import { Router } from 'express';
import { db, uid } from '../db.js';
import { requireAuth } from '../auth.js';

export const dataRoutes = Router();
dataRoutes.use(requireAuth);

// Generic CRUD gateway, same shape as the moneyos edge function: one POST
// endpoint that takes { table, operation, ... }. It exists so plain
// list/create/update/remove on plain tables doesn't need twenty near-identical
// routers. Anything with a side effect (sealing a page, scoring a quiz,
// awarding a badge, advancing a spaced-repetition card) gets its own named
// route instead and is deliberately absent from this allowlist.

const TABLES = {
  tasks: {
    columns: ['title', 'notes', 'status', 'priority', 'category', 'link_url', 'due_date', 'sort_order', 'completed_at'],
    defaultOrder: 'sort_order ASC, created_at DESC',
  },
  resources: {
    columns: ['name', 'category', 'subject', 'text_content', 'starred'],
    defaultOrder: 'created_at DESC',
  },
  decks: { columns: ['name', 'subject', 'resource_id', 'source'], defaultOrder: 'created_at DESC' },
  habits: { columns: ['name', 'icon', 'target_days', 'archived'], defaultOrder: 'created_at ASC' },
  moods: { columns: ['date', 'score', 'triggers', 'note'], defaultOrder: 'date DESC, created_at DESC' },
  goal_visions: { columns: ['text', 'target_date', 'achieved'], defaultOrder: 'created_at DESC' },
  sos_contacts: { columns: ['name', 'phone', 'relation', 'sort_order'], defaultOrder: 'sort_order ASC' },
  notifications: { columns: ['read_at'], defaultOrder: 'created_at DESC' },
  quizzes: { columns: ['title', 'subject', 'resource_id', 'time_limit_minutes'], defaultOrder: 'created_at DESC' },
  mind_maps: { columns: ['title', 'data', 'resource_id'], defaultOrder: 'created_at DESC' },
  print_orders: { columns: ['status'], defaultOrder: 'created_at DESC' },
};

// Only these column names may appear in a filter, and only with these
// operators - the values are still bound as parameters, but the column name
// itself is interpolated, so it must come from an allowlist.
const FILTER_OPS = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE' };

function assertTable(name) {
  const spec = TABLES[name];
  if (!spec) throw Object.assign(new Error(`Unknown or non-gateway table: ${name}`), { status: 400 });
  return spec;
}

dataRoutes.post('/', (req, res) => {
  const { table, operation, payload, id, filters, order, limit } = req.body || {};
  const spec = assertTable(table);
  const userId = req.user.id;

  if (operation === 'select') {
    const clauses = ['user_id = ?'];
    const values = [userId];

    for (const f of filters || []) {
      const op = FILTER_OPS[f.op || 'eq'];
      const allowed = new Set([...spec.columns, 'id', 'date', 'created_at', 'due_date', 'status']);
      if (!op || !allowed.has(f.column)) {
        return res.status(400).json({ error: `Unsupported filter on ${f.column}` });
      }
      clauses.push(`${f.column} ${op} ?`);
      values.push(f.value);
    }

    // Order is likewise allowlisted rather than interpolated from user input.
    let orderBy = spec.defaultOrder;
    if (order) {
      const [col, dir] = String(order).split('.');
      const allowed = new Set([...spec.columns, 'id', 'created_at', 'date']);
      if (allowed.has(col)) orderBy = `${col} ${dir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`;
    }

    const sql = `SELECT * FROM ${table} WHERE ${clauses.join(' AND ')} ORDER BY ${orderBy}${
      Number.isInteger(limit) ? ` LIMIT ${Math.min(limit, 500)}` : ''
    }`;
    return res.json({ data: db.prepare(sql).all(...values) });
  }

  if (operation === 'insert') {
    const cols = spec.columns.filter((c) => payload?.[c] !== undefined);
    const rowId = uid();
    db.prepare(
      `INSERT INTO ${table} (id, user_id${cols.length ? `, ${cols.join(', ')}` : ''})
       VALUES (?, ?${cols.map(() => ', ?').join('')})`,
    ).run(rowId, userId, ...cols.map((c) => normalize(payload[c])));
    return res.json({ data: db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(rowId) });
  }

  if (operation === 'update') {
    const cols = spec.columns.filter((c) => payload?.[c] !== undefined);
    if (!cols.length) return res.json({ data: db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(id, userId) });
    const result = db
      .prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND user_id = ?`)
      .run(...cols.map((c) => normalize(payload[c])), id, userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found.' });
    return res.json({ data: db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) });
  }

  if (operation === 'delete') {
    const result = db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).run(id, userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found.' });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: `Unknown operation: ${operation}` });
});

// SQLite has no boolean type and no native array; normalise at the boundary so
// callers can send natural JS values.
function normalize(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Array.isArray(value) || (value && typeof value === 'object')) return JSON.stringify(value);
  return value;
}
