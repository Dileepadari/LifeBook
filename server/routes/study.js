import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, uid, today, parseJSON } from '../db.js';
import { requireAuth } from '../auth.js';
import { evaluateBadges } from '../badges.js';
import * as ai from '../ai/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(here, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Files are stored under a per-user directory with a generated name; the
// original name is kept in the DB only. This means a crafted filename can
// never escape the upload root or collide with someone else's file.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(UPLOAD_DIR, req.user.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${uid()}${path.extname(file.originalname).slice(0, 12)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.log', '.rst', '.org',
  '.tex', '.html', '.htm', '.xml', '.yml', '.yaml',
]);

/**
 * Decide whether an upload is text we can feed to the AI generators, and
 * return its contents if so.
 *
 * The browser-supplied mimetype is not trustworthy - curl and several browsers
 * send application/octet-stream for a plain .md file - so the mimetype is only
 * one of three signals. Extension is checked too, and anything still ambiguous
 * is sniffed: a NUL byte or a high proportion of control characters means
 * binary, and we leave text_content null rather than storing mojibake.
 */
function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeLooksText = /^text\/|json|markdown|csv|xml|yaml/.test(file.mimetype || '');
  const extLooksText = TEXT_EXTENSIONS.has(ext);
  const knownBinary = /^(image|video|audio)\/|pdf|zip|officedocument|msword/.test(file.mimetype || '');

  if (knownBinary) return null;

  let buffer;
  try {
    buffer = fs.readFileSync(file.path);
  } catch {
    return null;
  }

  // Sniff the first 8KB: NULs never appear in UTF-8 text, and a run of control
  // characters means we are looking at a binary format the extension lied about.
  const sample = buffer.subarray(0, 8192);
  if (sample.includes(0)) return null;
  let controls = 0;
  for (const byte of sample) {
    if (byte < 9 || (byte > 13 && byte < 32)) controls += 1;
  }
  const looksText = sample.length === 0 || controls / sample.length < 0.02;

  if (!looksText) return null;
  if (!mimeLooksText && !extLooksText) return null;

  return buffer.toString('utf8').slice(0, 200_000);
}

export const studyRoutes = Router();
studyRoutes.use(requireAuth);

// ------------------------------------------------------------- sessions --

