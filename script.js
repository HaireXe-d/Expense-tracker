/* =====================================================================
   Expense tracker · script.js  —— 逐行注释讲解版
   ---------------------------------------------------------------------
   说明：这份文件【原来的功能一行都没有改动】，只是把每一行代码都补上了
   注释，方便 DOM 初学者逐行读懂“这行到底在干什么、为什么要这么写”。

   建议阅读顺序（和页面从上到下的顺序一致）：
     1. 全局变量：先把要用的“数据”和“页面元素”抓到手
     2. buildRow / dropRow：往列表里加一条 / 删一条
     3. tally / refresh：算账 + 刷新页面上的数字
     4. drawChart：把数据画成折线图
     5. 表单提交：用户点“保存”以后发生了什么
   文末还有：
     附录 A：本项目没用到的常用 JS 示例（只定义不执行，可在控制台手动调用）
     附录 B：知识点总结
   ===================================================================== */


/* =====================================================================
   第 1 部分：全局变量 —— 数据 与 页面元素
   ===================================================================== */

// 【难点】const 是“常量”，声明后变量名不能再被重新赋值（不能 ledger = 别的东西）。
//        但如果它装的是数组/对象，里面的“内容”仍然可以增删改。这一点初学者最容易混淆！
// ledger 是“流水账数组”，是整个程序唯一的数据来源。
// 每一条记录长这样：{ type: "Income", amount: "100", date: "2026-10-01", category: "工资" }
// 为什么要把数据单独存一份？因为有了它，统计/画图只要遍历这个数组就行；
// 页面上的 DOM 只负责“给别人看”，真正的数据放在这里。
const ledger = [];

// document 代表整个网页（DOM 中的“文档对象”）。
// getElementById 的意思：“在页面里把 id 等于 xxx 的那个元素找出来，交给变量保管”。
// 存起来的好处：以后再用就不必反复查找，代码更短、也更快。
const form = document.getElementById("entryForm");     // 左侧的“记账”表单
const list = document.getElementById("recordList");     // 右侧“交易记录”列表 <ul>
const balTotal = document.getElementById("balTotal");   // 当前余额的数字
const balIn = document.getElementById("balIn");         // 总收入的数字
const balOut = document.getElementById("balOut");       // 总支出的数字
const chartBody = document.getElementById("chartBody"); // 放折线图的容器

// 箭头函数：(参数) => 返回值。它等价于 function asMoney(n) { return "$" + n; }
// 作用：给数字前面拼一个 "$"，比如 100 变成 "$100"。
// 这里 "+" 用在“数字 + 字符串”时是【字符串拼接】，不是数学加法。
const asMoney = (n) => "$" + n;

// SVG 里的元素（<svg>、<circle> 等）和普通 HTML 元素（<div>、<li>）属于不同的“命名空间”，
// 所以创建 SVG 元素必须用 createElementNS 并带上这个固定网址，否则浏览器画不出来。
const SVG_NS = "http://www.w3.org/2000/svg";

// svgEl = “create SVG element”的简写，是一个小工具函数：
//   第 1 个参数 tag：要创建的标签名，比如 "line"
//   第 2 个参数 attrs：一个对象，装着所有要设置的属性，比如 { cx: 10, cy: 20 }
// 返回值：创建好的元素（还没插进页面）。
const svgEl = (tag, attrs) => {
  const node = document.createElementNS(SVG_NS, tag); // 用正确的命名空间创建元素
  // for...in 会遍历对象里的每一个“键名(key)”，例如 "cx"、"cy"。
  // 这行意思是：对 attrs 里的每个属性，都用 setAttribute 给新元素设置上去。
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  return node; // 返回造好的元素，交给调用者决定插到哪里
};


/* =====================================================================
   第 2 部分：列表 —— 造一条记录 & 删一条记录
   ===================================================================== */

/* buildRow：根据一条数据，“拼”出一个 <li> 列表项，然后返回它。
   4 个参数依次是：类型、金额、日期、分类。
   注意这个函数【只负责造，不负责往页面里放】——放的地方由调用它的代码决定。 */
