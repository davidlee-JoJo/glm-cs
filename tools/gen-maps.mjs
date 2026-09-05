import { WALKABLE } from '../js/world/maps.js';

function grid(rows, cols) {
  const g = Array.from({ length: rows }, () => Array(cols).fill('.'));
  for (let c = 0; c < cols; c++) { g[0][c] = '#'; g[rows - 1][c] = '#'; }
  for (let r = 0; r < rows; r++) { g[r][0] = '#'; g[r][cols - 1] = '#'; }
  return g;
}
const put = (g, c, r, ch) => { g[r][c] = ch; };
const rect = (g, c0, c1, r0, r1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; };
const hwall = (g, r, c0, c1, doors = []) => { for (let c = c0; c <= c1; c++) g[r][c] = '#'; for (const [c, rr] of doors) g[rr][c] = '.'; };
const vwall = (g, c, r0, r1, doors = []) => { for (let r = r0; r <= r1; r++) g[r][c] = '#'; for (const [cc, r] of doors) g[r][cc] = '.'; };

function buildFortress() {
  const g = grid(48, 48);
  vwall(g, 6, 1, 9, [[6, 4], [6, 5]]);
  vwall(g, 33, 1, 9, [[33, 4], [33, 5]]);
  hwall(g, 10, 6, 33, [[14, 10], [15, 10], [24, 10], [25, 10]]);
  for (const [c, r] of [[13, 4], [21, 4], [13, 6], [21, 6]]) put(g, c, r, 'P');
  rect(g, 25, 30, 3, 3, 'A');
  for (const [c, r] of [[26, 4], [27, 4], [26, 5], [10, 7], [11, 7]]) put(g, c, r, 'X');
  for (const [c, r] of [[38, 2], [42, 2], [37, 4], [40, 4], [43, 4]]) put(g, c, r, 'C');
  for (const [r, ch] of [[12, '1'], [13, '2'], [14, '3'], [15, '4']]) { put(g, 2, r, ch); put(g, 3, r, ch); }
  rect(g, 2, 3, 16, 30, 'P');
  for (const [r, ch] of [[31, '4'], [32, '3'], [33, '2'], [34, '1']]) { put(g, 2, r, ch); put(g, 3, r, ch); }
  for (const [c, r, ch] of [[24, 13, 'X'], [16, 14, 'x'], [11, 15, 'X'], [16, 17, 'x'], [17, 17, 'x'], [28, 19, 'X'], [19, 21, 'X'], [16, 24, 'x'], [17, 24, 'x'], [16, 25, 'x'], [17, 25, 'x'], [12, 26, 'X'], [28, 27, 'X'], [20, 28, 'H'], [22, 30, 'x'], [23, 30, 'x']]) put(g, c, r, ch);
  vwall(g, 34, 11, 30, [[34, 16], [34, 17], [34, 25], [34, 26]]);
  for (const [c, r, ch] of [[39, 12, 'X'], [41, 20, 'X'], [38, 28, 'X']]) put(g, c, r, ch);
  rect(g, 25, 30, 31, 32, 'B');
  hwall(g, 39, 1, 46, [[12, 39], [13, 39], [40, 39], [41, 39]]);
  for (const [c, r, ch] of [[10, 42, 'X'], [34, 42, 'X']]) put(g, c, r, ch);
  for (const [c, r] of [[14, 43], [18, 43], [22, 43], [26, 43], [20, 44], [30, 44]]) put(g, c, r, 'T');
  return g;
}

