function makeGrid(cols, rows) {
  const g = [];
  for (let r = 0; r < rows; r++) g.push(new Array(cols).fill('#'));
  return g;
}
function fill(g, c0, r0, c1, r1, ch) {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (g[r] && g[r][c] !== undefined) g[r][c] = ch;
}
function render(g) {
  return g.map((row) => row.join(''));
}
function show(name, g) {
  console.log('=== ' + name + ' ===');
  render(g).forEach((s, i) => console.log(String(i).padStart(2) + ' ' + s + ' [' + s.length + ']'));
}

const metro = makeGrid(46, 26);
fill(metro, 1, 1, 44, 24, '.');
for (let c = 11; c <= 34; c += 11) fill(metro, c, 2, c, 6, '#');
fill(metro, 5, 4, 7, 4, 'x');
fill(metro, 38, 4, 40, 4, 'x');
fill(metro, 2, 1, 3, 3, 'C');
fill(metro, 42, 1, 43, 3, 'T');
fill(metro, 15, 3, 16, 3, 'X');
fill(metro, 28, 5, 29, 5, 'H');
fill(metro, 1, 8, 44, 8, '#');
for (const [a, b] of [[6, 9], [21, 24], [36, 39]]) fill(metro, a, 8, b, 8, '.');
fill(metro, 1, 9, 44, 12, '2');
for (const [a, b] of [[6, 9], [21, 24], [36, 39]]) fill(metro, a, 9, b, 9, '1');
fill(metro, 1, 12, 44, 12, '1');
for (const c of [8, 24, 38]) fill(metro, c, 11, c, 11, '#');
fill(metro, 13, 13, 44, 19, '.');
fill(metro, 13, 14, 44, 14, 'R');
fill(metro, 13, 16, 44, 16, 'R');
fill(metro, 13, 18, 44, 18, 'R');
fill(metro, 13, 13, 12, 19, '#');
fill(metro, 1, 20, 44, 23, '2');
fill(metro, 1, 20, 44, 20, '1');
for (const c of [8, 24, 38]) fill(metro, c, 22, c, 22, '#');
fill(metro, 1, 24, 44, 25, '#');
const metroLayout = render(metro);

const rail = makeGrid(42, 30);
fill(rail, 1, 1, 40, 28, '.');
fill(rail, 2, 2, 4, 4, 'T');
fill(rail, 2, 25, 4, 27, 'C');
fill(rail, 5, 1, 17, 9, '.');
for (const [c, r0, r1] of [[7, 2, 3], [10, 2, 3], [13, 2, 3]]) fill(rail, c, r0, c, r1, 'H');
fill(rail, 6, 4, 6, 7, 'H');
fill(rail, 15, 4, 15, 7, 'H');
fill(rail, 8, 5, 8, 5, '1');
fill(rail, 9, 5, 9, 5, '2');
fill(rail, 10, 5, 10, 5, '3');
fill(rail, 11, 5, 11, 5, '4');
fill(rail, 12, 5, 16, 6, 'P');
fill(rail, 1, 10, 40, 10, '.');
fill(rail, 1, 11, 40, 11, 'R');
fill(rail, 1, 12, 40, 12, '.');
fill(rail, 1, 13, 40, 17, '.');
fill(rail, 1, 18, 40, 18, '.');
fill(rail, 1, 19, 40, 19, 'R');
fill(rail, 1, 20, 40, 20, '.');
fill(rail, 1, 21, 40, 28, '.');
for (const [c, r0, r1] of [[10, 14, 16], [13, 14, 16], [8, 15, 15], [15, 15, 15]]) fill(rail, c, r0, c, r1, 'X');
for (let r = 21; r <= 28; r++) for (let c = 26; c <= 39; c++) rail[r][c] = '#';
fill(rail, 27, 23, 38, 27, '.');
fill(rail, 32, 21, 33, 21, '.');
fill(rail, 26, 23, 26, 24, '.');
fill(rail, 28, 25, 29, 25, 'X');
fill(rail, 35, 24, 36, 24, 'X');
for (let r = 1; r <= 4; r++) for (let c = 30; c <= 39; c++) rail[r][c] = '#';
fill(rail, 31, 2, 38, 3, '.');
fill(rail, 34, 4, 35, 4, '.');
fill(rail, 19, 1, 22, 28, '.');
for (const [c, r0, r1] of [[24, 25, 26], [27, 24, 24], [22, 5, 5], [24, 6, 6]]) fill(rail, c, r0, c, r1, 'x');
const railLayout = render(rail);