function buildRow(type, amount, date, category) {
  // isIn 是个布尔值：类型是 "Income"(收入) 就为 true，否则为 false。
  // 后面很多地方都用它来决定“显示什么文字、用什么颜色”，这叫“一个判断，多处复用”。
  const isIn = type === "Income";

  // document.createElement("li") 会在内存中“凭空造”一个 <li> 元素（此时页面上还看不到）。
  const row = document.createElement("li");
  row.className = "row"; // 给它加 class，这样 CSS 里的 .row 样式才会生效

  // 造左边的小圆图标
  const icon = document.createElement("div");
  // 后面拼的是 "gain" 或 "loss"，所以最终 class 可能是 "icon gain" 或 "icon loss"。
  // 一个元素可以有多个 class，用空格隔开，CSS 就能同时套用 .icon 和 .gain 两套样式。
  icon.className = "icon " + (isIn ? "gain" : "loss");
  // "\u2191" 是 Unicode 转义写法，代表 ↑ 箭头；"\u2193" 代表 ↓ 箭头。
  // 写转义码是为了避免源码里出现特殊符号导致乱码，实际效果就是显示箭头。
  icon.textContent = isIn ? "\u2191" : "\u2193";

  // 中间的“分类 + 日期”文字区
  const info = document.createElement("div");
  info.className = "info";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = category; // textContent = 设置元素里的纯文字（比 innerHTML 更安全）

  const stamp = document.createElement("div");
  stamp.className = "date";
  // 【难点】new Date(date)：把 "2026-10-01" 这样的字符串变成一个“日期对象”。
  // toLocaleDateString 会按地区习惯把它格式化成可读文字。
  // 第一个参数 "zh-CN" 表示用中文格式；第二个参数是“配置对象”，指定只显示月/日/年。
  // 例如 2026-10-01 会显示成 “2026年10月1日”这样的形式。
  stamp.textContent = new Date(date).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // append 可以把多个子元素一次性塞进父元素里（顺序就是参数顺序）。
  // 作用：把“分类”和“日期”两个 div 放进 info 这个盒子里。
  info.append(name, stamp);

  // 右边的金额（带 +/- 号）
  const value = document.createElement("div");
  value.className = "value " + (isIn ? "gain" : "loss");
  // 三元运算符 条件 ? A : B：收入显示 "+$100"，支出显示 "-$100"。
  value.textContent = (isIn ? "+" : "-") + asMoney(amount);

  // 最右边的删除按钮
  const kill = document.createElement("button");
  kill.type = "button"; // 明确写成 button，避免在表单里被当成“提交按钮”
  kill.className = "remove";
  kill.textContent = "\u00d7"; // × 关闭符号
  // addEventListener = “给这个元素挂一个监听器”：有人点击它时，就执行后面的函数。
  // () => dropRow(...) 是箭头函数写法，点一下才执行里面的内容（不是立刻执行！）
  // kill.closest(".row") 表示“从我自己开始往上找，找到最近的 .row 祖先元素”，
  // 也就是这一整行 <li>，然后把整行交给 dropRow 去删除。
  kill.addEventListener("click", () => dropRow(kill.closest(".row")));

  // 把这 4 个子元素（图标/文字区/金额/删除按钮）按顺序放进这一行里。
  row.append(icon, info, value, kill);

  // 把造好的整行返回出去，谁调用 buildRow，谁就拿去用。
  return row;
}

/* dropRow：删除某一行（既删页面上的，也删数据里的）。 */
function dropRow(row) {
  // 【难点】list.children 是一个“类数组”（HTMLCollection），不能直接用 indexOf。
  // 前面加 [...] 是“展开运算符”，把它的元素倒进一个真正的新数组里，
  // 这样就能用数组方法 indexOf 了。这行在问：“这一行在列表里排第几个？”
  const idx = [...list.children].indexOf(row);
  // splice(索引, 1) = 从数据数组里删掉 1 个元素。
  // 这里必须让“页面顺序”和“数据顺序”保持一致，否则账算错。
  // 之所以能对上，是因为下面加记录时：列表用 prepend(插最前)，数据用 unshift(插最前)，
  // 两边都是“新的在最前面”，索引才能一一对应。
  if (idx > -1) ledger.splice(idx, 1); // idx > -1 表示确实找到了，没找到就不乱删
  row.remove(); // 从页面上把这一行移除
  refresh();    // 重新算账 + 重新画图
}


/* =====================================================================
   第 3 部分：汇总 —— 算出总收入/总支出，并刷新界面
   ===================================================================== */

/* tally：遍历所有流水，把收入、支出分别累加起来。
   返回值是一个对象 { inflow, outflow }，分别是总收入和总支出。 */
function tally() {
  let inflow = 0;  // 用 let 而不是 const，因为后面要不断 +=（重新赋值）
  let outflow = 0;
  // for...of 用于“值遍历”：每一轮 entry 就是 ledger 里的一个记录对象。
  for (const entry of ledger) {
    // 【难点】表单拿到的金额是字符串（比如 "100"），字符串不能直接相加，必须先转成数字。
    // parseFloat 把字符串转成小数；如果用户输入的不是数字，结果是 NaN（Not a Number）。
    // NaN 参与运算会让结果变成 NaN，所以后面加 "|| 0" 兜底：“转不成数字就当 0”。
    // 小提示：NaN 是“假值”，所以 NaN || 0 会取 0。
    const n = parseFloat(entry.amount) || 0;
    if (entry.type === "Income") inflow += n;
    else outflow += n;
  }
  return { inflow, outflow }; // 简写：等价于 { inflow: inflow, outflow: outflow }
}

/* refresh：把最新数据同步到界面上（数字 + 图表）。
   每当数据变化（增/删记录）后都会被调用一次，所以叫“刷新”。 */
function refresh() {
  // 【难点】“解构赋值”：tally() 返回一个对象，这里直接把里面的两个属性“拆”成两个变量。
  // 等价写法：const r = tally(); const inflow = r.inflow; const outflow = r.outflow;
  const { inflow, outflow } = tally();

  // textContent 用于替换元素里的文字。界面上的数字就是这样更新的。
  balIn.textContent = asMoney(inflow);
  balOut.textContent = asMoney(outflow);
  // 余额 = 收入 - 支出
  balTotal.textContent = asMoney(inflow - outflow);

  drawChart(); // 数字更新完，再把折线图重画一遍
}


/* =====================================================================
   第 4 部分：折线图 —— 纯手写 SVG（没引入任何图表库）
   ===================================================================== */

// 画布的逻辑尺寸（viewBox 坐标系），不是真实像素：SVG 会自动等比缩放。
const W = 560; // 画布宽
const H = 220; // 画布高
// PAD = padding（内边距）：给坐标轴文字留出的空白，避免文字贴边或超出画布。
// top/right/bottom/left 分别表示上、右、下、左留多少。
const PAD = { top: 18, right: 20, bottom: 32, left: 48 };

