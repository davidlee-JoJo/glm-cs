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
const building = (g, c0, c1, r0, r1, doors) => {
  hwall(g, r0, c0, c1); hwall(g, r1, c0, c1);
  vwall(g, c0, r0, r1); vwall(g, c1, r0, r1);
  for (const [c, r] of doors) g[r][c] = '.';
  return { c0: c0 + 1, c1: c1 - 1, r0: r0 + 1, r1: r1 - 1 };
};

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
  vwall(g, 34, 11, 30, [[34, 16], [34, 17], [34, 25], [34, 26]]);
  hwall(g, 39, 1, 46, [[12, 39], [13, 39], [40, 39], [41, 39]]);
  for (const [c, r] of [[14, 43], [18, 43], [22, 43], [26, 43], [20, 44], [30, 44]]) put(g, c, r, 'T');
  for (const [r, ch] of [[12, '1'], [13, '2'], [14, '3'], [15, '4']]) { put(g, 2, r, ch); put(g, 3, r, ch); }
  for (const [r, ch] of [[31, '4'], [32, '3'], [33, '2'], [34, '1']]) { put(g, 2, r, ch); put(g, 3, r, ch); }
  building(g, 10, 16, 20, 26, [[13, 20], [14, 20], [16, 22], [16, 23], [12, 26]]);
  for (const [c, r] of [[12, 22], [13, 22], [14, 24], [12, 24]]) put(g, c, r, 'H');
  vwall(g, 22, 12, 17, [[22, 14], [22, 15]]);
  vwall(g, 27, 24, 30, [[27, 27], [27, 28]]);
  hwall(g, 21, 17, 20, [[19, 21]]);
  hwall(g, 32, 8, 13, [[10, 32], [11, 32]]);
  vwall(g, 40, 14, 20, [[40, 17], [40, 18]]);
  for (const [c, r, ch] of [[24, 13, 'X'], [16, 14, 'x'], [11, 15, 'X'], [16, 17, 'x'], [17, 17, 'x'], [28, 19, 'X'], [19, 21, 'X'], [16, 24, 'x'], [17, 24, 'x'], [16, 25, 'x'], [17, 25, 'x'], [12, 26, 'X'], [28, 27, 'X'], [20, 28, 'H'], [22, 30, 'x'], [23, 30, 'x'], [8, 22, 'X'], [9, 22, 'X'], [30, 16, 'H'], [31, 16, 'H'], [14, 33, 'x'], [15, 33, 'x'], [21, 25, 'X'], [30, 34, 'X'], [31, 34, 'X'], [39, 12, 'X'], [41, 20, 'X'], [38, 28, 'X'], [42, 16, 'x'], [43, 16, 'x'], [44, 24, 'H'], [44, 25, 'H'], [36, 22, 'X'], [24, 41, 'H'], [25, 41, 'H'], [10, 42, 'X'], [34, 42, 'X']]) put(g, c, r, ch);
  rect(g, 25, 30, 31, 32, 'B');
  return { g, indoor: [{ c0: 11, c1: 15, r0: 21, r1: 25 }] };
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
  building(g, 2, 6, 16, 22, [[4, 16], [6, 19], [3, 22]]);
  building(g, 42, 46, 26, 32, [[44, 26], [42, 29], [44, 32]]);
  for (const [c, r, ch] of [[3, 18, 'H'], [4, 18, 'H'], [43, 28, 'H'], [44, 28, 'H'], [43, 29, 'H'], [20, 6, '#'], [20, 7, '#'], [20, 8, '#'], [20, 9, '#'], [20, 10, '#'], [20, 11, '#'], [17, 9, 'H'], [18, 9, 'H'], [43, 12, 'H'], [44, 12, 'H'], [42, 18, '#'], [42, 19, '#'], [42, 20, '#'], [42, 21, '#'], [42, 22, '#'], [42, 23, '#'], [42, 24, '#'], [42, 20, '.'], [42, 21, '.'], [45, 30, 'X'], [41, 36, 'X'], [25, 22, 'x'], [26, 22, 'x'], [3, 28, 'x'], [4, 28, 'x'], [3, 38, 'X'], [10, 44, 'X'], [12, 44, 'X'], [27, 44, 'H'], [28, 44, 'H']]) put(g, c, r, ch);
  return { g, indoor: [{ c0: 8, c1: 38, r0: 26, r1: 40 }, { c0: 18, c1: 28, r0: 13, r1: 20 }, { c0: 3, c1: 5, r0: 17, r1: 21 }, { c0: 43, c1: 45, r0: 27, r1: 31 }] };
}

