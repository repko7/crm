const STORAGE_KEY = "millionaireTrainer.v1";

const LEVELS = [
  { min: 0, name: "Новачок", emoji: "🌱" },
  { min: 40, name: "Практик", emoji: "📈" },
  { min: 120, name: "Стратег", emoji: "🧠" },
  { min: 250, name: "Інвестор мислення", emoji: "💼" },
  { min: 450, name: "Мільйонер-мислитель", emoji: "👑" },
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Не вдалось прочитати збережений прогрес", e);
  }
  return {
    points: 0,
    completedByCategory: { situation: 0, decision: 0, analysis: 0, product: 0 },
    queues: {},
    seenIds: { situation: [], decision: [], analysis: [], product: [] },
    journal: [],
    lastVisit: null,
    streak: 0,
  };
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Не вдалось зберегти прогрес", e);
  }
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);
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

function getQueue(category) {
  if (!state.queues[category] || state.queues[category].length === 0) {
    const ids = DECKS[category].cards.map((c) => c.id);
    state.queues[category] = shuffle(ids);
    saveState();
  }
  return state.queues[category];
}

function nextCard(category) {
  const q = getQueue(category);
  const id = q.shift();
  saveState();
  return DECKS[category].cards.find((c) => c.id === id);
}

function currentLevel() {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (state.points >= l.min) lvl = l;
  return lvl;
}

function nextLevel() {
  const cur = currentLevel();
  const idx = LEVELS.indexOf(cur);
  return LEVELS[idx + 1] || null;
}

// ---------- Rendering ----------

const root = document.getElementById("app");

function render() {
  const view = state.view || "home";
  if (view === "home") renderHome();
  else if (view === "deck") renderDeck();
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
      <div class="level-box">
        <div class="level-name">${lvl.emoji} ${lvl.name}</div>
        <div class="points">${state.points} балів${state.streak > 1 ? ` · 🔥 ${state.streak} дн. поспіль` : ""}</div>
        <div class="level-bar"><div class="level-bar-fill" style="width:${progressPct}%"></div></div>
        ${nxt ? `<div class="level-next">до «${nxt.name}»: ${nxt.min - state.points} балів</div>` : `<div class="level-next">максимальний рівень 🎉</div>`}
      </div>
    </header>
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
      <div class="deck-grid">${cards}</div>
      ${state.journal.length ? renderJournalPreview() : ""}
    </main>
  `;

  root.querySelectorAll(".deck-tile").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.view = "deck";
      state.category = btn.dataset.category;
      state.card = nextCard(state.category);
      state.selectedOption = null;
      render();
    });
  });
}

function renderJournalPreview() {
  const last = state.journal.slice(-3).reverse();
  return `
    <section class="journal">
      <h2>Останні нотатки</h2>
      ${last
        .map(
          (j) => `<div class="journal-entry">
            <div class="journal-prompt">${j.prompt}</div>
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

  root.innerHTML = `
    ${renderHeader()}
    <main class="deck">
      <div class="deck-topbar">
        <button class="btn-back" id="backBtn">← До категорій</button>
        <div class="deck-label">${deck.emoji} ${deck.title}</div>
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

  if (category === "situation" || category === "decision") wireChoiceCard(card, category);
  else wireOpenCard(card, category);
}

function renderChoiceCard(card) {
  const options = card.options
    .map(
      (opt, i) => `<button class="option-btn" data-index="${i}">${opt.text}</button>`
    )
    .join("");
  return `
    <div class="card-scenario">${card.scenario}</div>
    <div class="options">${options}</div>
    <div class="feedback-area" id="feedbackArea" hidden></div>
  `;
}

function wireChoiceCard(card, category) {
  const buttons = root.querySelectorAll(".option-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      buttons.forEach((b) => (b.disabled = true));
      const idx = Number(btn.dataset.index);
      const opt = card.options[idx];
      btn.classList.add(opt.score >= 3 ? "chosen-best" : opt.score >= 2 ? "chosen-ok" : "chosen-weak");

      state.points += opt.score;
      state.completedByCategory[category] = (state.completedByCategory[category] || 0) + 1;
      saveState();

      const area = document.getElementById("feedbackArea");
      area.hidden = false;
      const scoreLabel = opt.score >= 3 ? "Сильний хід" : opt.score >= 2 ? "Непогано" : opt.score >= 1 ? "Ризиковано" : "Слабкий хід";
      const scoreClass = opt.score >= 3 ? "best" : opt.score >= 2 ? "ok" : "weak";
      area.innerHTML = `
        <div class="feedback-score feedback-score--${scoreClass}">${scoreLabel} (+${opt.score})</div>
        <div class="feedback-text">${opt.feedback}</div>
        <div class="feedback-principle"><strong>Принцип:</strong> ${card.principle}</div>
        <button class="btn-next" id="nextBtn">Наступна картка →</button>
      `;
      document.getElementById("nextBtn").addEventListener("click", () => {
        state.card = nextCard(category);
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

function wireOpenCard(card, category) {
  document.getElementById("revealBtn").addEventListener("click", () => {
    const textEl = document.getElementById("answerText");
    const text = textEl.value.trim();

    if (text.length > 0) {
      state.journal.push({ prompt: card.prompt || card.scenario, text, category, date: new Date().toISOString() });
      if (state.journal.length > 100) state.journal.shift();
    }

    const pointsEarned = text.length > 0 ? 3 : 1;
    state.points += pointsEarned;
    state.completedByCategory[category] = (state.completedByCategory[category] || 0) + 1;
    saveState();

    document.getElementById("revealBtn").disabled = true;
    const area = document.getElementById("feedbackArea");
    area.hidden = false;
    area.innerHTML = `
      <div class="feedback-score">${text.length > 0 ? "Записано в журнал (+3)" : "Спробуй наступного разу написати власну відповідь (+1)"}</div>
      <div class="tips-list">
        ${card.tips.map((t) => `<div class="tip-item">💡 ${t}</div>`).join("")}
      </div>
      <button class="btn-next" id="nextBtn">Наступна картка →</button>
    `;
    document.getElementById("nextBtn").addEventListener("click", () => {
      state.card = nextCard(category);
      render();
    });
    renderHeader_update();
  });
}

function renderHeader_update() {
  const headerEl = document.querySelector(".app-header");
  if (headerEl) headerEl.outerHTML = renderHeader();
}

state.view = state.view || "home";
render();
