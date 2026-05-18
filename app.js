const emotions = [
  "Anxious",
  "Sad",
  "Angry",
  "Numb",
  "Tender",
  "Overwhelmed",
  "Hopeful",
  "Steady",
];

const prompts = [
  "What would feel 5% lighter by tonight?",
  "What are you carrying that no one can see?",
  "What did you need today that you did not quite get?",
  "Which thought wants a little more evidence?",
  "What would you say to someone you love in this exact moment?",
  "What boundary would protect tomorrow's energy?",
];

const nextSteps = [
  "Name the feeling, then lower the demand by one notch.",
  "Drink water, unclench your jaw, and send one honest text.",
  "Move one task out of today and write down why.",
  "Put both feet on the floor and choose the kindest next minute.",
  "Make the private worry specific enough to be solvable.",
  "Ask for company before you ask for advice.",
];

const groundingSteps = [
  "Name five things you can see.",
  "Name four things you can feel.",
  "Name three things you can hear.",
  "Name two things you can smell.",
  "Name one thing you can taste.",
];

const urgeAnchors = [
  "Give the wave a shape, a size, and a place in the body.",
  "Set a 10-minute delay and choose one safer action while it passes.",
  "Keep your attention on the edge of the urge, not the story inside it.",
  "Change temperature: cool water, open air, or a warm mug.",
  "Make contact with another person before making the decision alone.",
];

const values = ["Care", "Courage", "Rest", "Honesty", "Repair", "Patience", "Focus", "Play"];

const crisisPhrases = [
  "kill myself",
  "suicide",
  "suicidal",
  "end my life",
  "hurt myself",
  "harm myself",
  "self harm",
  "self-harm",
  "can't stay safe",
  "cannot stay safe",
  "not safe with myself",
  "hurt someone",
  "kill someone",
];

const openTalkSignals = [
  "talk",
  "listen",
  "chat",
  "free",
  "question",
  "anything",
  "confused",
  "stuck",
  "lost",
];

const feelingWords = [
  "anxious",
  "sad",
  "angry",
  "numb",
  "lonely",
  "overwhelmed",
  "scared",
  "tired",
  "ashamed",
  "guilty",
  "empty",
  "hurt",
  "stressed",
  "worried",
  "depressed",
  "happy",
  "hopeful",
];

const relationshipWords = ["friend", "partner", "family", "mother", "father", "sister", "brother", "relationship", "breakup", "love"];
const workWords = ["work", "job", "boss", "school", "study", "exam", "deadline", "career", "money"];
const uncertaintyWords = ["should i", "what if", "decision", "choose", "choice", "maybe", "don't know", "do not know"];
const explanationWords = ["explain", "what is", "what are", "how does", "how do", "define", "meaning of", "tell me about"];
const planningWords = ["plan", "routine", "schedule", "organize", "goal", "steps", "strategy", "prepare"];
const draftingWords = ["write", "draft", "message", "email", "caption", "rewrite", "text them", "say to"];
const creativeWords = ["idea", "brainstorm", "story", "name", "creative", "joke", "poem", "script"];
const technicalWords = ["code", "bug", "javascript", "html", "css", "database", "terminal", "error", "server", "api"];
const encouragementWords = ["motivate", "motivation", "lazy", "procrastinate", "discipline", "start", "stuck"];

const patterns = {
  calm: [
    { label: "Inhale", seconds: 4, className: "is-inhale" },
    { label: "Hold", seconds: 2, className: "is-hold" },
    { label: "Exhale", seconds: 6, className: "is-exhale" },
  ],
  box: [
    { label: "Inhale", seconds: 4, className: "is-inhale" },
    { label: "Hold", seconds: 4, className: "is-hold" },
    { label: "Exhale", seconds: 4, className: "is-exhale" },
    { label: "Hold", seconds: 4, className: "is-hold" },
  ],
  release: [
    { label: "Inhale", seconds: 3, className: "is-inhale" },
    { label: "Hold", seconds: 1, className: "is-hold" },
    { label: "Exhale", seconds: 7, className: "is-exhale" },
  ],
};

const state = window.StillpointDB.createEmptyState();
const selectedEmotions = new Set();
const selectedBody = new Set();

let appInitialized = false;
let currentUser = null;
let currentPrompt = 0;
let groundingIndex = 0;
let breathInterval = null;
let breathElapsed = 0;
let breathPhaseIndex = 0;
let breathPhaseRemaining = 0;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const views = ["today", "checkin", "journal", "tools", "safety"];

let saveQueue = Promise.resolve();

function persistState() {
  if (!currentUser) {
    return Promise.resolve();
  }

  saveQueue = saveQueue
    .then(() => window.StillpointDB.saveState(state))
    .then(() => {
      updateDatabaseStatus();
      updateProgressStatus();
    })
    .catch((error) => {
      console.warn("Could not save Stillpoint data", error);
      showToast("Could not save this entry.");
    });
  return saveQueue;
}

function updateDatabaseStatus() {
  const status = $("#databaseStatus");
  if (status) {
    status.textContent = `Database: ${window.StillpointDB.getStatus()}`;
  }

  const accountStatus = $("#accountStatus");
  if (accountStatus && currentUser) {
    accountStatus.textContent = `Signed in as ${currentUser.email}`;
  }
}

