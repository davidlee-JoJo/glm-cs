import { LAYOUT, WALKABLE, SPAWN_T, SPAWN_CT, PATROL_CELLS } from "../js/world/layout.js";

let errors = 0;
const fail = (msg) => { console.error("FAIL:", msg); errors++; };

LAYOUT.forEach((row, i) => {
  if (row.length !== 32) fail(`row ${i} length ${row.length} != 32`);
});

const rows = LAYOUT.length;
if (rows !== 32) fail(`layout has ${rows} rows != 32`);

const grid = LAYOUT.map((r) => r.split(""));

const walk = (c, r) =>
  c >= 0 && c < 32 && r >= 0 && r < 32 && WALKABLE.includes(grid[r][c]);

const spawns = [...SPAWN_T, ...SPAWN_CT];
for (const [c, r] of spawns) {
  if (!walk(c, r)) fail(`spawn (${c},${r}) is not walkable, char='${grid[r][c]}'`);
}
for (const [c, r] of PATROL_CELLS) {
  if (!walk(c, r)) fail(`patrol (${c},${r}) is not walkable, char='${grid[r][c]}'`);
}

const start = SPAWN_T[0];
const seen = new Set([start.join(",")]);
const queue = [start];
while (queue.length) {
  const [c, r] = queue.shift();
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nc = c + dc, nr = r + dr;
    const key = nc + "," + nr;
    if (walk(nc, nr) && !seen.has(key)) { seen.add(key); queue.push([nc, nr]); }
  }
}

let totalWalk = 0;
for (let r = 0; r < 32; r++) for (let c = 0; c < 32; c++) if (walk(c, r)) totalWalk++;
if (seen.size !== totalWalk) {
  fail(`flood fill reached ${seen.size}/${totalWalk} walkable cells`);
  for (let r = 0; r < 32; r++) for (let c = 0; c < 32; c++) {
    if (walk(c, r) && !seen.has(`${c},${r}`)) console.error(`  unreachable: cell (${c},${r}) char='${grid[r][c]}'`);
  }
}

const hasA = LAYOUT.some((r) => r.includes("A"));
const hasB = LAYOUT.some((r) => r.includes("B"));
if (!hasA) fail("no bomb site A cells");
if (!hasB) fail("no bomb site B cells");

const crateCount = LAYOUT.join("").split("").filter((ch) => ch === "X" || ch === "H").length;
console.log(`crates: ${crateCount}`);

if (errors === 0) {
  console.log(`MAP OK — 32x32, walkable=${totalWalk}, all spawns/patrol reachable, sites A+B present`);
} else {
  console.log(`MAP has ${errors} error(s)`);
  process.exit(1);
}
