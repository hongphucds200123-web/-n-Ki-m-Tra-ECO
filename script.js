const STORAGE_KEYS = {
  wrong: "eco111_wrong_ids_v2",
  stats: "eco111_stats_v2",
};

const state = {
  bank: QUESTION_BANK,
  session: [],
  sessionAnswers: {},
  currentIndex: 0,
  submittedCurrent: false,
  score: 0,
  timerId: null,
  remainingSeconds: 0,
  startedAt: null,
  instantFeedback: false,
  lastSessionMistakes: [],
};

const els = {
  mode: document.getElementById("mode"),
  order: document.getElementById("order"),
  questionCount: document.getElementById("questionCount"),
  timeLimit: document.getElementById("timeLimit"),
  instantFeedback: document.getElementById("instantFeedback"),
  startBtn: document.getElementById("startBtn"),
  resumeWrongBtn: document.getElementById("resumeWrongBtn"),
  clearWrongBtn: document.getElementById("clearWrongBtn"),
  resetProgressBtn: document.getElementById("resetProgressBtn"),
  welcomeView: document.getElementById("welcomeView"),
  quizView: document.getElementById("quizView"),
  resultView: document.getElementById("resultView"),
  currentIndex: document.getElementById("currentIndex"),
  totalInSession: document.getElementById("totalInSession"),
  currentScore: document.getElementById("currentScore"),
  timerBox: document.getElementById("timerBox"),
  questionNumber: document.getElementById("questionNumber"),
  questionText: document.getElementById("questionText"),
  optionsContainer: document.getElementById("optionsContainer"),
  feedbackBox: document.getElementById("feedbackBox"),
  prevBtn: document.getElementById("prevBtn"),
  submitBtn: document.getElementById("submitBtn"),
  nextBtn: document.getElementById("nextBtn"),
  finishBtn: document.getElementById("finishBtn"),
  progressFill: document.getElementById("progressFill"),
  markWrongBtn: document.getElementById("markWrongBtn"),
  statTotal: document.getElementById("statTotal"),
  statWrong: document.getElementById("statWrong"),
  statCompleted: document.getElementById("statCompleted"),
  statAccuracy: document.getElementById("statAccuracy"),
  resultTitle: document.getElementById("resultTitle"),
  resultCorrect: document.getElementById("resultCorrect"),
  resultWrong: document.getElementById("resultWrong"),
  resultAccuracy: document.getElementById("resultAccuracy"),
  resultTime: document.getElementById("resultTime"),
  restartBtn: document.getElementById("restartBtn"),
  reviewMistakesBtn: document.getElementById("reviewMistakesBtn"),
  mistakeList: document.getElementById("mistakeList"),
};

function loadWrongIds() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.wrong) || "[]");
}

function saveWrongIds(ids) {
  localStorage.setItem(STORAGE_KEYS.wrong, JSON.stringify([...new Set(ids)]));
  renderStats();
}

function loadStats() {
  return JSON.parse(
    localStorage.getItem(STORAGE_KEYS.stats) ||
      '{"correct":0,"wrong":0,"completedQuestionIds":[]}'
  );
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
  renderStats();
}

