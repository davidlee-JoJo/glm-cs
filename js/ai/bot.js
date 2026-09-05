import * as THREE from 'three';
import { Body } from '../core/physics.js';
import { WeaponInst, fireWeapon, startReload, updateWeapon } from '../player/weapons.js';

const TEAM_COLORS = {
  T: { cloth: 0xb08d57, vest: 0x7a5c30, head: 0xd9b38c },
  CT: { cloth: 0x3d5a80, vest: 0x2a3f5c, head: 0xd9b38c }
};

function buildBotModel(team) {
  const c = TEAM_COLORS[team];
  const cloth = new THREE.MeshLambertMaterial({ color: c.cloth });
  const vest = new THREE.MeshLambertMaterial({ color: c.vest });
  const skin = new THREE.MeshLambertMaterial({ color: c.head });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22252a });
  const g = new THREE.Group();

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), vest);
  torso.position.y = 1.12;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.27, 0.27), skin);
  head.position.y = 1.6;
  g.add(head);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.12, 0.29), dark);
  helmet.position.y = 1.7;
  g.add(helmet);

  const legL = new THREE.Group();
  const legLm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.78, 0.17), cloth);
  legLm.position.y = -0.39;
  legL.add(legLm);
  legL.position.set(-0.13, 0.81, 0);
  g.add(legL);
  const legR = new THREE.Group();
  const legRm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.78, 0.17), cloth);
  legRm.position.y = -0.39;
  legR.add(legRm);
  legR.position.set(0.13, 0.81, 0);
  g.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, 0.13), cloth);
  armL.position.set(-0.34, 1.16, -0.05);
  armL.rotation.x = -1.1;
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, 0.13), cloth);
  armR.position.set(0.34, 1.16, -0.05);
  armR.rotation.x = -1.1;
  g.add(armR);

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.6), dark);
  gun.position.set(0.12, 1.24, -0.42);
  g.add(gun);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return { group: g, legL, legR };
}

export class Bot {
  constructor(game, team, name, diff) {
    this.game = game;
    this.team = team;
    this.name = name;
    this.isBot = true;
    this.diff = diff;
    this.body = new Body(0, 2, 0, 0.35, 0.9, 0.35, {
      headFn: () => this.getHeadBox(), tag: 'bot'
    });
    this.body.owner = this;
    this.body.blockBullets = true;
    this.health = 100;
    this.armor = 0;
    this.helmet = false;
    this.money = 800;
    this.kills = 0;
    this.deaths = 0;
    this.alive = true;
    this.loadout = { primary: null, secondary: new WeaponInst('usp'), knife: new WeaponInst('knife'), grenades: { he: null, smoke: null, flash: null, molotov: null } };
    this.cur = this.loadout.secondary;
    this.yaw = 0;
    this.targetYaw = 0;
    this.crouching = false;
    this.blindT = 0;
    this.nadeCd = 5;
    this.lastShotT = -99;

    this.state = 'patrol';
    this.stateT = 0;
    this.path = null;
    this.pathI = 0;
    this.goal = null;
    this.repathT = 0;
    this.idleT = 0;
    this.scanT = 0;

    this.target = null;
    this.seeT = 0;
    this.reactionT = 0;
    this.lastSeenPos = null;
    this.lastSeenT = -99;
    this.alertPos = null;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.strafeDir = 1;
    this.strafeT = 0;
    this.plantSite = null;
    this.plantT = 0;
    this.defuseT = 0;
    this.beepT = 0;

    this.legPhase = 0;
    this.deathT = -1;
    this.stuckPos = new THREE.Vector3();
    this.stuckT = 0;

    const m = buildBotModel(team);
    this.model = m.group;
    this.legL = m.legL;
    this.legR = m.legR;
    game.engine.scene.add(this.model);
    this.resetForRound(team === 'T' ? game.map.spawnT[0] : game.map.spawnCT[0], false);
  }

