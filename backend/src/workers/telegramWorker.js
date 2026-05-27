require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
  console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required');
  process.exit(1);
}

const tgRequest = (method, params) => new Promise((resolve, reject) => {
  const body = JSON.stringify(params);
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${TOKEN}/${method}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => resolve(JSON.parse(data)));
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const sendMessage = (text) =>
  tgRequest('sendMessage', { chat_id: CHAT_ID, text, parse_mode: 'HTML' });

const getAIAnalysis = async (sessionType, todayText, history) => {
  if (!process.env.OPENAI_API_KEY) return null;
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const historyText = history.map(h =>
    `${h.checkin_date}: ${h.session_type === 'morning' ? `цілі: ${h.goals}` : `досягнення: ${h.achievements}`}, настрій: ${h.mood}/5`
  ).join('\n') || 'Перший запис';

  const isMorning = sessionType === 'morning';
  const prompt = `Ти особистий AI-коуч. Проаналізуй ${isMorning ? 'ранкові цілі' : 'вечірні досягнення'} Олега і порівняй з попередніми днями.

Сьогодні: ${todayText}

Попередні дні:
${historyText}

Дай короткий (3-4 речення) персональний аналіз українською. Будь конкретним і підтримуючим.`;

  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
  });
  return r.choices[0].message.content;
};

const getSessionType = () => {
  const hour = (new Date().getUTCHours() + 3) % 24; // Kyiv UTC+3
  return hour < 15 ? 'morning' : 'evening';
};

const processMessage = async (text) => {
  const today = new Date().toISOString().split('T')[0];
  const sessionType = getSessionType();
  const isMorning = sessionType === 'morning';

  // Find user with reminders enabled, fallback to first user
  let userRes = await pool.query(
    `SELECT id, name FROM users WHERE goal_reminder_enabled = TRUE ORDER BY id LIMIT 1`
  );
  if (!userRes.rows[0]) {
    userRes = await pool.query(`SELECT id, name FROM users ORDER BY id LIMIT 1`);
  }
  if (!userRes.rows[0]) {
    await sendMessage('❌ Немає жодного користувача в системі. Спочатку зареєструйся в CRM.');
    return;
  }
  const { id: userId, name: userName } = userRes.rows[0];

  // Get history for comparison
  const history = await pool.query(
    `SELECT * FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC, session_type LIMIT 5`,
    [userId]
  );

  // Save check-in
  const goalField = isMorning ? { goals: text } : { achievements: text };
  await pool.query(
    `INSERT INTO daily_checkins (user_id, checkin_date, session_type, ${isMorning ? 'goals' : 'achievements'})
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, checkin_date, session_type)
     DO UPDATE SET ${isMorning ? 'goals' : 'achievements'} = $4, updated_at = NOW()`,
    [userId, today, sessionType, text]
  );

  await sendMessage(`✅ <b>Збережено!</b>\n\n${isMorning ? '🌅 Ранкові цілі' : '🌙 Вечірні досягнення'} за ${today} записані.`);

  // Get AI analysis and save to DB
  try {
    await sendMessage('🤖 Аналізую...');
    const analysis = await getAIAnalysis(sessionType, text, history.rows);
    if (analysis) {
      await pool.query(
        `UPDATE daily_checkins SET ai_analysis=$1, updated_at=NOW()
         WHERE user_id=$2 AND checkin_date=$3 AND session_type=$4`,
        [analysis, userId, today, sessionType]
      );
      await sendMessage(`🧠 <b>AI-аналіз:</b>\n\n${analysis}`);
    }
  } catch (e) {
    console.error('AI error:', e.message);
  }
};

let offset = 0;

const poll = async () => {
  try {
    const res = await tgRequest('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
    if (res.ok && res.result.length > 0) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg || !msg.text) continue;
        if (String(msg.chat.id) !== String(CHAT_ID)) continue;

        if (msg.text.startsWith('/')) {
          if (msg.text === '/start') {
            await sendMessage(`Привіт, Олег! 👋\n\nЯ твій особистий Goal Planning бот 🎯\n\nКожного ранку о 7:00 і вечора о 21:00 я надсилатиму тобі нагадування. Просто відповідай на них — я збережу твої цілі і дам AI-аналіз.\n\nМожеш написати цілі прямо зараз!`);
          } else if (msg.text === '/stats') {
            const stats = await pool.query(
              `SELECT COUNT(*) as total, ROUND(AVG(mood),1) as avg_mood, MAX(checkin_date) as last
               FROM daily_checkins WHERE user_id=(SELECT id FROM users WHERE goal_reminder_enabled=TRUE ORDER BY id LIMIT 1)`
            );
            const s = stats.rows[0];
            await sendMessage(`📊 <b>Твоя статистика:</b>\n\nВсього check-in: ${s.total}\nСередній настрій: ${s.avg_mood || '-'}/5\nОстанній запис: ${s.last || '-'}`);
          }
        } else {
          await processMessage(msg.text);
        }
      }
    }
  } catch (e) {
    console.error('Poll error:', e.message);
  }
  setTimeout(poll, 1000);
};

console.log('Telegram Goal Bot started. Listening for messages...');
sendMessage('🤖 Бот запущено! Готовий до роботи. Напиши /start для початку.')
  .catch(e => console.error('Startup message error:', e.message));
poll();