function updateProgressStatus() {
  const status = $("#progressStatus");
  if (!status) return;

  if (!currentUser) {
    status.textContent = "Progress saves after sign in.";
    return;
  }

  const chatCount = state.agentMessages.filter((message) => !message.pending).length;
  const safetyCount = Object.values(state.safetyPlan || {}).filter(Boolean).length;
  const total =
    state.moods.length +
    state.journals.length +
    state.reframes.length +
    state.bodyNotes.length +
    chatCount +
    safetyCount;

  status.textContent = total
    ? `${total} saved item${total === 1 ? "" : "s"} for this account`
    : "Your first saved step will stay with this account.";
}

function applyTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = safeTheme;
  document.body.dataset.theme = safeTheme;

  const toggle = $("#themeToggle");
  if (toggle) {
    const nextTheme = safeTheme === "dark" ? "light" : "dark";
    toggle.textContent = safeTheme === "dark" ? "Light mode" : "Dark mode";
    toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    toggle.setAttribute("aria-pressed", String(safeTheme === "dark"));
  }
}

function initTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    const currentTheme = state.preferences?.theme === "dark" ? "dark" : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    state.preferences = {
      ...(state.preferences || {}),
      theme: nextTheme,
    };
    applyTheme(nextTheme);
    persistState();
    showToast(`${nextTheme === "dark" ? "Dark" : "Light"} mode saved.`);
  });
}

function formatDate(iso) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function moodText(score) {
  if (score <= 2) return "Very low";
  if (score <= 4) return "Heavy";
  if (score <= 6) return "Mixed";
  if (score <= 8) return "Steady";
  return "Open";
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function setAuthMode(mode) {
  const isSignup = mode === "signup";
  $$("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  $("#loginForm").classList.toggle("is-active", !isSignup);
  $("#signupForm").classList.toggle("is-active", isSignup);
  $("#authSubtitle").textContent = isSignup
    ? "Create a local account on this browser."
    : "Sign in to continue.";
  $("#authMessage").textContent = "";
}

function showAuth(mode = "login") {
  currentUser = null;
  $("#authScreen").classList.remove("is-hidden");
  $("#appShell").classList.add("is-hidden");
  $("#appShell").setAttribute("aria-hidden", "true");
  setAuthMode(mode);
}

async function showApp(user) {
  currentUser = user;
  Object.assign(state, window.StillpointDB.createEmptyState(), await window.StillpointDB.loadState());
  applyTheme(state.preferences?.theme || "light");
  $("#authScreen").classList.add("is-hidden");
  $("#appShell").classList.remove("is-hidden");
  $("#appShell").removeAttribute("aria-hidden");
  $("#accountName").textContent = user.name || user.email;
  updateDatabaseStatus();

  if (!appInitialized) {
    initHeader();
    initNavigation();
    initMood();
    initBodyScan();
    initJournal();
    initBreathing();
    initTools();
    initAgent();
    initSafetyPlan();
    initExport();
    initTheme();
    initAccountActions();
    appInitialized = true;
  }

  populateSafetyPlan();
  render();
}

function initAuth() {
  $$("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
  });

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuth(async () =>
      window.StillpointDB.login($("#loginEmail").value, $("#loginPassword").value),
    );
  });

  $("#signupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuth(async () =>
      window.StillpointDB.createAccount({
        name: $("#signupName").value,
        email: $("#signupEmail").value,
        password: $("#signupPassword").value,
      }),
    );
  });
}

async function submitAuth(action) {
  const message = $("#authMessage");
  message.textContent = "Checking account...";
  try {
    const user = await action();
    $("#loginForm").reset();
    $("#signupForm").reset();
    message.textContent = "";
    await showApp(user);
  } catch (error) {
    message.textContent = error.message || "Could not authenticate.";
  }
}

function initAccountActions() {
  $("#logoutButton").addEventListener("click", async () => {
    await persistState();
    await window.StillpointDB.logout();
    Object.assign(state, window.StillpointDB.createEmptyState());
    pauseBreathing();
    render();
    showAuth("login");
    showToast("Logged out.");
  });
}

function setView(viewName) {
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === `view-${viewName}`));
  $$("[data-view-link]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewLink === viewName);
  });
  window.location.hash = viewName;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getRouteView() {
  const route = window.location.hash.replace("#", "") || "today";
  return views.includes(route) ? route : "today";
}

function initHeader() {
  const now = new Date();
  $("#todayLabel").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const hour = now.getHours();
  const greeting =
    hour < 12
      ? "Begin gently, then decide."
      : hour < 18
        ? "Take the next honest step."
        : "Let the day land softly.";
  $("#greeting").textContent = greeting;
}

function initNavigation() {
  $$("[data-view-link]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewLink));
  });

  $$("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.jump);
      if (button.dataset.tool === "breath") {
        $("#breathTool")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  window.addEventListener("hashchange", () => {
    const nextView = getRouteView();
    if (!document.querySelector(`#view-${nextView}`)?.classList.contains("is-active")) {
      setView(nextView);
    }
  });

  setView(getRouteView());
}

function initMood() {
  const chipContainer = $("#emotionChips");
  chipContainer.innerHTML = emotions
    .map((emotion) => `<button class="chip" type="button" data-emotion="${emotion}">${emotion}</button>`)
    .join("");

  chipContainer.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-emotion]");
    if (!chip) return;
    const emotion = chip.dataset.emotion;
    if (selectedEmotions.has(emotion)) {
      selectedEmotions.delete(emotion);
    } else {
      selectedEmotions.add(emotion);
    }
    chip.classList.toggle("is-selected", selectedEmotions.has(emotion));
  });

  $("#moodRange").addEventListener("input", updateMoodSlider);
  $("#saveMood").addEventListener("click", saveMoodEntry);
  $("#clearMoodForm").addEventListener("click", clearMoodForm);
  updateMoodSlider();
}

