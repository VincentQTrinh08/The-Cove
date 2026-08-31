/* Weekly practice plan overrides: a coach can retitle and re-target
 * the standing Tue/Wed practice template for the whole team. One
 * shared record per weekday (dow: 'Tue' | 'Wed') — not per-swimmer.
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/practice-plan  -> { Tue: { focus, targetYards }, Wed: {...} }
router.get('/', (req, res) => {
  const rows = db.all('practicePlan');
  const byDow = {};
  rows.forEach((r) => { byDow[r.dow] = { focus: r.focus, targetYards: r.targetYards }; });
  res.json(byDow);
});

// PUT /api/practice-plan/:dow   body: { focus, targetYards }
router.put('/:dow', (req, res) => {
  const dow = req.params.dow;
  const { focus, targetYards } = req.body || {};
  if (!focus || !Number.isFinite(Number(targetYards)) || Number(targetYards) <= 0) {
    return res.status(400).json({ error: 'focus and a positive numeric targetYards are required' });
  }

  const updated = db.upsert(
    'practicePlan',
    (r) => r.dow === dow,
    { dow, focus, targetYards: Number(targetYards) }
  );
  res.json(updated);
});

module.exports = router;
