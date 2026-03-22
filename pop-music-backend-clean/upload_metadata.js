// Script to upload songs_metadata.json to Cloudflare R2 as a public file
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const fs = require('fs');
const AWS = require('aws-sdk');

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

const metadataPath = path.join(__dirname, 'songs_metadata.json');
const r2Key = 'songs_metadata.json'; // This will be the public file name in your bucket

async function uploadMetadata() {
    console.log('DEBUG: R2_BUCKET value is:', process.env.R2_BUCKET);
  const fileStream = fs.createReadStream(metadataPath);
  await s3.upload({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: fileStream,
    ContentType: 'application/json',
    ACL: 'public-read', // Make it public
  }).promise();
  console.log('songs_metadata.json uploaded to R2 as public file!');
  console.log(`Public URL: https://pub-344fcfefabee44c9b43923f4d1ced1f3.r2.dev/songs_metadata.json`);
}

uploadMetadata().catch(console.error);