function buildCity() {
  const g = grid(64, 64);
  const indoor = [];
  let b;
  b = building(g, 5, 14, 5, 14, [[9, 14], [10, 14], [14, 9], [14, 10]]);
  indoor.push(b);
  for (const [c, r] of [[8, 8], [11, 11]]) put(g, c, r, 'P');
  for (const [c, r, ch] of [[21, 8, 'H'], [22, 8, 'H'], [21, 12, 'H'], [22, 12, 'H'], [24, 10, 'x'], [25, 10, 'x']]) put(g, c, r, ch);
  b = building(g, 32, 42, 5, 14, [[32, 9], [32, 10], [37, 14], [38, 14]]);
  indoor.push(b);
  for (const [c, r] of [[36, 8], [39, 8], [36, 11]]) put(g, c, r, 'H');
  for (const [c, r, ch] of [[50, 8, 'X'], [53, 9, 'X'], [51, 12, 'X'], [48, 10, 'x'], [48, 11, 'x'], [55, 11, 'x']]) put(g, c, r, ch);
  for (const [c, r, ch] of [[8, 21, 'X'], [11, 24, 'X'], [7, 25, 'x'], [8, 25, 'x']]) put(g, c, r, ch);
  b = building(g, 19, 27, 19, 27, [[23, 19], [24, 19], [23, 27], [24, 27], [19, 23], [19, 24], [27, 23], [27, 24]]);
  indoor.push(b);
  for (const [c, r] of [[21, 21], [25, 21], [21, 25], [25, 25]]) put(g, c, r, 'P');
  for (const [c, r, ch] of [[35, 22, 'H'], [36, 22, 'H'], [39, 24, 'x'], [40, 24, 'x']]) put(g, c, r, ch);
  b = building(g, 47, 56, 19, 27, [[51, 19], [52, 19], [47, 23], [47, 24]]);
  indoor.push(b);
  for (const [c, r] of [[50, 23], [53, 23]]) put(g, c, r, 'X');
  b = building(g, 5, 14, 32, 42, [[9, 32], [10, 32], [14, 37], [14, 38]]);
  indoor.push(b);
  for (const [c, r] of [[8, 36], [11, 39]]) put(g, c, r, 'H');
  for (const [c, r, ch] of [[21, 35, 'x'], [22, 35, 'x'], [25, 38, 'X']]) put(g, c, r, ch);
  b = building(g, 32, 42, 32, 42, [[37, 32], [38, 32], [37, 42], [38, 42], [32, 37], [32, 38], [42, 37], [42, 38]]);
  indoor.push(b);
  for (const [c, r] of [[35, 35], [39, 35], [35, 39], [39, 39]]) put(g, c, r, 'P');
  for (const [c, r, ch] of [[50, 35, 'H'], [51, 35, 'H'], [54, 39, 'X']]) put(g, c, r, ch);
  for (const [c, r, ch] of [[8, 50, 'X'], [11, 53, 'x'], [12, 53, 'x']]) put(g, c, r, ch);
  for (const [c, r, ch] of [[21, 50, 'X'], [24, 51, 'X'], [22, 54, 'X'], [25, 49, 'x']]) put(g, c, r, ch);
  b = building(g, 32, 42, 47, 56, [[37, 47], [38, 47], [42, 51], [42, 52]]);
  indoor.push(b);
  for (const [c, r] of [[35, 51], [38, 54]]) put(g, c, r, 'H');
  for (const [c, r, ch] of [[50, 51, 'H'], [51, 51, 'H'], [53, 49, 'x'], [54, 49, 'x']]) put(g, c, r, ch);
  for (const [c, r, ch] of [[29, 10, 'H'], [30, 22, 'H'], [29, 34, 'H'], [30, 50, 'H'], [10, 16, 'X'], [24, 17, 'X'], [38, 16, 'X'], [52, 17, 'X'], [8, 29, 'x'], [24, 30, 'x'], [38, 29, 'x'], [52, 30, 'x'], [10, 44, 'H'], [24, 45, 'H'], [38, 44, 'H'], [52, 45, 'H'], [16, 8, 'X'], [17, 22, 'X'], [16, 36, 'X'], [17, 50, 'X'], [44, 8, 'H'], [45, 22, 'H'], [44, 36, 'H'], [45, 50, 'H']]) put(g, c, r, ch);
  for (const [c, r] of [[7, 3], [9, 3], [11, 3], [8, 4], [10, 4]]) put(g, c, r, 'C');
  for (const [c, r] of [[50, 59], [52, 59], [54, 59], [51, 60], [53, 60]]) put(g, c, r, 'T');
  return { g, indoor };
}

