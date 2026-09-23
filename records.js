/*
 * 练习记录层：只管"已完成遍数"的存取与展示数据，不碰 DOM、不碰定时器。
 * finished  = 循环到达设定次数自然结束
 * interrupted = 播放中改动预备拍或循环次数，本次练习中断
 * stopped   = 手动停止
 */
(function () {
  "use strict";

  const REASON_LABELS = {
    finished: "完成",
    interrupted: "中断",
    stopped: "停止"
  };
  const REASON_CLASS = {
    finished: "ok",
    interrupted: "warn",
    stopped: "muted"
  };
  const MAX_RECORDS = 50;

  function makeRecord(snapshot, reason) {
    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      id,
      at: new Date().toISOString(),
      name: snapshot.name || "未命名片段",
      bpm: snapshot.bpm,
      prepBeats: snapshot.prepBeats,
      total: snapshot.total,
      completed: snapshot.completed,
      reason
    };
  }

  // 一次练习结束（无论完成、中断还是手动停止），都留下已完成遍数。
  function append(records, snapshot, reason) {
    const list = Array.isArray(records) ? [...records] : [];
    list.unshift(makeRecord(snapshot, reason));
    return list.slice(0, MAX_RECORDS);
  }

  function clone(records) {
    return (Array.isArray(records) ? records : []).map((r) => ({ ...r }));
  }

  function reasonLabel(reason) {
    return REASON_LABELS[reason] || reason;
  }

  function reasonClass(reason) {
    return REASON_CLASS[reason] || "muted";
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  window.Records = { append, clone, reasonLabel, reasonClass, formatTime };
})();