function updateMoodSlider() {
  const score = Number($("#moodRange").value);
  $("#moodValue").textContent = String(score);
  $("#moodPhrase").textContent = moodText(score);
}

function saveMoodEntry() {
  const note = $("#quickNote").value.trim();
  const score = Number($("#moodRange").value);
  state.moods.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    score,
    emotions: Array.from(selectedEmotions),
    note,
  });
  state.moods = state.moods.slice(0, 60);
  persistState();
  clearMoodForm(false);
  render();
  showToast("Check-in saved.");
}

function clearMoodForm(show = true) {
  $("#quickNote").value = "";
  selectedEmotions.clear();
  $$("#emotionChips .chip").forEach((chip) => chip.classList.remove("is-selected"));
  if (show) showToast("Check-in cleared.");
}

function renderMood() {
  const latest = state.moods[0];
  $("#latestMood").textContent = latest ? `${latest.score}/10` : "--";
  $("#latestMoodText").textContent = latest
    ? `${moodText(latest.score)} - ${formatDate(latest.createdAt)}`
    : "Waiting for your first check-in.";

  $("#summaryLine").textContent = latest
    ? `Last check-in: ${moodText(latest.score).toLowerCase()} at ${latest.score}/10.`
    : "No check-ins yet.";

  $("#historyMeta").textContent = state.moods.length
    ? `${state.moods.length} saved check-in${state.moods.length === 1 ? "" : "s"}`
    : "No data yet";

  const recent = state.moods.slice(0, 14).reverse();
  $("#moodChart").innerHTML = recent.length
    ? recent
        .map(
          (entry) => `
            <div class="bar" style="height:${Math.max(16, entry.score * 16)}px" title="${entry.score}/10">
              <span>${entry.score}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="entry"><p>Your chart will appear after a check-in.</p></div>`;

  $("#moodEntries").innerHTML = state.moods.slice(0, 8).length
    ? state.moods
        .slice(0, 8)
        .map((entry) => {
          const tags = entry.emotions.length ? ` - ${entry.emotions.join(", ")}` : "";
          const note = entry.note ? `<p>${escapeHtml(entry.note)}</p>` : "";
          return `
            <article class="entry">
              <strong>${entry.score}/10 - ${moodText(entry.score)}</strong>
              <time datetime="${entry.createdAt}">${formatDate(entry.createdAt)}${tags}</time>
              ${note}
            </article>
          `;
        })
        .join("")
    : `<article class="entry"><p>No check-ins saved yet.</p></article>`;

  $("#streakCount").textContent = `${careStreak()} day${careStreak() === 1 ? "" : "s"}`;
}

function careStreak() {
  const days = new Set(
    [...state.moods, ...state.journals].map((entry) => new Date(entry.createdAt).toDateString()),
  );

  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function initBodyScan() {
  $$(".body-map button").forEach((button) => {
    button.addEventListener("click", () => {
      const bodyPart = button.dataset.body;
      if (selectedBody.has(bodyPart)) {
        selectedBody.delete(bodyPart);
      } else {
        selectedBody.add(bodyPart);
      }
      button.classList.toggle("is-selected", selectedBody.has(bodyPart));
    });
  });

  $("#saveBodyNote").addEventListener("click", () => {
    const note = $("#bodyNote").value.trim();
    if (!note && selectedBody.size === 0) {
      showToast("Add a note or choose a body area.");
      return;
    }

    state.bodyNotes.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      areas: Array.from(selectedBody),
      note,
    });
    state.bodyNotes = state.bodyNotes.slice(0, 30);
    $("#bodyNote").value = "";
    selectedBody.clear();
    $$(".body-map button").forEach((button) => button.classList.remove("is-selected"));
    persistState();
    showToast("Body note saved.");
  });
}

function initJournal() {
  $("#newPrompt").addEventListener("click", nextPrompt);
  $("#saveJournal").addEventListener("click", saveJournal);
  $("#clearJournal").addEventListener("click", () => {
    $("#journalText").value = "";
    showToast("Journal cleared.");
  });

  $("#suggestReframe").addEventListener("click", suggestReframe);
  $("#saveReframe").addEventListener("click", saveReframe);
}

function nextPrompt() {
  currentPrompt = (currentPrompt + 1) % prompts.length;
  $("#journalPrompt").textContent = prompts[currentPrompt];
}

function saveJournal() {
  const text = $("#journalText").value.trim();
  if (!text) {
    showToast("Write a little before saving.");
    return;
  }

  state.journals.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    prompt: prompts[currentPrompt],
    text,
  });
  state.journals = state.journals.slice(0, 80);
  $("#journalText").value = "";
  persistState();
  render();
  showToast("Journal saved.");
}

