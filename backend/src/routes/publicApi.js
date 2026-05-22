const express = require('express');
const crypto = require('crypto');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

// --- API Key middleware ---
const apiKeyAuth = async (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Missing X-Api-Key header' });

  const result = await db.query(
    'SELECT user_id FROM api_keys WHERE key_hash=$1 AND active=TRUE',
    [crypto.createHash('sha256').update(key).digest('hex')]
  );
  if (!result.rows[0]) return res.status(401).json({ error: 'Invalid API key' });

  req.user = { id: result.rows[0].user_id };
  next();
};

// --- Key management (requires JWT auth) ---
router.get('/keys', auth, async (req, res) => {
  const result = await db.query(
    'SELECT id, name, created_at, last_used_at FROM api_keys WHERE user_id=$1 AND active=TRUE',
    [req.user.id]
  );
  res.json(result.rows);
});

router.post('/keys', auth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Key name is required' });

  const rawKey = `crm_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

  await db.query(
    'INSERT INTO api_keys (user_id, name, key_hash) VALUES ($1,$2,$3)',
    [req.user.id, name, hash]
  );
  // Return the raw key ONCE — it's never stored in plain text
  res.status(201).json({ key: rawKey, name, warning: 'Save this key now. It will not be shown again.' });
});

router.delete('/keys/:id', auth, async (req, res) => {
  await db.query('UPDATE api_keys SET active=FALSE WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// --- Public REST API (uses API key auth) ---

// Contacts
router.get('/v1/contacts', apiKeyAuth, async (req, res) => {
  const { limit = 50, offset = 0, status } = req.query;
  let query = 'SELECT * FROM contacts WHERE user_id=$1';
  const params = [req.user.id];
  if (status) { params.push(status); query += ` AND status=$${params.length}`; }
  query += ` ORDER BY created_at DESC LIMIT $${params.push(Math.min(Number(limit), 100))} OFFSET $${params.push(Number(offset))}`;
  const result = await db.query(query, params);
  res.json({ data: result.rows, limit: Number(limit), offset: Number(offset) });
});

router.post('/v1/contacts', apiKeyAuth, async (req, res) => {
  const { name, email, phone, company, status, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = await db.query(
    'INSERT INTO contacts (user_id,name,email,phone,company,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.user.id, name, email, phone, company, status || 'lead', notes]
  );
  res.status(201).json(result.rows[0]);
});

// Deals
router.get('/v1/deals', apiKeyAuth, async (req, res) => {
  const { limit = 50, offset = 0, stage } = req.query;
  let query = 'SELECT * FROM deals WHERE user_id=$1';
  const params = [req.user.id];
  if (stage) { params.push(stage); query += ` AND stage=$${params.length}`; }
  query += ` ORDER BY created_at DESC LIMIT $${params.push(Math.min(Number(limit), 100))} OFFSET $${params.push(Number(offset))}`;
  const result = await db.query(query, params);
  res.json({ data: result.rows, limit: Number(limit), offset: Number(offset) });
});

router.post('/v1/deals', apiKeyAuth, async (req, res) => {
  const { contact_id, title, value, stage, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const result = await db.query(
    'INSERT INTO deals (user_id,contact_id,title,value,stage,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [req.user.id, contact_id || null, title, value || 0, stage || 'prospect', notes]
  );
  res.status(201).json(result.rows[0]);
});

// Webhook ping (for integrations to verify connection)
router.get('/v1/ping', apiKeyAuth, (req, res) => {
  res.json({ ok: true, user_id: req.user.id, version: 'v1' });
});

module.exports = { router, apiKeyAuth };
