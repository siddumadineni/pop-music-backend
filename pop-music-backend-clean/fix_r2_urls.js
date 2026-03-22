// Script to update songUrl and coverUrl in songs_metadata.json to use public R2.dev URLs
const fs = require('fs');
const path = require('path');

const metadataPath = path.join(__dirname, 'songs_metadata.json');

// Replace these with your actual values
const oldPrefix = 'https://015091fa95dcb957854c2203251d2c75.r2.cloudflarestorage.com/pop-music/';
const newPrefix = 'https://pub-344fcfefabee44c9b43923f4d1ced1f3.r2.dev/';

const data = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

for (const song of data) {
  if (song.songUrl && song.songUrl.startsWith(oldPrefix)) {
    song.songUrl = song.songUrl.replace(oldPrefix, newPrefix);
  }
  if (song.coverUrl && song.coverUrl.startsWith(oldPrefix)) {
    song.coverUrl = song.coverUrl.replace(oldPrefix, newPrefix);
  }
}

fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
console.log('Updated all songUrl and coverUrl fields to use public R2.dev URLs.');