function renderJournal() {
  $("#journalCount").textContent = String(state.journals.length);
  $("#journalCountText").textContent = state.journals.length
    ? `${formatDate(state.journals[0].createdAt)} was the latest.`
    : "A clean page is ready.";

  $("#recentJournalMeta").textContent = `${state.journals.length} saved`;
  $("#journalEntries").innerHTML = state.journals.slice(0, 8).length
    ? state.journals
        .slice(0, 8)
        .map(
          (entry) => `
            <article class="entry">
              <strong>${escapeHtml(entry.prompt)}</strong>
              <time datetime="${entry.createdAt}">${formatDate(entry.createdAt)}</time>
              <p>${escapeHtml(entry.text)}</p>
            </article>
          `,
        )
        .join("")
    : `<article class="entry"><p>No journal entries yet.</p></article>`;
}

function suggestReframe() {
  const thought = $("#thoughtInput").value.trim();
  const evidence = $("#evidenceInput").value.trim();
  if (!thought) {
    showToast("Add the automatic thought first.");
    return;
  }

  const evidenceLine = evidence
    ? "Some facts support this, and some facts make it less absolute."
    : "I may not have the full picture yet.";
  $("#balancedInput").value = `I am noticing the thought "${thought}". ${evidenceLine} A more balanced version is: I can take this seriously without treating it as the whole truth.`;
}

function saveReframe() {
  const thought = $("#thoughtInput").value.trim();
  const evidence = $("#evidenceInput").value.trim();
  const balanced = $("#balancedInput").value.trim();
  if (!thought || !balanced) {
    showToast("Add a thought and a balanced thought.");
    return;
  }

  state.reframes.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    thought,
    evidence,
    balanced,
  });
  state.reframes = state.reframes.slice(0, 40);
  $("#thoughtInput").value = "";
  $("#evidenceInput").value = "";
  $("#balancedInput").value = "";
  persistState();
  renderReframes();
  showToast("Reframe saved.");
}

function renderReframes() {
  $("#reframeEntries").innerHTML = state.reframes.slice(0, 4).length
    ? state.reframes
        .slice(0, 4)
        .map(
          (entry) => `
            <article class="entry">
              <strong>${escapeHtml(entry.balanced)}</strong>
              <small>${formatDate(entry.createdAt)}</small>
              <p>${escapeHtml(entry.thought)}</p>
            </article>
          `,
        )
        .join("")
    : "";
}

function initBreathing() {
  $("#startBreath").addEventListener("click", startBreathing);
  $("#startBreathLarge").addEventListener("click", startBreathing);
  $("#pauseBreath").addEventListener("click", pauseBreathing);
  $("#pauseBreathLarge").addEventListener("click", pauseBreathing);
  $("#breathPattern").addEventListener("change", () => {
    pauseBreathing();
    resetBreathLabels();
  });
  resetBreathLabels();
}

function startBreathing() {
  if (breathInterval) return;

  const pattern = patterns[$("#breathPattern").value];
  breathElapsed = 0;
  breathPhaseIndex = 0;
  breathPhaseRemaining = pattern[0].seconds;
  applyBreathPhase(pattern[0]);
  updateBreathLabels();

  breathInterval = window.setInterval(() => {
    breathElapsed += 1;
    breathPhaseRemaining -= 1;
    if (breathPhaseRemaining <= 0) {
      breathPhaseIndex = (breathPhaseIndex + 1) % pattern.length;
      breathPhaseRemaining = pattern[breathPhaseIndex].seconds;
      applyBreathPhase(pattern[breathPhaseIndex]);
    }
    updateBreathLabels();
  }, 1000);
}

function pauseBreathing() {
  window.clearInterval(breathInterval);
  breathInterval = null;
}

function applyBreathPhase(phase) {
  ["#breathRing", "#breathRingLarge"].forEach((selector) => {
    const ring = $(selector);
    ring.classList.remove("is-inhale", "is-hold", "is-exhale");
    ring.classList.add(phase.className);
  });
  $("#breathPhase").textContent = phase.label;
  $("#breathPhaseLarge").textContent = phase.label;
}

function updateBreathLabels() {
  const display = `${String(Math.floor(breathElapsed / 60)).padStart(2, "0")}:${String(
    breathElapsed % 60,
  ).padStart(2, "0")}`;
  $("#breathTimer").textContent = display;
  $("#breathTimerLarge").textContent = display;
}

function resetBreathLabels() {
  breathElapsed = 0;
  breathPhaseIndex = 0;
  breathPhaseRemaining = 0;
  ["#breathRing", "#breathRingLarge"].forEach((selector) => {
    $(selector).classList.remove("is-inhale", "is-hold", "is-exhale");
  });
  $("#breathPhase").textContent = "Ready";
  $("#breathPhaseLarge").textContent = "Ready";
  updateBreathLabels();
}

function initTools() {
  $("#nextGrounding").addEventListener("click", () => {
    groundingIndex = (groundingIndex + 1) % groundingSteps.length;
    renderGrounding();
  });
  $("#resetGrounding").addEventListener("click", () => {
    groundingIndex = 0;
    $("#groundingInput").value = "";
    renderGrounding();
  });

  $("#urgeRange").addEventListener("input", () => {
    $("#urgeValue").textContent = $("#urgeRange").value;
  });
  $("#refreshUrge").addEventListener("click", () => {
    $("#urgeText").textContent = urgeAnchors[Math.floor(Math.random() * urgeAnchors.length)];
  });

  $("#refreshStep").addEventListener("click", () => {
    $("#nextStepText").textContent = nextSteps[Math.floor(Math.random() * nextSteps.length)];
  });

  $("#valuesGrid").innerHTML = values
    .map((value) => `<button class="value-chip" type="button" data-value="${value}">${value}</button>`)
    .join("");

  $("#valuesGrid").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-value]");
    if (!chip) return;
    $$(".value-chip").forEach((valueChip) => valueChip.classList.remove("is-selected"));
    chip.classList.add("is-selected");
    $("#valueText").textContent = `${chip.dataset.value}: choose one action small enough to do before motivation arrives.`;
  });

  renderGrounding();
}

