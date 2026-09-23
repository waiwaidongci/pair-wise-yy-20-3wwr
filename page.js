/*
 * 页面层：只负责 DOM 渲染与事件转发，不含排练规则与存储逻辑。
 * handlers 由 app 装配：onPlay / onStop / onSave / onLoad / onCell /
 *   onName / onBpm / onLoop / onPrep / onTimes / onNote
 */
(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  function beatLabel(index) {
    const measure = Math.floor(index / Rules.BEATS_PER_MEASURE) + 1;
    const beat = (index % Rules.BEATS_PER_MEASURE) + 1;
    return `${measure}-${beat}`;
  }

  function createPage(instruments, handlers) {
    const refs = {
      playBtn: $("#playBtn"),
      stopBtn: $("#stopBtn"),
      saveBtn: $("#saveBtn"),
      pieceName: $("#pieceName"),
      bpmInput: $("#bpmInput"),
      loopSelect: $("#loopSelect"),
      prepInput: $("#prepInput"),
      timesInput: $("#timesInput"),
      noteInput: $("#noteInput"),
      grid: $("#grid"),
      savedList: $("#savedList"),
      structure: $("#structure"),
      notesList: $("#notesList"),
      recordsList: $("#recordsList"),
      status: $("#status"),
      badge: $("#playBadge")
    };

    function syncFields(state) {
      refs.pieceName.value = state.pieceName;
      refs.bpmInput.value = state.bpm;
      refs.loopSelect.value = state.loop;
      refs.prepInput.value = state.prepBeats;
      refs.timesInput.value = state.loopTimes;
    }

    function renderGrid(pattern) {
      const header = ['<div class="label-cell">乐器</div>'];
      for (let i = 0; i < Rules.STEPS; i += 1) {
        header.push(`<div class="beat-cell">${beatLabel(i)}</div>`);
      }
      const rows = instruments.flatMap((instrument, rowIndex) => {
        const row = [`<div class="label-cell">${instrument.name}</div>`];
        for (let step = 0; step < Rules.STEPS; step += 1) {
          const value = pattern[rowIndex][step];
          row.push(
            `<button class="cell ${value ? "filled" : ""}" type="button" data-row="${rowIndex}" data-step="${step}">${value}</button>`
          );
        }
        return row;
      });
      refs.grid.innerHTML = [...header, ...rows].join("");
    }

    function renderSidebars(state) {
      const measureCount = Rules.STEPS / Rules.BEATS_PER_MEASURE;
      refs.structure.innerHTML = Array.from({ length: measureCount }, (_, measure) => {
        const start = measure * Rules.BEATS_PER_MEASURE;
        const slice = state.pattern.flatMap((row) =>
          row.slice(start, start + Rules.BEATS_PER_MEASURE)
        );
        const count = slice.filter(Boolean).length;
        return `<div class="structure-row"><span>第${measure + 1}小节</span><strong>${count}个口令</strong></div>`;
      }).join("");

      refs.notesList.innerHTML = state.notes.length
        ? state.notes.map((note) => `<article class="note"><p>${note}</p></article>`).join("")
        : "<p>暂无批注。</p>";

      refs.savedList.innerHTML = state.saved.length
        ? state.saved.map((item) => `
          <button class="saved-item" type="button" data-load="${item.id}">
            <strong>${item.name}</strong><br>
            <span>${item.bpm}BPM · 预备${item.prepBeats ?? Rules.DEFAULTS.prepBeats}拍 ·
            ${item.loopTimes ?? Rules.DEFAULTS.loopTimes}遍 ·
            ${(item.records || []).length}次练习 · ${item.notes.length}条批注</span>
          </button>`).join("")
        : "<p>还没有保存方案。</p>";

      renderRecords(state.records);
    }

    function renderRecords(records) {
      const list = Array.isArray(records) ? records : [];
      refs.recordsList.innerHTML = list.length
        ? list.map((rec) => `
          <div class="record-row ${Records.reasonClass(rec.reason)}">
            <div class="record-main">
              <strong>${rec.completed}/${rec.total} 遍</strong>
              <em>${Records.reasonLabel(rec.reason)}</em>
            </div>
            <div class="record-meta">
              <span>${rec.bpm}BPM · 预备${rec.prepBeats}拍</span>
              <time>${Records.formatTime(rec.at)}</time>
            </div>
          </div>`).join("")
        : "<p>暂无练习记录。</p>";
    }

    function highlight(step) {
      document.querySelectorAll(".cell.playing").forEach((cell) => cell.classList.remove("playing"));
      document.querySelectorAll(`[data-step="${step}"]`).forEach((cell) => cell.classList.add("playing"));
    }

    function clearHighlight() {
      document.querySelectorAll(".cell.playing").forEach((cell) => cell.classList.remove("playing"));
    }

    // 数拍提示：在谱面上方大字显示剩余预备拍数。
    function showCount(remaining, total) {
      refs.badge.className = "badge count";
      refs.badge.textContent = `预备拍 ${remaining}/${total}`;
    }

    function showPass(pass, total) {
      refs.badge.className = "badge play";
      refs.badge.textContent = `第 ${pass}/${total} 遍`;
    }

    function clearBadge() {
      refs.badge.className = "badge";
      refs.badge.textContent = "";
    }

    function showStatus(message, tone) {
      refs.status.className = `status ${tone || "idle"}`;
      refs.status.textContent = message;
    }

    function setRunning(running) {
      refs.playBtn.disabled = running;
      refs.stopBtn.disabled = !running;
    }

    function bind() {
      refs.playBtn.addEventListener("click", handlers.onPlay);
      refs.stopBtn.addEventListener("click", () => handlers.onStop("stopped"));
      refs.saveBtn.addEventListener("click", handlers.onSave);

      refs.grid.addEventListener("click", (event) => {
        const cell = event.target.closest(".cell");
        if (!cell) return;
        handlers.onCell(Number(cell.dataset.row), Number(cell.dataset.step));
      });

      refs.pieceName.addEventListener("input", () => handlers.onName(refs.pieceName.value));
      refs.bpmInput.addEventListener("input", () => handlers.onBpm(refs.bpmInput.value));
      refs.loopSelect.addEventListener("change", () => handlers.onLoop(refs.loopSelect.value));
      refs.prepInput.addEventListener("change", () => handlers.onPrep(refs.prepInput.value));
      refs.timesInput.addEventListener("change", () => handlers.onTimes(refs.timesInput.value));

      refs.noteInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || !refs.noteInput.value.trim()) return;
        handlers.onNote(refs.noteInput.value.trim());
        refs.noteInput.value = "";
      });

      refs.savedList.addEventListener("click", (event) => {
        const id = event.target.closest("[data-load]")?.dataset.load;
        if (id) handlers.onLoad(id);
      });
    }

    bind();

    return {
      refs,
      render(state) {
        syncFields(state);
        renderGrid(state.pattern);
        renderSidebars(state);
      },
      renderRecords,
      renderSidebars,
      highlight,
      clearHighlight,
      showCount,
      showPass,
      clearBadge,
      showStatus,
      setRunning
    };
  }

  window.createPage = createPage;
})();
