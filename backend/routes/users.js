/* Users: swimmers, parents, and coaches.
 *
 * No authentication yet (see README) — these routes just manage
 * records. A parent is linked to one or more swimmers via the
 * parentLinks table so a parent's app view can pull up their kid(s).
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

const VALID_ROLES = ['swimmer', 'parent', 'coach'];

// GET /api/users?role=swimmer
router.get('/', (req, res) => {
  const { role } = req.query;
  const users = role ? db.filter('users', (u) => u.role === role) : db.all('users');
  res.json(users);
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const user = db.find('users', (u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users
// body: { name, role, group?  (swimmers only), swimmerIds? (parents only, existing swimmer user ids) }
router.post('/', (req, res) => {
  const { name, role, group, swimmerIds } = req.body || {};
  if (!name || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `name is required and role must be one of ${VALID_ROLES.join(', ')}` });
  }

  const user = db.insert('users', { name, role, group: group || null });

  if (role === 'parent' && Array.isArray(swimmerIds)) {
    swimmerIds.forEach((swimmerId) => {
      const swimmer = db.find('users', (u) => u.id === Number(swimmerId) && u.role === 'swimmer');
      if (swimmer) {
        db.insert('parentLinks', { parentId: user.id, swimmerId: swimmer.id });
      }
    });
  }

  res.status(201).json(user);
});

// GET /api/users/:id/swimmers  (for a parent: the swimmer(s) linked to them)
router.get('/:id/swimmers', (req, res) => {
  const parentId = Number(req.params.id);
  const links = db.filter('parentLinks', (l) => l.parentId === parentId);
  const swimmers = links
    .map((l) => db.find('users', (u) => u.id === l.swimmerId))
    .filter(Boolean);
  res.json(swimmers);
});

// PATCH /api/users/:id
// body: { name?, group?, swimmerIds? (parents only — replaces their linked swimmers) }
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.find('users', (u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, group, swimmerIds } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (group !== undefined) patch.group = group || null;
  const updated = db.update('users', id, patch);

  if (user.role === 'parent' && Array.isArray(swimmerIds)) {
    db.filter('parentLinks', (l) => l.parentId === id).forEach((l) => db.remove('parentLinks', l.id));
    swimmerIds.forEach((swimmerId) => {
      const swimmer = db.find('users', (u) => u.id === Number(swimmerId) && u.role === 'swimmer');
      if (swimmer) db.insert('parentLinks', { parentId: id, swimmerId: swimmer.id });
    });
  }

  res.json(updated);
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const ok = db.remove('users', id);
  if (!ok) return res.status(404).json({ error: 'User not found' });

  db.filter('parentLinks', (l) => l.parentId === id || l.swimmerId === id)
    .forEach((l) => db.remove('parentLinks', l.id));

  res.status(204).end();
});

module.exports = router;
