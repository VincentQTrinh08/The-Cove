/* This Week training log, backed by real storage instead of the
 * frontend's localStorage. Mirrors components/this-week-log/*.js on
 * the frontend: one entry per swimmer per date, yards logged.
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/swimmers/:id/week-log
router.get('/swimmers/:id/week-log', (req, res) => {
  const swimmerId = Number(req.params.id);
  const entries = db.filter('weekLogs', (e) => e.swimmerId === swimmerId);
  res.json(entries);
});

// POST /api/swimmers/:id/week-log
// body: { date: 'YYYY-MM-DD', yards: number }
// Re-logging the same date overwrites the previous entry.
router.post('/swimmers/:id/week-log', (req, res) => {
  const swimmerId = Number(req.params.id);
  const { date, yards } = req.body || {};
  if (!date || !Number.isFinite(Number(yards)) || Number(yards) <= 0) {
    return res.status(400).json({ error: 'date and a positive numeric yards are required' });
  }

  const entry = db.upsert(
    'weekLogs',
    (e) => e.swimmerId === swimmerId && e.date === date,
    { swimmerId, date, yards: Number(yards), loggedAt: new Date().toISOString() }
  );
  res.status(201).json(entry);
});

module.exports = router;
