import * as THREE from 'three';
import { Body } from '../core/physics.js';
import { fireWeapon, startReload, updateWeapon, currentSpread, WEAPONS, GRENADE_TYPES, ownedNades } from './weapons.js';

const STAND_HALF_Y = 0.9;
const CROUCH_HALF_Y = 0.6;
const EYE_STAND = 1.62;
const EYE_CROUCH = 1.05;
const RUN_SPEED = 4.8;
const JUMP_V = 6.6;

const gunMetal = () => new THREE.MeshLambertMaterial({ color: 0x2e3238 });
const darkMetal = () => new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
const woodMat = () => new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
const silverMat = () => new THREE.MeshLambertMaterial({ color: 0xb8bcc2 });
const greenMat = () => new THREE.MeshLambertMaterial({ color: 0x3a4a2e });

function part(mat, sx, sy, sz, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  return m;
}

function buildVM(key) {
  const g = new THREE.Group();
  if (key === 'usp' || key === 'deagle') {
    const big = key === 'deagle';
    g.add(part(gunMetal(), 0.05, 0.09, big ? 0.34 : 0.28, 0, 0.02, -0.1));
    g.add(part(darkMetal(), 0.045, 0.16, 0.09, 0, -0.1, 0.02, 0.25));
    g.add(part(silverMat(), 0.02, 0.02, 0.06, 0, 0.075, -0.22));
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.3);
    g.userData.base = new THREE.Vector3(0.3, -0.32, -0.5);
  } else if (key === 'ak47' || key === 'm4a4') {
    const isAK = key === 'ak47';
    g.add(part(gunMetal(), 0.055, 0.1, 0.55, 0, 0, -0.12));
    g.add(part(darkMetal(), 0.04, 0.05, 0.3, 0, 0.02, -0.48));
    g.add(part(isAK ? woodMat() : darkMetal(), 0.05, 0.17, 0.09, 0, -0.12, 0.02, 0.35));
    g.add(part(isAK ? woodMat() : gunMetal(), 0.05, 0.11, 0.22, 0, -0.02, 0.24));
    if (isAK) g.add(part(woodMat(), 0.045, 0.08, 0.2, 0, -0.03, -0.32));
    else g.add(part(darkMetal(), 0.03, 0.06, 0.18, 0, 0.07, -0.2));
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.66);
    g.userData.base = new THREE.Vector3(0.3, -0.3, -0.55);
  } else if (key === 'awp') {
    g.add(part(greenMat(), 0.06, 0.11, 0.8, 0, 0, -0.2));
    g.add(part(darkMetal(), 0.03, 0.04, 0.35, 0, 0.03, -0.65));
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 12), darkMetal());
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.1, -0.15);
    g.add(scope);
    g.add(part(greenMat(), 0.05, 0.16, 0.1, 0, -0.13, 0.05, 0.3));
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.85);
    g.userData.base = new THREE.Vector3(0.32, -0.3, -0.5);
  } else if (key === 'knife') {
    g.add(part(silverMat(), 0.018, 0.05, 0.3, 0, 0.02, -0.2));
    g.add(part(darkMetal(), 0.035, 0.05, 0.12, 0, 0, 0));
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.3);
    g.userData.base = new THREE.Vector3(0.32, -0.32, -0.45);
  } else {
    const color = WEAPONS[key] && WEAPONS[key].vmColor ? WEAPONS[key].vmColor : 0x3a4a2e;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10),
      new THREE.MeshLambertMaterial({ color }));
    g.add(ball);
    g.add(part(darkMetal(), 0.03, 0.05, 0.03, 0, 0.085, 0));
    g.userData.muzzle = new THREE.Vector3(0, 0.05, -0.1);
    g.userData.base = new THREE.Vector3(0.3, -0.32, -0.45);
  }
  return g;
}

export class Player {
  constructor(game) {
    this.game = game;
    this.isBot = false;
    this.team = 'CT';
    this.name = '你';
    this.body = new Body(0, 2, 0, 0.35, STAND_HALF_Y, 0.35, {
      headFn: () => this.getHeadBox(), tag: 'player'
    });
    this.body.owner = this;
    this.body.blockBullets = true;
    this.health = 100;
    this.armor = 0;
    this.money = 800;
    this.kills = 0;
    this.deaths = 0;
    this.alive = true;
    this.yaw = 0;
    this.pitch = 0;
    this.punchPitch = 0;
    this.punchYaw = 0;
    this.crouching = false;
    this.scoped = false;
    this.walkCycle = 0;
    this.stepT = 0;
    this.burstIdx = 0;
    this.kickZ = 0;
    this.kickRot = 0;
    this.switchT = 1;
    this.swingT = 1;
    this.loadout = null;
    this.cur = null;
    this.curSlot = 2;
    this.nadeType = 'he';
    this.blindT = 0;
    this.lastShotT = -99;
    this.vms = {};
    this.vmGroup = new THREE.Group();
    this.muzzleLight = new THREE.PointLight(0xffd88a, 0, 3);
    this.muzzleLight.position.set(0.35, -0.2, -1.0);
    game.engine.vmScene.add(this.muzzleLight);
    this._buildVMs();
    this.resetForRound(game.map.spawnCT[0], false);
  }

