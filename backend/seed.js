/* Seeds a few users and meets so the API has something to return on
 * first run. Safe to re-run — it skips seeding if users already
 * exist. Run with: node seed.js
 */

const db = require('./db');

const existing = db.all('users');
if (existing.length > 0) {
  console.log('Already seeded — skipping. Delete the data/*.json files to reset.');
  process.exit(0);
}

const coach = db.insert('users', { name: 'Coach Dana', role: 'coach', group: null });

const maya = db.insert('users', { name: 'Maya R.', role: 'swimmer', group: 'Senior' });
const jordan = db.insert('users', { name: 'Jordan T.', role: 'swimmer', group: 'Senior' });
const sam = db.insert('users', { name: 'Sam P.', role: 'swimmer', group: 'Age Group' });

const parent1 = db.insert('users', { name: "Maya's Parent", role: 'parent', group: null });
db.insert('parentLinks', { parentId: parent1.id, swimmerId: maya.id });

const meets = [
  { name: 'Fall Invitational', location: 'Westside Aquatic Center', date: '2026-09-13', entryDeadline: '2026-09-05' },
  { name: 'Age Group Championship', location: 'THPRD Aquatic Center', date: '2026-09-27', entryDeadline: '2026-09-19' },
  { name: 'October Relay Carnival', location: 'Sunset Swim Club', date: '2026-10-11', entryDeadline: '2026-10-03' },
  { name: 'Winter Kickoff Meet', location: 'THPRD Aquatic Center', date: '2026-11-08', entryDeadline: '2026-10-31' },
].map((m) => db.insert('meets', m));

db.insert('meetRequests', {
  meetId: meets[0].id,
  swimmerId: maya.id,
  events: ['50 Free', '100 Back'],
  notes: '',
  submittedAt: new Date().toISOString(),
});

db.insert('weekLogs', {
  swimmerId: maya.id,
  date: '2026-09-01',
  yards: 1200,
  loggedAt: new Date().toISOString(),
});

console.log('Seeded:');
console.log('  coach   ', coach);
console.log('  swimmers', [maya, jordan, sam].map((u) => `${u.id}:${u.name}`));
console.log('  parent  ', parent1);
console.log('  meets   ', meets.map((m) => `${m.id}:${m.name}`));