function renderGrounding() {
  $("#groundingStep").textContent = `${groundingIndex + 1} of ${groundingSteps.length}`;
  $("#groundingPrompt").textContent = groundingSteps[groundingIndex];
}

function initAgent() {
  const agentInput = $("#agentInput");
  $("#sendAgentMessage").addEventListener("click", handleAgentSubmit);
  agentInput.addEventListener("input", () => {
    resizeAgentInput();
    updateAgentSendState();
  });
  agentInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleAgentSubmit();
    }
  });

  $$("[data-agent-prompt]").forEach((button) => {
    button.addEventListener("click", () => sendAgentPrompt(button.dataset.agentPrompt));
  });

  $("#clearAgentChat").addEventListener("click", () => {
    state.agentMessages = [];
    renderAgentMessages();
    persistState();
    showToast("Agent chat cleared.");
  });
  updateAgentSendState();
}

function handleAgentSubmit() {
  const input = $("#agentInput").value.trim();
  if (!input) {
    showToast("Ask Yassuo anything first.");
    return;
  }

  $("#agentInput").value = "";
  resizeAgentInput();
  updateAgentSendState();
  sendAgentPrompt(input);
}

function resizeAgentInput() {
  const input = $("#agentInput");
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function updateAgentSendState() {
  $("#sendAgentMessage").disabled = !$("#agentInput").value.trim();
}

function sendAgentPrompt(input) {
  state.agentMessages = orderAgentMessages(state.agentMessages);
  const now = new Date().toISOString();
  const pendingId = crypto.randomUUID();
  state.agentMessages.push({
    id: crypto.randomUUID(),
    role: "user",
    text: input,
    createdAt: now,
  });
  state.agentMessages.push({
    id: pendingId,
    role: "agent",
    text: "Yassuo is thinking...",
    createdAt: new Date(Date.now() + 1).toISOString(),
    pending: true,
  });
  state.agentMessages = state.agentMessages.slice(-80);
  renderAgentMessages();

  window.setTimeout(() => {
    const pendingMessage = state.agentMessages.find((message) => message.id === pendingId);
    if (!pendingMessage) return;
    pendingMessage.text = generateAgentReply(input);
    pendingMessage.pending = false;
    renderAgentMessages();
    persistState();
  }, Math.min(900, 260 + input.length * 5));
}

function generateAgentReply(input) {
  const normalized = input.toLowerCase();
  const agentContext = getAgentContext(input);

  if (crisisPhrases.some((phrase) => normalized.includes(phrase))) {
    return "This may be a safety moment, so please do not handle it alone. If there is immediate danger, call local emergency services now or use your saved help contact. Move near another person if you can, and put distance between yourself and anything you could use to get hurt.";
  }

  if (includesAny(normalized, ["are you real", "real ai", "llm", "gpt", "chatgpt", "openai"])) {
    return "I am Yassuo, a local chat agent inside this app. I can answer broadly, reason with what you tell me, remember this account's saved notes, and help you think through almost anything. I do not have live internet or a cloud LLM brain, so I will be honest when I do not know instead of inventing facts.";
  }

  if (hasWholeWord(normalized, ["hi", "hello", "hey", "salam", "bonjour"])) {
    return `${personalGreeting()} What feels most present right now: the feeling, the thought, the situation, or the next decision?`;
  }

  if (includesAny(normalized, ["what can you do", "help me", "how do you work", "what are your limits"])) {
    return "Talk to me naturally. I can explain, plan, draft messages, brainstorm, debug simple ideas, help with decisions, reflect feelings, summarize patterns, and keep a conversation going from your saved local context. I still keep safety boundaries around harm and emergencies.";
  }

  if (includesAny(normalized, ["pattern", "summary", "summarize", "trend"])) {
    return summarizePatterns();
  }

  if (includesAny(normalized, ["mood", "check-in", "check in", "reflect"])) {
    return reflectLatestMood();
  }

  if (!includesAny(normalized, explanationWords) && includesAny(normalized, ["ground", "panic", "anxious", "overwhelmed", "spiral"])) {
    return "Let's make this smaller. Put both feet on the floor. Name five things you see, then take one 4-2-6 breath: inhale for 4, pause for 2, exhale for 6. After that, write the next physical action, not the whole solution.";
  }

  if (!includesAny(normalized, explanationWords) && includesAny(normalized, ["reframe", "thought", "belief", "i am", "i can't", "i cannot"])) {
    return buildReframeReply(input);
  }

  if (includesAny(normalized, ["journal", "journaling prompt", "diary prompt"])) {
    return `Try this prompt: ${prompts[Math.floor(Math.random() * prompts.length)]} Keep it to five honest sentences.`;
  }

  if (includesAny(normalized, technicalWords)) {
    return buildGeneralAssistantReply(input, agentContext, "technical");
  }

  if (includesAny(normalized, explanationWords)) {
    return buildGeneralAssistantReply(input, agentContext, "explain");
  }

  if (includesAny(normalized, planningWords)) {
    return buildGeneralAssistantReply(input, agentContext, "plan");
  }

  if (includesAny(normalized, draftingWords)) {
    return buildGeneralAssistantReply(input, agentContext, "draft");
  }

  if (includesAny(normalized, creativeWords)) {
    return buildGeneralAssistantReply(input, agentContext, "creative");
  }

  if (includesAny(normalized, encouragementWords)) {
    return buildGeneralAssistantReply(input, agentContext, "motivation");
  }

  if (includesAny(normalized, ["sleep", "tired", "rest"])) {
    return "Tonight's version can be simple: lower stimulation, prepare one thing for tomorrow, and let the unfinished parts stay unfinished on paper instead of in your head.";
  }

  if (includesAny(normalized, relationshipWords)) {
    return freeTalkReply(input, agentContext, "relationship");
  }

  if (includesAny(normalized, workWords)) {
    return freeTalkReply(input, agentContext, "pressure");
  }

  if (includesAny(normalized, uncertaintyWords)) {
    return freeTalkReply(input, agentContext, "decision");
  }

  if (includesAny(normalized, feelingWords) || includesAny(normalized, openTalkSignals)) {
    return freeTalkReply(input, agentContext, "feeling");
  }

  if (input.trim().endsWith("?")) {
    return answerOpenQuestion(input, agentContext);
  }

  return freeTalkReply(input, agentContext, "general");
}

function buildGeneralAssistantReply(input, context, mode) {
  const normalized = input.toLowerCase();
  if (includesAny(normalized, ["latest", "today", "news", "weather", "stock", "price", "current"])) {
    return "I do not have live internet in this local app, so I will not pretend to know current facts. Give me the details you have, and I can help you analyze them, compare options, draft a reply, or decide the next step.";
  }

  const topic = extractRequestTopic(input);
  const memoryLine = buildMemoryLine(context);
  const answer = buildModeAnswer(input, mode, topic);
  const followUp = buildModeFollowUp(mode, context);
  return [answer, memoryLine, followUp].filter(Boolean).join(" ");
}

function buildModeAnswer(input, mode, topic) {
  if (mode === "technical") {
    return `Let's handle it like a debugging problem. The clean path is: identify what you expected, what happened instead, copy the exact error, then change one thing at a time. From your message, the first useful move is to make the issue specific enough that we can test it.`;
  }

  if (mode === "explain") {
    return `Short answer: I can help explain ${topic}. The easiest way is to split it into three parts: what it is, why it matters, and one example. If the topic is factual or current, give me the facts you have and I will reason from them instead of guessing.`;
  }

  if (mode === "plan") {
    return `Here is a simple plan for ${topic}: define what "done" means, choose the smallest first action, set a short time box, and decide what can wait. A good plan should make the next move obvious, not make your life look perfect.`;
  }

  if (mode === "draft") {
    return `A clean draft could be: "I want to say this clearly and respectfully: ${makeDraftCore(input)}. I am open to talking about it, but I also want to be honest about what I need."`;
  }

  if (mode === "creative") {
    return `For ${topic}, I would start with three directions: one calm and simple, one bold and memorable, and one personal. Pick the direction that matches the feeling you want people to have, then we can sharpen it.`;
  }

  if (mode === "motivation") {
    return "You probably do not need a huge motivational speech. You need a start that is too small to argue with: two minutes, one tab, one sentence, one clean surface, one message. Momentum usually arrives after movement, not before it.";
  }

  return `I can work with that. The useful move is to separate the goal, the obstacle, and the next action so the whole thing stops feeling like one giant cloud.`;
}

function buildModeFollowUp(mode, context) {
  if (mode === "technical") {
    return "Send me the exact error or the part that behaves wrong, and I will walk through it step by step.";
  }
  if (mode === "explain") {
    return "Do you want the simple version, a deeper version, or an example?";
  }
  if (mode === "plan") {
    return "What is the deadline or the amount of energy you actually have today?";
  }
  if (mode === "draft") {
    return "Should the tone be soft, direct, professional, or emotional?";
  }
  if (mode === "creative") {
    return "Do you want more ideas, or should I refine one strong option?";
  }
  if (context.recentUserMessages.length) {
    return "I can also connect this to what you said earlier if that would help.";
  }
  return "Tell me one more detail and I will make the answer more specific.";
}

function buildMemoryLine(context) {
  if (context.latestMood) {
    return `I am also keeping your latest mood in mind: ${context.latestMood.score}/10.`;
  }
  if (context.recentUserMessages.length) {
    return "I am keeping the recent thread of this chat in mind.";
  }
  return "";
}

function extractRequestTopic(input) {
  const cleaned = input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(can you|could you|please|pls|help me|i need you to|tell me about|explain|define|what is|what are|how do|how does|write|draft|plan|brainstorm)\s+/i, "")
    .replace(/[?.!]+$/g, "");
  return cleaned || "this";
}

