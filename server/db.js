/**
 * SQLite handle and the small helpers every module shares - id generation,
 * local-timezone dates and JSON column parsing. The schema is applied on every
 * boot, so a fresh checkout needs no migration step.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.LIFEBOOK_DB || path.join(here, 'data', 'lifebook.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

// Applied on every boot. schema.sql is entirely CREATE ... IF NOT EXISTS, so
// this doubles as the migration story: add a table or index to the file and it
// appears on next start. Column changes still need a hand-written ALTER.
db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

export const uid = () => crypto.randomUUID();

/** Today in the server's local timezone as YYYY-MM-DD. See schema.sql on why
 *  local rather than UTC. */
export function today() {
  return toDateString(new Date());
}

export function toDateString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD, n days before `from` (default today). */
export function daysAgo(n, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return toDateString(d);
}

/** Inclusive list of date strings from `start` to `end`. */
export function dateRange(start, end) {
  const out = [];
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (d <= last) {
    out.push(toDateString(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** JSON.parse that returns `fallback` instead of throwing - columns holding
 *  JSON arrays are nullable, and a malformed row shouldn't 500 a whole page. */
export function parseJSON(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
