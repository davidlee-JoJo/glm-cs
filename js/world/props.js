import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PM = 'https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/';

export const PROPS = {
  barrel: { url: PM + 'medieval-fair/Barrel.glb', h: 0.92 },
  jar: { url: PM + 'tomb-chaser-1/Jar01_Art.glb', h: 0.72 },
  palm: { url: PM + 'tomb-chaser-1/PalmTree_Art.glb', h: 4.4 },
  rock: { url: PM + 'tomb-chaser-2/Rock01_Art.glb', h: 0.62 },
  grass: { url: PM + 'tomb-chaser-2/Grass01_Art.glb', h: 0.5 },
  cart: { url: PM + 'medieval-fair/Cart.glb', h: 1.3 },
  torch: { url: PM + 'tomb-chaser-1/FireTorch01_Art.glb', h: 1.35 },
  bench: { url: PM + 'transit/Bench_01.glb', h: 0.55 },
  plant: { url: PM + 'transit/Plant_02_Art.glb', h: 0.95 },
  ebox: { url: PM + 'tomb-chaser-2/ElectricBox01_Art.glb', h: 1.1 },
  lamp: { url: PM + 'transit/Tower_Station_Light_Art.glb', h: 3.3 },
  fence: { url: PM + 'transit/Tower_Ornamental_Fence_Art.glb', h: 1.1 },
  cone: { url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/TrafficCone/glTF-Binary/TrafficCone.glb', h: 0.55 }
};

export const MAP_PROPS = {
  dust: ['barrel', 'palm', 'jar', 'cart', 'rock', 'cone'],
  inferno: ['barrel', 'jar', 'cart', 'grass', 'plant', 'lamp'],
  nuke: ['barrel', 'ebox', 'bench', 'cone', 'plant', 'lamp'],
  snow: ['barrel', 'rock', 'grass', 'cone', 'ebox'],
  fortress: ['barrel', 'jar', 'cart', 'grass', 'rock', 'torch'],
  harbor: ['barrel', 'ebox', 'bench', 'torch', 'cone', 'lamp'],
  city: ['cone', 'bench', 'plant', 'ebox', 'barrel', 'lamp'],
  metro: ['bench', 'cone', 'ebox', 'barrel', 'plant', 'fence'],
  rail: ['barrel', 'cone', 'ebox', 'bench', 'lamp', 'fence', 'rock']
};

const TOP_PROPS = {
  dust: ['jar', 'rock', 'barrel'],
  inferno: ['jar', 'grass'],
  nuke: ['barrel', 'ebox'],
  snow: ['rock', 'barrel'],
  fortress: ['jar', 'barrel'],
  harbor: ['barrel', 'cone'],
  city: ['cone', 'plant'],
  metro: ['cone', 'barrel'],
  rail: ['barrel', 'cone', 'ebox']
};

const TOP_H = { X: 1.0, '1': 0.45, '2': 0.9, '3': 1.35, '4': 1.8, P: 2.0 };
const WALK = new Set('.CTAB12');

const cache = new Map();
function loadModel(key) {
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => {
      new GLTFLoader().load(PROPS[key].url, (g) => resolve(g.scene), undefined, () => resolve(null));
    }));
  }
  return cache.get(key);
}

const TRAIN_URL = PM + 'transit/Train_01_Art.glb';
let trainPromise = null;
export function loadTrain() {
  if (!trainPromise) {
    trainPromise = new Promise((resolve) => {
      new GLTFLoader().load(TRAIN_URL, (g) => resolve(g.scene), undefined, () => resolve(null));
    });
  }
  return trainPromise;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fitted(key, src) {
  const obj = src.clone(true);
  const wrap = new THREE.Group();
  wrap.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  obj.scale.setScalar(PROPS[key].h / Math.max(size.y, 0.001));
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -box2.min.y, -c.z);
  wrap.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return wrap;
}

export async function decorateMap(map, key) {
  const group = new THREE.Group();
  map.propsGroup = group;
  map.scene.add(group);
  const keys = MAP_PROPS[key];
  if (!keys) return 0;
  const loaded = {};
  await Promise.all(keys.map(async (k) => { loaded[k] = await loadModel(k); }));

  const def = map.def;
  const grid = def.layout.map((r) => r.split(''));
  const rows = grid.length, cols = grid[0].length;
  const spawns = new Set();
  for (const sp of [...def.spawnT, ...def.spawnCT]) spawns.add(sp[1] * cols + sp[0]);

  const edgeCells = [];
  const topCells = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const ch = grid[r][c];
      if (TOP_H[ch]) { topCells.push({ c, r, h: TOP_H[ch] }); continue; }
      if (!WALK.has(ch) || spawns.has(r * cols + c)) continue;
      const dirs = [];
      if (grid[r][c - 1] === '#') dirs.push([-1, 0]);
      if (grid[r][c + 1] === '#') dirs.push([1, 0]);
      if (grid[r - 1][c] === '#') dirs.push([0, -1]);
      if (grid[r + 1][c] === '#') dirs.push([0, 1]);
      if (dirs.length) edgeCells.push({ c, r, dirs });
    }
  }

  const rng = mulberry32(hashStr(key));
  const place = (k, x, y, z, ry) => {
    if (!loaded[k] || map.disposed) return;
    const w = fitted(k, loaded[k]);
    w.position.set(x, y, z);
    w.rotation.y = ry;
    group.add(w);
  };

  let count = 0;
  if (keys.includes('torch')) {
    for (const cell of edgeCells) {
      if (count >= 8) break;
      if (rng() > 0.3) continue;
      const [dc, dr] = cell.dirs[Math.floor(rng() * cell.dirs.length)];
      place('torch', map.cellToWorldX(cell.c) + dc * 0.92, 2.2, map.cellToWorldZ(cell.r) + dr * 0.92, rng() * Math.PI * 2);
      count++;
    }
  }

  const groundKeys = keys.filter((k) => k !== 'torch');
  let ng = 0;
  for (const cell of edgeCells) {
    if (ng >= 40) break;
    if (rng() > 0.18) continue;
    const k = groundKeys[Math.floor(rng() * groundKeys.length)];
    const [dc, dr] = cell.dirs[Math.floor(rng() * cell.dirs.length)];
    const tangent = Math.atan2(dc, dr) + Math.PI / 2;
    place(k, map.cellToWorldX(cell.c) + dc * 0.58, 0, map.cellToWorldZ(cell.r) + dr * 0.58,
      tangent + (rng() - 0.5) * 0.8);
    ng++;
  }

  const topKeys = TOP_PROPS[key] ? TOP_PROPS[key].filter((k) => loaded[k]) : [];
  let nt = 0;
  for (const cell of topCells) {
    if (nt >= 16 || !topKeys.length) break;
    if (rng() > 0.36) continue;
    place(topKeys[Math.floor(rng() * topKeys.length)],
      map.cellToWorldX(cell.c), cell.h, map.cellToWorldZ(cell.r), rng() * Math.PI * 2);
    nt++;
  }
  return group.children.length;
}
