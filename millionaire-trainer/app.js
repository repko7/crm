const STORAGE_KEY = "millionaireTrainer.v2";
const AI_MODEL = "claude-haiku-4-5-20251001";
const BOX_INTERVALS = [1, 2, 3, 5, 8];
const CATEGORY_KEYS = ["situation", "decision", "analysis", "product"];

const LEVELS = [
  { min: 0, name: "Новачок", emoji: "🌱" },
  { min: 40, name: "Практик", emoji: "📈" },
  { min: 120, name: "Стратег", emoji: "🧠" },
  { min: 250, name: "Інвестор мислення", emoji: "💼" },
  { min: 450, name: "Мільйонер-мислитель", emoji: "👑" },
];

function emptyCategoryMap(fill) {
  return CATEGORY_KEYS.reduce((acc, k) => ({ ...acc, [k]: fill() }), {});
}

function defaultState() {
  return {
    points: 0,
    completedByCategory: emptyCategoryMap(() => 0),
    queues: {},
    box: emptyCategoryMap(() => ({})),
    dueRound: emptyCategoryMap(() => ({})),
    round: emptyCategoryMap(() => 0),
    categoryStats: emptyCategoryMap(() => ({ totalScore: 0, totalMax: 0 })),
    journal: [],
    lastVisit: null,
    streak: 0,
    activeDays: [],
    pointsHistory: [],
    dailyChallenge: null,
    settings: { apiKey: "", aiCoachEnabled: false },
    showSettings: false,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) {
    console.warn("Не вдалось прочитати збережений прогрес", e);
  }
  return defaultState();
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Не вдалось зберегти прогрес", e);
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function updateStreak() {
  const today = todayStr();
  if (!state.activeDays.includes(today)) {
    state.activeDays.push(today);
    if (state.activeDays.length > 60) state.activeDays.shift();
  }
  if (state.lastVisit === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak = state.lastVisit === yesterday ? state.streak + 1 : 1;
  state.lastVisit = today;
  saveState();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Spaced repetition (Leitner-lite) ----------

function ensureQueue(category) {
  if (!state.queues[category] || state.queues[category].length === 0) {
    state.round[category] = (state.round[category] || 0) + 1;
    const round = state.round[category];
    const due = state.dueRound[category];
    const allIds = DECKS[category].cards.map((c) => c.id);
    let pool = allIds.filter((id) => (due[id] ?? 0) <= round);
    if (pool.length === 0) pool = allIds;
    state.queues[category] = shuffle(pool);
    saveState();
  }
  return state.queues[category];
}

function nextCard(category) {
  const q = ensureQueue(category);
  const id = q.shift();
  saveState();
  return DECKS[category].cards.find((c) => c.id === id);
}

function updateBox(category, cardId, score, maxScore) {
  const boxes = state.box[category];
  const due = state.dueRound[category];
  const cur = boxes[cardId] || 1;
  const isStrong = score >= maxScore;
  const nextBox = isStrong ? Math.min(cur + 1, BOX_INTERVALS.length) : 1;
  boxes[cardId] = nextBox;
  due[cardId] = (state.round[category] || 0) + BOX_INTERVALS[nextBox - 1];
}

// ---------- Progress bookkeeping ----------

function recordPointsHistory() {
  const t = todayStr();
  const last = state.pointsHistory[state.pointsHistory.length - 1];
  if (last && last.date === t) last.points = state.points;
  else {
    state.pointsHistory.push({ date: t, points: state.points });
    if (state.pointsHistory.length > 60) state.pointsHistory.shift();
  }
}

function applyAnswer({ category, cardId, score, maxScore }) {
  state.points += score;
  state.completedByCategory[category] = (state.completedByCategory[category] || 0) + 1;
  const stat = state.categoryStats[category];
  stat.totalScore += score;
  stat.totalMax += maxScore;
  updateBox(category, cardId, score, maxScore);
  recordPointsHistory();
  saveState();
}

function currentLevel() {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (state.points >= l.min) lvl = l;
  return lvl;
}

function nextLevel() {
  const cur = currentLevel();
  return LEVELS[LEVELS.indexOf(cur) + 1] || null;
}

// ---------- Daily challenge ----------

function ensureDailyChallenge() {
  const t = todayStr();
  if (state.dailyChallenge && state.dailyChallenge.date === t) return state.dailyChallenge;
  const seed = hashStr(t);
  const category = CATEGORY_KEYS[seed % CATEGORY_KEYS.length];
  const cards = DECKS[category].cards;
  const card = cards[Math.floor(seed / CATEGORY_KEYS.length) % cards.length];
  state.dailyChallenge = { date: t, category, cardId: card.id, completed: false };
  saveState();
  return state.dailyChallenge;
}

// ---------- AI coach ----------

async function callAnthropic(userPrompt) {
  const key = state.settings.apiKey;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 400,
      system:
        "Ти — досвідчений діловий консультант-коуч, який допомагає людині розвивати підприємницьке мислення через розбір її рішень у навчальних картках. Відповідай стисло (3-5 речень), українською мовою, по суті, без загальних фраз. Спочатку зауваж, що добре в міркуванні людини, потім вкажи на слабке місце чи ризик, і дай одну конкретну пораду на наступного разу.",
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Помилка запиту (${res.status})`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || "Не вдалося отримати відповідь.";
}

function buildChoicePrompt(card, opt) {
  return `Картка-ситуація: "${card.scenario}"\n\nЯ обрав варіант: "${opt.text}"\n\nСтандартний фідбек уже показано мені: "${opt.feedback}" Принцип картки: "${card.principle}"\n\nДай короткий персональний коментар саме щодо мого вибору в цій ситуації.`;
}

function buildOpenPrompt(card, text) {
  return `Завдання: "${card.prompt}"\n\nМоя відповідь: "${text}"\n\nЕкспертні підказки вже показані мені: ${card.tips.join(" ")}\n\nПрокоментуй мою відповідь: що в ній сильне, а що варто додати чи переглянути.`;
}

function wireAiCoach(container, promptBuilder) {
  const btn = container.querySelector("#aiCoachBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Аналізую…";
    const responseEl = container.querySelector("#aiResponse");
    responseEl.hidden = false;
    responseEl.className = "ai-response";
    responseEl.textContent = "";
    try {
      const text = await callAnthropic(promptBuilder());
      responseEl.textContent = text;
      btn.textContent = "🤖 Готово";
    } catch (e) {
      responseEl.classList.add("ai-response--error");
      responseEl.textContent = "Не вдалося отримати відповідь AI-коуча: " + e.message;
      btn.disabled = false;
      btn.textContent = "🤖 Спробувати ще раз";
    }
  });
}

function renderAiCoachBlock() {
  if (!state.settings.apiKey) return "";
  return `
    <div class="ai-coach-block">
      <button class="btn-ai" id="aiCoachBtn">🤖 Запитати AI-коуча</button>
      <div class="ai-response" id="aiResponse" hidden></div>
    </div>
  `;
}

// ---------- Rendering ----------

const root = document.getElementById("app");

function render() {
  const view = state.view || "home";
  if (view === "home") renderHome();
  else if (view === "deck" || view === "daily") renderDeck();
  else if (view === "dashboard") renderDashboard();

  wireHeaderActions();
  if (state.showSettings) {
    root.insertAdjacentHTML("beforeend", renderSettingsOverlay());
    wireSettingsOverlay();
  }
}

function renderHeader() {
  const lvl = currentLevel();
  const nxt = nextLevel();
  const progressPct = nxt ? Math.round(((state.points - lvl.min) / (nxt.min - lvl.min)) * 100) : 100;
  return `
    <header class="app-header">
      <div class="brand">
        <span class="brand-emoji">💰</span>
        <div>
          <h1>Тренажер мислення мільйонера</h1>
          <p class="subtitle">Картки для прийняття рішень, аналізу та створення продуктів</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="dashboardBtn" title="Прогрес">📊</button>
        <button class="icon-btn" id="settingsBtn" title="AI-коуч">⚙️</button>
      </div>
      <div class="level-box">
        <div class="level-name">${lvl.emoji} ${lvl.name}</div>
        <div class="points">${state.points} балів${state.streak > 1 ? ` · 🔥 ${state.streak} дн. поспіль` : ""}</div>
        <div class="level-bar"><div class="level-bar-fill" style="width:${progressPct}%"></div></div>
        ${nxt ? `<div class="level-next">до «${nxt.name}»: ${nxt.min - state.points} балів</div>` : `<div class="level-next">максимальний рівень 🎉</div>`}
      </div>
    </header>
  `;
}

function renderHeader_update() {
  const headerEl = document.querySelector(".app-header");
  if (headerEl) headerEl.outerHTML = renderHeader();
  wireHeaderActions();
}

function wireHeaderActions() {
  const dashBtn = document.getElementById("dashboardBtn");
  if (dashBtn) dashBtn.addEventListener("click", () => { state.view = "dashboard"; render(); });
  const setBtn = document.getElementById("settingsBtn");
  if (setBtn) setBtn.addEventListener("click", () => { state.showSettings = true; render(); });
}

function renderStreakCalendar() {
  const cells = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const active = state.activeDays.includes(key);
    const label = d.toLocaleDateString("uk-UA", { weekday: "short" })[0].toUpperCase();
    cells.push(`<div class="cal-cell${active ? " cal-cell--active" : ""}" title="${key}">${label}</div>`);
  }
  return `
    <div class="streak-cal-wrap">
      <p class="streak-cal-label">Останні 14 днів практики</p>
      <div class="streak-cal">${cells.join("")}</div>
    </div>
  `;
}

function renderDailyTile() {
  const dc = ensureDailyChallenge();
  const deck = DECKS[dc.category];
  const card = deck.cards.find((c) => c.id === dc.cardId);
  const preview = card.scenario || card.prompt;
  return `
    <button class="daily-tile${dc.completed ? " daily-tile--done" : ""}" id="dailyTile" ${dc.completed ? "disabled" : ""}>
      <div class="daily-kicker">${dc.completed ? "✅ Виклик дня виконано" : "🎯 Виклик дня"} · ${deck.emoji} ${deck.title}</div>
      <div class="daily-preview">${preview}</div>
      ${!dc.completed ? '<div class="daily-cta">Прийняти виклик →</div>' : ""}
    </button>
  `;
}

function renderHome() {
  updateStreak();
  const cards = Object.entries(DECKS)
    .map(([key, deck]) => {
      const done = state.completedByCategory[key] || 0;
      return `
        <button class="deck-tile" data-category="${key}">
          <div class="deck-emoji">${deck.emoji}</div>
          <div class="deck-title">${deck.title}</div>
          <div class="deck-subtitle">${deck.subtitle}</div>
          <div class="deck-meta">Опрацьовано карток: ${done}</div>
        </button>
      `;
    })
    .join("");

  root.innerHTML = `
    ${renderHeader()}
    <main class="home">
      ${renderDailyTile()}
      ${renderStreakCalendar()}
      <div class="deck-grid">${cards}</div>
      ${state.journal.length ? renderJournalPreview() : ""}
    </main>
  `;

  root.querySelectorAll(".deck-tile").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.view = "deck";
      state.category = btn.dataset.category;
      state.card = nextCard(state.category);
      render();
    });
  });

  const dailyBtn = document.getElementById("dailyTile");
  if (dailyBtn) {
    dailyBtn.addEventListener("click", () => {
      const dc = ensureDailyChallenge();
      state.view = "daily";
      state.category = dc.category;
      state.card = DECKS[dc.category].cards.find((c) => c.id === dc.cardId);
      render();
    });
  }
}

function renderJournalPreview() {
  const last = state.journal.slice(-3).reverse();
  return `
    <section class="journal">
      <h2>Останні нотатки</h2>
      ${last
        .map(
          (j) => `<div class="journal-entry">
            <div class="journal-prompt">${escapeHtml(j.prompt)}</div>
            <div class="journal-text">${escapeHtml(j.text)}</div>
          </div>`
        )
        .join("")}
    </section>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderDeck() {
  const category = state.category;
  const deck = DECKS[category];
  const card = state.card;
  const isDaily = state.view === "daily";

  root.innerHTML = `
    ${renderHeader()}
    <main class="deck">
      <div class="deck-topbar">
        <button class="btn-back" id="backBtn">← ${isDaily ? "На головну" : "До категорій"}</button>
        <div class="deck-label">${isDaily ? "🎯 Виклик дня" : `${deck.emoji} ${deck.title}`}</div>
      </div>
      <div class="card" id="cardEl">
        ${category === "situation" || category === "decision" ? renderChoiceCard(card) : renderOpenCard(card)}
      </div>
    </main>
  `;

  document.getElementById("backBtn").addEventListener("click", () => {
    state.view = "home";
    render();
  });

  if (category === "situation" || category === "decision") wireChoiceCard(card, category, isDaily);
  else wireOpenCard(card, category, isDaily);
}

function renderChoiceCard(card) {
  const options = card.options
    .map((opt, i) => `<button class="option-btn" data-index="${i}">${opt.text}</button>`)
    .join("");
  return `
    <div class="card-scenario">${card.scenario}</div>
    <div class="options">${options}</div>
    <div class="feedback-area" id="feedbackArea" hidden></div>
  `;
}

function wireChoiceCard(card, category, isDaily) {
  const buttons = root.querySelectorAll(".option-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      buttons.forEach((b) => (b.disabled = true));
      const idx = Number(btn.dataset.index);
      const opt = card.options[idx];
      btn.classList.add(opt.score >= 3 ? "chosen-best" : opt.score >= 2 ? "chosen-ok" : "chosen-weak");

      applyAnswer({ category, cardId: card.id, score: opt.score, maxScore: 3 });

      const area = document.getElementById("feedbackArea");
      area.hidden = false;
      const scoreLabel = opt.score >= 3 ? "Сильний хід" : opt.score >= 2 ? "Непогано" : opt.score >= 1 ? "Ризиковано" : "Слабкий хід";
      const scoreClass = opt.score >= 3 ? "best" : opt.score >= 2 ? "ok" : "weak";
      area.innerHTML = `
        <div class="feedback-score feedback-score--${scoreClass}">${scoreLabel} (+${opt.score})</div>
        <div class="feedback-text">${opt.feedback}</div>
        <div class="feedback-principle"><strong>Принцип:</strong> ${card.principle}</div>
        ${renderAiCoachBlock()}
        <button class="btn-next" id="nextBtn">${isDaily ? "На головну →" : "Наступна картка →"}</button>
      `;
      wireAiCoach(area, () => buildChoicePrompt(card, opt));
      document.getElementById("nextBtn").addEventListener("click", () => {
        if (isDaily) {
          state.dailyChallenge.completed = true;
          saveState();
          state.view = "home";
        } else {
          state.card = nextCard(category);
        }
        render();
      });
      renderHeader_update();
    });
  });
}

function renderOpenCard(card) {
  const list = card.questions || card.steps || [];
  return `
    <div class="card-scenario">${card.prompt}</div>
    <ul class="guiding-list">${list.map((q) => `<li>${q}</li>`).join("")}</ul>
    <textarea id="answerText" class="answer-box" placeholder="Запиши свої думки та висновки тут..." rows="5"></textarea>
    <button class="btn-reveal" id="revealBtn">Показати підказки експерта</button>
    <div class="feedback-area" id="feedbackArea" hidden></div>
  `;
}

function wireOpenCard(card, category, isDaily) {
  document.getElementById("revealBtn").addEventListener("click", () => {
    const textEl = document.getElementById("answerText");
    const text = textEl.value.trim();

    if (text.length > 0) {
      state.journal.push({ prompt: card.prompt || card.scenario, text, category, date: new Date().toISOString() });
      if (state.journal.length > 100) state.journal.shift();
    }

    const pointsEarned = text.length > 0 ? 3 : 1;
    applyAnswer({ category, cardId: card.id, score: pointsEarned, maxScore: 3 });

    document.getElementById("revealBtn").disabled = true;
    const area = document.getElementById("feedbackArea");
    area.hidden = false;
    area.innerHTML = `
      <div class="feedback-score">${text.length > 0 ? "Записано в журнал (+3)" : "Спробуй наступного разу написати власну відповідь (+1)"}</div>
      <div class="tips-list">
        ${card.tips.map((t) => `<div class="tip-item">💡 ${t}</div>`).join("")}
      </div>
      ${renderAiCoachBlock()}
      <button class="btn-next" id="nextBtn">${isDaily ? "На головну →" : "Наступна картка →"}</button>
    `;
    wireAiCoach(area, () => buildOpenPrompt(card, text || "(відповідь не написана)"));
    document.getElementById("nextBtn").addEventListener("click", () => {
      if (isDaily) {
        state.dailyChallenge.completed = true;
        saveState();
        state.view = "home";
      } else {
        state.card = nextCard(category);
      }
      render();
    });
    renderHeader_update();
  });
}

// ---------- Settings overlay ----------

function renderSettingsOverlay() {
  return `
    <div class="overlay" id="settingsOverlay">
      <div class="modal">
        <button class="modal-close" id="closeSettingsBtn">✕</button>
        <h2>AI-коуч</h2>
        <p class="modal-note">
          Введи свій Anthropic API-ключ, щоб отримувати персональний розбір твоїх відповідей від AI після кожної картки.
          Ключ зберігається лише локально у твоєму браузері (localStorage) і використовується для прямих запитів до
          api.anthropic.com — нікуди більше не передається.
        </p>
        <input type="password" id="apiKeyInput" class="text-input" placeholder="sk-ant-..." value="${escapeHtml(state.settings.apiKey || "")}" />
        <div class="modal-actions">
          <button class="btn-secondary" id="clearKeyBtn">Прибрати ключ</button>
          <button class="btn-next" id="saveKeyBtn">Зберегти</button>
        </div>
      </div>
    </div>
  `;
}

function wireSettingsOverlay() {
  const overlay = document.getElementById("settingsOverlay");
  const close = () => {
    state.showSettings = false;
    render();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.getElementById("closeSettingsBtn").addEventListener("click", close);
  document.getElementById("saveKeyBtn").addEventListener("click", () => {
    const val = document.getElementById("apiKeyInput").value.trim();
    state.settings.apiKey = val;
    state.settings.aiCoachEnabled = !!val;
    saveState();
    close();
  });
  document.getElementById("clearKeyBtn").addEventListener("click", () => {
    state.settings.apiKey = "";
    state.settings.aiCoachEnabled = false;
    saveState();
    close();
  });
}

// ---------- Dashboard ----------

function renderPointsChart() {
  const data = state.pointsHistory;
  if (data.length < 2) {
    return `<p class="empty-note">Ще замало даних — попрактикуйся кілька днів, і тут з'явиться графік.</p>`;
  }
  const w = 600, h = 160, pad = 24;
  const maxP = Math.max(...data.map((d) => d.points), 1);
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (d.points / maxP) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = "M" + pts.join(" L");
  const areaPath = `${linePath} L${(pad + (data.length - 1) * stepX).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  return `
    <svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pointsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:var(--accent-2);stop-opacity:0.55" />
          <stop offset="100%" style="stop-color:var(--accent-2);stop-opacity:0" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" style="fill:url(#pointsGrad)"></path>
      <path d="${linePath}" style="fill:none;stroke:var(--accent-2);stroke-width:2"></path>
    </svg>
    <div class="chart-caption">${data[0].date} → ${data[data.length - 1].date} · максимум ${maxP} балів</div>
  `;
}

function renderCategoryBars() {
  return Object.entries(DECKS)
    .map(([key, deck]) => {
      const stat = state.categoryStats[key];
      const pct = stat.totalMax ? Math.round((stat.totalScore / stat.totalMax) * 100) : null;
      return `
        <div class="bar-row">
          <div class="bar-label">${deck.emoji} ${deck.title}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct ?? 0}%"></div></div>
          <div class="bar-pct">${pct === null ? "—" : pct + "%"}</div>
        </div>
      `;
    })
    .join("");
}

function weakestCategoryNote() {
  const withData = Object.entries(state.categoryStats).filter(([, s]) => s.totalMax > 0);
  if (withData.length === 0) return "";
  const weakest = withData.reduce((a, b) => (a[1].totalScore / a[1].totalMax <= b[1].totalScore / b[1].totalMax ? a : b));
  const pct = Math.round((weakest[1].totalScore / weakest[1].totalMax) * 100);
  if (pct >= 80) return "";
  return `<p class="dashboard-hint">Найслабша зона зараз — «${DECKS[weakest[0]].title}» (${pct}%). Варто попрактикуватись там найближчим часом.</p>`;
}

function renderDashboard() {
  root.innerHTML = `
    ${renderHeader()}
    <main class="dashboard">
      <div class="deck-topbar">
        <button class="btn-back" id="backBtn">← На головну</button>
        <div class="deck-label">📊 Прогрес</div>
      </div>
      <section class="panel">
        <h2>Бали в часі</h2>
        ${renderPointsChart()}
      </section>
      <section class="panel">
        <h2>Сила по категоріях</h2>
        ${renderCategoryBars()}
        ${weakestCategoryNote()}
      </section>
    </main>
  `;
  document.getElementById("backBtn").addEventListener("click", () => {
    state.view = "home";
    render();
  });
}

state.view = state.view || "home";
render();
