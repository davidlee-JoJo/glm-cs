import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { PhysicsWorld, AABB } from './core/physics.js';
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
import { WeaponInst, WEAPONS, makeLoadout } from './player/weapons.js';

const FIXED = 1 / 60;
const WIN_ROUNDS = 8;

const DIFFS = {
  easy: { name: '簡單', reaction: 0.6, aimErr: 0.13, burst: 3, speed: 3.9 },
  normal: { name: '普通', reaction: 0.38, aimErr: 0.075, burst: 5, speed: 4.4 },
  hard: { name: '困難', reaction: 0.22, aimErr: 0.04, burst: 7, speed: 4.7 }
};

const T_NAMES = ['毒蛇', '灰狼', '禿鷹', '毒蠍', '夜鶯'];
const CT_NAMES = ['幽靈', '獵犬', '雷霆', '刺客', '銀翼'];

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
    for (const e of this.effects) this.game.engine.scene.remove(e.obj);
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
    this.map = new GameMap(this.engine.scene, this.physics, MAPS.dust);
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
    this.physicsNS = { AABB };

    this.players = [];
    this.player = null;
    this.bots = [];
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
    this.config = { mode: 'elim', difficulty: 'normal', botsPerSide: 3, map: 'dust', diffName: '普通', diff: DIFFS.normal };
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

  rebuildMap(key) {
    this.map.dispose();
    this.map = new GameMap(this.engine.scene, this.physics, MAPS[key]);
    this.mapKey = key;
    this.hud.buildMinimapBase(this.map);
    this.debug.buildVisuals();
  }

  startMatch(cfg) {
    this.audio.init();
    this.config = {
      mode: cfg.mode,
      difficulty: cfg.difficulty,
      botsPerSide: cfg.botsPerSide,
      map: cfg.map,
      diff: DIFFS[cfg.difficulty],
      diffName: DIFFS[cfg.difficulty].name
    };
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

    const perTeam = this.config.botsPerSide;
    const ctBots = perTeam - 1;
    for (let i = 0; i < ctBots; i++) {
      this.bots.push(new Bot(this, 'CT', CT_NAMES[i], this.config.diff));
    }
    for (let i = 0; i < perTeam; i++) {
      this.bots.push(new Bot(this, 'T', T_NAMES[i], this.config.diff));
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
    this.state = 'freeze';
    this.freezeLeft = 3;
    this.buyTimeLeft = 15;
    this.roundTime = this.config.mode === 'bomb' ? 115 : 120;
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
    for (const bot of this.bots) {
      const wasAlive = bot.alive;
      const spawn = bot.team === 'T' ? this.map.spawnT[ti++ % 5] : this.map.spawnCT[1 + (ci++ % 4)];
      bot.resetForRound(spawn, wasAlive);
      this.botBuy(bot);
    }

    this.bomb = {
      state: 'idle', carrier: null, pos: new THREE.Vector3(), timer: 0, site: null, beepT: 0
    };
    this.bombMesh.visible = false;
    if (this.config.mode === 'bomb') {
      const ts = this.bots.filter((b) => b.team === 'T');
      const carrier = ts[Math.floor(Math.random() * ts.length)];
      this.bomb.state = 'carried';
      this.bomb.carrier = carrier;
    }

    this.hud.banner(`第 ${this.roundNum} 回合`, this.config.mode === 'bomb' ? '炸彈攻防 — 恐怖分子攜帶 C4' : '團隊殲滅', '', 2.5);
    this.audio.roundStart();
    if (this.menu.buyOpen) this.menu.closeBuy();
  }

  canBuy() {
    return this.inMatch() && this.player.alive && this.buyTimeLeft > 0 &&
      (this.state === 'freeze' || this.state === 'live');
  }

  buy(key) {
    if (!this.canBuy()) return false;
    const p = this.player;
    const price = { deagle: 700, ak47: 2700, m4a4: 3100, awp: 4750, hegrenade: 300, armor: 1000 }[key];
    if (!price || p.money < price) return false;
    if (key === 'armor') {
      if (p.armor >= 100) return false;
      p.armor = 100;
    } else if (key === 'hegrenade') {
      if (p.loadout.grenade) return false;
      const inst = new WeaponInst('hegrenade');
      inst.mag = 1;
      p.loadout.grenade = inst;
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

  botBuy(bot) {
    if (this.roundNum <= 1) return;
    const l = bot.loadout;
    if (!l.primary) {
      const wantAwp = bot.money >= 5750 && this.roundNum >= 3 && Math.random() < 0.22 &&
        !this.bots.some((b) => b.team === bot.team && b.loadout.primary && b.loadout.primary.key === 'awp');
      if (wantAwp) {
        l.primary = new WeaponInst('awp');
        bot.money -= 4750;
      } else if (bot.money >= (bot.team === 'T' ? 3700 : 4100)) {
        l.primary = new WeaponInst(bot.team === 'T' ? 'ak47' : 'm4a4');
        bot.money -= l.primary.def.price;
        if (bot.money >= 1000) { bot.armor = 100; bot.money -= 1000; }
      } else if (bot.money >= 1700) {
        l.secondary = new WeaponInst('deagle');
        bot.money -= 700;
      }
    } else if (bot.money >= 1000 && bot.armor <= 0) {
      bot.armor = 100;
      bot.money -= 1000;
    }
    if (bot.money >= 300 && Math.random() < 0.5) bot.money -= 300;
    bot.cur = l.primary || l.secondary;
  }

  alertBots(pos, shooter) {
    if (!shooter) return;
    for (const p of this.players) {
      if (!p.isBot || !p.alive || p === shooter || p.team === shooter.team) continue;
      if (p.body.pos.distanceTo(pos) < 34) p.alert(pos);
    }
  }

  throwGrenade(owner, origin, dir) {
    const vel = dir.clone().multiplyScalar(16);
    vel.y += 3.5;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a4a2e }));
    this.engine.scene.add(mesh);
    this.physics.spawnProjectile({
      pos: origin.clone().addScaledVector(dir, 0.5),
      vel, radius: 0.09, bounce: 0.45, fuse: 1.7, owner, mesh,
      onBounce: (p) => this.audio.bounce(this.distToPlayer(p.pos)),
      onExplode: (p) => {
        this.engine.scene.remove(p.mesh);
        this.heExplode(p);
      }
    });
  }

  heExplode(p) {
    this.fx.explosion(p.pos, false);
    this.audio.explosion(this.distToPlayer(p.pos));
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

  applyHit(victim, dmg, attacker, headshot, def, point) {
    if (!victim || !victim.alive || !this.inMatch()) return;
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
    if (attacker === this.player) this.audio.kill();
    this.hud.killfeedAdd(attacker || victim, victim, def ? def.name : '?', headshot);

    if (this.config.mode === 'bomb' && this.bomb && this.bomb.state === 'carried' && this.bomb.carrier === victim) {
      this.bomb.state = 'dropped';
      this.bomb.pos.copy(victim.body.pos);
      this.bomb.pos.y = 0.15;
      this.bombMesh.visible = true;
      this.bombMesh.position.copy(this.bomb.pos);
      this.hud.banner('炸彈已掉落', '', '', 2);
    }
    this.checkRoundEnd();
  }

  checkRoundEnd() {
    if (this.state !== 'live') return;
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
    if (this.state !== 'live') return;
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
      if (!(this.bomb && this.bomb.state === 'planted')) {
        this.roundTime -= dt;
        if (this.roundTime <= 0) {
          this.endRound('CT', '時間到 — 目標未完成');
          return;
        }
      }
      if (this.config.mode === 'bomb') this.updateBomb(dt);
    } else if (this.state === 'roundEnd') {
      this.roundEndT -= dt;
      if (this.roundEndT <= 0) {
        if (this.scoreT >= WIN_ROUNDS || this.scoreCT >= WIN_ROUNDS) this.matchEnd();
        else this.nextRound();
      }
    }
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
        this.audio.bombBeep(this.distToPlayer(bomb.pos));
        this.bombLight.material.color.setHex(Math.floor(this.time * 6) % 2 ? 0xff2222 : 0x661111);
      }
      if (bomb.timer <= 0) {
        bomb.state = 'exploded';
        this.bombMesh.visible = false;
        this.fx.explosion(bomb.pos, true);
        this.audio.explosion(this.distToPlayer(bomb.pos));
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

  matchEnd() {
    this.state = 'matchEnd';
    this.input.enabled = false;
    this.input.exitLock();
    const win = this.scoreCT > this.scoreT;
    const p = this.player;
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