  _buildVMs() {
    for (const key of ['usp', 'deagle', 'ak47', 'm4a4', 'awp', 'knife', 'hegrenade', 'smoke', 'flash', 'molotov']) {
      const vm = buildVM(key);
      vm.visible = false;
      this.vms[key] = vm;
      this.game.engine.vmScene.add(vm);
    }
  }

  remove() {
    for (const k in this.vms) this.game.engine.vmScene.remove(this.vms[k]);
    this.game.engine.vmScene.remove(this.muzzleLight);
  }

  resetForRound(spawn, keepGuns) {
    this.body.pos.set(spawn.x, spawn.y, spawn.z);
    this.body.vel.set(0, 0, 0);
    this.body.half.y = STAND_HALF_Y;
    this.body.noclip = false;
    this.health = 100;
    this.alive = true;
    this.crouching = false;
    this.scoped = false;
    this.punchPitch = this.punchYaw = 0;
    this.yaw = Math.atan2(-(0 - spawn.x), -(0 - spawn.z));
    this.pitch = 0;
    if (!keepGuns || !this.loadout) {
      this.loadout = {
        primary: null,
        secondary: new (this.game.weaponNS.WeaponInst)('usp'),
        knife: new (this.game.weaponNS.WeaponInst)('knife'),
        grenades: { he: null, smoke: null, flash: null, molotov: null }
      };
      this.armor = 0;
      this.nadeType = 'he';
    } else {
      for (const inst of [this.loadout.primary, this.loadout.secondary, this.loadout.knife]) {
        if (inst) { inst.refill(); }
      }
      const owned = ownedNades(this.loadout);
      for (const t of GRENADE_TYPES) {
        if (this.loadout.grenades[t] && !owned.includes(t)) this.loadout.grenades[t] = null;
      }
      if (this.loadout.grenades[this.nadeType] == null && owned.length) this.nadeType = owned[0];
    }
    if (!this.loadout.primary) this.curSlot = 2;
    else if (this.curSlot === 4) this.curSlot = 1;
    if (!ownedNades(this.loadout).length && this.curSlot === 4) this.curSlot = 2;
    this._equip(this.curSlot);
  }

  _equip(slot) {
    const l = this.loadout;
    if (slot === 1 && !l.primary) return;
    if (slot === 4) {
      const owned = ownedNades(l);
      if (!owned.length) return;
      if (!l.grenades[this.nadeType]) this.nadeType = owned[0];
    }
    this.curSlot = slot;
    this.cur = slot === 1 ? l.primary : slot === 2 ? l.secondary : slot === 3 ? l.knife : l.grenades[this.nadeType];
    this.switchT = 0;
    this.scoped = false;
    this.burstIdx = 0;
  }

  eyeHeight() { return this.crouching ? EYE_CROUCH : EYE_STAND; }
  eyePos() {
    const b = this.body;
    return new THREE.Vector3(b.pos.x, b.feetY + this.eyeHeight(), b.pos.z);
  }
  getHeadBox() {
    const b = this.body;
    const top = b.pos.y + b.half.y;
    return new (this.game.physicsNS.AABB)(b.pos.x - 0.22, top - 0.36, b.pos.z - 0.22, b.pos.x + 0.22, top, b.pos.z + 0.22);
  }

  currentSpreadVal() { return currentSpread(this, this.cur.def); }

