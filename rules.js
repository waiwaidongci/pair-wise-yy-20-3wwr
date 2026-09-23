// 排练规则：只负责校验并给出原因，不碰页面与存储
const Rules = (() => {
  const BPM_MIN = 40;
  const BPM_MAX = 220;
  const COUNT_IN_MIN = 1;
  const COUNT_IN_MAX = 4;
  const LOOP_COUNT_MIN = 1;
  const LOOP_COUNT_MAX = 99;

  const hasCommands = (pattern) => pattern.some((row) => row.some(Boolean));

  const isValidBpm = (bpm) => Number.isFinite(bpm) && bpm >= BPM_MIN && bpm <= BPM_MAX;

  const isValidCountIn = (countIn) =>
    Number.isInteger(countIn) && countIn >= COUNT_IN_MIN && countIn <= COUNT_IN_MAX;

  const isValidLoopCount = (loopCount) =>
    Number.isInteger(loopCount) && loopCount >= LOOP_COUNT_MIN && loopCount <= LOOP_COUNT_MAX;

  // 返回设置不生效的原因列表；为空表示可以开排
  function validateRehearsal({ bpm, countIn, loopCount, pattern }) {
    const problems = [];
    if (!hasCommands(pattern)) problems.push("谱面无口令，请先在格子中填写口令");
    if (!isValidBpm(bpm)) problems.push(`速度需在 ${BPM_MIN}–${BPM_MAX} BPM 之间（当前 ${bpm}）`);
    if (!isValidCountIn(countIn)) problems.push(`预备拍需为 ${COUNT_IN_MIN}–${COUNT_IN_MAX} 拍`);
    if (!isValidLoopCount(loopCount)) problems.push(`循环次数需为 ${LOOP_COUNT_MIN}–${LOOP_COUNT_MAX} 次`);
    return problems;
  }

  return {
    BPM_MIN,
    BPM_MAX,
    COUNT_IN_MIN,
    COUNT_IN_MAX,
    LOOP_COUNT_MIN,
    LOOP_COUNT_MAX,
    hasCommands,
    isValidBpm,
    isValidCountIn,
    isValidLoopCount,
    validateRehearsal
  };
})();