studyRoutes.post('/sessions', (req, res) => {
  const {
    subject, technique = 'pomodoro', planned_minutes = 25, actual_minutes = 0,
    focus_rating, distractions = 0, notes, date, started_at, ended_at,
  } = req.body || {};

  const id = uid();
  db.prepare(
    `INSERT INTO study_sessions
       (id, user_id, date, subject, technique, planned_minutes, actual_minutes, focus_rating, distractions, notes, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, req.user.id, date || today(), subject || null, technique,
    planned_minutes, actual_minutes, focus_rating ?? null, distractions, notes || null,
    started_at || null, ended_at || new Date().toISOString(),
  );

  const awarded = evaluateBadges(req.user.id);
  res.json({ session: db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(id), awarded });
});

studyRoutes.get('/sessions', (req, res) => {
  const { from, to, limit = 100 } = req.query;
  const rows = from && to
    ? db.prepare('SELECT * FROM study_sessions WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC').all(req.user.id, from, to)
    : db.prepare('SELECT * FROM study_sessions WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT ?').all(req.user.id, Number(limit));
  res.json({ data: rows });
});

studyRoutes.delete('/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM study_sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ------------------------------------------------------------ resources --

studyRoutes.post('/resources/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received.' });
  const id = uid();
  const relPath = `/uploads/${req.user.id}/${req.file.filename}`;

  const text = extractText(req.file);

  db.prepare(
    `INSERT INTO resources (id, user_id, name, category, subject, file_path, mime_type, size_bytes, text_content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, req.user.id, req.body.name || req.file.originalname, req.body.category || 'Notes',
    req.body.subject || null, relPath, req.file.mimetype, req.file.size, text,
  );

  const awarded = evaluateBadges(req.user.id);
  res.json({ resource: db.prepare('SELECT * FROM resources WHERE id = ?').get(id), awarded });
});

studyRoutes.delete('/resources/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM resources WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  if (row.file_path) {
    const abs = path.join(UPLOAD_DIR, req.user.id, path.basename(row.file_path));
    fs.rm(abs, { force: true }, () => {});
  }
  db.prepare('DELETE FROM resources WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

// ------------------------------------------------- flashcards (SM-2) --

studyRoutes.get('/cards/due', (req, res) => {
  const rows = db
    .prepare(
      `SELECT f.*, d.name AS deck_name FROM flashcards f
       JOIN decks d ON d.id = f.deck_id
       WHERE f.user_id = ? AND f.due_date <= ?
       ORDER BY f.due_date ASC LIMIT 60`,
    )
    .all(req.user.id, today());
  res.json({ data: rows });
});

studyRoutes.get('/decks/:id/cards', (req, res) => {
  res.json({
    data: db.prepare('SELECT * FROM flashcards WHERE user_id = ? AND deck_id = ? ORDER BY created_at').all(req.user.id, req.params.id),
  });
});

studyRoutes.post('/cards', (req, res) => {
  const { deck_id, front, back } = req.body || {};
  if (!deck_id || !front || !back) return res.status(400).json({ error: 'deck_id, front and back are required.' });
  const id = uid();
  db.prepare('INSERT INTO flashcards (id, user_id, deck_id, front, back) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, deck_id, front, back);
  res.json({ card: db.prepare('SELECT * FROM flashcards WHERE id = ?').get(id) });
});

studyRoutes.delete('/cards/:id', (req, res) => {
  db.prepare('DELETE FROM flashcards WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

/**
 * SM-2. Not on the /data gateway because the next due date is computed from
 * the card's current state - the client sends a grade, never an interval.
 * grade: 0 = again, 3 = hard, 4 = good, 5 = easy.
 */
studyRoutes.post('/cards/:id/review', (req, res) => {
  const card = db.prepare('SELECT * FROM flashcards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!card) return res.status(404).json({ error: 'Card not found.' });

  const grade = Math.max(0, Math.min(5, Number(req.body?.grade ?? 4)));
  let { ease, interval_days: interval, repetitions } = card;

  if (grade < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * ease);
    ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  }

  const due = new Date();
  due.setDate(due.getDate() + interval);
  const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;

  db.prepare(
    'UPDATE flashcards SET ease = ?, interval_days = ?, repetitions = ?, due_date = ?, last_reviewed = ? WHERE id = ?',
  ).run(ease, interval, repetitions, dueStr, today(), card.id);

  res.json({ card: db.prepare('SELECT * FROM flashcards WHERE id = ?').get(card.id) });
});

// ---------------------------------------------------------------- quiz --

studyRoutes.get('/quizzes/:id', (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order').all(quiz.id);
  res.json({
    quiz,
    // answer_index is withheld until the attempt is submitted - otherwise the
    // answers are sitting in the network tab of the page taking the test.
    questions: questions.map((q) => ({ id: q.id, prompt: q.prompt, options: parseJSON(q.options, []), sort_order: q.sort_order })),
  });
});

studyRoutes.post('/quizzes/:id/attempt', (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

  const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order').all(quiz.id);
  const responses = Array.isArray(req.body?.responses) ? req.body.responses : [];
  const score = questions.reduce((n, q, i) => n + (responses[i] === q.answer_index ? 1 : 0), 0);

  const id = uid();
  db.prepare(
    `INSERT INTO quiz_attempts (id, user_id, quiz_id, date, score, total, seconds_taken, responses)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.user.id, quiz.id, today(), score, questions.length, req.body?.seconds_taken ?? null, JSON.stringify(responses));

  const awarded = evaluateBadges(req.user.id);
  res.json({
    attempt: db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(id),
    review: questions.map((q, i) => ({
      prompt: q.prompt,
      options: parseJSON(q.options, []),
      answer_index: q.answer_index,
      chosen: responses[i] ?? null,
      correct: responses[i] === q.answer_index,
      explanation: q.explanation,
    })),
    awarded,
  });
});

studyRoutes.get('/quiz-attempts', (req, res) => {
  res.json({
    data: db
      .prepare(
        `SELECT a.*, q.title FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
         WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 50`,
      )
      .all(req.user.id),
  });
});

// ------------------------------------------------------ AI generation --

/** Resolves the text an AI generator should work from. */
function sourceText(userId, body) {
  if (body?.text?.trim()) return { text: body.text.trim(), resourceId: null, title: body.title || 'Pasted notes' };
  if (body?.resource_id) {
    const r = db.prepare('SELECT * FROM resources WHERE id = ? AND user_id = ?').get(body.resource_id, userId);
    if (!r) throw Object.assign(new Error('Resource not found.'), { status: 404 });
    if (!r.text_content) {
      throw Object.assign(
        new Error(`"${r.name}" has no readable text. Upload a .txt/.md file, or paste the text you want to work from.`),
        { status: 400 },
      );
    }
    return { text: r.text_content, resourceId: r.id, title: r.name };
  }
  throw Object.assign(new Error('Provide either text or a resource_id.'), { status: 400 });
}

studyRoutes.post('/generate/flashcards', async (req, res, next) => {
  try {
    const { text, resourceId, title } = sourceText(req.user.id, req.body);
    const count = Math.min(30, Math.max(3, Number(req.body?.count) || 10));
    const { result: cards, provider, degradedFrom, error } = await ai.generateFlashcards(req.user.id, text, count);

    if (!cards?.length) return res.status(422).json({ error: 'Could not derive any cards from that material.' });

    const deckId = uid();
    db.prepare('INSERT INTO decks (id, user_id, name, subject, resource_id, source) VALUES (?, ?, ?, ?, ?, ?)')
      .run(deckId, req.user.id, req.body?.deck_name || `${title} - cards`, req.body?.subject || null, resourceId, provider === 'builtin' ? 'manual' : 'ai');

    const insert = db.prepare('INSERT INTO flashcards (id, user_id, deck_id, front, back) VALUES (?, ?, ?, ?, ?)');
    db.transaction(() => cards.forEach((c) => insert.run(uid(), req.user.id, deckId, c.front, c.back)))();

    res.json({
      deck: db.prepare('SELECT * FROM decks WHERE id = ?').get(deckId),
      cards: db.prepare('SELECT * FROM flashcards WHERE deck_id = ?').all(deckId),
      provider, degradedFrom, providerError: error,
    });
  } catch (err) { next(err); }
});

studyRoutes.post('/generate/quiz', async (req, res, next) => {
  try {
    const { text, resourceId, title } = sourceText(req.user.id, req.body);
    const count = Math.min(20, Math.max(3, Number(req.body?.count) || 5));
    const { result: questions, provider, degradedFrom, error } = await ai.generateQuiz(req.user.id, text, count);

    if (!questions?.length) return res.status(422).json({ error: 'Could not derive any questions from that material.' });

    const quizId = uid();
    db.prepare(
      'INSERT INTO quizzes (id, user_id, title, subject, resource_id, time_limit_minutes, generated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(quizId, req.user.id, req.body?.quiz_title || `${title} - practice test`, req.body?.subject || null, resourceId, Math.max(2, count * 2), provider);

    const insert = db.prepare(
      'INSERT INTO quiz_questions (id, quiz_id, prompt, options, answer_index, explanation, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    db.transaction(() =>
      questions.forEach((q, i) =>
        insert.run(uid(), quizId, q.prompt, JSON.stringify(q.options), q.answer_index, q.explanation || null, i),
      ),
    )();

    res.json({ quiz: db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId), count: questions.length, provider, degradedFrom, providerError: error });
  } catch (err) { next(err); }
});

studyRoutes.post('/generate/mindmap', async (req, res, next) => {
  try {
    const { text, resourceId, title } = sourceText(req.user.id, req.body);
    const { result: map, provider, degradedFrom, error } = await ai.generateMindMap(req.user.id, text, title);

    if (!map?.children?.length) return res.status(422).json({ error: 'Could not derive a structure from that material.' });

    const id = uid();
    db.prepare('INSERT INTO mind_maps (id, user_id, title, resource_id, data, generated_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.user.id, map.root || title, resourceId, JSON.stringify(map), provider);

    res.json({ mind_map: db.prepare('SELECT * FROM mind_maps WHERE id = ?').get(id), provider, degradedFrom, providerError: error });
  } catch (err) { next(err); }
});
