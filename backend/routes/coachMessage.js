/* Coach's Message: one team-wide note + contact email, shown on the
 * Home tab to every swimmer and parent. There's only ever one — it's
 * not per-user — so this is a singleton record rather than a normal
 * list resource.
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/coach-message
router.get('/', (req, res) => {
  const message = db.find('coachMessage', () => true);
  res.json(message || null);
});

// PUT /api/coach-message
// body: { message, email?, updatedByName }
router.put('/', (req, res) => {
  const { message, email, updatedByName } = req.body || {};
  if (!message || !updatedByName) {
    return res.status(400).json({ error: 'message and updatedByName are required' });
  }

  const updated = db.upsert(
    'coachMessage',
    () => true,
    { message, email: email || '', updatedByName, updatedAt: new Date().toISOString() }
  );
  res.json(updated);
});

module.exports = router;
