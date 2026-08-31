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

// ---- Volunteer slots ----
// A coach posts roles they need covered for a meet (timers, hospitality,
// concessions, etc.) with how many people each role needs; anyone
// signs up by name — no login/parent-linking required, matching how
// loose the rest of this prototype's auth is.

// GET /api/meets/:id/volunteer-slots  (slots + who's signed up for each)
router.get('/:id/volunteer-slots', (req, res) => {
  const meetId = Number(req.params.id);
  const slots = db.filter('volunteerSlots', (s) => s.meetId === meetId);
  const signups = db.all('volunteerSignups');
  res.json(slots.map((slot) => ({
    ...slot,
    signups: signups.filter((su) => su.slotId === slot.id),
  })));
});

// POST /api/meets/:id/volunteer-slots  (coach creates a role)
// body: { role, slotsNeeded, notes? }
router.post('/:id/volunteer-slots', (req, res) => {
  const meetId = Number(req.params.id);
  const { role, slotsNeeded, notes } = req.body || {};
  if (!role || !Number.isFinite(Number(slotsNeeded)) || Number(slotsNeeded) < 1) {
    return res.status(400).json({ error: 'role and a positive slotsNeeded are required' });
  }
  const slot = db.insert('volunteerSlots', { meetId, role, slotsNeeded: Number(slotsNeeded), notes: notes || '' });
  res.status(201).json({ ...slot, signups: [] });
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

// ---- Volunteer slot signup / cancel / delete ----
// Mounted separately in server.js (not under /api/meets/:id) since
// these act on a slot directly, the same way swimmerRequests does.

// DELETE /api/volunteer-slots/:id  (coach removes a role — also clears its signups)
function deleteVolunteerSlot(req, res) {
  const slotId = Number(req.params.id);
  const removed = db.remove('volunteerSlots', slotId);
  if (!removed) return res.status(404).json({ error: 'Volunteer slot not found' });
  db.filter('volunteerSignups', (su) => su.slotId === slotId)
    .forEach((su) => db.remove('volunteerSignups', su.id));
  res.json({ ok: true });
}

// POST /api/volunteer-slots/:id/signup   body: { name }
function volunteerSignup(req, res) {
  const slotId = Number(req.params.id);
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const slot = db.find('volunteerSlots', (s) => s.id === slotId);
  if (!slot) return res.status(404).json({ error: 'Volunteer slot not found' });

  const existingSignups = db.filter('volunteerSignups', (su) => su.slotId === slotId);
  if (existingSignups.some((su) => su.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Already signed up for this slot' });
  }
  if (existingSignups.length >= slot.slotsNeeded) {
    return res.status(409).json({ error: 'This role is already full' });
  }

  const signup = db.insert('volunteerSignups', { slotId, name: name.trim(), signedUpAt: new Date().toISOString() });
  res.status(201).json(signup);
}

// DELETE /api/volunteer-slots/:id/signup/:signupId
function volunteerCancelSignup(req, res) {
  const signupId = Number(req.params.signupId);
  const removed = db.remove('volunteerSignups', signupId);
  if (!removed) return res.status(404).json({ error: 'Signup not found' });
  res.json({ ok: true });
}

module.exports = { router, swimmerRequests, deleteVolunteerSlot, volunteerSignup, volunteerCancelSignup };