  resetForRound(spawn, keepGuns) {
    const s = spawn || (this.team === 'T' ? this.game.map.spawnT[0] : this.game.map.spawnCT[0]);
    this.body.pos.set(s.x + (Math.random() - 0.5), s.y, s.z + (Math.random() - 0.5));
    this.body.vel.set(0, 0, 0);
    this.health = 100;
    this.alive = true;
    this.deathT = -1;
    this.state = 'patrol';
    this.stateT = 0;
    this.path = null;
    this.goal = null;
    this.target = null;
    this.alertPos = null;
    this.lastSeenPos = null;
    this.burstLeft = 0;
    this.plantT = 0;
    this.defuseT = 0;
    this.crouching = false;
    this.body.half.y = 0.9;
    this.model.visible = true;
    this.model.rotation.set(0, 0, 0);
    this.body.blockBullets = true;
    if (!keepGuns || !this.loadout.primary) {
      this.loadout = { primary: null, secondary: new WeaponInst('usp'), knife: new WeaponInst('knife'), grenades: { he: null, smoke: null, flash: null, molotov: null } };
      this.armor = 0;
      this.helmet = false;
      this.plantSite = Math.random() < 0.5 ? 'A' : 'B';
    } else {
      for (const t of ['he', 'smoke', 'flash', 'molotov']) this.loadout.grenades[t] = null;
    }
    this.blindT = 0;
    this.nadeCd = 4 + Math.random() * 6;
    for (const inst of [this.loadout.primary, this.loadout.secondary]) if (inst) inst.refill();
    this.cur = this.loadout.primary || this.loadout.secondary;
    this.yaw = Math.atan2(-(0 - this.body.pos.x), -(0 - this.body.pos.z));
    this.targetYaw = this.yaw;
    if (!this.game.physics.bodies.includes(this.body)) this.game.physics.addBody(this.body);
  }

  eyePos() {
    const b = this.body;
    return new THREE.Vector3(b.pos.x, b.feetY + (this.crouching ? 1.05 : 1.58), b.pos.z);
  }
  getHeadBox() {
    const b = this.body;
    const top = b.pos.y + b.half.y;
    const h = this.crouching ? 0.3 : 0.36;
    return new (this.game.physicsNS.AABB)(b.pos.x - 0.2, top - h, b.pos.z - 0.2, b.pos.x + 0.2, top, b.pos.z + 0.2);
  }

  setGoal(v) {
    if (v && (!this.goal || this.goal.distanceToSquared(v) > 4)) {
      this.goal = v.clone();
      this.path = null;
      this.repathT = 0;
    }
  }

  _pickPatrolGoal() {
    const game = this.game, map = game.map;
    if (game.config.mode === 'bomb' && game.bomb) {
      const bomb = game.bomb;
      if (this.team === 'T') {
        if (bomb.state === 'carried' && bomb.carrier === this) {
          this.setGoal(map[this.plantSite === 'A' ? 'siteA' : 'siteB'].center);
          return;
        }
        if (bomb.state === 'dropped') { this.setGoal(bomb.pos); return; }
        if (bomb.state === 'planted') {
          this.setGoal(map.randomPointNear(bomb.pos, 9));
          return;
        }
      } else {
        if (bomb.state === 'planted') { this.setGoal(bomb.pos.clone()); return; }
        if (bomb.state === 'carried' || bomb.state === 'dropped') {
          const site = Math.random() < 0.5 ? map.siteA : map.siteB;
          if (!this.goal || Math.random() < 0.02) this.setGoal(site.center);
          return;
        }
      }
    }
    const pts = map.patrol;
    this.setGoal(pts[Math.floor(Math.random() * pts.length)]);
  }

