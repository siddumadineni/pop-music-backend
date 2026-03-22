// Script: Extract cover from each song, upload song and cover to R2, generate songs_metadata.json with public URLs and artist info
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const { parseFile } = require('music-metadata');

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

async function uploadFileToR2(localPath, r2Key, contentType) {
  const fileStream = fs.createReadStream(localPath);
  await s3.upload({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: fileStream,
    ACL: 'public-read',
    ContentType: contentType,
  }).promise();
  return `${R2_BASE}/${r2Key}`;
}

async function extractCoverAndSave(filePath, albumId) {
  const metadata = await parseFile(filePath);
  if (metadata.common.picture && metadata.common.picture.length > 0) {
    const cover = metadata.common.picture[0];
    const coverPath = path.join(COVERS_FOLDER, albumId);
    fs.writeFileSync(coverPath, cover.data);
    return coverPath;
  }
  return null;
}

async function main() {
  if (!fs.existsSync(COVERS_FOLDER)) fs.mkdirSync(COVERS_FOLDER);
  const files = fs.readdirSync(MUSIC_FOLDER).filter(f => /\.(mp3|flac|wav|m4a)$/i.test(f));
  let songs = [];
  let albumMap = {}; // albumName -> albumId
  let albumCounter = 1;
  let uploadedCovers = new Set();
  let albumsWithCovers = new Set();
  let albumsWithoutCovers = new Set();

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const filePath = path.join(MUSIC_FOLDER, fileName);
    try {
      const metadata = await parseFile(filePath);
      const title = metadata.common.title || path.parse(fileName).name;
      const album = metadata.common.album || 'Unknown Album';
      const artist = metadata.common.artist || 'Unknown Artist';
      // Assign albumId (still used for id, but not for cover)
      if (!albumMap[album]) {
        albumMap[album] = albumCounter++;
      }
      const albumId = albumMap[album];
      const trackNum = songs.filter(s => s.album === album).length + 1;
      const songId = `${albumId}${trackNum.toString().padStart(2, '0')}`;
      // Upload song file (replace if exists)
      const songR2Key = `songs/${fileName}`;
      const songUrl = await uploadFileToR2(filePath, songR2Key, metadata.format.mimeType || undefined);
      // Use album name (URL-encoded ONCE) for cover
      // Remove any accidental double encoding by decoding first, then encoding once
      function singleEncode(str) {
        try {
          return encodeURIComponent(decodeURIComponent(str));
        } catch (e) {
          return encodeURIComponent(str); // fallback if not encoded
        }
      }
      const albumCoverName = singleEncode(album) + '.jpg';
      let coverUrl = `${R2_BASE}/covers/${albumCoverName}`;
      if (!uploadedCovers.has(album)) {
        const coverPath = await extractCoverAndSave(filePath, albumCoverName);
        if (coverPath) {
          await uploadFileToR2(coverPath, `covers/${albumCoverName}`, 'image/jpeg');
          uploadedCovers.add(album);
          albumsWithCovers.add(album);
        } else {
          albumsWithoutCovers.add(album);
        }
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
  // Print albums missing covers
  if (albumsWithoutCovers.size > 0) {
    console.log('\nAlbums missing covers (add a .jpg with this album name, URL-encoded, to covers/):');
    for (const album of albumsWithoutCovers) {
      if (!albumsWithCovers.has(album)) {
        console.log('  -', album, '→', encodeURIComponent(album) + '.jpg');
      }
    }
  } else {
    console.log('\nAll albums have covers!');
  }
}

main();
