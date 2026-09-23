/*
 * 排练规则层：不碰 DOM、不碰存储，只管预备拍、有限次循环与播放条件校验。
 */
(function () {
  "use strict";

  const STEPS = 16;
  const BEATS_PER_MEASURE = 4;
  const MIN_BPM = 40;
  const MAX_BPM = 220;
  const PREP_MIN = 1;
  const PREP_MAX = 4;
  const TIMES_MIN = 1;
  const TIMES_MAX = 99;
  const DEFAULTS = { prepBeats: 4, loopTimes: 4, bpm: 96 };

  // 循环小节 "" 表示全段，否则为小节下标（0 起）。
  function rangeFor(loop) {
    if (loop === "" || loop === null || loop === undefined) return [0, STEPS - 1];
    const start = Number(loop) * BEATS_PER_MEASURE;
    return [start, start + BEATS_PER_MEASURE - 1];
  }

  function clampPrep(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return DEFAULTS.prepBeats;
    return Math.min(PREP_MAX, Math.max(PREP_MIN, n));
  }

  function clampTimes(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return DEFAULTS.loopTimes;
    return Math.min(TIMES_MAX, Math.max(TIMES_MIN, n));
  }

  function commandCount(pattern) {
    return pattern.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  }

  const bpmText = (bpm) => (Number.isFinite(bpm) ? String(Math.round(bpm)) : "未设置");

  // 谱面无口令，或速度超出 40–220 时，预备拍/有限循环不生效，并给出原因。
  function validatePlayback(pattern, bpm) {
    const reasons = [];
    if (commandCount(pattern) === 0) {
      reasons.push("谱面无口令（请先在格子中点出至少一个锣鼓口令）");
    }
    if (!Number.isFinite(bpm) || bpm < MIN_BPM) {
      reasons.push(`速度低于 ${MIN_BPM} BPM（当前 ${bpmText(bpm)}）`);
    } else if (bpm > MAX_BPM) {
      reasons.push(`速度高于 ${MAX_BPM} BPM（当前 ${bpmText(bpm)}）`);
    }
    return { ok: reasons.length === 0, reasons };
  }

  /*
   * 排练机：count（预备拍）→ play（逐拍走谱面），每走完一遍累加 completed，
   * 到达 loopTimes 自动 finished；运行中被外部停止时抛出 interrupted/stopped，
   * 由回调把已完成遍数交给记录层。
   */
  function createRehearsal(callbacks) {
    const cb = callbacks || {};
    let phase = "idle"; // idle | count | play
    let timer = null;
    let bpm = DEFAULTS.bpm;
    let prepBeats = DEFAULTS.prepBeats;
    let loopTimes = DEFAULTS.loopTimes;
    let range = [0, STEPS - 1];
    let countRemaining = 0;
    let playhead = 0;
    let completed = 0;

    const emit = (name, ...args) => {
      if (typeof cb[name] === "function") cb[name](...args);
    };

    function clearTimer() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    function restartTimer() {
      if (phase === "idle") return;
      clearTimer();
      timer = setInterval(tick, 60000 / bpm);
    }

    function step() {
      emit("onStep", playhead, { pass: completed + 1, total: loopTimes });
      if (playhead >= range[1]) {
        completed += 1;
        emit("onPass", completed, loopTimes);
        if (completed >= loopTimes) {
          stop("finished");
          return;
        }
        playhead = range[0];
      } else {
        playhead += 1;
      }
    }

    function tick() {
      if (phase === "idle") return;
      if (phase === "count") {
        if (countRemaining === 0) {
          // 预备拍数完，下一拍进入谱面。
          phase = "play";
          playhead = range[0];
          step();
          return;
        }
        emit("onCount", countRemaining, prepBeats);
        countRemaining -= 1;
        return;
      }
      step();
    }

    function stop(reason) {
      if (phase === "idle") return false;
      const snapshot = { completed, total: loopTimes, prepBeats, bpm };
      phase = "idle";
      clearTimer();
      emit("onEnd", completed, reason, snapshot);
      return true;
    }

    return {
      get running() {
        return phase !== "idle";
      },
      get phase() {
        return phase;
      },
      get completedPasses() {
        return completed;
      },
      configure(cfg) {
        bpm = Number(cfg.bpm);
        prepBeats = clampPrep(cfg.prepBeats);
        loopTimes = clampTimes(cfg.loopTimes);
        range = rangeFor(cfg.loop);
      },
      start() {
        if (phase !== "idle") return;
        countRemaining = prepBeats;
        completed = 0;
        playhead = range[0];
        phase = "count";
        tick(); // 第一拍预备拍立即响
        restartTimer();
      },
      stop(reason = "stopped") {
        return stop(reason);
      },
      // 播放中改速度：只换节拍器间隔，不中断本次练习。
      setBpm(value) {
        const next = Number(value);
        if (!Number.isFinite(next) || next <= 0) return;
        bpm = next;
        restartTimer();
      },
      // 播放中改循环小节：跟随新范围，不记入中断。
      setRange(loop) {
        range = rangeFor(loop);
        if (playhead < range[0] || playhead > range[1]) playhead = range[0];
      }
    };
  }

  window.Rules = {
    STEPS,
    BEATS_PER_MEASURE,
    MIN_BPM,
    MAX_BPM,
    PREP_MIN,
    PREP_MAX,
    DEFAULTS,
    rangeFor,
    clampPrep,
    clampTimes,
    commandCount,
    validatePlayback,
    createRehearsal
  };
})();
