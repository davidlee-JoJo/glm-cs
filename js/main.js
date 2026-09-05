import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { PhysicsWorld, AABB, Body, aabbTest } from './core/physics.js';
import { Input } from './core/input.js';
import { GameMap } from './world/map.js';
import { MAPS } from './world/maps.js';
import { Player } from './player/player.js';
import { Bot } from './ai/bot.js';
import { HUD } from './ui/hud.js';
import { Debug } from './ui/debug.js';
import { Menu } from './ui/menu.js';
import { AudioSys } from './audio.js';
import * as weaponNS from './player/weapons.js';
import { WeaponInst, WEAPONS, makeLoadout, GRENADE_TYPES, NADE_BY_DEFKEY, DEF_BY_NADE } from './player/weapons.js';

const FIXED = 1 / 60;
const WIN_ROUNDS = 8;
const DM_TARGET = 25;
const DM_TIME = 600;
const DM_RESPAWN = 3;
const WIN_WAVES = 10;

const DIFFS = {
  easy: { name: '簡單', reaction: 0.6, aimErr: 0.13, burst: 3, speed: 3.9 },
  normal: { name: '普通', reaction: 0.38, aimErr: 0.075, burst: 5, speed: 4.4 },
  hard: { name: '困難', reaction: 0.22, aimErr: 0.04, burst: 7, speed: 4.7 }
};

const T_NAMES = ['毒蛇', '灰狼', '禿鷹', '毒蠍', '夜鶯', '孤星', '赤狐', '黑豹'];
const CT_NAMES = ['幽靈', '獵犬', '雷霆', '刺客', '銀翼', '哨兵', '霜狼', '暴雨'];

class FX {
  constructor(game) {
    this.game = game;
    this.effects = [];
    this.decals = [];
    this.shakeAmt = 0;
    this.flashLight = new THREE.PointLight(0xffaa44, 0, 30);
    game.engine.scene.add(this.flashLight);
  }

  add(obj, life, update) {
    this.effects.push({ obj, life, max: life, update });
    this.game.engine.scene.add(obj);
  }

  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffe9a0, transparent: true, opacity: 0.85
    }));
    this.add(line, 0.06, (e, t) => { line.material.opacity = 0.85 * (e.life / e.max); });
  }

  impact(point, normal) {
    if (this.decals.length >= 60) {
      const old = this.decals.shift();
      this.game.engine.scene.remove(old);
    }
    const decal = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.85 })
    );
    decal.position.copy(point).addScaledVector(normal, 0.012);
    decal.lookAt(point.clone().add(normal));
    this.game.engine.scene.add(decal);
    this.decals.push(decal);

    const puff = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xcccccc, transparent: true, opacity: 0.7
    }));
    puff.position.copy(point);
    puff.scale.setScalar(0.12);
    this.add(puff, 0.15, (e) => {
      puff.scale.multiplyScalar(1.06);
      puff.material.opacity = 0.7 * (e.life / e.max);
    });
  }

  blood(pos) {
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xa01818, transparent: true, opacity: 0.9 }));
      s.position.copy(pos);
      s.scale.setScalar(0.07 + Math.random() * 0.05);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3);
      this.add(s, 0.35, (e, dt) => {
        vel.y -= 9 * dt;
        s.position.addScaledVector(vel, dt);
        s.material.opacity = 0.9 * (e.life / e.max);
      });
    }
  }

  explosion(pos, big) {
    const r0 = big ? 1.2 : 0.5;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(r0, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff8830, transparent: true, opacity: 0.9 }));
    sphere.position.copy(pos);
    const maxR = big ? 9 : 3;
    this.add(sphere, big ? 0.5 : 0.3, (e) => {
      const t = 1 - e.life / e.max;
      sphere.scale.setScalar(1 + t * (maxR / r0));
      sphere.material.opacity = 0.9 * (e.life / e.max);
    });
    this.flashLight.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
    this.flashLight.intensity = big ? 400 : 150;
    setTimeout(() => { this.flashLight.intensity = 0; }, 120);
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x555555, transparent: true, opacity: 0.8 }));
      s.position.copy(pos);
      s.scale.setScalar(0.4 + Math.random() * 0.5);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6);
      this.add(s, 0.9, (e, dt) => {
        vel.y -= 4 * dt;
        s.position.addScaledVector(vel, dt);
        s.scale.multiplyScalar(1.02);
        s.material.opacity = 0.8 * (e.life / e.max);
      });
    }
    const d = this.game.player.body.pos.distanceTo(pos);
    this.shake(Math.max(0, (big ? 1.4 : 0.5) - d * 0.03));
  }

  smokeCloud(pos, life) {
    const group = new THREE.Group();
    const puffs = [];
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        color: 0x9aa0a6, transparent: true, opacity: 0, depthWrite: false
      }));
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * 4.4;
      s.position.set(Math.cos(a) * rr, 0.7 + Math.random() * 2.8, Math.sin(a) * rr);
      s.scale.setScalar(2.4 + Math.random() * 2.6);
      group.add(s);
      puffs.push(s);
    }
    group.position.copy(pos);
    const entry = {
      obj: group, life, max: life, update: (e, dt) => {
        const grow = Math.min(1, (1 - e.life / e.max) * 6);
        const fade = e.life < 1.6 ? e.life / 1.6 : 1;
        for (const s of puffs) {
          s.material.opacity = 0.85 * grow * fade;
          s.scale.multiplyScalar(1 + 0.04 * dt);
        }
      }
    };
    this.effects.push(entry);
    this.game.engine.scene.add(group);
  }

  flashBurst(pos) {
    const light = new THREE.PointLight(0xffffff, 900, 45);
    light.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0));
    this.add(light, 0.35, (e) => { light.intensity = 900 * (e.life / e.max); });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
    sphere.position.copy(pos);
    this.add(sphere, 0.3, (e) => {
      const t = 1 - e.life / e.max;
      sphere.scale.setScalar(1 + t * 12);
      sphere.material.opacity = 0.95 * (e.life / e.max);
    });
  }

  fireZone(pos, life) {
    const group = new THREE.Group();
    const light = new THREE.PointLight(0xff6622, 50, 16);
    light.position.y = 0.9;
    group.add(light);
    const flames = [];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        color: i % 3 === 0 ? 0xff4414 : i % 3 === 1 ? 0xff8830 : 0xffbb44,
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * 3.6;
      s.position.set(Math.cos(a) * rr, 0.3 + Math.random() * 0.6, Math.sin(a) * rr);
      s.scale.setScalar(0.55 + Math.random() * 0.75);
      group.add(s);
      flames.push(s);
    }
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(4, 22),
      new THREE.MeshBasicMaterial({ color: 0x17120c, transparent: true, opacity: 0.5, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(pos.x, pos.y + 0.03, pos.z);
    this.game.engine.scene.add(scorch);
    group.position.copy(pos);
    const entry = {
      obj: group, life, max: life, extras: [scorch], update: (e) => {
        const t = e.life / e.max;
        light.intensity = 40 + Math.sin(this.game.time * 13) * 20;
        for (let i = 0; i < flames.length; i++) {
          const s = flames[i];
          s.position.y = 0.3 + (Math.sin(this.game.time * 5 + i * 2.1) * 0.5 + 0.5) * 0.9;
          s.material.opacity = (0.4 + 0.4 * Math.abs(Math.sin(this.game.time * 7 + i * 1.3))) * Math.min(1, t * 4);
        }
      }
    };
    this.effects.push(entry);
    this.game.engine.scene.add(group);
    return entry;
  }

  removeZone(entry) {
    if (!entry) return;
    const i = this.effects.indexOf(entry);
    if (i >= 0) this.effects.splice(i, 1);
    this.game.engine.scene.remove(entry.obj);
    if (entry.extras) for (const o of entry.extras) this.game.engine.scene.remove(o);
  }

  shake(amt) { this.shakeAmt = Math.max(this.shakeAmt, amt); }

  shakeOffset() {
    const s = this.shakeAmt;
    if (s <= 0.001) return { x: 0, y: 0, z: 0 };
    return {
      x: (Math.random() - 0.5) * s * 0.2,
      y: (Math.random() - 0.5) * s * 0.2,
      z: (Math.random() - 0.5) * s * 0.2
    };
  }

  clear() {
    for (const e of this.effects) {
      this.game.engine.scene.remove(e.obj);
      if (e.extras) for (const o of e.extras) this.game.engine.scene.remove(o);
    }
    this.effects = [];
    for (const d of this.decals) this.game.engine.scene.remove(d);
    this.decals = [];
    for (const p of this.game.physics.projectiles) {
      if (p.mesh) this.game.engine.scene.remove(p.mesh);
    }
    this.flashLight.intensity = 0;
  }

  update(dt) {
    this.shakeAmt *= Math.exp(-5 * dt);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.update) e.update(e, dt);
      if (e.life <= 0) {
        this.game.engine.scene.remove(e.obj);
        if (e.extras) for (const o of e.extras) {
          this.game.engine.scene.remove(o);
          o.traverse && o.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
        }
        e.obj.traverse && e.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        this.effects.splice(i, 1);
      }
    }
  }
}