function renderStats() {
  const wrongIds = loadWrongIds();
  const stats = loadStats();
  const totalAnswered = stats.correct + stats.wrong;
  const accuracy = totalAnswered ? Math.round((stats.correct / totalAnswered) * 100) : 0;

  els.statTotal.textContent = state.bank.length;
  els.statWrong.textContent = wrongIds.length;
  els.statCompleted.textContent = new Set(stats.completedQuestionIds || []).size;
  els.statAccuracy.textContent = accuracy + "%";
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickSessionQuestions() {
  const mode = els.mode.value;
  const order = els.order.value;
  let count = parseInt(els.questionCount.value, 10);

  let pool = [...state.bank];
  const wrongIds = loadWrongIds();
  const stats = loadStats();
  const completed = new Set(stats.completedQuestionIds || []);

  if (mode === "wrong") {
    pool = pool.filter((q) => wrongIds.includes(q.id));
  } else if (mode === "unanswered") {
    pool = pool.filter((q) => !completed.has(q.id));
  }

  if (!pool.length) {
    alert("No questions available for this mode yet.");
    return [];
  }

  if (!Number.isFinite(count) || count < 1) count = 1;
  count = Math.min(count, pool.length);

  if (order === "random") {
    pool = shuffle(pool);
  } else {
    pool.sort((a, b) => a.id - b.id);
  }

  return pool.slice(0, count);
}

function startSession(customQuestions = null) {
  const sessionQuestions = customQuestions || pickSessionQuestions();
  if (!sessionQuestions.length) return;

  state.session = sessionQuestions;
  state.sessionAnswers = {};
  state.currentIndex = 0;
  state.submittedCurrent = false;
  state.score = 0;
  state.lastSessionMistakes = [];
  state.instantFeedback = els.instantFeedback.checked;
  state.startedAt = Date.now();

  startTimer();

  showView("quiz");
  renderQuestion();
}

function showView(view) {
  els.welcomeView.classList.toggle("hidden", view !== "welcome");
  els.quizView.classList.toggle("hidden", view !== "quiz");
  els.resultView.classList.toggle("hidden", view !== "results");
}

function currentQuestion() {
  return state.session[state.currentIndex];
}

function renderQuestion() {
  const q = currentQuestion();
  const saved = state.sessionAnswers[q.id];

  state.submittedCurrent = saved?.isSubmitted || false;

  els.currentIndex.textContent = state.currentIndex + 1;
  els.totalInSession.textContent = state.session.length;
  els.currentScore.textContent = state.score;
  els.questionNumber.textContent = "#" + q.id;
  els.questionText.textContent = q.question;
  els.optionsContainer.innerHTML = "";
  els.feedbackBox.className = "feedback hidden";
  els.feedbackBox.innerHTML = "";

  Object.entries(q.options).forEach(([key, value]) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.type = "button";
    btn.dataset.key = key;
    btn.innerHTML = `
      <span class="option-key">${key}</span>
      <span class="option-text">${value || "N/A"}</span>
    `;

    if (saved?.selected === key) btn.classList.add("selected");

    if (saved?.isSubmitted) {
      if (key === q.answer) btn.classList.add("correct");
      if (saved.selected === key && key !== q.answer) btn.classList.add("wrong");
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => selectOption(key));
    }

    els.optionsContainer.appendChild(btn);
  });

  if (saved?.isSubmitted) {
    renderFeedback(saved.selected === q.answer, q.answer, saved.selected, q.note);
  }

  updateProgress();
  updateNavButtons();
}

function selectOption(key) {
  const q = currentQuestion();
  state.sessionAnswers[q.id] = {
    ...(state.sessionAnswers[q.id] || {}),
    selected: key,
    isSubmitted: false,
  };

  [...els.optionsContainer.children].forEach((node) =>
    node.classList.toggle("selected", node.dataset.key === key)
  );
}

function submitAnswer() {
  const q = currentQuestion();
  const chosen = state.sessionAnswers[q.id]?.selected;

  if (!chosen) {
    alert("Pick an answer first.");
    return;
  }

  if (state.sessionAnswers[q.id]?.isSubmitted) return;

  const isCorrect = chosen === q.answer;
  state.sessionAnswers[q.id].isSubmitted = true;
  state.sessionAnswers[q.id].correct = isCorrect;

  if (isCorrect) {
    state.score += 1;
    removeFromWrongList(q.id);
  } else {
    addToWrongList(q.id);
    state.lastSessionMistakes.push({
      id: q.id,
      question: q.question,
      selected: chosen,
      answer: q.answer,
    });
  }

  updatePersistentStats(q.id, isCorrect);
  renderQuestion();
}

function renderFeedback(isCorrect, answer, selected, note = "") {
  els.feedbackBox.className = "feedback " + (isCorrect ? "good" : "bad");
  els.feedbackBox.classList.remove("hidden");
  els.feedbackBox.innerHTML = isCorrect
    ? `<strong>Correct.</strong> Nice hit. ${note ? `<br><small>${note}</small>` : ""}`
    : `<strong>Wrong.</strong> You chose <b>${selected}</b>. Correct answer is <b>${answer}</b>. ${note ? `<br><small>${note}</small>` : ""}`;
}

function updateProgress() {
  const pct = ((state.currentIndex + 1) / state.session.length) * 100;
  els.progressFill.style.width = pct + "%";
}

function updateNavButtons() {
  els.prevBtn.disabled = state.currentIndex === 0;
  els.nextBtn.disabled = state.currentIndex >= state.session.length - 1;
}

function goNext() {
  if (state.currentIndex < state.session.length - 1) {
    state.currentIndex += 1;
    renderQuestion();
  }
}

function goPrev() {
  if (state.currentIndex > 0) {
    state.currentIndex -= 1;
    renderQuestion();
  }
}

