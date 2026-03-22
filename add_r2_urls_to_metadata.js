// Script to add songUrl and coverUrl to songs_metadata.json using known R2 public URL patterns
const fs = require('fs');
const path = require('path');

const metadataPath = path.join(__dirname, 'songs_metadata.json');
const data = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

// Set your public R2 base URL here
const R2_BASE = 'https://pub-344fcfefabee44c9b43923f4d1ced1f3.r2.dev';

for (const song of data) {
  // Add songUrl (assume all files are in /songs/ and use fileName)
  song.songUrl = `${R2_BASE}/songs/${encodeURIComponent(song.fileName)}`;
  // Add coverUrl (assume covers are named by albumId.jpg in /covers/)
  song.coverUrl = `${R2_BASE}/covers/${song.albumId}.jpg`;
}

fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
console.log('Added songUrl and coverUrl to all songs in songs_metadata.json.');
