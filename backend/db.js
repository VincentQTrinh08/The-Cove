/* Splash backend — data layer
 *
 * A small JSON-file-backed store. No native modules, nothing to
 * compile — good enough to make data actually persist across
 * restarts and across devices (which is the whole point right now)
 * without committing to a real database engine before we know we
 * need one. Swapping this for Postgres/SQLite later only means
 * rewriting this one file — every route calls these same functions.
 *
 * Each "table" is a JSON file under data/<table>.json holding
 * { nextId: number, rows: [...] }.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function tablePath(table) {
  return path.join(DATA_DIR, `${table}.json`);
}

function ensureTable(table) {
  const file = tablePath(table);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({ nextId: 1, rows: [] }, null, 2));
  }
}

function readTable(table) {
  ensureTable(table);
  const raw = fs.readFileSync(tablePath(table), 'utf8');
  return JSON.parse(raw);
}

// Atomic-ish write: write to a temp file then rename over the real
// one, so a crash mid-write can't leave a half-written JSON file.
function writeTable(table, data) {
  const file = tablePath(table);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function all(table) {
  return readTable(table).rows;
}

function find(table, predicate) {
  return readTable(table).rows.find(predicate);
}

function filter(table, predicate) {
  return readTable(table).rows.filter(predicate);
}

function insert(table, row) {
  const data = readTable(table);
  const record = { id: data.nextId, ...row };
  data.rows.push(record);
  data.nextId += 1;
  writeTable(table, data);
  return record;
}

// Insert-or-update by a matching predicate (used for "log this
// workout" actions where re-logging should overwrite, not duplicate).
function upsert(table, predicate, row) {
  const data = readTable(table);
  const idx = data.rows.findIndex(predicate);
  if (idx === -1) {
    const record = { id: data.nextId, ...row };
    data.rows.push(record);
    data.nextId += 1;
    writeTable(table, data);
    return record;
  }
  data.rows[idx] = { ...data.rows[idx], ...row };
  writeTable(table, data);
  return data.rows[idx];
}

function update(table, id, patch) {
  const data = readTable(table);
  const idx = data.rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  data.rows[idx] = { ...data.rows[idx], ...patch };
  writeTable(table, data);
  return data.rows[idx];
}

function remove(table, id) {
  const data = readTable(table);
  const before = data.rows.length;
  data.rows = data.rows.filter((r) => r.id !== id);
  writeTable(table, data);
  return data.rows.length < before;
}

module.exports = { all, find, filter, insert, upsert, update, remove };
