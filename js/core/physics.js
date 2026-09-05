import * as THREE from 'three';

export class AABB {
  constructor(minX, minY, minZ, maxX, maxY, maxZ) {
    this.minX = minX; this.minY = minY; this.minZ = minZ;
    this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
  }
}

export function aabbTest(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX &&
         a.minY <= b.maxY && a.maxY >= b.minY &&
         a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

export function rayAABB(ox, oy, oz, dx, dy, dz, box, maxDist) {
  let tmin = 0, tmax = maxDist;
  let nAxis = -1, nSign = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  const mins = [box.minX, box.minY, box.minZ], maxs = [box.maxX, box.maxY, box.maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return null;
      continue;
    }
    let t1 = (mins[i] - o[i]) / d[i];
    let t2 = (maxs[i] - o[i]) / d[i];
    let sign = -1;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; sign = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = i; nSign = sign; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  const n = [0, 0, 0];
  if (nAxis >= 0) n[nAxis] = nSign;
  return { t: tmin, nx: n[0], ny: n[1], nz: n[2] };
}

export class Body {
  constructor(x, y, z, hx, hy, hz, opts = {}) {
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.half = { x: hx, y: hy, z: hz };
    this.onGround = false;
    this.hitWallXZ = false;
    this.gravityScale = opts.gravityScale ?? 1;
    this.stepHeight = opts.stepHeight ?? 0.55;
    this.bounce = opts.bounce ?? 0;
    this.noclip = false;
    this.maxFall = 60;
    this.headFn = opts.headFn || null;
    this.tag = opts.tag || 'character';
  }
  boxAt(px, py, pz) {
    return new AABB(px - this.half.x, py - this.half.y, pz - this.half.z,
                    px + this.half.x, py + this.half.y, pz + this.half.z);
  }
  get box() { return this.boxAt(this.pos.x, this.pos.y, this.pos.z); }
  get feetY() { return this.pos.y - this.half.y; }
  getHeadBox() { return this.headFn ? this.headFn() : null; }
}

export class PhysicsWorld {
  constructor() {
    this.solids = [];
    this.bodies = [];
    this.projectiles = [];
    this.gravity = 20;
    this.rayCount = 0;
  }

  addSolid(cx, cy, cz, sx, sy, sz, tag = 'wall') {
    const box = new AABB(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
    const s = { box, tag };
    this.solids.push(s);
    return s;
  }

  addBody(b) { this.bodies.push(b); }
  removeBody(b) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  spawnProjectile(p) {
    this.projectiles.push(p);
    return p;
  }

  step(dt) {
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (!b.noclip) this._character(b, dt);
    }
    this._projectiles(dt);
  }

  _overlapSolids(box) {
    for (const s of this.solids) if (aabbTest(box, s.box)) return true;
    return false;
  }

  _sweepAxis(b, d, axis) {
    if (d === 0) return false;
    const p = b.pos;
    const h = b.half;
    const AX = axis === 'x' ? 'X' : axis === 'y' ? 'Y' : 'Z';
    let target = p[axis] + d;
    const cx = axis === 'x' ? p.x + d : p.x;
    const cy = axis === 'y' ? p.y + d : p.y;
    const cz = axis === 'z' ? p.z + d : p.z;
    const probe = new AABB(cx - h.x, cy - h.y, cz - h.z, cx + h.x, cy + h.y, cz + h.z);
    let blocked = false;
    for (const s of this.solids) {
      const box = s.box;
      if (!aabbTest(probe, box)) continue;
      blocked = true;
      if (d > 0) target = Math.min(target, box['min' + AX] - h[axis] - 0.001);
      else target = Math.max(target, box['max' + AX] + h[axis] + 0.001);
    }
    p[axis] = target;
    return blocked;
  }

  _groundProbe(b) {
    const probe = b.boxAt(b.pos.x, b.pos.y - 0.06, b.pos.z);
    return this._overlapSolids(probe);
  }

  _tryStep(b, dx, dz) {
    const ox = b.pos.x, oy = b.pos.y, oz = b.pos.z;
    b.pos.y += b.stepHeight;
    if (this._overlapSolids(b.box)) { b.pos.y = oy; return; }
    this._sweepAxis(b, dx, 'x');
    this._sweepAxis(b, dz, 'z');
    this._sweepAxis(b, -(b.stepHeight + 0.02), 'y');
    const moved = Math.abs(b.pos.x - ox) + Math.abs(b.pos.z - oz);
    if (moved < 0.01 || b.pos.y < oy - 0.001) b.pos.set(ox, oy, oz);
  }

  _character(b, dt) {
    if (b.vel.y > -b.maxFall) b.vel.y -= this.gravity * b.gravityScale * dt;
    if (b.vel.y < -b.maxFall) b.vel.y = -b.maxFall;
    const dx = b.vel.x * dt, dz = b.vel.z * dt, dy = b.vel.y * dt;
    b.hitWallXZ = false;
    const wasGround = b.onGround;

    const bx = this._sweepAxis(b, dx, 'x');
    const bz = this._sweepAxis(b, dz, 'z');
    if (bx) { b.vel.x = 0; b.hitWallXZ = true; }
    if (bz) { b.vel.z = 0; b.hitWallXZ = true; }
    if ((bx || bz) && wasGround && b.stepHeight > 0) this._tryStep(b, dx, dz);

    const by = this._sweepAxis(b, dy, 'y');
    if (by && dy < 0) b.vel.y = 0;
    if (by && dy > 0) b.vel.y = 0;
    b.onGround = b.vel.y <= 0.01 && this._groundProbe(b);
  }

  _projectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.fuse -= dt;
      if (p.fuse <= 0) {
        this.projectiles.splice(i, 1);
        if (p.onExplode) p.onExplode(p);
        continue;
      }
      const speed = p.vel.length();
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.25));
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        p.vel.y -= this.gravity * sdt;
        const fake = {
          pos: p.pos, half: { x: p.radius, y: p.radius, z: p.radius },
          vel: p.vel, onGround: false, hitWallXZ: false, stepHeight: 0, maxFall: 60
        };
        const hx = this._sweepAxis(fake, p.vel.x * sdt, 'x');
        if (hx) { p.vel.x = -p.vel.x * p.bounce; if (Math.abs(p.vel.x) < 0.7) p.vel.x = 0; p.vel.z *= 0.75; p.onBounce && p.onBounce(p); }
        const hz = this._sweepAxis(fake, p.vel.z * sdt, 'z');
        if (hz) { p.vel.z = -p.vel.z * p.bounce; if (Math.abs(p.vel.z) < 0.7) p.vel.z = 0; p.vel.x *= 0.75; p.onBounce && p.onBounce(p); }
        const hy = this._sweepAxis(fake, p.vel.y * sdt, 'y');
        if (hy) {
          if (p.vel.y < 0) p.onGround = true;
          p.vel.y = -p.vel.y * p.bounce;
          if (Math.abs(p.vel.y) < 1.2) p.vel.y = 0;
          p.vel.x *= 0.82; p.vel.z *= 0.82;
          p.onBounce && p.onBounce(p);
        }
      }
      if (p.mesh) {
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.x += p.vel.length() * dt * 2;
        p.mesh.rotation.z += p.vel.length() * dt * 1.4;
      }
    }
  }

  raycast(origin, dir, maxDist, opts = {}) {
    this.rayCount++;
    const ox = origin.x, oy = origin.y, oz = origin.z;
    const dx = dir.x, dy = dir.y, dz = dir.z;
    let best = null;
    for (const s of this.solids) {
      const h = rayAABB(ox, oy, oz, dx, dy, dz, s.box, best ? best.dist : maxDist);
      if (h && (!best || h.t < best.dist)) {
        best = {
          type: 'world', dist: h.t, solid: s, body: null, headshot: false,
          point: new THREE.Vector3(ox + dx * h.t, oy + dy * h.t, oz + dz * h.t),
          normal: new THREE.Vector3(h.nx, h.ny, h.nz)
        };
      }
    }
    if (opts.bodies !== false) {
      for (const b of this.bodies) {
        if (b === opts.skipBody) continue;
        if (b.blockBullets === false) continue;
        const head = b.getHeadBox ? b.getHeadBox() : null;
        const maxSoFar = best ? best.dist : maxDist;
        const hHead = head ? rayAABB(ox, oy, oz, dx, dy, dz, head, maxSoFar) : null;
        if (hHead) {
          best = {
            type: 'body', dist: hHead.t, body: b, headshot: true, solid: null,
            point: new THREE.Vector3(ox + dx * hHead.t, oy + dy * hHead.t, oz + dz * hHead.t),
            normal: new THREE.Vector3(hHead.nx, hHead.ny, hHead.nz)
          };
          continue;
        }
        const hBody = rayAABB(ox, oy, oz, dx, dy, dz, b.box, maxSoFar);
        if (hBody) {
          best = {
            type: 'body', dist: hBody.t, body: b, headshot: false, solid: null,
            point: new THREE.Vector3(ox + dx * hBody.t, oy + dy * hBody.t, oz + dz * hBody.t),
            normal: new THREE.Vector3(hBody.nx, hBody.ny, hBody.nz)
          };
        }
      }
    }
    return best;
  }

  losClear(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const dist = dir.length();
    if (dist < 0.01) return true;
    dir.divideScalar(dist);
    const hit = this.raycast(a, dir, dist - 0.05, { bodies: false });
    return !hit;
  }

  bodiesInRadius(pos, r) {
    const out = [];
    for (const b of this.bodies) {
      if (b.blockBullets === false) continue;
      const d = b.pos.distanceTo(pos);
      if (d <= r + Math.max(b.half.x, b.half.y, b.half.z)) out.push({ body: b, dist: d });
    }
    return out;
  }
}
