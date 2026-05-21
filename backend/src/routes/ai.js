const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// AI endpoint with graceful fallback when OpenAI key not configured
const getAIResponse = async (prompt) => {
  if (!process.env.OPENAI_API_KEY) {
    return 'AI features require an OpenAI API key. Add OPENAI_API_KEY to your .env file.';
  }
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500
  });
  return response.choices[0].message.content;
};

// Summarize a contact based on their notes and deals
router.post('/summarize-contact/:id', async (req, res) => {
  const contact = await db.query('SELECT * FROM contacts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!contact.rows[0]) return res.status(404).json({ error: 'Not found' });

  const deals = await db.query('SELECT * FROM deals WHERE contact_id=$1', [req.params.id]);
  const c = contact.rows[0];

  const prompt = `You are a CRM assistant. Summarize this contact in 2-3 sentences for a salesperson.
Contact: ${c.name}, ${c.company || 'no company'}, ${c.email || 'no email'}
Status: ${c.status}
Notes: ${c.notes || 'none'}
Deals: ${deals.rows.map(d => `${d.title} ($${d.value}, ${d.stage})`).join(', ') || 'none'}
Give actionable insights about next steps.`;

  const summary = await getAIResponse(prompt);
  await db.query('UPDATE contacts SET ai_summary=$1 WHERE id=$2', [summary, req.params.id]);
  res.json({ summary });
});

// Generate a follow-up email draft
router.post('/draft-email', async (req, res) => {
  const { contact_id, context } = req.body;
  const contact = await db.query('SELECT * FROM contacts WHERE id=$1 AND user_id=$2', [contact_id, req.user.id]);
  if (!contact.rows[0]) return res.status(404).json({ error: 'Not found' });

  const c = contact.rows[0];
  const prompt = `Write a short, professional follow-up email to ${c.name} from ${c.company || 'their company'}.
Context: ${context || 'general follow-up after initial meeting'}
Notes about them: ${c.notes || 'none'}
Keep it under 150 words. Be friendly and specific. Include a clear call to action.`;

  const email = await getAIResponse(prompt);
  res.json({ email });
});

// Get AI sales coaching tips
router.post('/coach', async (req, res) => {
  const { question } = req.body;
  const stats = await db.query(
    'SELECT stage, COUNT(*) as count, SUM(value) as value FROM deals WHERE user_id=$1 GROUP BY stage',
    [req.user.id]
  );

  const prompt = `You are a sales coach for small businesses.
Pipeline stats: ${JSON.stringify(stats.rows)}
Salesperson's question: ${question || 'What should I focus on today?'}
Give specific, actionable advice in 2-3 bullet points.`;

  const advice = await getAIResponse(prompt);
  res.json({ advice });
});

module.exports = router;