function validate(g, def, indoor) {
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
  for (const [i, z] of (indoor || []).entries()) {
    let cnt = 0;
    for (let r = z.r0; r <= z.r1; r++) for (let c = z.c0; c <= z.c1; c++) if (w(c, r)) cnt++;
    if (cnt < 8) errs.push(`indoor[${i}]=${cnt}`);
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

const FORT = {
  spawnT: [[14, 43], [18, 43], [22, 43], [26, 43], [20, 44], [30, 44]],
  spawnCT: [[38, 2], [42, 2], [37, 4], [40, 4], [43, 4]],
  siteA: { col0: 24, col1: 31, row0: 2, row1: 8 },
  siteB: { col0: 24, col1: 33, row0: 30, row1: 37 },
  patrol: [[19, 20], [15, 22], [28, 35], [36, 20], [39, 35], [20, 42], [15, 6], [28, 5], [1, 20], [4, 35], [12, 41], [44, 8], [13, 23], [24, 29], [19, 36], [42, 30]]
};
const HARB = {
  spawnT: [[30, 43], [34, 43], [38, 43], [32, 44], [36, 44], [28, 42]],
  spawnCT: [[3, 2], [6, 2], [3, 3], [2, 4], [5, 4]],
  siteA: { col0: 30, col1: 42, row0: 8, row1: 16 },
  siteB: { col0: 8, col1: 16, row0: 26, row1: 38 },
  patrol: [[8, 10], [24, 11], [40, 10], [4, 20], [44, 20], [25, 28], [15, 35], [33, 30], [14, 44], [40, 45], [23, 19], [13, 8], [4, 19], [44, 29], [9, 32], [24, 45]]
};
const CITY = {
  spawnT: [[50, 59], [52, 59], [54, 59], [51, 60], [53, 60]],
  spawnCT: [[7, 3], [9, 3], [11, 3], [8, 4], [10, 4]],
  siteA: { col0: 47, col1: 56, row0: 5, row1: 14 },
  siteB: { col0: 19, col1: 27, row0: 47, row1: 56 },
  patrol: [[29, 3], [16, 17], [29, 17], [45, 17], [3, 30], [16, 30], [45, 30], [60, 30], [3, 45], [29, 45], [60, 45], [16, 59], [45, 59], [23, 23], [9, 9], [37, 37], [23, 53]]
};

for (const [name, build, def] of [['fortress', buildFortress, FORT], ['harbor', buildHarbor, HARB], ['city', buildCity, CITY]]) {
  const { g, indoor } = build();
  const { errs, total } = validate(g, def, indoor);
  if (errs.length) { console.log(`[${name}] FAIL`); errs.forEach((e) => console.log('  ' + e)); process.exit(1); }
  console.log(`// ${name}: ${total} walkable, indoor=${JSON.stringify(indoor)}`);
  console.log(`// ${name} layout:`);
  console.log(g.map((r) => '      "' + r.join('') + '",').join('\n'));
}