  update(dt) {
    const game = this.game;
    const input = game.input;

    const md = input.consumeMouse();
    if (this.alive) {
      const sensFactor = game.engine.camera.fov / 90;
      this.yaw -= md.dx * 0.0022 * sensFactor;
      this.pitch -= md.dy * 0.0022 * sensFactor;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    }

    const k = Math.exp(-7 * dt);
    this.punchPitch *= k;
    this.punchYaw *= k;
    if (this.blindT > 0) this.blindT = Math.max(0, this.blindT - dt);
    this.kickZ *= Math.exp(-11 * dt);
    this.kickRot *= Math.exp(-11 * dt);
    if (this.switchT < 1) this.switchT = Math.min(1, this.switchT + dt * 4);
    if (this.swingT < 1) this.swingT = Math.min(1, this.swingT + dt * 5);

    const cam = game.engine.camera;
    const frozen = game.state === 'freeze';
    const inputAllowed = this.alive && !frozen && !game.menu.blocking();
    const canMove = inputAllowed;

    if (this.alive) {
      const b = this.body;
      let wishX = 0, wishZ = 0;
      if (canMove) {
        if (input.down('KeyW')) wishZ -= 1;
        if (input.down('KeyS')) wishZ += 1;
        if (input.down('KeyA')) wishX -= 1;
        if (input.down('KeyD')) wishX += 1;
      }
      const len = Math.hypot(wishX, wishZ);
      if (len > 0) { wishX /= len; wishZ /= len; }

      const wantCrouch = inputAllowed && input.down('ControlLeft');
      if (wantCrouch !== this.crouching) {
        if (wantCrouch) this._setCrouch(true);
        else if (this._canStand()) this._setCrouch(false);
      }

      const def = this.cur.def;
      const walk = input.down('ShiftLeft');
      let speed = RUN_SPEED * def.speedMul;
      if (walk) speed *= 0.52;
      if (this.crouching) speed *= 0.38;
      if (this.scoped) speed *= 0.45;

      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const dirX = wishX * cy + wishZ * sy;
      const dirZ = -wishX * sy + wishZ * cy;

      if (game.debug.noclip) {
        const fwd = new THREE.Vector3();
        cam.getWorldDirection(fwd);
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        const move = new THREE.Vector3()
          .addScaledVector(fwd, -wishZ)
          .addScaledVector(right, wishX);
        if (move.lengthSq() > 0) move.normalize();
        const fly = 14;
        b.vel.set(move.x * fly, move.y * fly, move.z * fly);
        if (input.down('Space')) b.vel.y = fly;
        else if (input.down('ControlLeft')) b.vel.y = -fly;
        b.pos.addScaledVector(b.vel, dt);
      } else {
        const accel = b.onGround ? 12 : 1.6;
        const t = Math.min(1, accel * dt);
        b.vel.x += (dirX * speed - b.vel.x) * t;
        b.vel.z += (dirZ * speed - b.vel.z) * t;
        if (input.down('Space') && b.onGround && canMove) {
          b.vel.y = JUMP_V;
          b.onGround = false;
        }
      }

      const hsp = Math.hypot(b.vel.x, b.vel.z);
      if (b.onGround && hsp > 1.8) {
        this.walkCycle += hsp * dt * 2.4;
        this.stepT -= dt * hsp;
        if (this.stepT <= 0) {
          this.stepT = 2.4;
          game.audio.step(0);
        }
      } else this.stepT = 0.15;

      this._handleWeapons(dt, frozen);
    }

    const eye = this.alive ? this.eyePos() : this.deathEye;
    const bobAmt = this.alive ? Math.min(1, Math.hypot(this.body.vel.x, this.body.vel.z) / 4.8) : 0;
    const bobY = Math.sin(this.walkCycle * 2) * 0.028 * bobAmt;
    const bobX = Math.cos(this.walkCycle) * 0.02 * bobAmt;
    const shake = game.fx.shakeOffset();
    cam.position.set(
      (eye ? eye.x : 0) + bobX + shake.x,
      (eye ? eye.y : 1.6) + bobY + shake.y,
      (eye ? eye.z : 0) + shake.z
    );
    cam.rotation.set(this.pitch + this.punchPitch, this.yaw + this.punchYaw, 0);

    const targetFov = this.scoped ? 22 : 90;
    const f = cam.fov + (targetFov - cam.fov) * Math.min(1, dt * 14);
    game.engine.setFov(f);

    this._updateVM(dt, bobAmt);
  }

  _setCrouch(v) {
    const b = this.body;
    const feet = b.feetY;
    this.crouching = v;
    b.half.y = v ? CROUCH_HALF_Y : STAND_HALF_Y;
    b.pos.y = feet + b.half.y;
  }

  _canStand() {
    const b = this.body;
    const test = b.boxAt(b.pos.x, b.feetY + STAND_HALF_Y, b.pos.z);
    return !b.noclip && !this.game.physics._overlapSolids(test);
  }