  _followPath(dt, speed) {
    const game = this.game, b = this.body;
    if (!this.goal) { this._pickPatrolGoal(); return false; }
    this.repathT -= dt;
    if (!this.path || this.repathT <= 0) {
      this.path = game.map.findPath(b.pos, this.goal);
      this.pathI = 0;
      this.repathT = 1.5;
    }
    if (!this.path || this.pathI >= this.path.length) return true;
    const wp = this.path[this.pathI];
    const dx = wp.x - b.pos.x, dz = wp.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.7) { this.pathI++; return this.pathI >= this.path.length; }
    this.moveWish = { x: dx / d, z: dz / d, speed };
    this.targetYaw = Math.atan2(-dx, -dz);
    return false;
  }

  _perceive(dt) {
    const game = this.game;
    if (this.blindT > 0) {
      if (this.target && game.time - this.lastSeenT > 0.8) {
        this.alertPos = this.lastSeenPos ? this.lastSeenPos.clone() : null;
        this.target = null;
        if (this.state === 'engage') this._enter('seek');
      }
      return;
    }
    let best = null, bestD = 1e9;
    const myEye = this.eyePos();
    const facing = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    for (const p of game.players) {
      if (!p.alive || p.team === this.team) continue;
      const pe = p.eyePos();
      const d = myEye.distanceTo(pe);
      if (d > 45 || d >= bestD) continue;
      const toEnemy = new THREE.Vector3().subVectors(pe, myEye).normalize();
      const facingDot = facing.dot(toEnemy);
      const heardRecently = game.time - p.lastShotT < 1.2 && d < 48;
      const aware = this.state === 'engage' || this.alertPos;
      if (facingDot < 0.35 && d > 5 && !heardRecently && !aware) continue;
      if (!game.physics.losClear(myEye, pe)) continue;
      best = p; bestD = d;
    }
    if (best) {
      if (this.target !== best) {
        this.target = best;
        this.reactionT = this.diff.reaction * (0.7 + Math.random() * 0.6) * (bestD > 30 ? 1.4 : 1);
        this.seeT = 0;
      }
      this.seeT += dt;
      this.reactionT -= dt;
      this.lastSeenPos = best.body.pos.clone();
      this.lastSeenT = game.time;
      this.alertPos = null;
      if (this.state !== 'engage' && this.state !== 'plant' && this.state !== 'defuse') this._enter('engage');
      else if (this.state === 'plant' || this.state === 'defuse') this._enter('engage');
    } else if (this.target) {
      if (game.time - this.lastSeenT > 1.6) {
        this.alertPos = this.lastSeenPos ? this.lastSeenPos.clone() : null;
        this.target = null;
        if (this.state === 'engage') this._enter('seek');
      }
    }
  }

  _enter(s) {
    if (this.state === 'plant' && s !== 'plant') this.plantT = 0;
    if (this.state === 'defuse' && s !== 'defuse') this.defuseT = 0;
    this.state = s;
    this.stateT = 0;
    if (s === 'engage') this.strafeT = 0;
    if (s === 'seek') this.path = null;
  }

  _fsm(dt) {
    const game = this.game;
    this.stateT += dt;
    this.moveWish = null;

    switch (this.state) {
      case 'patrol': {
        if (this.game.config.mode === 'bomb' && this.game.bomb) {
          const bomb = this.game.bomb;
          if (bomb.state === 'carried' && bomb.carrier === this && this.game.map.inSite(this.body.pos)) {
            this._enter('plant');
            break;
          }
          if (bomb.state === 'planted' && this.team === 'CT' && this.body.pos.distanceTo(bomb.pos) < 1.6) {
            this._enter('defuse');
            break;
          }
        }
        if (this.idleT > 0) {
          this.idleT -= dt;
          this.targetYaw += Math.sin(this.stateT * 1.7) * dt * 1.5;
          if (this.cur.mag < this.cur.def.mag && this.cur.reserve > 0 && !this.cur.reloading) startReload(this.cur);
          return;
        }
        const arrived = this._followPath(dt, this.diff.speed);
        if (arrived) { this.idleT = 0.4 + Math.random() * 1.2; this.goal = null; }
        break;
      }
      case 'seek': {
        this._maybeNade(dt);
        if (this.alertPos) {
          this.setGoal(this.alertPos);
          const arrived = this._followPath(dt, this.diff.speed * 1.05);
          if (arrived) { this.scanT += dt; this.targetYaw += dt * 2.4; this.alertPos = null; if (this.scanT > 2) { this.scanT = 0; this._enter('patrol'); } }
        } else this._enter('patrol');
        break;
      }
      case 'engage': {
        const t = this.target;
        if (!t || !t.alive) { this.target = null; this._enter(this.alertPos ? 'seek' : 'patrol'); break; }
        if (this.cur.mag <= 0 && !this.cur.reloading) { startReload(this.cur); }
        if (this.cur.reloading) { this._combatMove(dt, true); break; }
        this._maybeNade(dt);
        this._combatAim(dt);
        this._combatMove(dt, false);
        this._combatFire(dt);
        break;
      }
      case 'plant': {
        const bomb = game.bomb;
        if (!bomb || bomb.state !== 'carried' || bomb.carrier !== this) { this._enter('patrol'); break; }
        this.moveWish = null;
        this.plantT += dt;
        this.beepT -= dt;
        if (this.beepT <= 0) { this.beepT = 0.75; game.audio.plantBeep(); }
        if (this.plantT >= 3.2) { game.plantBomb(this); this.plantT = 0; }
        break;
      }
      case 'defuse': {
        const bomb = game.bomb;
        if (!bomb || bomb.state !== 'planted') { this._enter('patrol'); break; }
        this.moveWish = null;
        this.defuseT += dt;
        this.beepT -= dt;
        if (this.beepT <= 0) { this.beepT = 0.5; game.audio.defuseTick(); }
        if (this.defuseT >= 7) { game.defuseBomb(this); this.defuseT = 0; }
        break;
      }
    }
  }

  _combatAim(dt) {
    const t = this.target;
    const myEye = this.eyePos();
    const aimAt = t.eyePos();
    aimAt.y -= 0.22;
    if (this.diff.aimErr < 0.05 && Math.random() < 0.3) aimAt.y = t.eyePos().y;
    const dx = aimAt.x - myEye.x, dz = aimAt.z - myEye.z;
    this.targetYaw = Math.atan2(-dx, -dz);
  }

  _combatMove(dt, whileReloading) {
    const t = this.target;
    const b = this.body;
    const toT = new THREE.Vector3().subVectors(t.body.pos, b.pos);
    toT.y = 0;
    const dist = toT.length();
    toT.normalize();
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = 0.6 + Math.random() * 0.8;
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    }
    const perp = { x: -toT.z * this.strafeDir, z: toT.x * this.strafeDir };
    let adv = 0;
    const ideal = this.cur.def.key === 'awp' ? 22 : 10;
    if (dist > ideal * 1.4) adv = 1;
    else if (dist < ideal * 0.5) adv = -1;
    const spd = this.diff.speed * (whileReloading ? 1 : 0.85);
    this.moveWish = { x: perp.x + toT.x * adv, z: perp.z + toT.z * adv, speed: spd };
    const l = Math.hypot(this.moveWish.x, this.moveWish.z);
    if (l > 0) { this.moveWish.x /= l; this.moveWish.z /= l; }
  }

  _combatFire(dt) {
    const game = this.game;
    const t = this.target;
    if (this.reactionT > 0) return;
    if (this.cur.def.kind === 'melee') return;
    if (this.burstLeft > 0) {
      if (this.cur.cd <= 0) {
        const myEye = this.eyePos();
        const aimAt = t.eyePos();
        aimAt.y -= 0.2 + Math.random() * 0.25;
        const dir = new THREE.Vector3().subVectors(aimAt, myEye).normalize();
        const dist = myEye.distanceTo(aimAt);
        const err = this.diff.aimErr * (0.5 + dist / 45) * (this.seeT < 0.7 ? 1.7 : 1);
        const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(dir, up).normalize();
        const trueUp = new THREE.Vector3().crossVectors(right, dir);
        const ang = Math.random() * Math.PI * 2;
        dir.addScaledVector(right, Math.cos(ang) * err * Math.random()).addScaledVector(trueUp, Math.sin(ang) * err * Math.random()).normalize();
        fireWeapon(game, this, this.cur, myEye, dir);
        this.burstLeft--;
        if (this.burstLeft <= 0) this.burstPause = 0.25 + Math.random() * 0.45;
      }
    } else {
      this.burstPause -= dt;
      if (this.burstPause <= 0) this.burstLeft = 2 + Math.floor(Math.random() * this.diff.burst);
    }
  }

  _maybeNade(dt) {
    const game = this.game;
    this.nadeCd -= dt;
    if (this.nadeCd > 0 || this.blindT > 0) return;
    const g = this.loadout.grenades;
    if (game.config.mode === 'bomb' && game.bomb && game.bomb.state === 'planted' &&
        this.team === 'T' && g.molotov && g.molotov.mag > 0) {
      const d = this.body.pos.distanceTo(game.bomb.pos);
      if (d > 7 && d < 22 && Math.random() < 0.4) {
        this._throwAt(game.bomb.pos, 'molotov');
        this.nadeCd = 10 + Math.random() * 8;
        return;
      }
    }
    if (this.state === 'seek' && this.alertPos && g.flash && g.flash.mag > 0) {
      const d = this.body.pos.distanceTo(this.alertPos);
      if (d > 6 && d < 24 && Math.random() < 0.45) {
        this._throwAt(this.alertPos, 'flash');
        this.nadeCd = 6 + Math.random() * 6;
        return;
      }
    }
    if (this.state === 'engage' && this.target && this.target.alive && g.he && g.he.mag > 0) {
      const tp = this.target.body.pos;
      const d = this.body.pos.distanceTo(tp);
      if (d > 7 && d < 22 && Math.random() < 0.3 &&
          game.physics.losClear(this.eyePos(), this.target.eyePos())) {
        this._throwAt(tp, 'he');
        this.nadeCd = 8 + Math.random() * 8;
      }
    }
  }

  _throwAt(targetPos, type) {
    const game = this.game;
    const from = this.eyePos();
    const to = targetPos.clone();
    to.y += 0.2;
    const flat = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
    const d = Math.min(24, flat.length());
    if (d < 3) return;
    flat.normalize();
    const t = d / 16;
    const dy = to.y - from.y;
    const vy = (dy + 10 * t * t) / t;
    const dir = new THREE.Vector3(flat.x, Math.max(-0.1, Math.min(0.72, (vy - 3.5) / 16)), flat.z).normalize();
    game.throwGrenade(this, from, dir, type);
    this.loadout.grenades[type].mag = 0;
    this.loadout.grenades[type] = null;
  }

  _applyMovement(dt) {
    const b = this.body;
    const w = this.moveWish;
    if (b.noclip) return;
    if (!w) {
      const t = Math.min(1, 10 * dt);
      b.vel.x += (0 - b.vel.x) * t;
      b.vel.z += (0 - b.vel.z) * t;
    } else {
      const accel = b.onGround ? 10 : 1.5;
      const tt = Math.min(1, accel * dt);
      b.vel.x += (w.x * w.speed - b.vel.x) * tt;
      b.vel.z += (w.z * w.speed - b.vel.z) * tt;
    }
  }

  _stuckCheck(dt) {
    this.stuckT += dt;
    if (this.stuckT >= 1.2) {
      const moved = this.body.pos.distanceTo(this.stuckPos);
      if (moved < 0.35 && this.moveWish) {
        this.path = null;
        this.repathT = 0;
        if (Math.random() < 0.35 && this.state === 'patrol') { this.goal = null; this.idleT = 0; }
      }
      this.stuckPos.copy(this.body.pos);
      this.stuckT = 0;
    }
  }

  update(dt) {
    const game = this.game;
    if (!this.alive) {
      if (this.deathT >= 0 && this.deathT < 0.5) {
        this.deathT += dt;
        const t = Math.min(1, this.deathT / 0.4);
        this.model.rotation.z = (Math.PI / 2) * t * (this.name.length % 2 ? 1 : -1);
        this.model.position.y = this.body.pos.y - 0.9 + 0.1 * t;
      }
      return;
    }
    if (game.state === 'freeze' || game.state === 'roundEnd') {
      this._syncModel(dt);
      return;
    }
    updateWeapon(this.cur, dt);
    if (this.blindT > 0) this.blindT = Math.max(0, this.blindT - dt);
    this._perceive(dt);
    this._fsm(dt);
    this._applyMovement(dt);
    this._stuckCheck(dt);
    this._syncModel(dt);
  }

  _syncModel(dt) {
    const b = this.body;
    this.model.position.set(b.pos.x, b.pos.y - b.half.y, b.pos.z);
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 12);
    this.model.rotation.y = this.yaw;
    const hsp = Math.hypot(b.vel.x, b.vel.z);
    this.legPhase += hsp * dt * 2.6;
    const swing = Math.sin(this.legPhase) * Math.min(1, hsp / 3) * 0.55;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
  }

  alert(pos) {
    if (!this.alive) return;
    if (this.state === 'engage' || this.state === 'plant' || this.state === 'defuse') return;
    this.alertPos = pos.clone();
    this._enter('seek');
  }

  hurt(dmg, attacker) {
    if (attacker && attacker.team !== this.team && attacker !== this) {
      if (!this.target) {
        this.lastSeenPos = attacker.body.pos.clone();
        this.lastSeenT = this.game.time;
        this.alertPos = attacker.body.pos.clone();
        this._enter('seek');
        const dx = attacker.body.pos.x - this.body.pos.x;
        const dz = attacker.body.pos.z - this.body.pos.z;
        this.targetYaw = Math.atan2(-dx, -dz);
      }
      if (this.state === 'plant' || this.state === 'defuse') { this.plantT = 0; this.defuseT = 0; this._enter('engage'); }
    }
  }

  die(attacker) {
    this.alive = false;
    this.deaths++;
    this.deathT = 0;
    this.body.blockBullets = false;
    if (this.game.config.mode === 'dm') this.respawnT = 3;
    this.game.physics.removeBody(this.body);
  }

  remove() {
    this.game.engine.scene.remove(this.model);
    this.game.physics.removeBody(this.body);
  }
}
