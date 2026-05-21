const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res) => {
  const { search, status } = req.query;
  let query = 'SELECT * FROM contacts WHERE user_id = $1';
  const params = [req.user.id];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`;
  }
  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';

  const result = await db.query(query, params);
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  const { name, email, phone, company, status, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = await db.query(
    'INSERT INTO contacts (user_id,name,email,phone,company,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.user.id, name, email, phone, company, status || 'lead', notes]
  );
  res.status(201).json(result.rows[0]);
});

router.get('/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM contacts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, email, phone, company, status, notes, ai_summary } = req.body;
  const result = await db.query(
    `UPDATE contacts SET name=$1,email=$2,phone=$3,company=$4,status=$5,notes=$6,ai_summary=$7,updated_at=NOW()
     WHERE id=$8 AND user_id=$9 RETURNING *`,
    [name, email, phone, company, status, notes, ai_summary, req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM contacts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