/* niceCeil：把纵轴最大值“凑整”成一个好看的数字（1/2/5 乘以 10 的幂）。
   比如输入 87，会返回 100；输入 430，会返回 500。这样刻度就是 0/25/50/75/100 这种整数。 */
function niceCeil(v) {
  if (v <= 0) return 1; // 没有数据（或负数）时给个最小值 1，避免后面除以 0
  // Math.log10(v) 求“以 10 为底的对数”，Math.floor 向下取整，得到数量级。
  // 例：v=87 -> log10≈1.94 -> floor=1；Math.pow(10,1)=10，说明 87 在“十位”级别。
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow; // 把 v 缩放到 1~10 之间，方便判断往哪个档位凑（如 8.7）
  // 小于等于 1 就取 1，≤2 取 2，≤5 取 5，否则取 10 —— 这就是“1/2/5 凑整法”。
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow; // 再乘回数量级。87 -> 1*? 实际 n=8.7 -> step=10 -> 10*10=100
}

/* smoothPath：把一串点连成一条【平滑曲线】的路径字符串（SVG 的 d 属性）。
   如果直接连点，折线会很生硬；这里用“三次贝塞尔曲线”把线段弯出圆角，更灵动。 */
function smoothPath(points) {
  // points 是形如 [{x:10,y:20}, {x:30,y:5}, ...] 的点数组。
  if (points.length === 0) return ""; // 一个点都没有：返回空路径
  // 只有一个点：只写“移动到该点”(M = Move to)，画不出线，但这不算错。
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  // 【难点】反引号 ` 是“模板字符串”，可以在里面用 ${表达式} 直接插值，比字符串相加清爽。
  // M 表示“移动画笔到起点”，后面接的 C 表示“三次贝塞尔曲线”。
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    // 依次取出相邻的 4 个点：p0(前一个) p1(当前) p2(下一个) p3(下下个)。
    // Catmull-Rom 平滑的核心：用前后相邻点来决定“入弯/出弯”的方向，让曲线顺滑穿过每个点。
    const p0 = points[i - 1] || points[i]; // 第一个点没有“前一个”，就用自己顶替
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;        // 最后一个点没有“下下个”，就用 p2 顶替

    // c1/c2 是两个“控制点”，相当于把曲线往某个方向“拽”。
    // 除以 6 是关键经验系数：取值太小曲线太直，太大又会甩过头。
    // 公式含义：控制点 = 当前点 + (下一点 - 上一点)/6。
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    // 追加一段曲线指令：“C 控制点1, 控制点2, 终点”。终点就是 p2。
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d; // 返回完整路径字符串，稍后塞给 <path> 的 d 属性
}

