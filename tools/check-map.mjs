import { MAPS, WALKABLE } from '../js/world/maps.js';

let failed = false;

for (const [key, def] of Object.entries(MAPS)) {
  const errs = [];
  const L = def.layout;
  const rows = L.length, cols = L[0].length;

  if (rows !== 32) errs.push(`rows=${rows} (應為 32)`);
  L.forEach((r, i) => { if (r.length !== cols) errs.push(`r${i} 長度 ${r.length} ≠ ${cols}`); });
  L.forEach((r, i) => {
    for (const ch of r) if (!WALKABLE.includes(ch) && ch !== '#' && ch !== 'X' && ch !== 'H' && ch !== 'x')
      errs.push(`r${i} 非法字元 '${ch}'`);
  });

  const walk = L.map((r) => r.split('').map((ch) => WALKABLE.includes(ch)));
  const w = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows && walk[r][c];

  for (const [label, arr, min] of [['T', def.spawnT, 5], ['CT', def.spawnCT, 5]]) {
    if (arr.length < min) errs.push(`spawn${label} 只有 ${arr.length} 個 (需 ≥${min})`);
    for (const [c, r] of arr) if (!w(c, r)) errs.push(`spawn${label} (${c},${r}) 不可行走 '${L[r]?.[c]}'`);
  }
  for (const [i, [c, r]] of def.patrol.entries()) {
    if (!w(c, r)) errs.push(`patrol[${i}] (${c},${r}) 不可行走 '${L[r]?.[c]}'`);
  }
  for (const [name, s] of [['A', def.siteA], ['B', def.siteB]]) {
    let cnt = 0;
    for (let r = s.row0; r <= s.row1; r++) for (let c = s.col0; c <= s.col1; c++) if (w(c, r)) cnt++;
    if (cnt < 12) errs.push(`site${name} 可行走格僅 ${cnt} (需 ≥12)`);
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
    errs.push(`連通性: ${seen.size}/${total} 可達`);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (w(c, r) && !seen.has(r * cols + c)) errs.push(`  孤島格 (${c},${r})`);
    }
  }

  for (const [c, r] of [...def.spawnT, ...def.spawnCT, ...def.patrol]) {
    if (!seen.has(r * cols + c)) errs.push(`(${c},${r}) 與 T 出生點不連通`);
  }

  if (errs.length) {
    failed = true;
    console.log(`[FAIL] ${key} (${def.name})`);
    for (const e of errs) console.log('  ' + e);
  } else {
    console.log(`[OK] ${key} (${def.name}) — ${total} 可行走格, 全部連通`);
  }
}

if (failed) process.exit(1);
console.log('ALL MAPS PASS');
