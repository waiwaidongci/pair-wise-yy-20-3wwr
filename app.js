const storageKey = "wxyy-4-luogujing-grid";
const instruments = [
  { name: "大锣", token: "仓", freq: 180 },
  { name: "鼓", token: "冬", freq: 120 },
  { name: "钹", token: "才", freq: 360 },
  { name: "小锣", token: "台", freq: 520 }
];
const steps = 16;
const defaults = {
  pieceName: "出场锣鼓-慢起",
  bpm: 96,
  loop: "",
  countIn: 4,
  loopCount: 4,
  notes: [],
  pattern: instruments.map((instrument) => Array.from({ length: steps }, (_, index) => index % 4 === 0 ? instrument.token : "")),
  saved: []
};
const state = { ...defaults, ...(JSON.parse(localStorage.getItem(storageKey) || "null") || {}) };
// 规整历史数据里越界的预备拍与循环次数
if (!Rules.isValidCountIn(state.countIn)) state.countIn = defaults.countIn;
if (!Rules.isValidLoopCount(state.loopCount)) state.loopCount = defaults.loopCount;

let timer = null;
let playhead = 0;
let audioContext = null;
let session = null; // { phase: "countin" | "play", countInLeft, passes }

const grid = document.querySelector("#grid");
const savedList = document.querySelector("#savedList");
const recordList = document.querySelector("#recordList");
const structure = document.querySelector("#structure");
const notesList = document.querySelector("#notesList");
const pieceName = document.querySelector("#pieceName");
const bpmInput = document.querySelector("#bpmInput");
const loopSelect = document.querySelector("#loopSelect");
const countInSelect = document.querySelector("#countInSelect");
const loopCountInput = document.querySelector("#loopCountInput");
const noteInput = document.querySelector("#noteInput");
const message = document.querySelector("#message");

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function syncFields() {
  pieceName.value = state.pieceName;
  bpmInput.value = state.bpm;
  loopSelect.value = state.loop;
  countInSelect.value = String(state.countIn);
  loopCountInput.value = state.loopCount;
}

function showMessage(text, kind = "info") {
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = !text;
}

function clearMessage() {
  showMessage("");
}

function beatLabel(index) {
  const measure = Math.floor(index / 4) + 1;
  const beat = (index % 4) + 1;
  return `${measure}-${beat}`;
}

function renderGrid() {
  const header = ['<div class="label-cell">乐器</div>'];
  for (let i = 0; i < steps; i += 1) {
    header.push(`<div class="beat-cell">${beatLabel(i)}</div>`);
  }

  const rows = instruments.flatMap((instrument, rowIndex) => {
    const row = [`<div class="label-cell">${instrument.name}</div>`];
    for (let step = 0; step < steps; step += 1) {
      const value = state.pattern[rowIndex][step];
      row.push(`<button class="cell ${value ? "filled" : ""}" type="button" data-row="${rowIndex}" data-step="${step}">${value}</button>`);
    }
    return row;
  });

  grid.innerHTML = [...header, ...rows].join("");
}

function renderRecords() {
  const records = Records.list();
  recordList.innerHTML = records.length ? records.map((item) => `
    <article class="record-item">
      <strong>${item.name}</strong>
      <span>完成${item.passes}遍${item.interrupted ? "（中断）" : ""} · ${item.bpm}BPM</span>
      <time>${new Date(item.at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
    </article>
  `).join("") : "<p>还没有排练记录。</p>";
}

function renderSidebars() {
  const filledByMeasure = [0, 1, 2, 3].map((measure) => {
    const start = measure * 4;
    const count = state.pattern.flatMap((row) => row.slice(start, start + 4)).filter(Boolean).length;
    return { measure: measure + 1, count };
  });
  structure.innerHTML = filledByMeasure.map((item) => `
    <div class="structure-row"><span>第${item.measure}小节</span><strong>${item.count}个口令</strong></div>
  `).join("");

  notesList.innerHTML = state.notes.length ? state.notes.map((note) => `
    <article class="note"><p>${note}</p></article>
  `).join("") : "<p>暂无批注。</p>";

  savedList.innerHTML = state.saved.length ? state.saved.map((item) => `
    <button class="saved-item" type="button" data-load="${item.id}">
      <strong>${item.name}</strong><br><span>${item.bpm}BPM · 预备${item.countIn ?? "—"}拍 · ${item.loopCount ?? "—"}遍 · ${item.notes.length}条批注</span>
    </button>
  `).join("") : "<p>还没有保存方案。</p>";

  renderRecords();
}

function render() {
  syncFields();
  renderGrid();
  renderSidebars();
}

function playSound(instrument) {
  audioContext ||= new AudioContext();
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.frequency.value = instrument.freq;
  osc.type = instrument.name === "鼓" ? "sine" : "square";
  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
  osc.connect(gain).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + 0.09);
}

function playClick() {
  audioContext ||= new AudioContext();
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.frequency.value = 880;
  osc.type = "triangle";
  gain.gain.setValueAtTime(0.12, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.06);
  osc.connect(gain).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + 0.07);
}

function highlight(step) {
  document.querySelectorAll(".cell.playing").forEach((cell) => cell.classList.remove("playing"));
  document.querySelectorAll(`[data-step="${step}"]`).forEach((cell) => cell.classList.add("playing"));
}

function clearHighlight() {
  document.querySelectorAll(".cell.playing").forEach((cell) => cell.classList.remove("playing"));
}