  _handleWeapons(dt, frozen) {
    const game = this.game, input = game.input;
    updateWeapon(this.cur, dt);
    const l = this.loadout;

    if (!game.menu.blocking() && !frozen) {
      if (input.down('Digit1') && l.primary && this.curSlot !== 1) this._equip(1);
      if (input.down('Digit2') && this.curSlot !== 2) this._equip(2);
      if (input.down('Digit3') && this.curSlot !== 3) this._equip(3);
      if (input.down('Digit4')) {
        if (this.curSlot !== 4) this._equip(4);
        else {
          const owned = ownedNades(l);
          if (owned.length > 1) {
            const idx = owned.indexOf(this.nadeType);
            this.nadeType = owned[(idx + 1) % owned.length];
            this._equip(4);
            game.hud.hint(`切換 ${WEAPONS[this.nadeType].name}`);
            game.hintT = 1.2;
          }
        }
      }
      const wheel = input.consumeWheel();
      if (wheel !== 0) {
        const hasNade = ownedNades(l).length > 0;
        const order = [1, 2, 3, 4].filter((s) => (s === 1 && l.primary) || (s === 2) || (s === 3) || (s === 4 && hasNade));
        let idx = order.indexOf(this.curSlot);
        idx = (idx + (wheel > 0 ? 1 : -1) + order.length) % order.length;
        this._equip(order[idx]);
      }

      if (input.down('KeyR')) startReload(this.cur) && game.audio.reload();

      const def = this.cur.def;
      if (def.scope) {
        if (input.rmb && !this._rmbHeld) { this.scoped = !this.scoped; game.audio.defuseTick(); }
        this._rmbHeld = input.rmb;
      }

      const wantFire = input.lmb;
      if (wantFire) {
        if (def.auto || !this._lmbHeld) this._tryFire();
      }
      this._lmbHeld = wantFire;
    }

    game.playerDefusing(dt);
  }

  _tryFire() {
    const game = this.game;
    const def = this.cur.def;
    const origin = this.eyePos();
    const dir = new THREE.Vector3();
    game.engine.camera.getWorldDirection(dir);

    if (def.kind === 'grenade') {
      if (this.cur.mag <= 0) return;
      this.cur.mag--;
      this.cur.cd = 0.8;
      this.swingT = 0;
      const type = this.nadeType;
      game.throwGrenade(this, origin, dir, type);
      if (this.cur.mag <= 0) {
        this.loadout.grenades[type] = null;
        const owned = ownedNades(this.loadout);
        if (owned.length) {
          this.nadeType = owned[0];
          this._equip(4);
        } else this._equip(2);
      }
      return;
    }

    if (def.kind === 'melee') {
      if (this.cur.cd > 0) return;
      this.swingT = 0;
      const res = fireWeapon(game, this, this.cur, origin, dir);
      if (res) this.kickRot += 0.04;
      return;
    }

    const res = fireWeapon(game, this, this.cur, origin, dir);
    if (!res) return;
    this.burstIdx++;
    this.kickZ += 0.045;
    this.kickRot += 0.05 + def.recoilV * 1.5;
    this.punchPitch += def.recoilV * (1 + Math.min(this.burstIdx, 8) * 0.12);
    const sideDrift = this.burstIdx > 4 ? 1.7 : 0.55;
    this.punchYaw += def.recoilH * sideDrift * Math.sin(this.burstIdx * 0.9);
    this.muzzleT = 0.05;
  }

  notifyShot() {
    this.burstIdx = 0;
  }

  _updateVM(dt, bobAmt) {
    for (const key in this.vms) this.vms[key].visible = false;
    if (!this.alive || this.scoped) return;
    const vm = this.vms[this.cur.key];
    if (!vm) return;
    vm.visible = true;
    const base = vm.userData.base;
    const bobX = Math.cos(this.walkCycle) * 0.014 * bobAmt;
    const bobY = -Math.abs(Math.sin(this.walkCycle * 2)) * 0.012 * bobAmt;
    let rotX = this.kickRot;
    let y = base.y + bobY;
    if (this.switchT < 1) y -= (1 - this.switchT) * 0.4;
    if (this.cur.reloading) {
      const r = 1 - this.cur.reloadT / this.cur.def.reload;
      rotX -= Math.sin(r * Math.PI) * 0.6;
    }
    if (this.swingT < 1) {
      const s = this.swingT;
      vm.rotation.z = -Math.sin(s * Math.PI) * 0.9;
      vm.position.z = base.z - Math.sin(s * Math.PI) * 0.25;
    } else {
      vm.rotation.z = 0;
      vm.position.z = base.z + this.kickZ;
    }
    vm.position.set(base.x + bobX, y, vm.position.z);
    vm.rotation.x = rotX;
    vm.rotation.y = 0;

    if (this.muzzleT > 0) {
      this.muzzleT -= dt;
      this.muzzleLight.intensity = 6;
      const mpos = vm.userData.muzzle;
      this.muzzleLight.position.set(base.x + mpos.x, base.y + mpos.y, base.z + mpos.z);
    } else this.muzzleLight.intensity = 0;
  }

  hurt(dmg, attacker, headshot) {
    this.game.audio.damage();
    this.game.hud.damageFlash(dmg);
    if (attacker) this.game.hud.damageDirection(attacker, this);
  }

  die(attacker) {
    this.alive = false;
    this.deaths++;
    this.scoped = false;
    const eye = this.eyePos();
    this.deathEye = new THREE.Vector3(eye.x, Math.max(0.4, eye.y - 0.9), eye.z);
    this.body.blockBullets = false;
    this.game.physics.removeBody(this.body);
    this.game.hud.setSpectating(true);
  }
}