export class Game {
  constructor() {
    const canvas = document.getElementById('game-canvas');
    this.engine = new Engine(canvas);
    this.physics = new PhysicsWorld();
    this.input = new Input(canvas, {
      onKeyDown: (code) => this.onKeyDown(code),
      onKeyUp: (code) => this.onKeyUp(code),
      onLockChange: (locked) => this.onLockChange(locked)
    });
    this.audio = new AudioSys();
    this.mapKey = 'dust';
    this.map = new GameMap(this.engine, this.physics, MAPS.dust);
    this.hud = new HUD(this);
    this.debug = new Debug(this);
    this.debug.buildVisuals();
    this.menu = new Menu(this, {
      onStart: (cfg) => this.startMatch(cfg),
      onResume: () => this.resume(),
      onRestart: () => { this.menu.hideEnd(); this.menu.hidePause(); this.startMatch(this.config); },
      onQuit: () => this.backToMenu()
    });
    this.fx = new FX(this);

    this.weaponNS = weaponNS;
    this.physicsNS = { AABB, Body };

    this.players = [];
    this.player = null;
    this.bots = [];
    this.fires = [];
    this.bomb = null;
    this.bombMesh = this._buildBombMesh();
    this.engine.scene.add(this.bombMesh);
    this.bombMesh.visible = false;

    this.state = 'menu';
    this.paused = false;
    this.timeScale = 1;
    this.gravityScale = 1;
    this.time = 0;
    this.roundTime = 0;
    this.freezeLeft = 0;
    this.buyTimeLeft = 0;
    this.roundEndT = 0;
    this.scoreT = 0;
    this.scoreCT = 0;
    this.roundNum = 0;
    this.lossStreak = { T: 0, CT: 0 };
    this.killStreak = 0;
    this.lastKillT = -99;
    this.deathCamT = 0;
    this.deathCamTarget = null;
    this.config = { mode: 'elim', difficulty: 'normal', ctBots: 2, tBots: 3, map: 'dust', diffName: '普通', diff: DIFFS.normal };
    this.defuseT = 0;

    this.acc = 0;
    this.last = performance.now();
    this.tickMs = 0;
    this.hintT = 0;

    this.input.sens = this.menu.config.sens;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  _buildBombMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x2a3324 }));
    body.position.y = 0.07;
    g.add(body);
    this.bombLight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    this.bombLight.position.set(0.12, 0.16, 0);
    g.add(this.bombLight);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  onKeyDown(code) {
    if (this.state === 'menu' || this.state === 'matchEnd') return;
    switch (code) {
      case 'F3': this.debug.togglePanel(); return;
      case 'F4': this.debug.toggleVisuals(); return;
      case 'F6': this.debug.toggleGod(); this.hud.hint(this.debug.god ? '無敵模式 開啟' : '無敵模式 關閉'); this.hintT = 2; return;
      case 'F7': this.debug.cycleGravity(); this.hud.hint(`重力 ${this.gravityScale}x`); this.hintT = 2; return;
      case 'F8': this.debug.cycleTime(); this.hud.hint(`時間縮放 ${this.timeScale}x`); this.hintT = 2; return;
      case 'F9': this.debug.toggleNoclip(); this.hud.hint(this.player.body.noclip ? '穿牆模式 開啟' : '穿牆模式 關閉'); this.hintT = 2; return;
      case 'Tab': this.hud.scoreboard(true); return;
      case 'KeyB':
        if (this.menu.buyOpen) this.menu.closeBuy();
        else if (this.canBuy()) this.menu.openBuy();
        else { this.hud.hint('無法購買 — 只能在回合開始 15 秒內'); this.hintT = 2; }
        return;
      case 'Escape':
        if (this.menu.buyOpen) this.menu.closeBuy();
        return;
      case 'KeyG': {
        const p = this.player;
        if (!p || !p.alive || this.paused) return;
        const he = p.loadout.grenades && p.loadout.grenades.he;
        if (!he || he.mag <= 0) { this.hud.hint('沒有手榴彈'); this.hintT = 1.5; return; }
        he.mag = 0;
        p.loadout.grenades.he = null;
        const dir = new THREE.Vector3();
        this.engine.camera.getWorldDirection(dir);
        this.throwGrenade(p, p.eyePos(), dir, 'he');
        p.swingT = 0;
        if (p.curSlot === 4) p._equip(4);
        return;
      }
    }
  }

  onKeyUp(code) {
    if (code === 'Tab') this.hud.scoreboard(false);
  }

  onLockChange(locked) {
    if (locked) {
      this.input.clearButtons();
      this.menu.hidePause();
      this.paused = false;
      return;
    }
    if (this.inMatch() && !this.menu.blocking() && !this.menu.buyOpen) {
      this.pause();
    }
  }

  inMatch() {
    return ['freeze', 'live', 'roundEnd'].includes(this.state);
  }

  pause() {
    if (!this.inMatch() || this.paused) return;
    this.paused = true;
    this.menu.showPause();
    this.input.clearButtons();
  }

  resume() {
    this.paused = false;
    this.menu.hidePause();
    this.input.requestLock(this.engine.renderer.domElement);
  }

  distToPlayer(origin) {
    return this.player ? this.player.body.pos.distanceTo(origin) : 0;
  }

  panFor(pos) {
    const cam = this.engine.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const dx = pos.x - cam.position.x, dz = pos.z - cam.position.z;
    const L = Math.hypot(dx, dz) || 1;
    return Math.max(-1, Math.min(1, (-fwd.z * dx + fwd.x * dz) / L));
  }

  rebuildMap(key) {
    this.map.dispose();
    this.map = new GameMap(this.engine, this.physics, MAPS[key]);
    this.mapKey = key;
    this.hud.buildMinimapBase(this.map);
    this.debug.buildVisuals();
  }

  startMatch(cfg) {
    this.audio.init();
    this.config = {
      mode: cfg.mode,
      difficulty: cfg.difficulty,
      ctBots: cfg.ctBots,
      tBots: cfg.tBots,
      map: cfg.map,
      diff: DIFFS[cfg.difficulty],
      diffName: DIFFS[cfg.difficulty].name
    };
    const dm = this.config.mode === 'dm';
    const survival = this.config.mode === 'survival';
    for (const b of this.bots) b.remove();
    this.bots = [];
    this.fx.clear();
    if (cfg.map && cfg.map !== this.mapKey) this.rebuildMap(cfg.map);
    this.scoreT = 0;
    this.scoreCT = 0;
    this.roundNum = 0;
    this.lossStreak = { T: 0, CT: 0 };

    if (!this.player) {
      this.player = new Player(this);
      this.players = [this.player];
    } else this.player.resetForRound(this.map.spawnCT[0], false);
    if (dm) this.player.money = 16000;
    else if (survival) this.player.money = 2000;

    const ctNames = CT_NAMES.slice(0, this.config.ctBots);
    const tNames = T_NAMES.slice(0, this.config.tBots);
    for (let i = 0; i < this.config.ctBots; i++) {
      this.bots.push(new Bot(this, 'CT', ctNames[i], this.config.diff));
    }
    for (let i = 0; i < this.config.tBots; i++) {
      this.bots.push(new Bot(this, 'T', tNames[i], this.config.diff));
    }
    if (dm) {
      for (const bot of this.bots) {
        bot.money = 16000;
        this.botBuy(bot, true);
      }
    } else if (survival) {
      for (const bot of this.bots) bot.money = 1000;
    }
    this.players = [this.player, ...this.bots];

    this.menu.hideMain();
    this.menu.hideEnd();
    this.hud.show(true);
    this.hud.buildMinimapBase(this.map);
    this.hud.setSpectating(false);
    this.input.enabled = true;
    this.input.sens = this.menu.config.sens;
    this.debug.god = false;
    this.input.requestLock(this.engine.renderer.domElement);

    this.nextRound();
  }

  nextRound() {
    this.roundNum++;
    const dm = this.config.mode === 'dm';
    const survival = this.config.mode === 'survival';
    if (survival) {
      for (const b of this.bots) if (b.team === 'T') b.remove();
      this.bots = this.bots.filter((b) => b.team !== 'T');
      const base = this.config.diff;
      const waveDiff = {
        name: base.name, burst: base.burst,
        reaction: Math.max(0.15, base.reaction - this.roundNum * 0.025),
        aimErr: Math.max(0.02, base.aimErr - this.roundNum * 0.007),
        speed: Math.min(5.2, base.speed + this.roundNum * 0.12)
      };
      const count = Math.min(1 + this.roundNum, 8);
      for (let i = 0; i < count; i++) {
        this.bots.push(new Bot(this, 'T', T_NAMES[(this.roundNum + i) % T_NAMES.length], waveDiff));
      }
    }
    this.state = 'freeze';
    this.freezeLeft = dm ? 2 : survival ? 10 : 3;
    this.buyTimeLeft = dm ? DM_TIME + 30 : survival ? 10 : 15;
    this.roundTime = dm ? DM_TIME : this.config.mode === 'bomb' ? 115 : 120;
    this.paused = false;
    this.fx.clear();
    for (const p of this.physics.projectiles.slice()) {
      if (p.mesh) this.engine.scene.remove(p.mesh);
    }
    this.physics.projectiles.length = 0;

    const keep = this.player.alive;
    if (!this.physics.bodies.includes(this.player.body)) this.physics.addBody(this.player.body);
    this.player.body.blockBullets = true;
    this.player.resetForRound(this.map.spawnCT[0], keep);

    let ti = 0, ci = 0;
    const tSpawns = this.map.spawnT, ctSpawns = this.map.spawnCT;
    for (const bot of this.bots) {
      const wasAlive = bot.alive;
      const spawn = bot.team === 'T' ? tSpawns[ti++ % tSpawns.length] : ctSpawns[1 + (ci++ % (ctSpawns.length - 1))];
      bot.resetForRound(spawn, wasAlive);
      this.botBuy(bot, survival);
    }

    this.bomb = {
      state: 'idle', carrier: null, pos: new THREE.Vector3(), timer: 0, site: null, beepT: 0
    };
    this.bombMesh.visible = false;
    for (const f of this.fires) this.fx.removeZone(f.visuals);
    this.fires = [];
    this.physics.smokes = [];
    if (this.config.mode === 'bomb') {
      const ts = this.bots.filter((b) => b.team === 'T');
      const carrier = ts[Math.floor(Math.random() * ts.length)];
      this.bomb.state = 'carried';
      this.bomb.carrier = carrier;
    }

    this.hud.banner(
      dm ? '死鬥模式' : survival ? `第 ${this.roundNum} 波` : `第 ${this.roundNum} 回合`,
      dm ? `率先達到 ${DM_TARGET} 擊殺即可獲勝 — 隨時可按 B 購買` :
        survival ? `敵人来袭 — 共 ${this.bots.filter((b) => b.team === 'T').length} 名，購買裝備備戰` :
        (this.config.mode === 'bomb' ? '炸彈攻防 — 恐怖分子攜帶 C4' : '團隊殲滅'),
      '', 2.5
    );
    this.audio.roundStart();
    if (this.menu.buyOpen) this.menu.closeBuy();
  }

  canBuy() {
    if (!this.inMatch() || !this.player.alive) return false;
    if (this.config.mode === 'dm') return this.state === 'freeze' || this.state === 'live';
    return this.buyTimeLeft > 0 && (this.state === 'freeze' || this.state === 'live');
  }

  buy(key) {
    if (!this.canBuy()) return false;
    const p = this.player;
    const price = { deagle: 700, mp5: 1500, m3: 1200, ak47: 2700, m4a4: 3100, awp: 4750, armor: 1000, helmet: 350,
      hegrenade: 300, smoke: 300, flash: 200, molotov: 600 }[key];
    if (!price || p.money < price) return false;
    if (key === 'armor') {
      if (p.armor >= 100) return false;
      p.armor = 100;
    } else if (key === 'helmet') {
      if (p.helmet || p.armor < 100) return false;
      p.helmet = true;
    } else if (GRENADE_TYPES.includes(NADE_BY_DEFKEY[key] || key)) {
      const nk = NADE_BY_DEFKEY[key] || key;
      if (p.loadout.grenades[nk]) return false;
      const inst = new WeaponInst(DEF_BY_NADE[nk]);
      inst.mag = 1;
      p.loadout.grenades[nk] = inst;
      if (this.player.curSlot === 4) this.player._equip(4);
    } else if (key === 'deagle') {
      p.loadout.secondary = new WeaponInst('deagle');
      p._equip(2);
    } else {
      p.loadout.primary = new WeaponInst(key);
      p._equip(1);
    }
    p.money -= price;
    this.audio.buy();
    return true;
  }

  botBuy(bot, force = false) {
    if (!force && this.roundNum <= 1) return;
    const l = bot.loadout;
    const buyArmor = () => {
      if (bot.money >= 1000 && bot.armor <= 0) {
        bot.armor = 100;
        bot.money -= 1000;
        if (bot.money >= 350 && !bot.helmet) { bot.helmet = true; bot.money -= 350; }
      }
    };
    if (!l.primary) {
      const wantAwp = bot.money >= 5750 && this.roundNum >= 3 && Math.random() < 0.22 &&
        !this.bots.some((b) => b.team === bot.team && b.loadout.primary && b.loadout.primary.key === 'awp');
      if (wantAwp) {
        l.primary = new WeaponInst('awp');
        bot.money -= 4750;
        buyArmor();
      } else if (bot.money >= (bot.team === 'T' ? 3700 : 4100)) {
        l.primary = new WeaponInst(bot.team === 'T' ? 'ak47' : 'm4a4');
        bot.money -= l.primary.def.price;
        buyArmor();
      } else if (bot.money >= 1500 && Math.random() < 0.5) {
        l.primary = new WeaponInst('mp5');
        bot.money -= 1500;
        buyArmor();
      } else if (bot.money >= 1200 && Math.random() < 0.4) {
        l.primary = new WeaponInst('m3');
        bot.money -= 1200;
        buyArmor();
      } else if (bot.money >= 1700) {
        l.secondary = new WeaponInst('deagle');
        bot.money -= 700;
      }
    } else buyArmor();
    const buyNade = (type, price, chance) => {
      if (!l.grenades[type] && bot.money >= price && Math.random() < chance) {
        const inst = new WeaponInst(DEF_BY_NADE[type]);
        inst.mag = 1;
        l.grenades[type] = inst;
        bot.money -= price;
      }
    };
    buyNade('he', 300, 0.55);
    buyNade('flash', 200, 0.45);
    buyNade('smoke', 300, 0.35);
    buyNade('molotov', 600, this.config.mode === 'bomb' ? 0.3 : 0.15);
    bot.cur = l.primary || l.secondary;
  }

  alertBots(pos, shooter) {
    if (!shooter) return;
    for (const p of this.players) {
      if (!p.isBot || !p.alive || p === shooter || p.team === shooter.team) continue;
      if (p.body.pos.distanceTo(pos) < 34) p.alert(pos);
    }
  }

  throwGrenade(owner, origin, dir, type = 'he') {
    const def = WEAPONS[type] || WEAPONS.hegrenade;
    const vel = dir.clone().multiplyScalar(16 * (def.speedMul || 1));
    vel.y += 3.5;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshLambertMaterial({ color: def.vmColor || 0x3a4a2e }));
    this.engine.scene.add(mesh);
    this.physics.spawnProjectile({
      pos: origin.clone().addScaledVector(dir, 0.5),
      vel, radius: 0.09, bounce: type === 'molotov' ? 0.15 : 0.45, fuse: def.fuse, owner, mesh, nadeType: type,
      onBounce: (p) => {
        this.audio.bounce(this.distToPlayer(p.pos), this.panFor(p.pos));
        if (p.nadeType === 'molotov' && !p.exploded) {
          p.exploded = true;
          p.fuse = -1;
        }
      },
      onExplode: (p) => {
        this.engine.scene.remove(p.mesh);
        if (p.nadeType === 'smoke') this.smokeExplode(p);
        else if (p.nadeType === 'flash') this.flashExplode(p);
        else if (p.nadeType === 'molotov') this.molotovExplode(p);
        else this.heExplode(p);
      }
    });
  }

  heExplode(p) {
    this.fx.explosion(p.pos, false);
    this.audio.explosion(this.distToPlayer(p.pos), this.panFor(p.pos));
    const def = WEAPONS.hegrenade;
    for (const { body, dist } of this.physics.bodiesInRadius(p.pos, def.radius)) {
      const v = body.owner;
      if (!v || !v.alive) continue;
      const chest = new THREE.Vector3(body.pos.x, body.pos.y, body.pos.z);
      const los = this.physics.losClear(p.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), chest);
      let dmg = def.dmg * Math.max(0, 1 - dist / def.radius) * (los ? 1 : 0.25);
      if (dmg < 2) continue;
      this.applyHit(v, dmg, p.owner, false, def, chest);
    }
  }

  smokeExplode(p) {
    this.audio.smokePop(this.distToPlayer(p.pos), this.panFor(p.pos));
    const pos = p.pos.clone();
    pos.y = Math.max(pos.y, 0.4);
    const until = this.time + 12;
    this.physics.smokes.push({ pos, r: 6, until });
    this.fx.smokeCloud(pos, 12);
  }

  flashExplode(p) {
    this.audio.flashbang(this.distToPlayer(p.pos), this.panFor(p.pos));
    this.fx.flashBurst(p.pos);
    for (const v of this.players) {
      if (!v.alive) continue;
      const eye = v.eyePos();
      const dist = eye.distanceTo(p.pos);
      if (dist > 24) continue;
      if (!this.physics.losClear(p.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), eye)) continue;
      const toFlash = p.pos.clone().sub(eye).normalize();
      let facing = 0;
      if (v.isBot) {
        const fwd = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(-1);
        facing = Math.max(0, fwd.dot(toFlash));
      } else {
        const fwd = new THREE.Vector3();
        this.engine.camera.getWorldDirection(fwd);
        facing = Math.max(0, fwd.dot(toFlash));
      }
      const blind = facing > 0.2 ? 0.8 + facing * 2.4 : 0.4;
      v.blindT = Math.max(v.blindT || 0, blind);
    }
  }

  molotovExplode(p) {
    this.audio.fireIgnite(this.distToPlayer(p.pos), this.panFor(p.pos));
    const pos = p.pos.clone();
    pos.y = Math.max(pos.y - 0.05, 0.05);
    const until = this.time + 6;
    const visuals = this.fx.fireZone(pos, 6);
    this.fires.push({ pos, r: 4, until, owner: p.owner, tick: 0, visuals });
  }

  updateTacticals(dt) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      if (this.time >= f.until) {
        this.fx.removeZone(f.visuals);
        this.fires.splice(i, 1);
        continue;
      }
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.25;
        this.audio.fireCrackle(this.distToPlayer(f.pos), this.panFor(f.pos));
        for (const { body } of this.physics.bodiesInRadius(f.pos, f.r)) {
          const v = body.owner;
          if (!v || !v.alive) continue;
          if (body.feetY > f.pos.y + 2.2) continue;
          this.applyHit(v, 6, f.owner && f.owner.alive ? f.owner : null, false, WEAPONS.molotov, body.pos.clone());
        }
      }
    }
    for (let i = this.physics.smokes.length - 1; i >= 0; i--) {
      if (this.time >= this.physics.smokes[i].until) this.physics.smokes.splice(i, 1);
    }
  }

  applyHit(victim, dmg, attacker, headshot, def, point) {
    if (!victim || !victim.alive || !this.inMatch()) return;
    if (victim.protT && this.time < victim.protT) return;
    if (this.debug.god && victim === this.player) return;
    if (attacker && attacker !== victim && victim.team === attacker.team) return;

    if (victim.armor > 0) {
      dmg *= 0.5;
      victim.armor = Math.max(0, victim.armor - dmg * 0.5);
    }
    dmg = Math.max(1, Math.round(dmg));
    victim.health -= dmg;
    if (point) this.fx.blood(point);

    if (attacker === this.player) {
      this.hud.hitmarker(headshot);
      this.audio.hit(headshot);
    }
    if (victim.hurt) victim.hurt(dmg, attacker, headshot);

    if (victim.health <= 0) this.onKill(attacker, victim, def, headshot);
  }

  onKill(attacker, victim, def, headshot) {
    victim.health = 0;
    if (attacker && attacker !== victim) {
      attacker.kills++;
      attacker.money = Math.min(16000, attacker.money + (def.killReward || 300));
    }
    if (victim.isBot) victim.die(attacker);
    else victim.die(attacker);
    if (victim === this.player) this.killStreak = 0;
    if (attacker === this.player) {
      this.audio.kill();
      if (this.time - this.lastKillT < 4) this.killStreak++;
      else this.killStreak = 1;
      this.lastKillT = this.time;
      if (this.killStreak >= 2) {
        const label = this.killStreak >= 5 ? '大殺特殺！！' :
          { 2: '雙殺！', 3: '三連殺！', 4: '四連殺！' }[this.killStreak];
        this.hud.banner(label, `${this.killStreak} 連殺`, 'win', 1.6);
        this.audio.multiKill(this.killStreak);
      }
    }
    this.hud.killfeedAdd(attacker || victim, victim, def ? def.name : '?', headshot);

    if (this.config.mode === 'bomb' && this.bomb && this.bomb.state === 'carried' && this.bomb.carrier === victim) {
      this.bomb.state = 'dropped';
      this.bomb.pos.copy(victim.body.pos);
      this.bomb.pos.y = 0.15;
      this.bombMesh.visible = true;
      this.bombMesh.position.copy(this.bomb.pos);
      this.hud.banner('炸彈已掉落', '', '', 2);
    }
    if (this.config.mode === 'dm') {
      if (attacker && attacker.kills >= DM_TARGET) this.matchEnd();
      return;
    }
    if (this.config.mode === 'survival') {
      if (victim === this.player) this.survivalEnd(false);
      return;
    }
    this.checkRoundEnd();
  }

  checkRoundEnd() {
    if (this.state !== 'live' || this.config.mode === 'dm' || this.config.mode === 'survival') return;
    const tAlive = this.players.filter((p) => p.team === 'T' && p.alive).length;
    const ctAlive = this.players.filter((p) => p.team === 'CT' && p.alive).length;
    if (ctAlive === 0) { this.endRound('T', '反恐部隊全滅'); return; }
    if (tAlive === 0) {
      if (this.config.mode === 'elim' || (this.bomb && this.bomb.state !== 'planted' && this.bomb.state !== 'exploded')) {
        this.endRound('CT', '恐怖分子全滅');
      }
    }
  }

  plantBomb(bot) {
    if (!this.bomb || this.bomb.state !== 'carried' || this.bomb.carrier !== bot) return;
    this.bomb.state = 'planted';
    this.bomb.pos.copy(bot.body.pos);
    this.bomb.pos.y = 0.15;
    this.bomb.timer = 40;
    this.bomb.site = this.map.inSite(bot.body.pos) || 'A';
    this.bombMesh.visible = true;
    this.bombMesh.position.copy(this.bomb.pos);
    this.audio.plantBeep();
    this.hud.banner('炸彈已設置', `地點 ${this.bomb.site} — 40 秒後引爆`, '', 2.5);
  }

  defuseBomb(who) {
    if (!this.bomb || this.bomb.state !== 'planted') return;
    this.bomb.state = 'defused';
    this.bombMesh.visible = false;
    this.hud.interact(null);
    this.endRound('CT', who === this.player ? '你拆除了炸彈' : `${who.name} 拆除了炸彈`);
  }

  endRound(winner, reason) {
    if (this.state !== 'live' || this.config.mode === 'dm' || this.config.mode === 'survival') return;
    this.state = 'roundEnd';
    this.roundEndT = 4;
    if (winner === 'T') this.scoreT++;
    else this.scoreCT++;
    this.hud.interact(null);

    const winMoney = this.config.mode === 'bomb' && reason.includes('引爆') ? 3500 : 3250;
    for (const p of this.players) {
      if (p.team === winner) p.money = Math.min(16000, p.money + winMoney);
      else {
        const streak = Math.min(4, this.lossStreak[p.team]);
        p.money = Math.min(16000, p.money + 1400 + streak * 500);
      }
    }
    this.lossStreak[winner] = 0;
    this.lossStreak[winner === 'T' ? 'CT' : 'T']++;

    const playerWon = winner === this.player.team;
    this.hud.banner(
      playerWon ? '回合勝利' : '回合失敗',
      `${winner === 'T' ? '恐怖分子' : '反恐部隊'}獲勝 — ${reason} | 比分 T ${this.scoreT} : ${this.scoreCT} CT`,
      playerWon ? 'win' : 'lose', 3.5
    );
    if (playerWon) this.audio.win();
    else this.audio.lose();
  }

  updateMatch(dt) {
    if (this.state === 'freeze') {
      this.freezeLeft -= dt;
      this.buyTimeLeft -= dt;
      if (this.freezeLeft <= 0) {
        this.state = 'live';
        this.hud.banner('行動開始', '', '', 1.2);
      }
    } else if (this.state === 'live') {
      this.buyTimeLeft -= dt;
      if (this.config.mode !== 'survival' && !(this.bomb && this.bomb.state === 'planted')) {
        this.roundTime -= dt;
        if (this.roundTime <= 0) {
          if (this.config.mode === 'dm') { this.matchEnd(); return; }
          this.endRound('CT', '時間到 — 目標未完成');
          return;
        }
      }
      if (this.config.mode === 'bomb') this.updateBomb(dt);
      if (this.config.mode === 'dm') this.updateRespawns(dt);
      if (this.config.mode === 'survival' && !this.players.some((p) => p.team === 'T' && p.alive)) {
        this.waveComplete();
      }
    } else if (this.state === 'roundEnd') {
      this.roundEndT -= dt;
      if (this.roundEndT <= 0) {
        if (this.config.mode === 'survival') {
          if (this.roundNum >= WIN_WAVES) this.survivalEnd(true);
          else this.nextRound();
        } else if (this.scoreT >= WIN_ROUNDS || this.scoreCT >= WIN_ROUNDS) this.matchEnd();
        else this.nextRound();
      }
    }
  }

  waveComplete() {
    if (this.state !== 'live') return;
    this.state = 'roundEnd';
    this.roundEndT = 5;
    const bonus = 400 + this.roundNum * 150;
    for (const p of this.players) {
      if (p.alive) p.money = Math.min(16000, p.money + bonus);
    }
    this.hud.banner(`第 ${this.roundNum} 波肅清`, `獎勵 $${bonus} — 下一波即將來襲`, 'win', 4);
    this.audio.win();
  }

  survivalEnd(win) {
    this.state = 'matchEnd';
    this.input.enabled = false;
    this.input.exitLock();
    const p = this.player;
    this.menu.showEnd(
      win ? '勝利!' : '戰敗',
      win ? `你撐過了全部 ${WIN_WAVES} 波攻勢！` : `你在第 ${this.roundNum} 波陣亡`,
      `你的成績：擊殺 ${p.kills} ／ 死亡 ${p.deaths} ／ 到達波次 ${this.roundNum}/${WIN_WAVES}`,
      win
    );
    if (win) this.audio.win();
    else this.audio.lose();
  }

  updateBomb(dt) {
    const bomb = this.bomb;
    if (bomb.state === 'dropped') {
      for (const p of this.players) {
        if (p.isBot && p.team === 'T' && p.alive && p.body.pos.distanceTo(bomb.pos) < 1.3) {
          bomb.state = 'carried';
          bomb.carrier = p;
          this.bombMesh.visible = false;
          break;
        }
      }
    } else if (bomb.state === 'planted') {
      bomb.timer -= dt;
      bomb.beepT -= dt;
      const interval = Math.max(0.12, 0.2 + (bomb.timer / 40) * 0.9);
      if (bomb.beepT <= 0) {
        bomb.beepT = interval;
        this.audio.bombBeep(this.distToPlayer(bomb.pos), this.panFor(bomb.pos));
        this.bombLight.material.color.setHex(Math.floor(this.time * 6) % 2 ? 0xff2222 : 0x661111);
      }
      if (bomb.timer <= 0) {
        bomb.state = 'exploded';
        this.bombMesh.visible = false;
        this.fx.explosion(bomb.pos, true);
        this.audio.explosion(this.distToPlayer(bomb.pos), this.panFor(bomb.pos));
        for (const { body, dist } of this.physics.bodiesInRadius(bomb.pos, 26)) {
          const v = body.owner;
          if (!v || !v.alive) continue;
          const dmg = 250 * Math.max(0, 1 - dist / 26);
          if (dmg > 5) this.applyHit(v, dmg, null, false, WEAPONS.hegrenade, body.pos);
        }
        this.endRound('T', '炸彈已引爆');
      }
    }
  }

  playerDefusing(dt) {
    const bomb = this.bomb;
    const p = this.player;
    const active = this.input.down('KeyE') && !this.menu.blocking();
    if (this.state !== 'live' || !bomb || bomb.state !== 'planted' || !p.alive || !active) {
      if (this.defuseT > 0) { this.defuseT = Math.max(0, this.defuseT - dt * 2); }
      if (this.defuseT <= 0) this.hud.interact(null);
      else this.hud.interact('拆除炸彈中...', this.defuseT / 7);
      return;
    }
    const near = p.body.pos.distanceTo(bomb.pos) < 1.7;
    const still = Math.hypot(p.body.vel.x, p.body.vel.z) < 0.6;
    if (near && still) {
      this.defuseT += dt;
      this.hud.interact('拆除炸彈中...', this.defuseT / 7);
      if (this.defuseT >= 7) {
        this.defuseT = 0;
        this.defuseBomb(p);
      }
    } else {
      if (this.defuseT > 0) this.defuseT = Math.max(0, this.defuseT - dt * 2);
      if (this.defuseT <= 0) this.hud.interact(null);
      else this.hud.interact('拆除炸彈中...', this.defuseT / 7);
    }
  }

  _pickRespawnPos() {
    const map = this.map;
    const enemies = this.players.filter((p) => p.alive);
    let best = null, bestScore = -1;
    for (let attempt = 0; attempt < 50; attempt++) {
      const col = Math.floor(Math.random() * map.cols);
      const row = Math.floor(Math.random() * map.rows);
      if (!map.walkable(col, row)) continue;
      const x = map.cellToWorldX(col), z = map.cellToWorldZ(row);
      const box = new AABB(x - 0.6, 0, z - 0.6, x + 0.6, 1.9, z + 0.6);
      let blocked = false;
      for (const s of this.physics.solids) {
        if (s.tag === 'floor' || s.tag === 'ceiling') continue;
        if (aabbTest(box, s.box)) { blocked = true; break; }
      }
      if (blocked) continue;
      let minD = 1e9;
      for (const e of enemies) minD = Math.min(minD, e.body.pos.distanceTo(new THREE.Vector3(x, 1, z)));
      const score = minD >= 15 ? minD + 100 : minD;
      if (score > bestScore) { bestScore = score; best = { x, y: 0.95, z }; }
      if (minD >= 15 && attempt > 8) break;
    }
    if (best) return best;
    const s = map.spawnCT[0];
    return { x: s.x, y: 0.95, z: s.z };
  }

  updateRespawns(dt) {
    for (const p of this.players) {
      if (p.alive || p.respawnT === undefined) continue;
      p.respawnT -= dt;
      if (p === this.player) this.hud.hint(`重生倒數 ${Math.max(0, Math.ceil(p.respawnT))}s...`);
      if (p.respawnT <= 0) this._respawn(p);
    }
  }

  _respawn(p) {
    p.resetForRound(this._pickRespawnPos(), true);
    p.protT = this.time + 3;
    if (p === this.player) {
      this.hud.setSpectating(false);
      this.hud.hint(null);
      this.hud.banner('已重生', '3 秒重生保護 — 開火後失效', '', 1.5);
    } else {
      if (p.money >= 500 && !p.loadout.grenades.he) {
        p.loadout.grenades.he = new WeaponInst(DEF_BY_NADE.he);
        p.loadout.grenades.he.mag = 1;
        p.money -= 300;
      }
      if (p.money >= 200 && !p.loadout.grenades.flash) {
        p.loadout.grenades.flash = new WeaponInst(DEF_BY_NADE.flash);
        p.loadout.grenades.flash.mag = 1;
        p.money -= 200;
      }
    }
  }

  matchEnd() {
    this.state = 'matchEnd';
    this.input.enabled = false;
    this.input.exitLock();
    const p = this.player;
    if (this.config.mode === 'dm') {
      const sorted = [...this.players].sort((a, b) => b.kills - a.kills);
      const win = sorted[0] === p;
      this.menu.showEnd(
        win ? '勝利!' : '戰敗',
        `死鬥結束 — 冠軍 ${sorted[0].name}（${sorted[0].kills} 擊殺）`,
        `你的成績：擊殺 ${p.kills} ／ 死亡 ${p.deaths} ／ K/D ${(p.kills / Math.max(1, p.deaths)).toFixed(2)}`,
        win
      );
      if (win) this.audio.win();
      else this.audio.lose();
      return;
    }
    const win = this.scoreCT > this.scoreT;
    this.menu.showEnd(
      win ? '勝利!' : '戰敗',
      `最終比分 — 反恐部隊 ${this.scoreCT} : ${this.scoreT} 恐怖分子`,
      `你的成績：擊殺 ${p.kills} ／ 死亡 ${p.deaths} ／ K/D ${(p.kills / Math.max(1, p.deaths)).toFixed(2)}<br>剩餘金錢 $${p.money}`,
      win
    );
    if (win) this.audio.win();
    else this.audio.lose();
  }

  backToMenu() {
    this.state = 'menu';
    this.paused = false;
    this.input.enabled = false;
    this.input.exitLock();
    this.fx.clear();
    for (const b of this.bots) b.remove();
    this.bots = [];
    this.players = [];
    this.bombMesh.visible = false;
    this.bomb = null;
    this.hud.show(false);
    this.hud.interact(null);
    this.hud.scoreboard(false);
    this.menu.hidePause();
    this.menu.hideEnd();
    this.menu.showMain();
  }

  simStep(dt) {
    const t0 = performance.now();
    this.time += dt;
    this.physics.rayCount = 0;

    for (const p of this.players) {
      if (p.alive && p.body && p.body.pos.y < -25) {
        p.health = 0;
        this.onKill(null, p, WEAPONS.hegrenade, false);
      }
    }

    if (this.player) this.player.update(dt);
    for (const bot of this.bots) bot.update(dt);
    this.physics.step(dt);
    this.fx.update(dt);
    this.updateTacticals(dt);
    if (this.inMatch()) this.updateMatch(dt);
    if (this.bomb && this.bomb.state === 'planted') {
      this.bombMesh.position.copy(this.bomb.pos);
    }

    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) this.hud.hint(null);
    } else if (this.inMatch() && this.player.alive && this.buyTimeLeft > 0) {
      this.hud.hint(`購買時間 — 按 B 開啟購買選單 (${Math.ceil(this.buyTimeLeft)}s)`);
    }

    this.tickMs = this.tickMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  loop() {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    let frameDt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    const active = this.inMatch() && !this.paused;
    try {
      if (active) {
        this.acc += frameDt * this.timeScale;
        let steps = 0;
        while (this.acc >= FIXED && steps < 6) {
          this.simStep(FIXED);
          this.acc -= FIXED;
          steps++;
        }
        this.debug.tickMs = this.tickMs;
      }

      this.debug.update(frameDt);
      if (this.state !== 'menu' && this.players.length) this.hud.update(frameDt);
      this._buyRefreshT = (this._buyRefreshT || 0) + frameDt;
      if (this.menu.buyOpen && this._buyRefreshT > 0.5) {
        this._buyRefreshT = 0;
        this.menu.refreshBuy();
      }
    } catch (e) {
      if (!this._fatalShown) {
        this._fatalShown = true;
        console.error(e);
        this.hud.banner('發生錯誤 — 請回報', (e && e.message) || String(e), 'lose', 30);
      }
    }

    this.engine.render(this.state !== 'menu' && this.player && this.player.alive);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__glmcs_ready = true;
  try {
    window.__glmcs_game = new Game();
  } catch (e) {
    console.error('GAME CONSTRUCTOR FAIL:', e && e.stack ? e.stack : e);
  }
});