function makeDraftCore(input) {
  const normalized = input.toLowerCase();
  if (includesAny(normalized, ["sorry", "apologize", "apology"])) {
    return "I am sorry for my part in what happened, and I want to repair it without making excuses";
  }
  if (includesAny(normalized, ["boundary", "no", "can't", "cannot"])) {
    return "I cannot commit to that right now, and I need to protect my time and energy";
  }
  if (includesAny(normalized, ["thank", "grateful", "appreciate"])) {
    return "I appreciate what you did, and I wanted to say thank you properly";
  }
  return "this matters to me, and I want to handle it with care";
}

function reflectLatestMood() {
  const latest = state.moods[0];
  if (!latest) {
    return "I do not have a saved mood yet. Do a quick check-in first, then I can reflect it back with a more useful next step.";
  }

  const emotions = latest.emotions || [];
  const emotionsLine = emotions.length
    ? ` You marked ${emotions.join(", ").toLowerCase()}.`
    : "";
  const suggestion =
    latest.score <= 4
      ? "Make the next task protective, not productive: food, water, contact, rest, or safety."
      : latest.score <= 7
        ? "Choose a steadying action before a solving action."
        : "Use the steadiness gently: do one meaningful thing and leave margin.";

  return `Your latest check-in was ${latest.score}/10, which reads as ${moodText(latest.score).toLowerCase()}.${emotionsLine} ${suggestion}`;
}

