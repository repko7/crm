require('dotenv').config();
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const getHourInTimezone = (tz) => {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    return parseInt(parts.find(p => p.type === 'hour').value, 10);
  } catch {
    return new Date().getUTCHours();
  }
};

const getTodayInTimezone = (tz) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const sendGoalEmail = async (to, name, type, appUrl) => {
  const isMorning = type === 'morning';
  const subject = isMorning
    ? `Доброго ранку, ${name}! Час ставити цілі на сьогодні`
    : `Добрий вечір, ${name}! Час підбити підсумки дня`;

  const html = isMorning ? `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:12px">
      <h1 style="color:#1e40af;margin-bottom:8px">🌅 Ранкове планування</h1>
      <p style="font-size:16px;color:#334155">Привіт, <strong>${name}</strong>!</p>
      <p style="color:#475569">Починається новий день, повний можливостей. Витрати 5 хвилин, щоб поставити чіткі SMART-цілі на сьогодні.</p>
      <div style="background:#dbeafe;border-left:4px solid #2563eb;padding:16px;border-radius:6px;margin:20px 0">
        <p style="margin:0;font-weight:600;color:#1e40af">Запитай себе:</p>
        <ul style="color:#1e3a8a;margin:8px 0">
          <li>Яка одна найважливіша ціль на сьогодні?</li>
          <li>Як я зрозумію, що досяг її?</li>
          <li>Які конкретні кроки треба зробити?</li>
        </ul>
      </div>
      <a href="${appUrl}/goals" style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
        Записати ранкові цілі →
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">CRM Pro · Goal Planning</p>
    </div>` : `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:12px">
      <h1 style="color:#7c3aed;margin-bottom:8px">🌙 Вечірнє планування</h1>
      <p style="font-size:16px;color:#334155">Привіт, <strong>${name}</strong>!</p>
      <p style="color:#475569">День добігає кінця. Час переглянути свої досягнення та підготуватися до успішного завтра.</p>
      <div style="background:#ede9fe;border-left:4px solid #7c3aed;padding:16px;border-radius:6px;margin:20px 0">
        <p style="margin:0;font-weight:600;color:#6d28d9">Запитай себе:</p>
        <ul style="color:#4c1d95;margin:8px 0">
          <li>Які цілі сьогодні вдалось виконати?</li>
          <li>Що завадило і як уникнути цього завтра?</li>
          <li>Які три пріоритети на завтра?</li>
        </ul>
      </div>
      <a href="${appUrl}/goals" style="display:inline-block;background:#7c3aed;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
        Написати вечірні цілі →
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">CRM Pro · Goal Planning</p>
    </div>`;

  await transport.sendMail({
    from: `"CRM Pro Goals" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};

const processGoalReminders = async () => {
  if (!process.env.SMTP_USER) return;

  const users = await pool.query(
    `SELECT id, email, name, goal_reminder_morning, goal_reminder_evening,
            goal_reminder_timezone, goal_last_morning_date, goal_last_evening_date
     FROM users
     WHERE goal_reminder_enabled = TRUE`
  );

  const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  for (const user of users.rows) {
    const tz = user.goal_reminder_timezone || 'Europe/Kiev';
    const currentHour = getHourInTimezone(tz);
    const today = getTodayInTimezone(tz);

    const lastMorning = user.goal_last_morning_date
      ? new Date(user.goal_last_morning_date).toISOString().split('T')[0]
      : null;
    const lastEvening = user.goal_last_evening_date
      ? new Date(user.goal_last_evening_date).toISOString().split('T')[0]
      : null;

    try {
      if (currentHour === user.goal_reminder_morning && lastMorning !== today) {
        await sendGoalEmail(user.email, user.name, 'morning', appUrl);
        await pool.query('UPDATE users SET goal_last_morning_date=$1 WHERE id=$2', [today, user.id]);
        console.log(`Sent morning goal reminder to ${user.email}`);
      }

      if (currentHour === user.goal_reminder_evening && lastEvening !== today) {
        await sendGoalEmail(user.email, user.name, 'evening', appUrl);
        await pool.query('UPDATE users SET goal_last_evening_date=$1 WHERE id=$2', [today, user.id]);
        console.log(`Sent evening goal reminder to ${user.email}`);
      }
    } catch (err) {
      console.error(`Goal reminder failed for ${user.email}:`, err.message);
    }
  }
};

const run = async () => {
  console.log('Goal reminder worker started');
  while (true) {
    try {
      await processGoalReminders();
    } catch (err) {
      console.error('Goal worker error:', err.message);
    }
    await new Promise(r => setTimeout(r, 60_000));
  }
};

run();