function currentRange() {
  if (state.loop === "") return [0, steps - 1];
  const start = Number(state.loop) * 4;
  return [start, start + 3];
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function finishSession(reason, cause = "") {
  stopTimer();
  clearHighlight();
  const passes = session ? session.passes : 0;
  session = null;
  if (passes > 0) {
    Records.add({
      name: state.pieceName || "未命名片段",
      bpm: state.bpm,
      passes,
      goal: state.loopCount,
      interrupted: reason === "interrupted",
      at: new Date().toISOString()
    });
    renderRecords();
  }
  if (reason === "done") {
    showMessage(`已完成 ${passes} 遍循环，本次遍数已留下。`, "ok");
  } else {
    const prefix = cause ? `${cause}在播放中改变，` : "";
    showMessage(passes > 0
      ? `${prefix}本次练习中断，已完成的 ${passes} 遍记录已保留。`
      : `${prefix}本次练习中断，未完成整遍。`, "info");
  }
}

function interruptIfPlaying(cause) {
  if (session) finishSession("interrupted", cause);
}

function tick() {
  if (!session) return;
  const [start, end] = currentRange();

  if (session.phase === "countin") {
    showMessage(`预备拍 ${session.countInLeft} / ${state.countIn}`, "info");
    playClick();
    session.countInLeft -= 1;
    if (session.countInLeft === 0) {
      session.phase = "play";
      playhead = start;
      clearMessage();
    }
    return;
  }

  if (playhead < start || playhead > end) playhead = start;
  highlight(playhead);
  instruments.forEach((instrument, rowIndex) => {
    if (state.pattern[rowIndex][playhead]) playSound(instrument);
  });
  if (playhead >= end) {
    session.passes += 1;
    if (session.passes >= state.loopCount) {
      finishSession("done");
      return;
    }
    playhead = start;
  } else {
    playhead += 1;
  }
}

grid.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const row = Number(cell.dataset.row);
  const step = Number(cell.dataset.step);
  state.pattern[row][step] = state.pattern[row][step] ? "" : instruments[row].token;
  save();
  render();
});

pieceName.addEventListener("input", () => {
  state.pieceName = pieceName.value;
  save();
});

bpmInput.addEventListener("input", () => {
  const value = Number(bpmInput.value);
  if (!Rules.isValidBpm(value)) {
    showMessage(`速度需在 ${Rules.BPM_MIN}–${Rules.BPM_MAX} BPM 之间，原设置未改动。`, "error");
    return;
  }
  state.bpm = value;
  save();
  if (message.dataset.kind === "error") clearMessage();
  if (timer) {
    clearInterval(timer);
    timer = setInterval(tick, 60000 / state.bpm);
  }
});

loopSelect.addEventListener("change", () => {
  state.loop = loopSelect.value;
  playhead = currentRange()[0];
  save();
});

countInSelect.addEventListener("change", () => {
  state.countIn = Number(countInSelect.value);
  save();
  interruptIfPlaying("预备拍");
});

loopCountInput.addEventListener("input", () => {
  const value = Number(loopCountInput.value);
  if (!Rules.isValidLoopCount(value)) {
    showMessage(`循环次数需为 ${Rules.LOOP_COUNT_MIN}–${Rules.LOOP_COUNT_MAX} 次，原设置未改动。`, "error");
    return;
  }
  state.loopCount = value;
  save();
  if (message.dataset.kind === "error") clearMessage();
  interruptIfPlaying("循环次数");
});

noteInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !noteInput.value.trim()) return;
  state.notes.unshift(noteInput.value.trim());
  noteInput.value = "";
  save();
  renderSidebars();
});

document.querySelector("#playBtn").addEventListener("click", () => {
  const problems = Rules.validateRehearsal(state);
  if (problems.length) {
    showMessage(`无法开排：${problems.join("；")}`, "error");
    return;
  }
  clearMessage();
  stopTimer();
  clearHighlight();
  session = { phase: "countin", countInLeft: state.countIn, passes: 0 };
  playhead = currentRange()[0];
  tick();
  timer = setInterval(tick, 60000 / state.bpm);
});

document.querySelector("#stopBtn").addEventListener("click", () => {
  if (session) {
    finishSession("interrupted");
  } else {
    stopTimer();
    clearHighlight();
  }
});

document.querySelector("#saveBtn").addEventListener("click", () => {
  state.saved.unshift({
    id: crypto.randomUUID(),
    name: state.pieceName || "未命名片段",
    bpm: state.bpm,
    loop: state.loop,
    countIn: state.countIn,
    loopCount: state.loopCount,
    notes: [...state.notes],
    pattern: state.pattern.map((row) => [...row]),
    createdAt: new Date().toISOString()
  });
  save();
  renderSidebars();
});

savedList.addEventListener("click", (event) => {
  const id = event.target.closest("[data-load]")?.dataset.load;
  const item = state.saved.find((entry) => entry.id === id);
  if (!item) return;
  stopTimer();
  session = null;
  clearHighlight();
  state.pieceName = item.name;
  state.bpm = item.bpm;
  state.loop = item.loop;
  state.countIn = Rules.isValidCountIn(item.countIn) ? item.countIn : state.countIn;
  state.loopCount = Rules.isValidLoopCount(item.loopCount) ? item.loopCount : state.loopCount;
  state.notes = [...item.notes];
  state.pattern = item.pattern.map((row) => [...row]);
  save();
  render();
});

render();
