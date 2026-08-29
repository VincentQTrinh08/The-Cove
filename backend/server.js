/* Splash backend — entry point.
 *
 * No authentication yet (see README "Adding real auth next") — every
 * route trusts whatever id is passed in. That's fine for local
 * development and for wiring the frontend up to real persistence,
 * but this must not be deployed publicly as-is.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const usersRouter = require('./routes/users');
const weekLogsRouter = require('./routes/weekLogs');
const awayWorkoutsRouter = require('./routes/awayWorkouts');
const { router: meetsRouter, swimmerRequests } = require('./routes/meets');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Uploaded meet photos are served back out from here, e.g.
// GET /uploads/171234-abc.jpg
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

const db = require('./db');

app.get('/api/health', (req, res) => res.json({ ok: true }));

// All parent-swimmer links, for building a full roster view in one extra call.
app.get('/api/parent-links', (req, res) => res.json(db.all('parentLinks')));

app.use('/api/users', usersRouter);
app.use('/api', weekLogsRouter);      // /api/swimmers/:id/week-log
app.use('/api', awayWorkoutsRouter);  // /api/swimmers/:id/away-workouts
app.use('/api/meets', meetsRouter);   // /api/meets, /api/meets/:id/requests, /api/meets/:id/photos
app.get('/api/swimmers/:id/meet-requests', swimmerRequests);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`Splash backend listening on http://localhost:${PORT}`);
});