function summarizePatterns() {
  const recentMoods = state.moods.slice(0, 7);
  const recentJournals = state.journals.slice(0, 3);

  if (!recentMoods.length && !recentJournals.length) {
    return "There is not enough saved data for a pattern yet. Add a few check-ins or journal entries and I can help you notice what repeats.";
  }

  const average = recentMoods.length
    ? (recentMoods.reduce((total, entry) => total + entry.score, 0) / recentMoods.length).toFixed(1)
    : null;
  const topEmotion = getTopEmotion(recentMoods);
  const journalLine = recentJournals.length
    ? ` You also have ${recentJournals.length} recent journal entr${recentJournals.length === 1 ? "y" : "ies"}, so writing is becoming part of the care loop.`
    : "";

  if (!average) {
    return `Your recent pattern is mostly in the journal right now.${journalLine} Add mood check-ins when you can so we can connect feelings to days.`;
  }

  return `Across your last ${recentMoods.length} check-in${recentMoods.length === 1 ? "" : "s"}, your average mood is ${average}/10.${topEmotion ? ` The emotion showing up most is ${topEmotion.toLowerCase()}.` : ""}${journalLine} The next useful experiment is to notice what happens before the number changes.`;
}

function buildReframeReply(input) {
  const thought = input
    .replace(/help me reframe/gi, "")
    .replace(/reframe/gi, "")
    .replace(/this thought/gi, "")
    .trim();

  if (thought.length < 8) {
    return "Write the exact automatic thought, then ask me again. A good reframe starts with the real sentence, not the polished one.";
  }

  return `Try: "I am having the thought that ${thought}. It may be pointing to something important, but it is not the whole truth. One balanced next step is to check the facts and choose the smallest repair."`;
}

function personalGreeting() {
  const name = currentUser?.name?.split(" ")[0];
  return name ? `Hi ${name}. I am here.` : "Hi. I am here.";
}

function getAgentContext(input) {
  const latestMood = state.moods[0] || null;
  const recentJournal = state.journals[0] || null;
  const recentUserMessages = orderAgentMessages(state.agentMessages)
    .filter((message) => message.role === "user" && message.text !== input)
    .slice(-3)
    .map((message) => message.text);
  const detectedFeeling = feelingWords.find((word) => input.toLowerCase().includes(word)) || "";

  return {
    detectedFeeling,
    latestMood,
    recentJournal,
    recentUserMessages,
  };
}

function freeTalkReply(input, context, mode) {
  const reflection = buildReflection(input, context);
  const validation = buildValidation(context, mode);
  const nextMove = buildNextMove(mode, context);
  const question = buildFollowUpQuestion(mode, context);

  return `${reflection} ${validation} ${nextMove} ${question}`;
}

function buildReflection(input, context) {
  const cleaned = input.trim().replace(/\s+/g, " ");
  if (context.detectedFeeling) {
    return `It sounds like ${context.detectedFeeling} is part of this.`;
  }
  if (cleaned.length < 36) {
    return `I hear you saying: "${cleaned}".`;
  }
  return `I hear a few layers in that: what happened, what it means to you, and what it is asking from you now.`;
}

function buildValidation(context, mode) {
  const moodLine = context.latestMood
    ? ` Your latest check-in is ${context.latestMood.score}/10, so I will keep this grounded and practical.`
    : "";

  if (mode === "relationship") {
    return `It makes sense that relationships can feel loud inside because they touch belonging, boundaries, and repair.${moodLine}`;
  }
  if (mode === "pressure") {
    return `Pressure often tricks the mind into treating everything as urgent at once.${moodLine}`;
  }
  if (mode === "decision") {
    return `Uncertainty can feel like danger even when it is really a request for clearer options.${moodLine}`;
  }
  if (mode === "feeling") {
    return `You do not have to justify the feeling before you care for it.${moodLine}`;
  }
  return `We can stay with this without rushing to fix the whole thing.${moodLine}`;
}

