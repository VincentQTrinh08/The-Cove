# Splash backend

A small Express API that gives the Splash frontend real, persistent
storage instead of each tab quietly saving to the browser's
localStorage. This is the first step toward real accounts — it does
**not** include authentication yet (see "Adding real auth next"
below). Every route currently trusts whatever id you send it.

## Running it

```
npm install
node seed.js      # only needed once, populates a coach/swimmers/meets to try things with
node server.js
```

The API listens on `http://localhost:3001`. Health check:
`GET /api/health` → `{"ok": true}`.

## Data storage

Data lives as JSON files in `data/` (one file per "table" — users,
meets, weekLogs, etc.), written atomically on every change. No
database server to install, nothing native to compile — good enough
to prove persistence works and to develop against locally. When it's
time to actually deploy this somewhere real, swap `db.js` for a real
database (Postgres is the usual choice); every route calls the same
handful of functions in `db.js` (`all`, `find`, `filter`, `insert`,
`upsert`, `update`, `remove`), so that's the only file that has to
change.

Uploaded meet photos are saved to `data/uploads/` and served back out
at `/uploads/<filename>`.

## Users and roles

Three roles, matching how the app is meant to work: `swimmer`,
`parent`, `coach`. A parent is linked to their swimmer(s) via the
`parentLinks` table (`GET /api/users/:id/swimmers` returns a parent's
linked swimmers). There's no login yet — see below.

## Endpoints

| Method | Path | What it's for |
|---|---|---|
| GET | `/api/users?role=swimmer` | List users, optionally by role |
| POST | `/api/users` | Create a user (`{name, role, group?, swimmerIds?}`) |
| GET | `/api/users/:id/swimmers` | A parent's linked swimmers |
| GET | `/api/swimmers/:id/week-log` | This Week's logged yardage for a swimmer |
| POST | `/api/swimmers/:id/week-log` | Log yardage for a date (`{date, yards}`) |
| GET | `/api/swimmers/:id/away-workouts` | Away Workouts completion log |
| POST | `/api/swimmers/:id/away-workouts` | Log a workout done (`{week, workoutId}`) |
| GET | `/api/meets` | List meets |
| POST | `/api/meets` | Create a meet (coach) |
| GET | `/api/meets/:id/photos` | Photos for a meet |
| POST | `/api/meets/:id/photos` | Upload a photo (multipart: `photo`, `uploadedByUserId`, `caption?`) |
| GET | `/api/swimmers/:id/away-workouts` | Away Workouts completion log |
| POST | `/api/swimmers/:id/away-workouts` | Log a workout done (`{week, workoutId}`) |
| GET | `/api/practice-plan` | The team's standing Tue/Wed practice overrides |
| PUT | `/api/practice-plan/:dow` | Coach updates one weekday (`{focus, targetYards}`) |

## Scope: what The Cove does vs. SwimTopia

THPRD purchased SwimTopia for team ops — registration, meet entries/
RSVPs, volunteer job-board management, and team communications. The
Cove intentionally doesn't duplicate any of that anymore: event
requests, volunteer sign-ups, and Coach's Message were removed (along
with their backend routes) since SwimTopia already covers them. The
Cove's Meets tab is now read-only — calendar, name, date, location,
entry deadline — pointing people at when things are rather than
handling entries or volunteers itself. What's left is the stuff
SwimTopia doesn't do: daily training logs, away workouts, the stroke
library, and team media.

## Wiring status

Every remaining frontend component talks to this backend directly
instead of `localStorage` — This Week, Away Workouts, Meets (read-only
calendar/listing), and Team Roster. There's no `TODO(sync)` left in
`index.html`.

One thing worth knowing: this store is plain JSON files under
`data/` on whatever filesystem the server runs on (see "Data storage"
above). On a host like Railway, a fresh deploy typically rebuilds the
container from git — so anything written through the live API since
the last commit (a new roster entry, a logged workout, a practice-plan
edit) won't survive a redeploy unless it's also been committed to
`data/*.json`, or the host is configured with a persistent volume
mounted at `data/`. Worth confirming before relying on same-day data
surviving a deploy.

## Adding real auth next

This backend is deliberately not doing auth yet, per the decision to
get data persisting first. The pieces are already shaped for it:

1. Add a password hash (or a magic-link token) column to `users`.
2. Add login/signup routes and issue a session token or JWT.
3. Add middleware that reads that token and sets `req.user`.
4. Replace the `:id` params that routes currently trust blindly
   (e.g. `POST /api/swimmers/:id/week-log`) with a check that
   `req.user` is actually that swimmer, or a parent linked to them,
   or a coach.

Nothing about the data layer or the route shapes needs to change for
that — auth slots in as middleware in front of what's already here.
