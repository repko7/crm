require('dotenv').config();
const db = require('../models/db');

const STALE_CONTACT_DAYS = 7;
const STALE_DEAL_DAYS = 14;
const CYCLE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ─── AI helper ────────────────────────────────────────────────────────────────

async function askAI(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    // No key — return a minimal structured fallback so the agent still works
    return JSON.stringify({ tasks: [] });
  }
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    response_format: { type: 'json_object' }
  });
  return response.choices[0].message.content;
}

// ─── OBSERVE ──────────────────────────────────────────────────────────────────

async function observe(userId) {
  // Contacts with no activity for STALE_CONTACT_DAYS and no pending agent task
  const staleContacts = await db.query(`
    SELECT
      c.id, c.name, c.company, c.status, c.notes,
      COALESCE(MAX(a.created_at), c.created_at) AS last_activity_at
    FROM contacts c
    LEFT JOIN activities a ON a.contact_id = c.id
    WHERE c.user_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.contact_id = c.id
          AND t.completed = false
          AND t.created_at > NOW() - INTERVAL '3 days'
          AND t.title LIKE '[Agent]%'
      )
    GROUP BY c.id
    HAVING COALESCE(MAX(a.created_at), c.created_at) < NOW() - INTERVAL '${STALE_CONTACT_DAYS} days'
    LIMIT 10
  `, [userId]);

  // Deals stuck in the same stage for STALE_DEAL_DAYS
  const staleDeals = await db.query(`
    SELECT
      d.id, d.title, d.stage, d.value, d.notes,
      c.name AS contact_name
    FROM deals d
    LEFT JOIN contacts c ON c.id = d.contact_id
    WHERE d.user_id = $1
      AND d.stage NOT IN ('closed_won', 'closed_lost')
      AND d.updated_at < NOW() - INTERVAL '${STALE_DEAL_DAYS} days'
      AND NOT EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.deal_id = d.id
          AND t.completed = false
          AND t.created_at > NOW() - INTERVAL '3 days'
          AND t.title LIKE '[Agent]%'
      )
    LIMIT 10
  `, [userId]);

  return { staleContacts: staleContacts.rows, staleDeals: staleDeals.rows };
}

// ─── REASON ───────────────────────────────────────────────────────────────────

async function reason(staleContacts, staleDeals) {
  if (staleContacts.length === 0 && staleDeals.length === 0) return { tasks: [] };

  const prompt = `You are an autonomous CRM assistant. Analyze the following sales data and decide which follow-up tasks to create. Return ONLY valid JSON in this exact format: {"tasks": [{"type": "contact"|"deal", "ref_id": <number>, "title": "<short action>", "description": "<why this matters>", "due_days": <1-7>}]}

STALE CONTACTS (no activity for 7+ days):
${JSON.stringify(staleContacts, null, 2)}

STALE DEALS (no progress for 14+ days):
${JSON.stringify(staleDeals, null, 2)}

Rules:
- Each task title must start with "[Agent] "
- Be specific and actionable (e.g. "[Agent] Call Maria to discuss Q2 proposal")
- due_days = how many days from today the task is due
- Create at most 1 task per contact/deal
- Skip if the notes already mention a clear next step was done recently`;

  const raw = await askAI(prompt);
  try {
    return JSON.parse(raw);
  } catch {
    return { tasks: [] };
  }
}

// ─── ACT ──────────────────────────────────────────────────────────────────────

async function act(userId, tasks, staleContacts, staleDeals) {
  let created = 0;
  const details = [];

  for (const task of tasks) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (task.due_days || 3));

    let contactId = null;
    let dealId = null;

    if (task.type === 'contact') {
      const match = staleContacts.find(c => c.id === task.ref_id);
      if (!match) continue;
      contactId = task.ref_id;
    } else if (task.type === 'deal') {
      const match = staleDeals.find(d => d.id === task.ref_id);
      if (!match) continue;
      dealId = task.ref_id;
    }

    await db.query(
      `INSERT INTO tasks (user_id, contact_id, deal_id, title, description, due_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, contactId, dealId, task.title, task.description, dueDate]
    );

    created++;
    details.push({ title: task.title, type: task.type, ref_id: task.ref_id });
  }

  return { created, details };
}

// ─── LOG ──────────────────────────────────────────────────────────────────────

async function logCycle(userId, tasksCreated, summary, details) {
  await db.query(
    `INSERT INTO agent_logs (user_id, tasks_created, summary, details)
     VALUES ($1, $2, $3, $4)`,
    [userId, tasksCreated, summary, JSON.stringify(details)]
  );
}

// ─── ONE CYCLE FOR A SINGLE USER ──────────────────────────────────────────────

async function runForUser(user) {
  try {
    const { staleContacts, staleDeals } = await observe(user.id);

    if (staleContacts.length === 0 && staleDeals.length === 0) return;

    const decisions = await reason(staleContacts, staleDeals);
    const { created, details } = await act(user.id, decisions.tasks || [], staleContacts, staleDeals);

    if (created > 0) {
      const summary = `Created ${created} task(s): ${details.map(d => d.title).join(' | ')}`;
      await logCycle(user.id, created, summary, details);
      console.log(`[Agent] user=${user.id} (${user.email}) → ${summary}`);
    }
  } catch (err) {
    console.error(`[Agent] Error for user ${user.id}:`, err.message);
  }
}

// ─── MAIN CYCLE ───────────────────────────────────────────────────────────────

async function runCycle() {
  console.log(`[Agent] Cycle started at ${new Date().toISOString()}`);
  try {
    const users = await db.query('SELECT id, email FROM users');
    for (const user of users.rows) {
      await runForUser(user);
    }
  } catch (err) {
    console.error('[Agent] Cycle error:', err.message);
  }
  console.log(`[Agent] Cycle done`);
}

function start() {
  console.log(`[Agent] Starting — cycle every ${CYCLE_INTERVAL_MS / 60000} min`);
  runCycle(); // run immediately on start
  setInterval(runCycle, CYCLE_INTERVAL_MS);
}

module.exports = { start, runCycle };
