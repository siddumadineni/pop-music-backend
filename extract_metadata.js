// Script to extract metadata from all audio files in Songs/ and write to songs_metadata.json (no upload)
const fs = require('fs');
const path = require('path');
const { parseFile } = require('music-metadata');
const { v4: uuidv4 } = require('uuid');

const MUSIC_FOLDER = path.resolve(__dirname, 'Songs');
const METADATA_FILE = path.resolve(__dirname, 'songs_metadata.json');

async function extractAllMetadata() {
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
      // No upload, just use fileName as songUrl
      const songMeta = {
        id: `${albumId}${trackNum.toString().padStart(2, '0')}`,
        albumId,
        album,
        artist,
        title,
        fileName,
      };
      songs.push(songMeta);
      console.log(`Extracted: ${fileName}`);
    } catch (err) {
      console.error(`Error extracting ${fileName}:`, err.message);
    }
  }
  fs.writeFileSync(METADATA_FILE, JSON.stringify(songs, null, 2));
  console.log(`\nAll done! Metadata saved to ${METADATA_FILE}`);
}

extractAllMetadata();