/* drawChart：折线图主函数。把 ledger 里的数据算成坐标，再画成 SVG。 */
function drawChart() {
  // 每次重画前先清空容器：把之前画的内容全部删掉，避免新旧图叠在一起。
  chartBody.innerHTML = "";

  // 没有任何记录时，显示一句友好提示就结束（return 表示“函数到此为止”）。
  if (ledger.length === 0) {
    const hint = document.createElement("p");
    hint.className = "empty";
    hint.textContent = "还没有数据，先记一笔试试～";
    chartBody.appendChild(hint); // appendChild 和 append 类似，把子元素加进去
    return; // 提前结束，后面的画图代码就不用跑了
  }

  // ---------- 把记录按“日期”归集 ----------
  // 【难点】Map 是一种“键值对”结构，类似对象，但键可以是任意类型且会保持插入顺序。
  // 这里用日期当键，值是一个 {in: 总收入, out: 总支出} 的小汇总。
  const byDate = new Map();
  for (const entry of ledger) {
    // 如果这个日期还不在 Map 里，就先初始化一个“收支都为零”的格子。
    if (!byDate.has(entry.date)) byDate.set(entry.date, { in: 0, out: 0 });
    const slot = byDate.get(entry.date); // 取出这一天的汇总格子
    const n = parseFloat(entry.amount) || 0; // 同样，字符串转数字并兜底 0
    if (entry.type === "Income") slot.in += n;
    else slot.out += n;
  }

  // [...byDate.keys()] 把 Map 的所有“日期键”取出并变成数组；
  // .sort() 不传参数时按字符串从小到大排序，正好让日期从早到晚排列。
  const dates = [...byDate.keys()].sort();

  // ---------- 计算“绘图区”大小 ----------
  // 总宽减去左右内边距 = 真正能画线的宽度；高度同理。
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // 找出所有数据里的最大金额，用来决定纵轴顶端画到哪里。
  let peak = 0;
  byDate.forEach((slot) => {
    peak = Math.max(peak, slot.in, slot.out); // Math.max 取几个数里最大的那个
  });
  const maxVal = niceCeil(peak); // 把最大值凑整成好看的刻度上限

  // 【难点·核心】坐标换算函数。把“真实数值”翻译成“屏幕坐标”。
  // 横轴：i 是第几个点，除以 (点数-1) 得到 0~1 的比例，再乘以绘图宽度。
  // 只有一个点时无法按比例分散，就直接放在正中间。
  const xOf = (i) =>
    dates.length === 1
      ? PAD.left + plotW / 2
      : PAD.left + (i * plotW) / (dates.length - 1);
  // 纵轴：注意屏幕的 y 是“往下变大”，所以要用 (绘图高度 - 比例部分) 把图翻过来，
  // 这样数值越大，点画得越靠上。
  const yOf = (v) => PAD.top + plotH - (v / maxVal) * plotH;

  // 生成两组点：一条收入线、一条支出线。v 顺手存下原始数值，方便以后用。
  const seriesIn = [];
  const seriesOut = [];
  dates.forEach((day, i) => {
    const slot = byDate.get(day);
    seriesIn.push({ x: xOf(i), y: yOf(slot.in), v: slot.in });
    seriesOut.push({ x: xOf(i), y: yOf(slot.out), v: slot.out });
  });

  // ---------- 创建 <svg> 画布 ----------
  // viewBox 定义内部坐标系 “0 0 560 220”，浏览器会自动把它缩放去适应容器宽度。
  // role="img" 是无障碍属性，告诉读屏软件“这是一张图片”。
  const svg = svgEl("svg", { class: "chart-svg", viewBox: `0 0 ${W} ${H}`, role: "img" });
  // <title> 是图片的“说明文字”，鼠标悬停时会显示，也方便读屏。
  const title = svgEl("title", {});
  title.textContent = "收支趋势：横轴为日期，纵轴为金额";
  svg.appendChild(title);

  // ---------- 横向网格线 + 纵轴刻度 ----------
  const rows = 4; // 把纵轴均分成 4 段，于是会有 5 条线（0、1/4、2/4、3/4、顶）
  for (let i = 0; i <= rows; i++) {
    const value = (maxVal / rows) * i; // 这一条线代表的金额
    const y = yOf(value);             // 换算成屏幕 y 坐标
    // 画一条横线：x1/x2 是起点终点横坐标，y1/y2 是纵坐标（相等即为水平线）。
    svg.appendChild(svgEl("line", { class: "grid-line", x1: PAD.left, x2: W - PAD.right, y1: y, y2: y }));

    // 画刻度文字：x 放在轴的左侧一点点，y+3 是为了让文字垂直居中。
    // "text-anchor": "end" 表示“以文字右端对齐到这个坐标”，所以文字在线的左边。
    const label = svgEl("text", { class: "axis-text", x: PAD.left - 8, y: y + 3, "text-anchor": "end" });
    label.textContent = Math.round(value); // 取整显示，避免 25.0000001 这种小数
    svg.appendChild(label);
  }

  // ---------- 画折线 + 数据点 ----------
  // drawSeries 是一个“内部函数”，接收一组点和颜色名（tone），画一条线加若干个圆点。
  // 这样收入线、支出线就能复用同一段逻辑，不必写两遍。
  const drawSeries = (points, tone) => {
    const path = svgEl("path", {
      class: "line " + tone, // tone 是 "gain" 或 "loss"，决定 CSS 里用哪种颜色
      d: smoothPath(points), // 上面算好的平滑曲线路径
      pathLength: 1,         // 把整条线的“总长度”统一成 1，方便做“描画动画”
      "stroke-dasharray": 1, // 【难点】虚线模式：用一段“长 1”的实线再拼接空隙，
      // 配合 CSS 动画把虚线的偏移量从 1 变到 0，
      // 视觉上就像一支笔把线“慢慢画出来”。这是常见的描线动画技巧。
    });
    svg.appendChild(path);

    // 给每个数据点画一个小圆（cx/cy 是圆心，r 是半径）。
    points.forEach((p) => {
      svg.appendChild(svgEl("circle", { class: "point " + tone, cx: p.x, cy: p.y, r: 3.6 }));
    });
  };
  // 先画支出再画收入，这样收入线压在支出线上面，视觉主次更清晰。
  drawSeries(seriesOut, "loss");
  drawSeries(seriesIn, "gain");

  // ---------- 横轴日期文字 ----------
  // 日期太多时标签会挤成一团，所以算一个“间隔”：每隔 skip 个才画一个。
  // Math.ceil 向上取整，保证日期多时也不会一个都不剩。
  const skip = Math.ceil(dates.length / 6);
  dates.forEach((day, i) => {
    // 不是间隔点就跳过；最后一个日期总是画出来，避免右边空一块。
    if (i % skip !== 0 && i !== dates.length - 1) return;
    const text = svgEl("text", {
      class: "axis-text",
      x: xOf(i),
      y: H - PAD.bottom + 16, // 放在绘图区下方
      "text-anchor": "middle", // 以文字中心对齐坐标（居中）
    });
    // 【难点】日期字符串形如 "2026-10-01"（长度≥10），slice(5) 表示从下标 5 开始截取，
    // 得到 "10-01"；如果格式不是这样（长度不足），就原样显示。
    text.textContent = day.length >= 10 ? day.slice(5) : day;
    svg.appendChild(text);
  });

  // 最后把拼好的整张 <svg> 放进页面容器，图就出现了。
  chartBody.appendChild(svg);
}


/* =====================================================================
   第 5 部分：表单提交 —— 用户点“保存”之后发生什么
   ===================================================================== */