function buildHarbor() {
  const g = grid(48, 48);
  rect(g, 12, 22, 2, 4, 'P');
  for (const [r, ch] of [[5, '4'], [6, '3'], [7, '2'], [8, '1']]) { put(g, 12, r, ch); put(g, 13, r, ch); }
  for (const [c, r] of [[3, 2], [6, 2], [3, 3], [2, 4], [5, 4]]) put(g, c, r, 'C');
  rect(g, 33, 40, 9, 9, 'A');
  for (const [c, r] of [[34, 10], [38, 10]]) put(g, c, r, 'X');
  hwall(g, 12, 17, 29);
  vwall(g, 17, 13, 20, [[17, 15], [17, 16]]);
  vwall(g, 29, 13, 20, [[29, 15], [29, 16]]);
  hwall(g, 21, 17, 29, [[22, 21], [23, 21]]);
  put(g, 22, 18, 'X');
  for (const [c, r, ch] of [[5, 12, 'X'], [14, 13, 'H'], [15, 13, 'H'], [32, 14, 'H'], [33, 14, 'H']]) put(g, c, r, ch);
  for (const [c, r, ch] of [[10, 22, 'H'], [11, 22, 'H'], [34, 23, 'H'], [35, 23, 'H'], [15, 24, 'X']]) put(g, c, r, ch);
  hwall(g, 25, 7, 39, [[14, 25], [15, 25], [30, 25], [31, 25]]);
  vwall(g, 7, 26, 40, [[7, 32], [7, 33]]);
  vwall(g, 39, 26, 40, [[39, 33], [39, 34]]);
  for (const [c, r] of [[12, 29], [13, 29], [20, 29], [21, 29], [28, 29], [29, 29], [12, 34], [13, 34], [20, 34], [21, 34], [28, 34], [29, 34]]) put(g, c, r, 'H');
  rect(g, 10, 15, 30, 31, 'B');
  for (const [c, r] of [[24, 32], [34, 36]]) put(g, c, r, 'X');
  hwall(g, 41, 7, 39, [[20, 41], [21, 41]]);
  for (const [c, r] of [[30, 43], [34, 43], [38, 43], [32, 44], [36, 44]]) put(g, c, r, 'T');
  return g;
}

function validate(g, def) {
  const rows = g.length, cols = g[0].length;
  const errs = [];
  g.forEach((row, i) => { if (row.length !== cols) errs.push(`r${i} len ${row.length}`); });
  const w = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows && WALKABLE.includes(g[r][c]);
  for (const [label, arr] of [['T', def.spawnT], ['CT', def.spawnCT]]) {
    if (arr.length < 5) errs.push(`spawn${label} <5`);
    for (const [c, r] of arr) if (!w(c, r)) errs.push(`spawn${label} (${c},${r})='${g[r][c]}'`);
  }
  def.patrol.forEach(([c, r], i) => { if (!w(c, r)) errs.push(`patrol[${i}] (${c},${r})='${g[r][c]}'`); });
  for (const [name, s] of [['A', def.siteA], ['B', def.siteB]]) {
    let cnt = 0;
    for (let r = s.row0; r <= s.row1; r++) for (let c = s.col0; c <= s.col1; c++) if (w(c, r)) cnt++;
    if (cnt < 12) errs.push(`site${name}=${cnt}`);
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
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      if (w(c, r) && !seen.has(r * cols + c)) errs.push(`  island (${c},${r})`);
  }
  for (const [c, r] of [...def.spawnT, ...def.spawnCT, ...def.patrol])
    if (!seen.has(r * cols + c)) errs.push(`(${c},${r}) unreachable`);
  return { errs, total };
}

const FORT = { spawnT: [[14, 43], [18, 43], [22, 43], [26, 43], [20, 44], [30, 44]], spawnCT: [[38, 2], [42, 2], [37, 4], [40, 4], [43, 4]], siteA: { col0: 24, col1: 31, row0: 2, row1: 8 }, siteB: { col0: 24, col1: 33, row0: 30, row1: 37 }, patrol: [[19, 20], [15, 22], [28, 35], [36, 20], [39, 35], [20, 42], [15, 6], [28, 5], [1, 20], [4, 35], [12, 41], [44, 8]] };
const HARB = { spawnT: [[30, 43], [34, 43], [38, 43], [32, 44], [36, 44], [28, 42]], spawnCT: [[3, 2], [6, 2], [3, 3], [2, 4], [5, 4]], siteA: { col0: 30, col1: 42, row0: 8, row1: 16 }, siteB: { col0: 8, col1: 16, row0: 26, row1: 38 }, patrol: [[8, 10], [24, 11], [40, 10], [4, 20], [44, 20], [25, 28], [15, 35], [33, 30], [10, 44], [40, 45], [23, 19], [13, 8]] };

for (const [name, build, def] of [['fortress', buildFortress, FORT], ['harbor', buildHarbor, HARB]]) {
  const g = build();
  const { errs, total } = validate(g, def);
  if (errs.length) { console.log(`[${name}] FAIL`); errs.forEach((e) => console.log('  ' + e)); process.exit(1); }
  console.log(`// ${name}: ${total} walkable, all connected`);
  console.log(`// ${name} layout:`);
  console.log(g.map((r) => '      "' + r.join('') + '",').join('\n'));
}
