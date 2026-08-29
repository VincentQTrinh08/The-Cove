/* Meets: the calendar, per-swimmer event requests, and meet photos.
 * Mirrors components/meets/meets.js on the frontend.
 *
 * A "request" is the swimmer's ask, not the official entry — a
 * coach still sets the real lineup using GET /api/meets/:id/requests
 * to see what everyone asked for.
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

const MAX_EVENTS_PER_MEET = 4;

// ---- Meets ----

// GET /api/meets
router.get('/', (req, res) => {
  const meets = db.all('meets').sort((a, b) => a.date.localeCompare(b.date));
  res.json(meets);
});

// POST /api/meets  (coach creates a meet)
// body: { name, location, date: 'YYYY-MM-DD', entryDeadline: 'YYYY-MM-DD' }
router.post('/', (req, res) => {
  const { name, location, date, entryDeadline } = req.body || {};
  if (!name || !location || !date || !entryDeadline) {
    return res.status(400).json({ error: 'name, location, date, and entryDeadline are required' });
  }
  const meet = db.insert('meets', { name, location, date, entryDeadline });
  res.status(201).json(meet);
});

// ---- Event requests ----

// GET /api/meets/:id/requests  (coach-facing: everyone's request for this meet)
router.get('/:id/requests', (req, res) => {
  const meetId = Number(req.params.id);
  const requests = db.filter('meetRequests', (r) => r.meetId === meetId);
  res.json(requests);
});

// GET /api/swimmers/:id/meet-requests  (swimmer-facing: their own requests, mounted below)
function swimmerRequests(req, res) {
  const swimmerId = Number(req.params.id);
  const requests = db.filter('meetRequests', (r) => r.swimmerId === swimmerId);
  res.json(requests);
}

// POST /api/meets/:id/requests
// body: { swimmerId, events: string[] (max 4), notes? }
router.post('/:id/requests', (req, res) => {
  const meetId = Number(req.params.id);
  const { swimmerId, events, notes } = req.body || {};
  if (!swimmerId || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'swimmerId and a non-empty events array are required' });
  }
  if (events.length > MAX_EVENTS_PER_MEET) {
    return res.status(400).json({ error: `events cannot exceed ${MAX_EVENTS_PER_MEET}` });
  }

  const request = db.upsert(
    'meetRequests',
    (r) => r.meetId === meetId && r.swimmerId === Number(swimmerId),
    { meetId, swimmerId: Number(swimmerId), events, notes: notes || '', submittedAt: new Date().toISOString() }
  );
  res.status(201).json(request);
});

// ---- Photos ----

// GET /api/meets/:id/photos
router.get('/:id/photos', (req, res) => {
  const meetId = Number(req.params.id);
  const photos = db.filter('meetPhotos', (p) => p.meetId === meetId);
  res.json(photos);
});

// POST /api/meets/:id/photos  (multipart/form-data: photo, uploadedByUserId, caption?)
router.post('/:id/photos', upload.single('photo'), (req, res) => {
  const meetId = Number(req.params.id);
  const { uploadedByUserId, caption } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'photo file is required (field name "photo")' });
  if (!uploadedByUserId) return res.status(400).json({ error: 'uploadedByUserId is required' });

  const photo = db.insert('meetPhotos', {
    meetId,
    uploadedByUserId: Number(uploadedByUserId),
    caption: caption || '',
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
  });
  res.status(201).json(photo);
});

module.exports = { router, swimmerRequests };