// 给表单挂一个 “submit(提交)” 监听器。
// e 是“事件对象”，里面装着这次事件的各种信息，也需要它来阻止默认行为。
form.addEventListener("submit", (e) => {
  // 【难点】表单默认提交会让浏览器刷新/跳转页面（原来的老式做法）。
  // preventDefault() = “别做默认动作”，我们想用 JS 自己处理，所以必须阻止它。
  e.preventDefault();

  // FormData 会自动把表单里所有带 name 的控件收集成“键值对”，
  // 键就是 name 属性（kind/money/day/tag），值是用户填的内容。
  const data = new FormData(form);
  // data.get("kind") 就取出对应控件当前的 value（这里值是 "Income" 或 "Expense"）。
  const type = data.get("kind");
  const amount = data.get("money");
  const date = data.get("day");
  const category = data.get("tag");

  // ---------- 同步“页面”和“数据” ----------
  // buildRow(...) 造出一行；list.prepend(...) 把它插到列表【最前面】。
  list.prepend(buildRow(type, amount, date, category));
  // ledger.unshift(...) 把同一条数据也插到数组【最前面】，顺序与页面保持一致。
  // unshift 与 prepend 都表示“加到最前面”，这是两者能对上的关键。
  ledger.unshift({ type, amount, date, category });
  refresh();     // 重新算账、重新画图
  form.reset();  // 清空表单，方便继续记录下一条
});

// 程序启动时先手动执行一次 refresh：
// 这样即使一开始没有任何数据，页面上的数字和图表“空状态”也能正确初始化。
refresh();


/* =====================================================================
   附录 A：本项目【没有用到】的常用 JS —— 示例代码
   ---------------------------------------------------------------------
   下面这些函数都是“只定义、不调用”，所以完全不会影响页面运行。
   想亲手体验：按 F12 打开浏览器控制台(Console)，输入函数名加括号回车即可，
   例如输入  demoArray()  就能看到结果。
   提示：真实上线项目里，这类练习代码应当放进单独文件或删掉，不要留在正式代码中。
   ===================================================================== */


/* ---------------- A1. 数组常用方法（最高频，必须掌握） ---------------- */
function demoArray() {
  const nums = [3, 1, 4, 1, 5, 9, 2, 6];

  // map：把每个元素“加工”成新东西，返回【新数组】，长度不变。
  const doubled = nums.map((n) => n * 2);            // [6,2,8,2,10,18,4,12]

  // filter：筛选出符合条件的元素，返回【新数组】，长度可变短。
  const big = nums.filter((n) => n > 3);              // [4,5,9,6]

  // reduce：把整个数组“压缩”成一个值，最常用于求和/求最大值。
  // acc 是累加器（上一轮的结果），0 是初始值。
  const sum = nums.reduce((acc, n) => acc + n, 0);    // 31

  // forEach：只遍历、不返回新数组（返回值永远是 undefined）。
  nums.forEach((n, i) => console.log("第" + i + "个 = " + n));

  // find / findIndex：找第一个满足条件的“元素” / 它的“下标”(-1 表示没找到)。
  const firstBig = nums.find((n) => n > 3);           // 4
  const idxBig = nums.findIndex((n) => n > 3);        // 2

  // some / every：是否存在一个满足 / 是否全部满足，返回布尔值。
  const hasBig = nums.some((n) => n > 8);             // true
  const allPos = nums.every((n) => n > 0);            // true

  // includes：数组里是否包含某个值。
  const hasFive = nums.includes(5);                   // true

  // 【难点】sort 会直接改动原数组！想保留原数组要先 [...nums] 复制一份。
  // 数字排序必须写 (a,b)=>a-b，否则按字符串比大小，会出现 10 < 9 的怪现象。
  const sorted = [...nums].sort((a, b) => a - b);

  // 去重：Set 的特性是“值不重复”，再用 [...] 转回数组。
  const unique = [...new Set(nums)];

  // slice(起点,终点)：截取一段（不改原数组）；splice(起点,个数,...新增)：会改原数组。
  const head = nums.slice(0, 3);                      // [3,1,4]

  console.log({ doubled, big, sum, firstBig, idxBig, hasBig, allPos, hasFive, sorted, unique, head });
}


/* ---------------- A2. 对象：解构 / 展开 / 可选链 / Object 工具 ---------------- */
function demoObject() {
  const user = { name: "小明", age: 20, city: "北京" };

  // 解构：把对象里的属性“拆”成独立变量，写起来更短。
  const { name, city } = user;

  // 展开 ...：复制一份并新增/覆盖属性，原对象不受影响（“浅拷贝”）。
  const extra = { ...user, job: "学生" };

  // 【难点】可选链 ?.：user 里没有 address，直接写 user.address.city 会报错崩溃；
  // 用 ?. 则安全返回 undefined，程序不会挂。
  const street = user.address?.city;

  // 空值合并 ??：只有当左边是 null 或 undefined 时，才用右边的默认值。
  // 对比 ||：如果左边是 0 或 ""（空字符串）也会取右边，容易误伤，所以推荐 ??。
  const nick = user.nickname ?? "匿名";

  // Object 静态方法：取键、取值、取键值对。
  const keys = Object.keys(user);                     // ["name","age","city"]
  const values = Object.values(user);                 // ["小明",20,"北京"]
  const entries = Object.entries(user);               // [["name","小明"],...]

  // 遍历对象的两种方式（for...of 只能配 entries，因为对象本身不可直接遍历）。
  for (const [k, v] of Object.entries(user)) console.log(k, v);

  console.log({ name, city, extra, street, nick, keys, values, entries });
}


/* ---------------- A3. 字符串常用方法 ---------------- */
function demoString() {
  const s = "  Hello World  ";

  console.log(s.trim());                       // 去掉首尾空格 -> "Hello World"
  console.log(s.includes("World"));            // 是否包含子串 -> true
  console.log(s.startsWith("  Hello"));        // 是否以某段开头
  console.log("a,b,c".split(","));             // 按分隔符切成数组 -> ["a","b","c"]
  console.log(["a", "b"].join("-"));           // 把数组拼成字符串 -> "a-b"
  console.log("abc".toUpperCase());            // 转大写
  console.log("ABC".slice(1));                 // 从下标 1 截到最后 -> "BC"
  console.log("2026-10-01".replace("-", "/")); // 只替换第一处 -> "2026/10-01"
  console.log("2026-10-01".replaceAll("-", "/")); // 全部替换 -> "2026/10/01"
  console.log("5".padStart(3, "0"));           // 左边补零到 3 位 -> "005"
}


