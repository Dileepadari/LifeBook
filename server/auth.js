import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, uid } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// A deployment should set LIFEBOOK_JWT_SECRET. For local use we generate one
// once and persist it next to the database - without persisting it, every
// server restart would silently invalidate everyone's session, which reads as
// a bug rather than a security posture.
function resolveSecret() {
  if (process.env.LIFEBOOK_JWT_SECRET) return process.env.LIFEBOOK_JWT_SECRET;
  const file = path.join(here, 'data', '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const generated = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

const SECRET = resolveSecret();
const TOKEN_TTL = '30d';

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, SECRET, { expiresIn: TOKEN_TTL });
}

/** The public shape of a user. password_hash must never leave this module. */
export function publicUser(row) {
  if (!row) return null;
  const { password_hash: _hash, ...rest } = row;
  return rest;
}

export function createUser({ email, username, password, display_name }) {
  const existing = db
    .prepare('SELECT id FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)')
    .get(email, username);
  if (existing) throw Object.assign(new Error('That email or username is already registered.'), { status: 409 });

  const id = uid();
  db.prepare(
    `INSERT INTO users (id, email, username, password_hash, display_name)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, email.trim(), username.trim(), bcrypt.hashSync(password, 10), (display_name || username).trim());

  // Every user gets a settings row up front so the rest of the code can
  // assume it exists rather than upserting defensively on every read.
  db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(id);
  db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(id);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function verifyLogin(identifier, password) {
  const row = db
    .prepare('SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)')
    .get(identifier, identifier);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return null;
  return row;
}

/** Express middleware. Attaches req.user (full row) or 401s. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });

  req.user = user;
  next();
}