function buildNextMove(mode, context) {
  if (mode === "relationship") {
    return "Try separating the facts from the story: what did they do, what did you feel, and what boundary or request would be honest?";
  }
  if (mode === "pressure") {
    return "Pick the smallest visible step, then make a second list called 'not now' so your mind can stop holding everything.";
  }
  if (mode === "decision") {
    return "Name the two or three real options, then ask which one protects your values with the least self-betrayal.";
  }
  if (mode === "feeling" && context.detectedFeeling) {
    return `For ${context.detectedFeeling}, start with the body first: breathe out slowly, relax your jaw, and lower today's demand by one notch.`;
  }
  return "A useful next step is to write one sentence beginning with 'The part I am avoiding is...' and answer it plainly.";
}

function buildFollowUpQuestion(mode, context) {
  if (mode === "relationship") {
    return "Do you want to be understood, to set a boundary, or to decide what to do next?";
  }
  if (mode === "pressure") {
    return "What is the one thing that would make the next hour 10% less heavy?";
  }
  if (mode === "decision") {
    return "What would you choose if you only had to live with the next 24 hours, not the whole future?";
  }
  if (context.recentUserMessages.length) {
    return "Is this connected to what you mentioned earlier, or does it feel like a new thread?";
  }
  return "What part should we stay with first: the feeling, the thought, or the situation?";
}

function answerOpenQuestion(input, context) {
  const normalized = input.toLowerCase();
  if (includesAny(normalized, ["why do i", "why am i"])) {
    return "There may be a reason, but we do not have to force one too quickly. A gentler way in is: what was happening right before this feeling got stronger, and what did your mind decide it meant about you?";
  }
  if (includesAny(normalized, ["what should i do", "what do i do"])) {
    return "Start with a stabilizing step, then a clarifying step. Stabilize: breathe, drink water, and reduce stimulation. Clarify: write the smallest honest action you can take without pretending the whole problem is solved.";
  }
  if (includesAny(normalized, ["am i wrong", "is it wrong", "am i bad"])) {
    return "I would not jump straight to judging you. Let's separate impact from identity: what happened, who was affected, what can be repaired, and what does not need to become a story about your whole self?";
  }
  if (includesAny(normalized, ["will i be okay", "is it going to be okay"])) {
    return "I cannot promise the future, but I can stay with this moment. Right now the goal is not to solve your life; it is to get through the next few minutes with care and less aloneness.";
  }

  return freeTalkReply(input, context, "general");
}

function getTopEmotion(entries) {
  const counts = new Map();
  entries.forEach((entry) => {
    (entry.emotions || []).forEach((emotion) =>
      counts.set(emotion, (counts.get(emotion) || 0) + 1),
    );
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function includesAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

function hasWholeWord(value, words) {
  return words.some((word) => new RegExp(`(^|\\W)${escapeRegExp(word)}(\\W|$)`, "i").test(value));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderAgentMessages() {
  const messages = state.agentMessages.length
    ? orderAgentMessages(state.agentMessages)
    : [
        {
          role: "agent",
          text: "Hi, I am Yassuo. You can talk to me freely. I can reflect, ask questions, help you reframe, ground you, or notice patterns from your local notes.",
        },
      ];

  $("#agentMessages").innerHTML = messages
    .map(
      (message) => `
        <article class="agent-message is-${message.role === "user" ? "user" : "agent"}${message.pending ? " is-pending" : ""}">
          <strong>${message.role === "user" ? "You" : "Yassuo"}</strong>
          <p>${escapeHtml(message.text)}</p>
        </article>
      `,
    )
    .join("");

  const messagePanel = $("#agentMessages");
  messagePanel.scrollTop = messagePanel.scrollHeight;
}

function orderAgentMessages(messages) {
  const ordered = [...messages].sort((a, b) => {
    const timeDifference = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    if (timeDifference !== 0) return timeDifference;
    if (a.role === b.role) return 0;
    return a.role === "user" ? -1 : 1;
  });

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    const currentTime = new Date(current.createdAt || 0).getTime();
    const nextTime = new Date(next.createdAt || 0).getTime();
    if (
      current.role === "agent" &&
      next.role === "user" &&
      Math.abs(currentTime - nextTime) < 5000
    ) {
      ordered[index] = next;
      ordered[index + 1] = current;
    }
  }

  return ordered;
}

function initSafetyPlan() {
  $$("[data-plan]").forEach((field) => {
    field.addEventListener("input", () => {
      state.safetyPlan[field.dataset.plan] = field.value;
      persistState();
    });
  });
}

function populateSafetyPlan() {
  $$("[data-plan]").forEach((field) => {
    field.value = state.safetyPlan[field.dataset.plan] || "";
  });
}

function initExport() {
  $("#exportData").addEventListener("click", () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        account: currentUser
          ? {
              name: currentUser.name,
              email: currentUser.email,
            }
          : null,
        ...state,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stillpoint-notes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Export started.");
  });
}

function render() {
  renderMood();
  renderJournal();
  renderReframes();
  renderAgentMessages();
  updateProgressStatus();
  $("#streakText").textContent = careStreak()
    ? "You showed up today."
    : "A check-in or entry starts it.";
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

async function bootApp() {
  initAuth();
  const user = await window.StillpointDB.getCurrentUser();
  if (user) {
    await showApp(user);
  } else {
    showAuth("login");
  }
}

bootApp().catch((error) => {
  console.error("Could not start Stillpoint", error);
  showAuth("login");
  $("#authMessage").textContent = "Could not open the account database.";
});
