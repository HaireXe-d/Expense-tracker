// 所有流水存在这里，唯一的数据源
const ledger = [];

const form = document.getElementById("entryForm");
const list = document.getElementById("recordList");
const balTotal = document.getElementById("balTotal");
const balIn = document.getElementById("balIn");
const balOut = document.getElementById("balOut");
const chartBody = document.getElementById("chartBody");

const asMoney = (n) => "$" + n;

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  return node;
};

/* ---------------- 列表 ---------------- */

function buildRow(type, amount, date, category) {
  const isIn = type === "Income";

  const row = document.createElement("li");
  row.className = "row";

  const icon = document.createElement("div");
  icon.className = "icon " + (isIn ? "gain" : "loss");
  icon.textContent = isIn ? "\u2191" : "\u2193";

  const info = document.createElement("div");
  info.className = "info";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = category;

  const stamp = document.createElement("div");
  stamp.className = "date";
  stamp.textContent = new Date(date).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  info.append(name, stamp);

  const value = document.createElement("div");
  value.className = "value " + (isIn ? "gain" : "loss");
  value.textContent = (isIn ? "+" : "-") + asMoney(amount);

  const kill = document.createElement("button");
  kill.type = "button";
  kill.className = "remove";
  kill.textContent = "\u00d7";
  kill.addEventListener("click", () => dropRow(kill.closest(".row")));

  row.append(icon, info, value, kill);
  return row;
}

function dropRow(row) {
  const idx = [...list.children].indexOf(row);
  if (idx > -1) ledger.splice(idx, 1);
  row.remove();
  refresh();
}

/* ---------------- 汇总 ---------------- */

function tally() {
  let inflow = 0;
  let outflow = 0;
  for (const entry of ledger) {
    const n = parseFloat(entry.amount) || 0;
    if (entry.type === "Income") inflow += n;
    else outflow += n;
  }
  return { inflow, outflow };
}

function refresh() {
  const { inflow, outflow } = tally();

  balIn.textContent = asMoney(inflow);
  balOut.textContent = asMoney(outflow);
  balTotal.textContent = asMoney(inflow - outflow);

  drawChart();
}

/* ---------------- 折线图 ---------------- */

const W = 560;
const H = 220;
const PAD = { top: 18, right: 20, bottom: 32, left: 48 };

function niceCeil(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function smoothPath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function drawChart() {
  chartBody.innerHTML = "";

  if (ledger.length === 0) {
    const hint = document.createElement("p");
    hint.className = "empty";
    hint.textContent = "还没有数据，先记一笔试试～";
    chartBody.appendChild(hint);
    return;
  }

  // 按日期归集收支
  const byDate = new Map();
  for (const entry of ledger) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, { in: 0, out: 0 });
    const slot = byDate.get(entry.date);
    const n = parseFloat(entry.amount) || 0;
    if (entry.type === "Income") slot.in += n;
    else slot.out += n;
  }

  const dates = [...byDate.keys()].sort();
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  let peak = 0;
  byDate.forEach((slot) => {
    peak = Math.max(peak, slot.in, slot.out);
  });
  const maxVal = niceCeil(peak);

  const xOf = (i) =>
    dates.length === 1
      ? PAD.left + plotW / 2
      : PAD.left + (i * plotW) / (dates.length - 1);
  const yOf = (v) => PAD.top + plotH - (v / maxVal) * plotH;

  const seriesIn = [];
  const seriesOut = [];
  dates.forEach((day, i) => {
    const slot = byDate.get(day);
    seriesIn.push({ x: xOf(i), y: yOf(slot.in), v: slot.in });
    seriesOut.push({ x: xOf(i), y: yOf(slot.out), v: slot.out });
  });

  const svg = svgEl("svg", { class: "chart-svg", viewBox: `0 0 ${W} ${H}`, role: "img" });
  const title = svgEl("title", {});
  title.textContent = "收支趋势：横轴为日期，纵轴为金额";
  svg.appendChild(title);

  // 横向网格 + 纵轴刻度
  const rows = 4;
  for (let i = 0; i <= rows; i++) {
    const value = (maxVal / rows) * i;
    const y = yOf(value);
    svg.appendChild(svgEl("line", { class: "grid-line", x1: PAD.left, x2: W - PAD.right, y1: y, y2: y }));

    const label = svgEl("text", { class: "axis-text", x: PAD.left - 8, y: y + 3, "text-anchor": "end" });
    label.textContent = Math.round(value);
    svg.appendChild(label);
  }

  // 折线 + 数据点
  const drawSeries = (points, tone) => {
    const path = svgEl("path", {
      class: "line " + tone,
      d: smoothPath(points),
      pathLength: 1,
      "stroke-dasharray": 1,
    });
    svg.appendChild(path);

    points.forEach((p) => {
      svg.appendChild(svgEl("circle", { class: "point " + tone, cx: p.x, cy: p.y, r: 3.6 }));
    });
  };
  drawSeries(seriesOut, "loss");
  drawSeries(seriesIn, "gain");

  // 横轴日期
  const skip = Math.ceil(dates.length / 6);
  dates.forEach((day, i) => {
    if (i % skip !== 0 && i !== dates.length - 1) return;
    const text = svgEl("text", {
      class: "axis-text",
      x: xOf(i),
      y: H - PAD.bottom + 16,
      "text-anchor": "middle",
    });
    text.textContent = day.length >= 10 ? day.slice(5) : day;
    svg.appendChild(text);
  });

  chartBody.appendChild(svg);
}

/* ---------------- 提交 ---------------- */

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = new FormData(form);
  const type = data.get("kind");
  const amount = data.get("money");
  const date = data.get("day");
  const category = data.get("tag");

  list.prepend(buildRow(type, amount, date, category));
  ledger.unshift({ type, amount, date, category });
  refresh();
  form.reset();
});

refresh();