const W = '.CTAB1234PR';
function validate(name, L, def) {
  const errs = [];
  const rows = L.length, cols = L[0].length;
  L.forEach((r, i) => { if (r.length !== cols) errs.push(`r${i} len ${r.length}`); });
  L.forEach((r, i) => { for (const ch of r) if (!W.includes(ch) && !'#XHx'.includes(ch)) errs.push(`r${i} bad '${ch}'`); });
  const walk = L.map((r) => r.split('').map((ch) => W.includes(ch)));
  const w = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows && walk[r][c];
  for (const [label, arr] of [['T', def.spawnT], ['CT', def.spawnCT]]) {
    for (const [c, r] of arr) if (!w(c, r)) errs.push(`spawn${label} (${c},${r}) '${L[r]?.[c]}'`);
  }
  for (const [i, [c, r]] of def.patrol.entries()) if (!w(c, r)) errs.push(`patrol[${i}] (${c},${r}) '${L[r]?.[c]}'`);
  for (const [n, s] of [['A', def.siteA], ['B', def.siteB]]) {
    let cnt = 0;
    for (let r = s.row0; r <= s.row1; r++) for (let c = s.col0; c <= s.col1; c++) if (w(c, r)) cnt++;
    if (cnt < 12) errs.push(`site${n} ${cnt}`);
  }
  const seen = new Set();
  const q = [def.spawnT[0]];
  seen.add(q[0][1] * cols + q[0][0]);
  while (q.length) {
    const [c, r] = q.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, k = nr * cols + nc;
      if (w(nc, nr) && !seen.has(k)) { seen.add(k); q.push([nc, nr]); }
    }
  }
  let total = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (w(c, r)) total++;
  if (seen.size !== total) {
    errs.push(`conn ${seen.size}/${total}`);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (w(c, r) && !seen.has(r * cols + c)) errs.push(`  island (${c},${r})`);
  }
  if (errs.length) { console.log('FAIL ' + name); errs.slice(0, 30).forEach((e) => console.log('  ' + e)); }
  else console.log('PASS ' + name + ' walkable=' + total);
  return !errs.length;
}

const metroDef = {
  name: '捷運車站',
  theme: 'metro',
  layout: metroLayout,
  spawnT: [[41, 1], [42, 2], [41, 3], [43, 1], [42, 3]],
  spawnCT: [[2, 1], [3, 2], [2, 3], [4, 1], [3, 3]],
  siteA: { col0: 4, col1: 12, row0: 10, row1: 11 },
  siteB: { col0: 32, col1: 40, row0: 21, row1: 23 },
  indoor: [
    { c0: 0, c1: 45, r0: 0, r1: 8, h: 3.5 },
    { c0: 0, c1: 45, r0: 9, r1: 12, h: 3.5 },
    { c0: 0, c1: 45, r0: 13, r1: 19, h: 4.6 },
    { c0: 0, c1: 45, r0: 20, r1: 23, h: 3.5 }
  ],
  train: [{ c0: 14, c1: 26, r: 16 }, { c0: 30, c1: 40, r: 14 }],
  patrol: [
    [5, 10], [15, 11], [28, 10], [40, 11], [22, 15], [8, 17], [35, 17],
    [12, 3], [30, 4], [40, 6], [5, 7], [20, 22], [33, 21], [42, 23], [10, 20], [26, 2], [17, 13], [30, 19]
  ]
};

const railDef = {
  name: '鐵路調車場',
  theme: 'rail',
  layout: railLayout,
  spawnT: [[2, 2], [3, 3], [2, 4], [4, 2], [3, 4]],
  spawnCT: [[2, 25], [3, 26], [2, 27], [4, 25], [3, 27]],
  siteA: { col0: 27, col1: 38, row0: 23, row1: 27 },
  siteB: { col0: 5, col1: 16, row0: 1, row1: 9 },
  indoor: [
    { c0: 30, c1: 39, r0: 1, r1: 4, h: 3.2 },
    { c0: 26, c1: 39, r0: 21, r1: 28, h: 4.6 }
  ],
  train: [{ c0: 24, c1: 34, r: 11 }, { c0: 5, c1: 15, r: 19 }],
  crossings: [{ r: 10, c0: 18, c1: 23 }, { r: 12, c0: 18, c1: 23 }, { r: 18, c0: 18, c1: 23 }, { r: 20, c0: 18, c1: 23 }],
  patrol: [
    [7, 7], [14, 8], [16, 5], [3, 7], [8, 13], [16, 15], [5, 17], [25, 13],
    [35, 13], [38, 15], [25, 17], [6, 24], [16, 26], [23, 24], [28, 23], [38, 23], [12, 22], [20, 27], [8, 16], [33, 26], [31, 2], [35, 3]
  ]
};

show('metro', metro);
show('rail', rail);
const ok1 = validate('metro', metroLayout, metroDef);
const ok2 = validate('rail', railLayout, railDef);
if (ok1 && ok2) {
  const out = '\n  metro: ' + JSON.stringify(metroDef, null, 2).replace(/"layout": \[\n/, 'layout: [\n').replace(/"layout": \[/, 'layout: [') + ',\n';
  require('fs').writeFileSync('tools/newmaps_raw.txt', 'METRO_DEF_START' + JSON.stringify({ metro: metroDef, rail: railDef }));
  console.log('WROTE tools/newmaps_raw.txt');
}
