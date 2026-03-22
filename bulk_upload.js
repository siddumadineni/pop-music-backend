// Bulk uploader for music files to Cloudflare R2
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const { parseFile } = require('music-metadata');
const { v4: uuidv4 } = require('uuid');

// Cloudflare R2 config from .env
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET;

const s3 = new AWS.S3({
  endpoint: R2_ENDPOINT,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
  region: 'auto',
});

// Helper: Generate song and album IDs
function generateSongId(albumId, trackNum) {
  return parseInt(`${albumId}${trackNum.toString().padStart(2, '0')}`);
}

// CONFIG: Set your music folder path here
const MUSIC_FOLDER = path.resolve(__dirname, 'Songs'); // CHANGE THIS
const METADATA_FILE = path.resolve(__dirname, 'songs_metadata.json');

async function uploadAllSongs() {
  const files = fs.readdirSync(MUSIC_FOLDER).filter(f => /\.(mp3|flac|wav)$/i.test(f));
  let songs = [];
  let albumMap = {}; // albumName -> albumId
  let albumCounter = 1;

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const filePath = path.join(MUSIC_FOLDER, fileName);
    try {
      const metadata = await parseFile(filePath);
      const title = metadata.common.title || path.parse(fileName).name;
      const album = metadata.common.album || 'Unknown Album';
      const artist = metadata.common.artist || 'Unknown Artist';
      // Assign albumId
      if (!albumMap[album]) {
        albumMap[album] = albumCounter++;
      }
      const albumId = albumMap[album];
      const trackNum = songs.filter(s => s.albumId === albumId).length + 1;
      const songId = generateSongId(albumId, trackNum);

      // Upload song
      const songKey = `songs/${songId}_${uuidv4()}${path.extname(fileName)}`;
      await s3.upload({
        Bucket: R2_BUCKET,
        Key: songKey,
        Body: fs.createReadStream(filePath),
        ContentType: metadata.format.mimeType || 'audio/mpeg',
      }).promise();
      const songUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${songKey}`;

      // Upload cover (if present)
      let coverUrl = null;
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const coverBuffer = metadata.common.picture[0].data;
        const coverMime = metadata.common.picture[0].format;
        const coverKey = `covers/${songId}_${uuidv4()}`;
        await s3.upload({
          Bucket: R2_BUCKET,
          Key: coverKey,
          Body: coverBuffer,
          ContentType: coverMime,
        }).promise();
        coverUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${coverKey}`;
      }

      // Save metadata
      const songMeta = {
        id: songId,
        albumId,
        album,
        artist,
        title,
        songUrl,
        coverUrl,
        fileName,
      };
      songs.push(songMeta);
      console.log(`Uploaded: ${fileName} -> ${songUrl}`);
    } catch (err) {
      console.error(`Error uploading ${fileName}:`, err.message);
    }
  }
  fs.writeFileSync(METADATA_FILE, JSON.stringify(songs, null, 2));
  console.log(`\nAll done! Metadata saved to ${METADATA_FILE}`);
}

uploadAllSongs();