/* ---------------- A4. 数字与 Math ---------------- */
function demoNumber() {
  console.log(Number("3.14"));        // 字符串转数字 -> 3.14
  console.log(parseInt("42px"));      // 转整数，遇到非数字停下 -> 42
  console.log(parseFloat("3.14kg"));  // 转小数 -> 3.14
  console.log((3.14159).toFixed(2));  // 保留两位小数，结果是【字符串】-> "3.14"
  console.log(Math.round(2.5));       // 四舍五入 -> 3
  console.log(Math.floor(2.9));       // 向下取整 -> 2
  console.log(Math.ceil(2.1));        // 向上取整 -> 3
  console.log(Math.max(1, 9, 3));     // 取最大值 -> 9
  console.log(Math.min(1, 9, 3));     // 取最小值 -> 1
  // 生成 [0, 1) 的随机小数；乘 10 再 floor 得到 0~9 的随机整数。
  console.log(Math.floor(Math.random() * 10));
  // 【常见坑】浮点误差：0.1 + 0.2 不等于 0.3，比较金额时要用 toFixed 或转成分再算。
  console.log(0.1 + 0.2);             // 0.30000000000000004
}


/* ---------------- A5. 函数进阶：默认参数 / 剩余参数 / 闭包 / 递归 ---------------- */
function demoFunction() {
  // 默认参数：没传参时用 "游客"。
  function greet(who = "游客") { return "你好，" + who; }

  // 剩余参数 ...args：把多出来的实参打包成数组。
  const total = (...nums) => nums.reduce((a, b) => a + b, 0);

  // 【难点】闭包：内层函数“记住”了外层函数的变量，即使外层已经执行完毕。
  // counter() 每次被调用都会生成一个独立的小计数器，各自记忆互不干扰。
  function counter() {
    let n = 0;             // 这个变量被内层函数“捕获”了
    return () => ++n;      // 返回一个函数，它一直记得 n
  }
  const c1 = counter();
  const c2 = counter();
  c1(); c1();              // c1 内部 n 变成 2
  console.log("c1=", c1(), "c2=", c2()); // c1=3，c2=1（两者互不影响）

  // 递归：函数自己调用自己，必须有“出口”否则会无限循环。
  function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }

  // 回调函数：把“函数”当参数传给另一个函数，需要时再调用它。
  function runTwice(fn) { fn(); fn(); }
  runTwice(() => console.log("我被调用了"));

  console.log(greet(), greet("小明"), total(1, 2, 3, 4), factorial(5));
}


/* ---------------- A6. DOM 进阶：选择器 / classList / dataset / 事件委托 ---------------- */
function demoDom() {
  // querySelector 用 CSS 选择器找【第一个】匹配元素；All 找【全部】（返回类数组）。
  const firstRow = document.querySelector(".row");
  const allRows = document.querySelectorAll(".row");

  // classList 增删改查 class，比拼接 className 字符串更安全直观。
  if (firstRow) {
    firstRow.classList.add("active");       // 加
    firstRow.classList.remove("active");    // 删
    firstRow.classList.toggle("active");    // 有就删、没有就加
    console.log(firstRow.classList.contains("active")); // 是否包含
  }

  // dataset 读取 HTML 里的 data-* 属性。例如 <li data-id="7"> -> 元素.dataset.id === "7"
  console.log([...allRows].map((r) => r.dataset.id));

  // 修改文字/HTML。注意：innerHTML 会解析标签，有被注入的风险，优先用 textContent。
  // firstRow.textContent = "纯文字";
  // firstRow.innerHTML = "<b>会解析成加粗标签</b>";

  // 【难点·重要】事件委托：不给每个子元素单独绑定，只在“父容器”上绑一次。
  // 好处：1) 省内存 2) 以后动态新增的子元素也自动生效。
  // e.target 是真正被点的那个元素；closest 往上找最近的匹配祖先。
  const listEl = document.getElementById("recordList");
  if (listEl) {
    listEl.addEventListener("click", (e) => {
      const row = e.target.closest(".row");
      if (!row) return;          // 点到了空白区域，忽略
      console.log("你点到了某一行的区域内");
    });
  }
}


/* ---------------- A7. 表单与输入处理 ---------------- */
function demoForm() {
  // 实时监听输入：每敲一下都会触发（适合做搜索联想/实时校验）。
  const moneyInput = document.getElementById("money");
  if (moneyInput) {
    moneyInput.addEventListener("input", (e) => {
      // e.target.value 就是当前输入框里的文字。
      const raw = e.target.value;
      // 正则 /[^0-9.]/g 表示“把不是数字和点的字符全部删掉”，做简单输入过滤。
      e.target.value = raw.replace(/[^0-9.]/g, "");
    });
  }

  // 校验：用正则判断是否像金额（可带小数）。test 返回 true/false。
  const isMoney = (s) => /^\d+(\.\d{1,2})?$/.test(s);
  console.log(isMoney("12.5"), isMoney("abc"));

  // 读取/设置表单控件值（多选框、单选框等也都是 .value / .checked）。
  const kind = document.getElementById("kind");
  if (kind) console.log("当前类型 =", kind.value);
}


