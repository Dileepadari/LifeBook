import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, uid } from '../db.js';
import { createUser, verifyLogin, signToken, publicUser, requireAuth } from '../auth.js';
import { STARTER_HABITS } from '../seed.js';

export const authRoutes = Router();

authRoutes.post('/signup', (req, res) => {
  const { email, username, password, display_name } = req.body || {};
  if (!email || !username || !password) return res.status(400).json({ error: 'Email, username and password are required.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-32 characters, letters, numbers, dot, dash or underscore.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'That does not look like an email address.' });

  const user = createUser({ email, username, password, display_name });
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRoutes.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = verifyLogin(username || '', password || '');
  if (!user) return res.status(401).json({ error: 'Wrong username or password.' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRoutes.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

authRoutes.patch('/me', requireAuth, (req, res) => {
  const { display_name, bio, avatar_url, email } = req.body || {};
  const fields = [];
  const values = [];
  if (display_name !== undefined) { fields.push('display_name = ?'); values.push(display_name); }
  if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
  if (avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(avatar_url); }
  if (email !== undefined) { fields.push('email = ?'); values.push(email); }
  if (fields.length) {
    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

authRoutes.post('/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  if (!bcrypt.compareSync(current || '', req.user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  if (!next || String(next).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id);
  res.json({ ok: true });
});

// --- profile / onboarding ---

authRoutes.get('/profile', requireAuth, (req, res) => {
  res.json({ profile: db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id) });
});

authRoutes.put('/profile', requireAuth, (req, res) => {
  const p = req.body || {};
  const existing = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id) || {};
  const merged = {
    persona: p.persona ?? existing.persona,
    academic_goal: p.academic_goal ?? existing.academic_goal,
    personal_goal: p.personal_goal ?? existing.personal_goal,
    chronotype: p.chronotype ?? existing.chronotype,
    target_deep_work: p.target_deep_work ?? existing.target_deep_work ?? 4,
    target_sleep: p.target_sleep ?? existing.target_sleep ?? 7.5,
    target_screen_time: p.target_screen_time ?? existing.target_screen_time ?? 2,
    exam_date: p.exam_date ?? existing.exam_date,
    institution: p.institution ?? existing.institution,
    onboarded_at: p.complete ? new Date().toISOString() : existing.onboarded_at,
  };

  db.prepare(
    `UPDATE profiles SET persona=@persona, academic_goal=@academic_goal, personal_goal=@personal_goal,
       chronotype=@chronotype, target_deep_work=@target_deep_work, target_sleep=@target_sleep,
       target_screen_time=@target_screen_time, exam_date=@exam_date, institution=@institution,
       onboarded_at=@onboarded_at
     WHERE user_id=@user_id`,
  ).run({ ...merged, user_id: req.user.id });

  // Completing onboarding seeds the persona's starter habits, but only once
  // and only if the user has none - re-running onboarding shouldn't duplicate.
  if (p.complete && !existing.onboarded_at) {
    const count = db.prepare('SELECT COUNT(*) n FROM habits WHERE user_id = ?').get(req.user.id).n;
    if (count === 0) {
      const starters = STARTER_HABITS[merged.persona] || STARTER_HABITS.organized_learner;
      const insert = db.prepare('INSERT INTO habits (id, user_id, name, icon, target_days) VALUES (?, ?, ?, ?, ?)');
      starters.forEach((h) => insert.run(uid(), req.user.id, h.name, h.icon, h.target_days));
    }
  }

  res.json({ profile: db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id) });
});

// --- settings ---

// ai_key is write-only: the browser can set it but never reads it back. It is
// replaced with a boolean + masked hint so Settings can show "a key is saved"
// without the key ever re-entering a page that might get screenshotted.
authRoutes.get('/settings', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  const { ai_key, ...rest } = s;
  res.json({
    settings: {
      ...rest,
      has_ai_key: Boolean(ai_key),
      ai_key_hint: ai_key ? `${ai_key.slice(0, 7)}...${ai_key.slice(-4)}` : null,
    },
  });
});

authRoutes.patch('/settings', requireAuth, (req, res) => {
  const allowed = ['theme', 'palette', 'ai_provider', 'ai_key', 'ai_model', 'notify_daily_page', 'notify_streaks', 'notify_challenges'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (req.body?.[key] === undefined) continue;
    // Empty string clears the key rather than storing ''.
    const value = key === 'ai_key' && req.body[key] === '' ? null : req.body[key];
    fields.push(`${key} = ?`);
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
  }
  if (fields.length) {
    values.push(req.user.id);
    db.prepare(`UPDATE settings SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);
  }
  const s = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  const { ai_key, ...rest } = s;
  res.json({ settings: { ...rest, has_ai_key: Boolean(ai_key), ai_key_hint: ai_key ? `${ai_key.slice(0, 7)}...${ai_key.slice(-4)}` : null } });
});

// --- account-level actions ---

/** Full export of everything this user owns, as one JSON document. */
authRoutes.get('/export', requireAuth, (req, res) => {
  const tables = [
    'profiles', 'settings', 'tasks', 'study_sessions', 'resources', 'decks', 'flashcards',
    'mind_maps', 'quizzes', 'quiz_attempts', 'habits', 'habit_logs', 'challenge_enrollments',
    'challenge_progress', 'wellness_logs', 'moods', 'journal_entries', 'lifepages',
    'print_orders', 'goal_visions', 'sos_contacts', 'user_badges', 'saved_posts', 'saved_motivation',
  ];
  const data = {};
  for (const t of tables) {
    data[t] = db.prepare(`SELECT * FROM ${t} WHERE user_id = ?`).all(req.user.id);
  }
  // Never include the key material in an export the user might email around.
  if (data.settings?.[0]) delete data.settings[0].ai_key;
  data.user = publicUser(req.user);
  res.setHeader('Content-Disposition', `attachment; filename="lifebook-export-${req.user.username}.json"`);
  res.json({ exported_at: new Date().toISOString(), ...data });
});

authRoutes.delete('/me', requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!bcrypt.compareSync(password || '', req.user.password_hash)) {
    return res.status(400).json({ error: 'Password is incorrect.' });
  }
  // Every user-owned table declares ON DELETE CASCADE, so this is sufficient.
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});
