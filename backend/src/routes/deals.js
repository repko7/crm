const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT d.*, c.name as contact_name, c.company as contact_company
     FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id
     WHERE d.user_id=$1 ORDER BY d.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

router.get('/pipeline', async (req, res) => {
  const result = await db.query(
    'SELECT stage, COUNT(*) as count, SUM(value) as total_value FROM deals WHERE user_id=$1 GROUP BY stage',
    [req.user.id]
  );
  const pipeline = STAGES.map(stage => ({
    stage,
    count: 0,
    total_value: 0,
    ...result.rows.find(r => r.stage === stage)
  }));
  res.json(pipeline);
});

router.post('/', async (req, res) => {
  const { contact_id, title, value, stage, probability, expected_close, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const result = await db.query(
    'INSERT INTO deals (user_id,contact_id,title,value,stage,probability,expected_close,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [req.user.id, contact_id, title, value || 0, stage || 'prospect', probability || 0, expected_close, notes]
  );
  res.status(201).json(result.rows[0]);
});

router.put('/:id', async (req, res) => {
  const { contact_id, title, value, stage, probability, expected_close, notes } = req.body;
  const result = await db.query(
    `UPDATE deals SET contact_id=$1,title=$2,value=$3,stage=$4,probability=$5,expected_close=$6,notes=$7,updated_at=NOW()
     WHERE id=$8 AND user_id=$9 RETURNING *`,
    [contact_id, title, value, stage, probability, expected_close, notes, req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM deals WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
