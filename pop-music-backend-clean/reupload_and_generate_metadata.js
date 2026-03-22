// Script to upload all music files to Cloudflare R2, replace existing files, extract metadata, and generate songs_metadata.json with public URLs and artist info
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const { parseFile } = require('music-metadata');

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

const MUSIC_FOLDER = path.resolve(__dirname, 'Songs');
const COVERS_FOLDER = path.resolve(__dirname, 'covers');
const METADATA_FILE = path.resolve(__dirname, 'songs_metadata.json');
const R2_BASE = 'https://pub-344fcfefabee44c9b43923f4d1ced1f3.r2.dev';

async function uploadFileToR2(localPath, r2Key) {
  const fileStream = fs.createReadStream(localPath);
  await s3.upload({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: fileStream,
    ACL: 'public-read',
    ContentType: undefined, // Let AWS guess
  }).promise();
  return `${R2_BASE}/${r2Key}`;
}

async function main() {
  const files = fs.readdirSync(MUSIC_FOLDER).filter(f => /\.(mp3|flac|wav|m4a)$/i.test(f));
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
      const songId = `${albumId}${trackNum.toString().padStart(2, '0')}`;
      // Upload song file (replace if exists)
      const songR2Key = `songs/${fileName}`;
      const songUrl = await uploadFileToR2(filePath, songR2Key);
      // Upload cover (replace if exists, one per album)
      let coverUrl = '';
      const coverFile = path.join(COVERS_FOLDER, `${albumId}.jpg`);
      if (fs.existsSync(coverFile)) {
        const coverR2Key = `covers/${albumId}.jpg`;
        coverUrl = await uploadFileToR2(coverFile, coverR2Key);
      } else {
        coverUrl = `${R2_BASE}/covers/${albumId}.jpg`; // fallback, may 404
      }
      // Add song metadata
      songs.push({
        id: songId,
        albumId,
        album,
        artist,
        title,
        fileName,
        songUrl,
        coverUrl
      });
      console.log(`Uploaded: ${fileName}`);
    } catch (err) {
      console.error(`Error processing ${fileName}:`, err.message);
    }
  }
  fs.writeFileSync(METADATA_FILE, JSON.stringify(songs, null, 2));
  console.log(`\nAll done! Metadata saved to ${METADATA_FILE}`);
}

main();
