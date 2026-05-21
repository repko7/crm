const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res) => {
  const { completed } = req.query;
  let query = `SELECT t.*, c.name as contact_name, d.title as deal_title
               FROM tasks t
               LEFT JOIN contacts c ON t.contact_id = c.id
               LEFT JOIN deals d ON t.deal_id = d.id
               WHERE t.user_id=$1`;
  const params = [req.user.id];

  if (completed !== undefined) {
    params.push(completed === 'true');
    query += ` AND t.completed=$${params.length}`;
  }
  query += ' ORDER BY t.due_date ASC NULLS LAST';

  const result = await db.query(query, params);
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  const { contact_id, deal_id, title, description, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const result = await db.query(
    'INSERT INTO tasks (user_id,contact_id,deal_id,title,description,due_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [req.user.id, contact_id, deal_id, title, description, due_date]
  );
  res.status(201).json(result.rows[0]);
});

router.put('/:id', async (req, res) => {
  const { title, description, due_date, completed } = req.body;
  const result = await db.query(
    'UPDATE tasks SET title=$1,description=$2,due_date=$3,completed=$4 WHERE id=$5 AND user_id=$6 RETURNING *',
    [title, description, due_date, completed, req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