function addToWrongList(id) {
  const ids = loadWrongIds();
  if (!ids.includes(id)) ids.push(id);
  saveWrongIds(ids);
}

function removeFromWrongList(id) {
  const ids = loadWrongIds().filter((item) => item !== id);
  saveWrongIds(ids);
}

function updatePersistentStats(questionId, isCorrect) {
  const stats = loadStats();

  if (isCorrect) {
    stats.correct += 1;
  } else {
    stats.wrong += 1;
  }

  stats.completedQuestionIds = Array.from(
    new Set([...(stats.completedQuestionIds || []), questionId])
  );

  saveStats(stats);
}

function startTimer() {
  clearInterval(state.timerId);
  const minutes = parseInt(els.timeLimit.value, 10);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    state.remainingSeconds = 0;
    els.timerBox.textContent = "∞";
    return;
  }

  state.remainingSeconds = minutes * 60;
  renderTimer();

  state.timerId = setInterval(() => {
    state.remainingSeconds -= 1;
    renderTimer();

    if (state.remainingSeconds <= 0) {
      clearInterval(state.timerId);
      finishSession(true);
    }
  }, 1000);
}

function renderTimer() {
  if (parseInt(els.timeLimit.value, 10) <= 0) {
    els.timerBox.textContent = "∞";
    return;
  }

  const mins = String(Math.max(0, Math.floor(state.remainingSeconds / 60))).padStart(2, "0");
  const secs = String(Math.max(0, state.remainingSeconds % 60)).padStart(2, "0");
  els.timerBox.textContent = `${mins}:${secs}`;
}

function finishSession(isAuto = false) {
  clearInterval(state.timerId);

  const total = state.session.length;
  const correct = Object.values(state.sessionAnswers).filter((x) => x.correct).length;
  const wrong = total - correct;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const usedMinutes = Math.max(1, Math.round((Date.now() - state.startedAt) / 60000));

  els.resultTitle.textContent = isAuto ? "Time is up." : (accuracy >= 80 ? "Strong work." : "Session finished.");
  els.resultCorrect.textContent = correct;
  els.resultWrong.textContent = wrong;
  els.resultAccuracy.textContent = accuracy + "%";
  els.resultTime.textContent = usedMinutes + " min";

  renderMistakes();
  showView("results");
  renderStats();
}

function renderMistakes() {
  els.mistakeList.innerHTML = "";

  if (!state.lastSessionMistakes.length) {
    els.mistakeList.innerHTML = `<div class="mistake-item"><p>No mistakes this round. Clean sweep.</p></div>`;
    return;
  }

  state.lastSessionMistakes.forEach((item) => {
    const div = document.createElement("div");
    div.className = "mistake-item";
    div.innerHTML = `
      <p><strong>#${item.id}</strong> ${item.question}</p>
      <p>Your answer: <b>${item.selected}</b> &nbsp;•&nbsp; Correct: <b>${item.answer}</b></p>
    `;
    els.mistakeList.appendChild(div);
  });
}

function reviewMistakesNow() {
  const wrongIds = state.lastSessionMistakes.map((x) => x.id);
  if (!wrongIds.length) {
    alert("No mistakes in the last session.");
    return;
  }

  const questions = state.bank.filter((q) => wrongIds.includes(q.id));
  startSession(questions);
}

function markCurrentAsWrong() {
  const q = currentQuestion();
  addToWrongList(q.id);
  alert(`Question #${q.id} saved to wrong list.`);
}

els.startBtn.addEventListener("click", () => startSession());
els.resumeWrongBtn.addEventListener("click", () => {
  els.mode.value = "wrong";
  startSession();
});
els.prevBtn.addEventListener("click", goPrev);
els.nextBtn.addEventListener("click", goNext);
els.submitBtn.addEventListener("click", submitAnswer);
els.finishBtn.addEventListener("click", () => finishSession(false));
els.restartBtn.addEventListener("click", () => showView("welcome"));
els.reviewMistakesBtn.addEventListener("click", reviewMistakesNow);
els.markWrongBtn.addEventListener("click", markCurrentAsWrong);

els.clearWrongBtn.addEventListener("click", () => {
  if (confirm("Clear the saved wrong-question list?")) {
    saveWrongIds([]);
  }
});

els.resetProgressBtn.addEventListener("click", () => {
  if (confirm("Reset all progress and stats?")) {
    localStorage.removeItem(STORAGE_KEYS.wrong);
    localStorage.removeItem(STORAGE_KEYS.stats);
    renderStats();
  }
});

renderStats();
showView("welcome");
