/* Team Media: photos from practices and meets, uploaded by anyone
 * (mainly parents) from their phone or camera roll. Separate from the
 * per-meet "Meet Photos" grid in routes/meets.js — this is the
 * team-wide gallery, not scoped to one meet's page.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per photo
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image uploads are allowed'));
    cb(null, true);
  },
});

// GET /api/photos?occasion=practice|meet&meetId=fall-invite
router.get('/', (req, res) => {
  const { occasion, meetId } = req.query;
  let photos = db.all('photos');
  if (occasion) photos = photos.filter((p) => p.occasion === occasion);
  if (meetId) photos = photos.filter((p) => p.meetId === meetId);
  photos.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  res.json(photos);
});

// POST /api/photos
// multipart/form-data: photo, uploadedByName, occasion ('practice'|'meet'), meetId? (required if occasion is 'meet'), caption?
//
// Takes a display name rather than a user id — the prototype sign-in
// (see the sign-in script at the bottom of index.html) only ever
// captures a name + role locally, with no backend account behind it,
// so there's no real user id to attach here yet. Once sign-in has
// real accounts (see splash-backend README "Adding real auth next"),
// swap this for uploadedByUserId like routes/meets.js photos use.
router.post('/', upload.single('photo'), (req, res) => {
  const { uploadedByName, occasion, meetId, caption } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'photo file is required (field name "photo")' });
  if (!uploadedByName) return res.status(400).json({ error: 'uploadedByName is required' });
  if (occasion !== 'practice' && occasion !== 'meet') {
    return res.status(400).json({ error: "occasion must be 'practice' or 'meet'" });
  }
  if (occasion === 'meet' && !meetId) {
    return res.status(400).json({ error: 'meetId is required when occasion is "meet"' });
  }

  const photo = db.insert('photos', {
    uploadedByName,
    occasion,
    meetId: occasion === 'meet' ? meetId : null,
    caption: caption || '',
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
  });
  res.status(201).json(photo);
});

// DELETE /api/photos/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const photo = db.find('photos', (p) => p.id === id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const ok = db.remove('photos', id);
  if (ok) {
    fs.unlink(path.join(UPLOAD_DIR, photo.filename), () => {});
  }
  res.status(204).end();
});

module.exports = router;
