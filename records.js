// 排练记录：只负责完成遍数的存取，不碰页面与规则
const Records = (() => {
  const recordsKey = "wxyy-4-luogujing-records";
  const MAX_RECORDS = 50;

  let records = [];
  try {
    records = JSON.parse(localStorage.getItem(recordsKey) || "[]");
    if (!Array.isArray(records)) records = [];
  } catch {
    records = [];
  }

  function list() {
    return records;
  }

  // 留下一次练习完成的遍数
  function add(record) {
    records = [{ id: crypto.randomUUID(), ...record }, ...records].slice(0, MAX_RECORDS);
    localStorage.setItem(recordsKey, JSON.stringify(records));
    return records;
  }

  return { list, add };
})();
