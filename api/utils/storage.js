const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const r2AccountId = process.env.R2_ACCOUNT_ID || '';
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const r2Bucket = process.env.R2_BUCKET || '';
const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL || '';

const r2Enabled = Boolean(r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2Bucket);

const r2Client = r2Enabled ? new S3Client({
  region: 'auto',
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey
  },
  forcePathStyle: true
}) : null;

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '');
}

function getPublicBaseUrl() {
  if (!r2Enabled) return '';
  if (r2PublicBaseUrl) return normalizeBaseUrl(r2PublicBaseUrl);
  return normalizeBaseUrl(`https://${r2AccountId}.r2.cloudflarestorage.com/${r2Bucket}`);
}

function buildPublicUrl(key) {
  const base = getPublicBaseUrl();
  return base ? `${base}/${key}` : '';
}

function generateFilename(ext) {
  const suffix = crypto.randomBytes(3).toString('hex');
  return `gallery-${Date.now()}-${suffix}.${ext}`;
}

async function saveGalleryImage({ buffer, mime, ext }) {
  const filename = generateFilename(ext);

  if (!r2Enabled) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'gallery');
    fs.mkdirSync(uploadDir, { recursive: true });
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, buffer);
    return { filename, storageKey: null, url: '' };
  }

  const storageKey = `gallery/${filename}`;
  await r2Client.send(new PutObjectCommand({
    Bucket: r2Bucket,
    Key: storageKey,
    Body: buffer,
    ContentType: mime
  }));

  return { filename, storageKey, url: buildPublicUrl(storageKey) };
}

async function deleteGalleryImage({ filename, storageKey }) {
  if (r2Enabled && storageKey) {
    try {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: r2Bucket,
        Key: storageKey
      }));
    } catch (err) {
      console.error('Failed to delete R2 object:', err);
    }
    return;
  }

  const filepath = path.join(__dirname, '..', 'uploads', 'gallery', filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

function attachPublicUrl(photo) {
  if (!photo || photo.url) return photo;
  if (!r2Enabled || !photo.storage_key) return photo;
  return { ...photo, url: buildPublicUrl(photo.storage_key) };
}

module.exports = {
  r2Enabled,
  saveGalleryImage,
  deleteGalleryImage,
  attachPublicUrl
};
