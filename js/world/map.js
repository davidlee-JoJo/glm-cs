import * as THREE from 'three';
import { CELL, WALKABLE } from './maps.js';
import { buildMaterials, boxMesh, siteDecalTex, THEMES } from './materials.js';

const WALL_H = 4.2;
const CRATE_H = 1.0;
const STACK_H = 2.0;
const LOW_H = 1.1;
const ELEV_H = { '1': 0.45, '2': 0.9, '3': 1.35, '4': 1.8, 'P': 2.0 };
const CEIL_H = 3.6;
const CEIL_TH = 0.4;

export class GameMap {
  constructor(engine, physics, def) {
    this.engine = engine;
    this.scene = engine.scene;
    this.physics = physics;
    this.def = def;
    this.theme = THEMES[def.theme];
    this.cols = def.layout[0].length;
    this.rows = def.layout.length;
    this.mats = buildMaterials(this.theme);
    this.rects = [];
    this.walk = [];
    this.meshes = [];
    this.navDirty = false;

    const bg = new THREE.Color(this.theme.sky);
    if (this.scene.background) this.scene.background.set(bg); else this.scene.background = bg;
    const fogN = def.fog ? def.fog[0] : this.theme.fogNear;
    const fogF = def.fog ? def.fog[1] : this.theme.fogFar;
    if (this.scene.fog) {
      this.scene.fog.color.set(bg);
      this.scene.fog.near = fogN;
      this.scene.fog.far = fogF;
    }
    const L = this.theme.light;
    engine.hemi.intensity = L.hemi;
    engine.sun.intensity = L.sun;
    engine.sun.color.set(L.sunColor);
    const sc = engine.sun.shadow.camera;
    sc.left = -L.shadow; sc.right = L.shadow; sc.top = L.shadow; sc.bottom = -L.shadow;
    sc.updateProjectionMatrix();

    this._buildFloor();
    this._buildCells();
    this._buildNav();
    this._buildSiteDecals();
    this._buildIndoor();
  }

  dispose() {
    for (const m of this.meshes) this.scene.remove(m);
    this.meshes = [];
    this.physics.solids = [];
    this.rects = [];
  }

  _track(mesh) {
    this.meshes.push(mesh);
    this.scene.add(mesh);
    return mesh;
  }

  cellToWorldX(col) { return (col + 0.5 - this.cols / 2) * CELL; }
  cellToWorldZ(row) { return (row + 0.5 - this.rows / 2) * CELL; }
  worldToCell(x, z) {
    return {
      col: Math.floor(x / CELL + this.cols / 2),
      row: Math.floor(z / CELL + this.rows / 2)
    };
  }

  _buildFloor() {
    const size = this.cols * CELL;
    const geo = new THREE.PlaneGeometry(size, size);
    const floor = this._track(new THREE.Mesh(geo, this.mats.floor));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.physics.addSolid(0, -0.25, 0, size, 0.5, size, 'floor');
  }

