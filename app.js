const storageKey = "wxyy-4-luogujing-grid";
const instruments = [
  { name: "大锣", token: "仓", freq: 180 },
  { name: "鼓", token: "冬", freq: 120 },
  { name: "钹", token: "才", freq: 360 },
  { name: "小锣", token: "台", freq: 520 }
];

const persisted = JSON.parse(localStorage.getItem(storageKey) || "null") || {};
const state = {
  pieceName: persisted.pieceName ?? "出场锣鼓-慢起",
  bpm: persisted.bpm ?? Rules.DEFAULTS.bpm,
  loop: persisted.loop ?? "",
  prepBeats: Rules.clampPrep(persisted.prepBeats ?? Rules.DEFAULTS.prepBeats),
  loopTimes: Rules.clampTimes(persisted.loopTimes ?? Rules.DEFAULTS.loopTimes),
  notes: Array.isArray(persisted.notes) ? persisted.notes : [],
  pattern: persisted.pattern || instruments.map((instrument) =>
    Array.from({ length: Rules.STEPS }, (_, index) =>
      index % Rules.BEATS_PER_MEASURE === 0 ? instrument.token : ""
    )
  ),
  saved: Array.isArray(persisted.saved) ? persisted.saved : [],
  records: Records.clone(persisted.records)
};

let audioContext = null;

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function playSound(instrument) {
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
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

// 预备拍用木鱼式轻点的 woodblock 音色，区别于正式口令。
function playCountSound() {
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.frequency.value = 880;
  osc.type = "triangle";
  gain.gain.setValueAtTime(0.05, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
  osc.connect(gain).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + 0.06);
}

function snapshotSession(completed, total) {
  return {
    name: state.pieceName || "未命名片段",
    bpm: state.bpm,
    prepBeats: state.prepBeats,
    total,
    completed
  };
}

const page = createPage(instruments, {
  onPlay,
  onStop,
  onSave,
  onLoad,
  onCell,
  onName,
  onBpm,
  onLoop,
  onPrep,
  onTimes,
  onNote
});

const engine = Rules.createRehearsal({
  onCount: (remaining, total) => {
    playCountSound();
    page.showCount(remaining, total);
  },
  onStep: (step, info) => {
    page.highlight(step);
    page.showPass(info.pass, info.total);
    instruments.forEach((instrument, rowIndex) => {
      if (state.pattern[rowIndex][step]) playSound(instrument);
    });
  },
  onPass: (completed, total) => {
    page.showStatus(`已完成 ${completed}/${total} 遍`, "running");
  },
  onEnd: (completed, reason, snap) => {
    // 不管是完成、中断还是手动停止，这次完成的遍数都留下。
    state.records = Records.append(state.records, {
      ...snapshotSession(completed, snap.total),
      prepBeats: snap.prepBeats,
      bpm: snap.bpm
    }, reason);
    save();
    page.setRunning(false);
    page.clearHighlight();
    page.clearBadge();
    page.renderRecords(state.records);
    if (reason === "finished") {
      page.showStatus(`练习完成：共 ${snap.total} 遍`, "ok");
    } else if (reason === "interrupted") {
      page.showStatus(`练习中断，已保留已完成的 ${completed} 遍`, "warn");
    } else {
      page.showStatus(`已停止，已保留已完成的 ${completed} 遍`, "idle");
    }
  }
});

// 播放前校验：谱面无口令或速度越界时，预备拍/次数设置不生效。
function validationMessage() {
  const result = Rules.validatePlayback(state.pattern, state.bpm);
  return result.ok ? null : `原设置不生效：${result.reasons.join("；")}`;
}

function refreshHint() {
  const message = validationMessage();
  if (engine.running) {
    page.showStatus(`排练中：${state.prepBeats}拍预备 · 目标 ${state.loopTimes} 遍`, "running");
  } else if (message) {
    page.showStatus(message, "bad");
  } else {
    page.showStatus(`就绪：先数 ${state.prepBeats} 拍预备拍，循环 ${state.loopTimes} 遍后停止`, "idle");
  }
}

function onPlay() {
  const result = Rules.validatePlayback(state.pattern, state.bpm);
  if (!result.ok) {
    page.showStatus(`原设置不生效：${result.reasons.join("；")}`, "bad");
    return;
  }
  engine.configure({
    bpm: state.bpm,
    prepBeats: state.prepBeats,
    loopTimes: state.loopTimes,
    loop: state.loop
  });
  engine.start();
  page.setRunning(true);
  refreshHint();
}

function onStop(reason) {
  engine.stop(reason);
}

function onCell(row, step) {
  state.pattern[row][step] = state.pattern[row][step] ? "" : instruments[row].token;
  save();
  page.render(state);
  refreshHint();
}

function onName(value) {
  state.pieceName = value;
  save();
}

function onBpm(value) {
  state.bpm = Number(value);
  save();
  if (engine.running) engine.setBpm(state.bpm);
  refreshHint();
}

function onLoop(value) {
  state.loop = value;
  save();
  if (engine.running) engine.setRange(value);
}

// 播放中改动预备拍或循环次数：这次练习中断，已完成记录照样保留。
function onPrep(value) {
  const next = Rules.clampPrep(value);
  const wasRunning = engine.running;
  state.prepBeats = next;
  save();
  page.refs.prepInput.value = next;
  if (wasRunning) {
    engine.stop("interrupted"); // onEnd 最后写状态条，提示不会被覆盖
  } else {
    refreshHint();
  }
}

function onTimes(value) {
  const next = Rules.clampTimes(value);
  const wasRunning = engine.running;
  state.loopTimes = next;
  save();
  page.refs.timesInput.value = next;
  if (wasRunning) {
    engine.stop("interrupted");
  } else {
    refreshHint();
  }
}

function onNote(text) {
  state.notes.unshift(text);
  save();
  page.renderSidebars(state);
}

function onSave() {
  state.saved.unshift({
    id: crypto.randomUUID(),
    name: state.pieceName || "未命名片段",
    bpm: state.bpm,
    loop: state.loop,
    prepBeats: state.prepBeats,
    loopTimes: state.loopTimes,
    notes: [...state.notes],
    pattern: state.pattern.map((row) => [...row]),
    records: Records.clone(state.records),
    createdAt: new Date().toISOString()
  });
  save();
  page.renderSidebars(state);
}

function onLoad(id) {
  const item = state.saved.find((entry) => entry.id === id);
  if (!item) return;
  if (engine.running) engine.stop("stopped"); // 载入前先停下当前练习
  state.pieceName = item.name;
  state.bpm = item.bpm;
  state.loop = item.loop ?? "";
  state.prepBeats = Rules.clampPrep(item.prepBeats ?? Rules.DEFAULTS.prepBeats);
  state.loopTimes = Rules.clampTimes(item.loopTimes ?? Rules.DEFAULTS.loopTimes);
  state.notes = [...(item.notes || [])];
  state.pattern = item.pattern.map((row) => [...row]);
  state.records = Records.clone(item.records);
  save();
  page.render(state);
  page.setRunning(false);
  page.clearBadge();
  refreshHint();
}

page.render(state);
page.setRunning(false);
refreshHint();