/* ---------------- A8. localStorage：把数据存到浏览器里（本项目很值得加的功能） ---------------- */
function demoStorage() {
  // 【难点】localStorage 只能存“字符串”，存对象/数组前必须用 JSON.stringify 转成字符串。
  const data = [{ type: "Income", amount: "100" }];
  localStorage.setItem("demoKey", JSON.stringify(data)); // 存

  // 读出来是字符串，要用 JSON.parse 还原成数组/对象。取不到时给个默认值 []。
  const raw = localStorage.getItem("demoKey");
  const back = raw ? JSON.parse(raw) : [];
  console.log("读回来的数据 =", back);

  localStorage.removeItem("demoKey"); // 删掉某一项
  // localStorage.clear();            // 清空全部（慎用）

  // 思路：把它接进本项目 —— 每次 refresh 时 setItem("ledger", JSON.stringify(ledger))，
  // 页面加载时先从 localStorage 读回来，刷新页面数据就不会丢了。
}


/* ---------------- A9. Date 与 Intl：日期时间处理 ---------------- */
function demoDate() {
  const now = new Date();               // 当前时间
  console.log(now.getFullYear());       // 年
  console.log(now.getMonth() + 1);      // 【坑】月份从 0 开始，所以要 +1
  console.log(now.getDate());           // 日
  console.log(now.getTime());           // 时间戳（毫秒），比较时间先后很方便

  // Intl.NumberFormat：把数字格式化成货币/千分位，比手拼字符串专业得多。
  const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD" }).format(1234.5);
  console.log(money);                   // 类似 "US$1,234.50"

  // 计算两个日期的天数差：相减得到毫秒，再除以一天的毫秒数。
  const a = new Date("2026-10-01");
  const b = new Date("2026-10-17");
  const days = (b - a) / (1000 * 60 * 60 * 24);
  console.log("相差天数 =", days);
}


/* ---------------- A10. JSON 与深拷贝 ---------------- */
function demoJson() {
  const obj = { a: 1, b: [2, 3], c: { d: 4 } };

  // JSON.stringify：对象 -> 字符串；JSON.parse：字符串 -> 对象。
  const text = JSON.stringify(obj);
  console.log(text, JSON.parse(text));

  // 【难点】浅拷贝 vs 深拷贝：
  // 展开 {...obj} 只复制第一层，内部的数组/对象仍是“同一份引用”，改一个另一个也变。
  const shallow = { ...obj };
  shallow.c.d = 999;
  console.log("原对象被改了 ->", obj.c.d); // 999，说明只是浅拷贝

  // 真正互不影响（含嵌套）的深拷贝：
  const deep = JSON.parse(JSON.stringify(obj));   // 简单可靠，但不支持函数/Date 等类型
  // 更现代的写法：const deep2 = structuredClone(obj); // 支持更多类型，但同样不支持函数
  console.log("深拷贝后改它不影响原对象 ->", deep.c.d);
}


/* ---------------- A11. 异步：Promise / async-await / fetch / 定时器 ---------------- */
function demoTimer() {
  // setTimeout：等一段时间后只执行一次；setInterval：每隔一段时间执行一次。
  setTimeout(() => console.log("1 秒后执行一次"), 1000);
  const id = setInterval(() => console.log("每 2 秒执行一次"), 2000);
  setTimeout(() => clearInterval(id), 5000); // clearInterval 停止循环，否则一直跑
}

// async 表示这个函数里可以“等待”异步结果。
async function demoAsync() {
  // Promise：表示一个“将来才有结果”的任务，有三种状态：等待、成功、失败。
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 【难点】await 会“暂停”当前函数，等 Promise 有结果再往下走；
  // 它让异步代码看起来像同步代码，比一层层 .then() 更好读。
  console.log("开始");
  await wait(500);
  console.log("等了 0.5 秒");

  // fetch 是浏览器自带的网络请求工具，返回的也是 Promise。
  // 典型写法：请求 -> 检查状态 -> 转成 JSON。务必用 try/catch 包住，网络失败很常见。
  try {
    const res = await fetch("https://api.iconify.design/simple-icons.json?icons=github");
    if (!res.ok) throw new Error("请求失败，状态码 " + res.status);
    const json = await res.json();
    console.log("拿到数据 =", json);
  } catch (err) {
    console.log("出错了：", err.message);
  }
}


/* ---------------- A12. 错误处理：try / catch / finally / throw ---------------- */
function demoError() {
  try {
    // try 里放“可能出错的代码”。
    console.log("尝试做事……");
    throw new Error("我故意抛出一个错误"); // throw 主动抛出错误，交给 catch 处理
  } catch (err) {
    // catch 捕获错误：程序不会崩溃，而是走到这里。
    console.log("捕获到错误：", err.message);
  } finally {
    // finally 无论成功失败都会执行，常用于收尾（如关闭加载动画）。
    console.log("无论成功失败都会执行");
  }
}


/* ---------------- A13. class：面向对象写法 ---------------- */
function demoClass() {
  // class 是“创建对象的模板”。constructor 是构造器，new 的时候自动执行。
  class Entry {
    constructor(type, amount, date) {
      this.type = type;     // this 指“当前被创建的那个对象”
      this.amount = amount;
      this.date = date;
    }
    // 方法：写在 class 里，无需 function 关键字。
    isIncome() { return this.type === "Income"; }
    // getter：像读属性一样调用（不加括号），常用于“算出来的值”。
    get label() { return (this.isIncome() ? "+" : "-") + "$" + this.amount; }
    // static：属于类本身，不依赖具体对象，通过 Entry.hello() 调用。
    static hello() { return "我是 Entry 类"; }
  }

  const e = new Entry("Income", 100, "2026-10-01");
  console.log(e.label, e.isIncome(), Entry.hello());
}