  _buildCells() {
    const LAYOUT = this.def.layout;
    const grid = LAYOUT.map((r) => r.split(''));
    const half = CELL / 2;

    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        if (grid[r][c] !== '#') { c++; continue; }
        let c2 = c;
        while (c2 < this.cols && grid[r][c2] === '#') c2++;
        const len = c2 - c;
        const x = (c + len / 2 - this.cols / 2) * CELL;
        const z = this.cellToWorldZ(r);
        const mesh = boxMesh(this.mats.wall, len * CELL, WALL_H, CELL, x, WALL_H / 2, z);
        this._track(mesh);
        this.physics.addSolid(x, WALL_H / 2, z, len * CELL, WALL_H, CELL, 'wall');
        this.rects.push({ x0: x - len * half, x1: x + len * half, z0: z - half, z1: z + half });
        c = c2;
      }
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = grid[r][c];
        const isElev = ELEV_H[ch] !== undefined;
        if (ch !== 'X' && ch !== 'H' && ch !== 'x' && !isElev) continue;
        const h = isElev ? ELEV_H[ch] : ch === 'X' ? CRATE_H : ch === 'H' ? STACK_H : LOW_H;
        const mat = isElev ? this.mats.concrete :
          ch === 'x' ? this.mats.concrete : (c + r) % 3 === 0 ? this.mats.metal : this.mats.crate;
        const x = this.cellToWorldX(c), z = this.cellToWorldZ(r);
        const sz = (!isElev && ch !== 'x') ? CELL * 0.92 : CELL;
        const mesh = boxMesh(mat, sz, h, sz, x, h / 2, z);
        this._track(mesh);
        this.physics.addSolid(x, h / 2, z, sz, h, sz, isElev ? 'elev' : ch === 'x' ? 'lowwall' : 'crate');
        this.rects.push({ x0: x - sz / 2, x1: x + sz / 2, z0: z - sz / 2, z1: z + sz / 2 });
      }
    }

    this.spawnT = this.def.spawnT.map(([c, r]) => new THREE.Vector3(this.cellToWorldX(c), 0.95, this.cellToWorldZ(r)));
    this.spawnCT = this.def.spawnCT.map(([c, r]) => new THREE.Vector3(this.cellToWorldX(c), 0.95, this.cellToWorldZ(r)));
    this.patrol = this.def.patrol.map(([c, r]) => new THREE.Vector3(this.cellToWorldX(c), 0, this.cellToWorldZ(r)));

    const SA = this.def.siteA, SB = this.def.siteB;
    const aC = (SA.col0 + SA.col1 + 1) / 2, aR = (SA.row0 + SA.row1 + 1) / 2;
    const bC = (SB.col0 + SB.col1 + 1) / 2, bR = (SB.row0 + SB.row1 + 1) / 2;
    this.siteA = {
      minX: (SA.col0 - this.cols / 2) * CELL, maxX: (SA.col1 + 1 - this.cols / 2) * CELL,
      minZ: (SA.row0 - this.rows / 2) * CELL, maxZ: (SA.row1 + 1 - this.rows / 2) * CELL,
      center: new THREE.Vector3(this.cellToWorldX(aC - 0.5), 0, this.cellToWorldZ(aR - 0.5))
    };
    this.siteB = {
      minX: (SB.col0 - this.cols / 2) * CELL, maxX: (SB.col1 + 1 - this.cols / 2) * CELL,
      minZ: (SB.row0 - this.rows / 2) * CELL, maxZ: (SB.row1 + 1 - this.rows / 2) * CELL,
      center: new THREE.Vector3(this.cellToWorldX(bC - 0.5), 0, this.cellToWorldZ(bR - 0.5))
    };
  }

  _buildSiteDecals() {
    const mk = (site, letter) => {
      const tex = siteDecalTex(letter);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(site.center.x, 0.02, site.center.z);
      this._track(m);
    };
    mk(this.siteA, 'A');
    mk(this.siteB, 'B');
  }

  _buildIndoor() {
    for (const z of this.def.indoor || []) {
      const w = (z.c1 - z.c0 + 1) * CELL, d = (z.r1 - z.r0 + 1) * CELL;
      const x = (z.c0 + (z.c1 - z.c0 + 1) / 2 - this.cols / 2) * CELL;
      const zz = (z.r0 + (z.r1 - z.r0 + 1) / 2 - this.rows / 2) * CELL;
      const ceil = boxMesh(this.mats.wall, w, CEIL_TH, d, x, CEIL_H + CEIL_TH / 2, zz);
      this._track(ceil);
      this.physics.addSolid(x, CEIL_H + CEIL_TH / 2, zz, w, CEIL_TH, d, 'ceiling');
      this.rects.push({ x0: x - w / 2, x1: x + w / 2, z0: zz - d / 2, z1: zz + d / 2 });
    }
  }

  _buildNav() {
    this.walk = [];
    for (let r = 0; r < this.rows; r++) {
      const rowArr = [];
      for (let c = 0; c < this.cols; c++) rowArr.push(WALKABLE.includes(this.def.layout[r][c]));
      this.walk.push(rowArr);
    }
  }

  walkable(c, r) {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows && this.walk[r][c];
  }

  findPath(fromWorld, toWorld) {
    const s = this.worldToCell(fromWorld.x, fromWorld.z);
    const g = this.worldToCell(toWorld.x, toWorld.z);
    if (!this.walkable(s.col, s.row) || !this.walkable(g.col, g.row)) return null;
    const key = (c, r) => r * this.cols + c;
    const startK = key(s.col, s.row), goalK = key(g.col, g.row);
    if (startK === goalK) return [toWorld.clone()];

    const open = [{ c: s.col, r: s.row, g: 0, f: 0, parent: null }];
    const best = new Map([[startK, 0]]);
    const closed = new Set();
    let found = null;
    let guard = 0;

    while (open.length && guard++ < 12000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      const ck = key(cur.c, cur.r);
      if (ck === goalK) { found = cur; break; }
      closed.add(ck);
      for (const [dc, dr, cost] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42]]) {
        const nc = cur.c + dc, nr = cur.r + dr;
        if (!this.walkable(nc, nr)) continue;
        if (dc !== 0 && dr !== 0 && (!this.walkable(cur.c + dc, cur.r) || !this.walkable(cur.c, cur.r + dr))) continue;
        const nk = key(nc, nr);
        if (closed.has(nk)) continue;
        const ng = cur.g + cost;
        if (best.has(nk) && best.get(nk) <= ng) continue;
        best.set(nk, ng);
        const h = Math.hypot(nc - g.col, nr - g.row);
        open.push({ c: nc, r: nr, g: ng, f: ng + h * 1.1, parent: cur });
      }
    }
    if (!found) return null;

    const cells = [];
    for (let n = found; n; n = n.parent) cells.unshift([n.c, n.r]);
    const pts = cells.map(([c, r]) => new THREE.Vector3(this.cellToWorldX(c), 0, this.cellToWorldZ(r)));
    pts[pts.length - 1].set(toWorld.x, 0, toWorld.z);
    return this._smooth(pts, fromWorld);
  }

  _smooth(pts, fromWorld) {
    const out = [];
    let cur = new THREE.Vector3(fromWorld.x, 0, fromWorld.z);
    let i = 0;
    while (i < pts.length) {
      let far = i;
      for (let j = pts.length - 1; j > i; j--) {
        const a = new THREE.Vector3(cur.x, 0.9, cur.z);
        const b = new THREE.Vector3(pts[j].x, 0.9, pts[j].z);
        if (this.physics.losClear(a, b)) { far = j; break; }
      }
      out.push(pts[far].clone());
      cur = pts[far];
      i = far + 1;
    }
    return out;
  }

  randomPoint() {
    for (let tries = 0; tries < 50; tries++) {
      const c = Math.floor(Math.random() * this.cols);
      const r = Math.floor(Math.random() * this.rows);
      if (this.walkable(c, r)) return new THREE.Vector3(this.cellToWorldX(c), 0, this.cellToWorldZ(r));
    }
    return new THREE.Vector3(0, 0, 0);
  }

  randomPointNear(center, r) {
    for (let tries = 0; tries < 40; tries++) {
      const x = center.x + (Math.random() - 0.5) * 2 * r;
      const z = center.z + (Math.random() - 0.5) * 2 * r;
      const c = this.worldToCell(x, z);
      if (this.walkable(c.col, c.row)) return new THREE.Vector3(x, 0, z);
    }
    return center.clone();
  }

  inSite(pos) {
    const inA = pos.x >= this.siteA.minX && pos.x <= this.siteA.maxX && pos.z >= this.siteA.minZ && pos.z <= this.siteA.maxZ;
    const inB = pos.x >= this.siteB.minX && pos.x <= this.siteB.maxX && pos.z >= this.siteB.minZ && pos.z <= this.siteB.maxZ;
    return inA ? 'A' : inB ? 'B' : null;
  }
}
