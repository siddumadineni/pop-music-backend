require('dotenv').config();
// Backend entry point for Pop Music App
const express = require('express');
const multer = require('multer');
const { parseFile } = require('music-metadata');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// TODO: Configure Cloudflare R2 credentials here
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'YOUR_R2_ACCESS_KEY_ID';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'YOUR_R2_SECRET_ACCESS_KEY';
const R2_ENDPOINT = process.env.R2_ENDPOINT || 'YOUR_R2_ENDPOINT';
const R2_BUCKET = process.env.R2_BUCKET || 'YOUR_R2_BUCKET';

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;

// Configure AWS S3 client for Cloudflare R2
const s3 = new AWS.S3({
  endpoint: R2_ENDPOINT,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
  region: 'auto',
});

// In-memory DB (replace with real DB in production)
let songs = [];

// Helper: Generate song and album IDs
function generateSongId(albumId, trackNum) {
  return parseInt(`${albumId}${trackNum.toString().padStart(2, '0')}`);
}

// Upload song endpoint
app.post('/upload', upload.single('song'), async (req, res) => {
  try {
    const { albumId, title } = req.body;
    const file = req.file;
    if (!file || !albumId || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract cover image (if present)
    let coverBuffer = null;
    let coverMime = null;
    let trackNum = songs.filter(s => s.albumId === albumId).length + 1;
    let songId = generateSongId(albumId, trackNum);
    const metadata = await parseFile(file.path);
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      coverBuffer = metadata.common.picture[0].data;
      coverMime = metadata.common.picture[0].format;
    }

    // Upload song to R2
    const songKey = `songs/${songId}_${uuidv4()}${path.extname(file.originalname)}`;
    await s3.upload({
      Bucket: R2_BUCKET,
      Key: songKey,
      Body: fs.createReadStream(file.path),
      ContentType: file.mimetype,
    }).promise();
    const songUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${songKey}`;

    // Upload cover to R2 (if present)
    let coverUrl = null;
    if (coverBuffer) {
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
      title,
      songUrl,
      coverUrl,
    };
    songs.push(songMeta);

    // Cleanup
    fs.unlinkSync(file.path);

    res.json(songMeta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all songs

// Serve songs_metadata.json if it exists, otherwise fallback to in-memory songs
app.get('/songs', (req, res) => {
  const metadataPath = path.join(__dirname, 'songs_metadata.json');
  if (fs.existsSync(metadataPath)) {
    const data = fs.readFileSync(metadataPath, 'utf-8');
    try {
      const songsList = JSON.parse(data);
      return res.json(songsList);
    } catch (e) {
      return res.status(500).json({ error: 'Invalid songs_metadata.json format' });
    }
  }
  res.json(songs);
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
