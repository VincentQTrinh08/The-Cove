/* Away Workouts completion log, backed by real storage. Mirrors
 * components/away-workouts/away-workouts.js on the frontend: one
 * entry per swimmer per (season week, workout id).
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/swimmers/:id/away-workouts
router.get('/swimmers/:id/away-workouts', (req, res) => {
  const swimmerId = Number(req.params.id);
  const entries = db.filter('awayWorkoutLogs', (e) => e.swimmerId === swimmerId);
  res.json(entries);
});

// POST /api/swimmers/:id/away-workouts
// body: { week: number (1-10), workoutId: string }
router.post('/swimmers/:id/away-workouts', (req, res) => {
  const swimmerId = Number(req.params.id);
  const { week, workoutId } = req.body || {};
  if (!Number.isInteger(week) || week < 1 || week > 10 || !workoutId) {
    return res.status(400).json({ error: 'week (1-10) and workoutId are required' });
  }

  const entry = db.upsert(
    'awayWorkoutLogs',
    (e) => e.swimmerId === swimmerId && e.week === week && e.workoutId === workoutId,
    { swimmerId, week, workoutId, loggedAt: new Date().toISOString() }
  );
  res.status(201).json(entry);
});

module.exports = router;