/* ---------------- A14. 四个高频小工具：防抖 / 节流 / 金额格式化 / 唯一 ID ---------------- */
function demoTools() {
  // 防抖 debounce：短时间内被疯狂触发，也只等“安静下来”后执行最后一次。
  // 典型场景：搜索框输入联想、窗口 resize 结束后再计算。
  function debounce(fn, delay = 300) {
    let timer;                                  // 闭包保住定时器
    return function (...args) {
      clearTimeout(timer);                      // 每次触发都取消上一次
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // 节流 throttle：一段时间内最多执行一次，保证频率稳定。
  // 典型场景：滚动监听、鼠标拖动。
  function throttle(fn, gap = 300) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= gap) { last = now; fn.apply(this, args); }
    };
  }

  // 金额格式化：保留两位小数 + 千分位（比手写拼接好用）。
  const fmt = (n) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // 随机唯一 ID：随机数转 36 进制再截取，够日常使用。
  const uid = () => Math.random().toString(36).slice(2, 9);

  // 演示防抖：连续调用只会打印最后一次。
  const log = debounce((t) => console.log("防抖执行:", t), 300);
  log("a"); log("b"); log("c");

  console.log(fmt(1234567.891), uid());
  console.log(typeof throttle); // 提示：throttle 已定义，可自行套到滚动事件上试试
}


/* ---------------- A15. 正则表达式基础 ---------------- */
function demoRegex() {
  const s = "我的电话是 138-1234-5678，邮箱是 abc@mail.com";

  // \d 表示数字，+ 表示“一个或多个”；match 返回找到的内容数组。
  console.log(s.match(/\d+/g));                     // ["138","1234","5678"]

  // 邮箱的常见简易匹配（\w 表示字母数字下划线，@ 和 . 需转义或用字面量）。
  console.log(s.match(/[\w.]+@[\w.]+/)[0]);         // "abc@mail.com"

  // test 返回 true/false，用于校验；replace 用正则批量替换。
  console.log(/\d{4}/.test("abcd1234"));            // true
  console.log("2026-10-01".replace(/-/g, "/"));     // "2026/10/01"

  // 常用标记：g = 全局查找；i = 忽略大小写；m = 多行。
  console.log("Hello hello".match(/hello/gi));      // ["Hello","hello"]
}


/* =====================================================================
   附录 B：知识点总结（把本项目从头到尾串一遍）
   ---------------------------------------------------------------------
   一、变量与数据类型
     - const 不可重新赋值；let 可以改；var 是旧写法，尽量别用（作用域混乱）。
     - 基础类型：string / number / boolean / null / undefined；对象类型：object / array / function。
     - 假值（参与 if 会被当成 false）：false、0、""、null、undefined、NaN，其余都算真值。

   二、选取与操作 DOM（本项目最核心）
     - 查找：getElementById、querySelector、querySelectorAll。
     - 创建：createElement；SVG 要用 createElementNS + 命名空间。
     - 插入：append / appendChild / prepend / insertBefore；删除：element.remove()。
     - 改内容：textContent（纯文字，安全）优于 innerHTML（会解析标签，有注入风险）。
     - 改样式：优先动 class（className / classList），样式写进 CSS 文件，别散在 JS 里。

   三、事件（用户交互）
     - addEventListener(事件名, 处理函数)；事件对象 e 常用 e.preventDefault() 阻止默认行为。
     - 事件委托：绑在父元素上，用 e.target + closest() 找到真正被点的子元素，
       动态新增的元素也能自动响应，这是本项目“删除按钮”能用统一逻辑处理的关键思路。

   四、数组与对象（数据处理）
     - 数组：map / filter / reduce / forEach / find / some / every / sort / slice / splice。
      重点区分：map、filter、slice 返回新数组不改原数组；sort、splice、push、unshift 会改原数组。
     - 对象：解构、展开 {...}、可选链 ?.、空值合并 ??、Object.keys/values/entries。

   五、函数
     - 箭头函数：写法短，没有自己的 this（回调里几乎都用它）。
     - 闭包：内层函数记住外层变量；本项目的 drawSeries、防抖/节流都靠它。
     - 递归：函数调用自己，必须有终止条件。

   六、本项目用到的关键技巧
     - 数据与视图分离：数据存在 ledger 数组，DOM 只负责显示；改数据 -> 调 refresh 重绘。
     - 双份同步：列表用 prepend 插最前，数组用 unshift 插最前，保证下标一一对应；
       删除时用 [...list.children].indexOf(row) 找到下标，再 splice 同步删除。
     - parseInt/parseFloat 转数字，并用 "|| 0" 兜底 NaN。
     - 坐标换算：把真实数值“翻译”成屏幕像素（xOf/yOf），是所有图表的基础。
     - SVG 描线动画：pathLength=1 + stroke-dasharray/dashoffset + CSS 动画。

   七、进阶方向（附录 A 都给了起步示例）
     异步：Promise / async-await / fetch；存储：localStorage + JSON 序列化；
     错误处理：try/catch/throw；日期：Date / Intl；面向对象：class；工具：防抖/节流；正则。
   ===================================================================== */
