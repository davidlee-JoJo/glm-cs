import * as THREE from 'three';
import { CELL } from '../world/maps.js';

const GRAV_STEPS = [1, 0.5, 0.15, 0];
const TIME_STEPS = [1, 0.5, 0.25];

export class Debug {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.visuals = false;
    this.god = false;
    this.gravIdx = 0;
    this.timeIdx = 0;
    this.fps = 60;
    this.panelT = 0;
    this.visT = 0;
    this.tickMs = 0;

    this.el = {
      panel: document.getElementById('debug-panel'),
      main: document.getElementById('dbg-main'),
      bots: document.getElementById('dbg-bots')
    };

    this.colliderGroup = new THREE.Group();
    this.navGroup = new THREE.Group();
    this.pathGroup = new THREE.Group();
    this.losGroup = new THREE.Group();
    this.coneGroup = new THREE.Group();
    for (const g of [this.colliderGroup, this.navGroup, this.pathGroup, this.losGroup, this.coneGroup]) {
      g.visible = false;
      game.engine.scene.add(g);
    }
  }

  buildVisuals() {
    const game = this.game;
    this.colliderGroup.clear();
    const mat = new THREE.LineBasicMaterial({ color: 0x3fdc81, transparent: true, opacity: 0.55 });
    for (const s of game.physics.solids) {
      const b = s.box;
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(
        b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ));
      const line = new THREE.LineSegments(geo, mat);
      line.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      this.colliderGroup.add(line);
    }
    this.navGroup.clear();
    const pos = [];
    const map = game.map;
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        if (!map.walkable(c, r)) continue;
        const x = map.cellToWorldX(c), z = map.cellToWorldZ(r), h = CELL / 2;
        pos.push(x - h, 0.04, z - h, x + h, 0.04, z - h, x + h, 0.04, z + h);
        pos.push(x - h, 0.04, z - h, x + h, 0.04, z + h, x - h, 0.04, z + h);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.navGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x3f8fdc, wireframe: true, transparent: true, opacity: 0.25
    })));
  }

  togglePanel() {
    this.enabled = !this.enabled;
    this.el.panel.classList.toggle('hidden', !this.enabled);
  }
  toggleVisuals() {
    this.visuals = !this.visuals;
    for (const g of [this.colliderGroup, this.navGroup, this.pathGroup, this.losGroup, this.coneGroup]) {
      g.visible = this.visuals;
    }
  }
  toggleGod() { this.god = !this.god; }
  toggleNoclip() {
    const p = this.game.player;
    p.body.noclip = !p.body.noclip;
    if (!p.body.noclip) p.body.vel.set(0, 0, 0);
  }
  cycleGravity() {
    this.gravIdx = (this.gravIdx + 1) % GRAV_STEPS.length;
    this.game.gravityScale = GRAV_STEPS[this.gravIdx];
    this.game.physics.gravity = 20 * this.game.gravityScale;
  }
  cycleTime() {
    this.timeIdx = (this.timeIdx + 1) % TIME_STEPS.length;
    this.game.timeScale = TIME_STEPS[this.timeIdx];
  }

  update(dt) {
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    if (!this.enabled) return;
    this.panelT -= dt;
    if (this.panelT > 0) return;
    this.panelT = 0.1;
    this._renderPanel();
    if (this.visuals) {
      this._updateVisualizers();
    }
  }

  _renderPanel() {
    const game = this.game, p = game.player;
    const b = p.body;
    const pos = `(${b.pos.x.toFixed(2)}, ${b.pos.y.toFixed(2)}, ${b.pos.z.toFixed(2)})`;
    const vel = `(${b.vel.x.toFixed(2)}, ${b.vel.y.toFixed(2)}, ${b.vel.z.toFixed(2)})`;
    const spd = Math.hypot(b.vel.x, b.vel.z).toFixed(2);
    const def = p.cur.def;
    const bomb = game.bomb;
    this.el.main.textContent =
`FPS ${this.fps.toFixed(0)} | tick ${this.tickMs.toFixed(2)}ms | 狀態 ${game.state} | 回合 ${game.roundNum}
位置 ${pos}  速度 ${vel}  速率 ${spd} m/s
著地 ${b.onGround} | 蹲 ${p.crouching} | 無敵 ${this.god} | 穿牆 ${p.body.noclip}
HP ${p.health} | 護甲 ${p.armor.toFixed(0)} | 金錢 $${p.money} | K/D ${p.kills}/${p.deaths}
武器 ${def.name} | 彈藥 ${def.kind === 'melee' || def.kind === 'grenade' ? '-' : `${p.cur.mag}/${p.cur.reserve}`} | 換彈 ${p.cur.reloading ? '是' : '否'} | 擴散 ${(p.currentSpreadVal() * 1000).toFixed(1)}mrad
實體 ${game.physics.bodies.length} | 投射物 ${game.physics.projectiles.length} | 射線/幀 ${game.physics.rayCount}
重力 ${game.gravityScale}x | 時間 ${game.timeScale}x | 炸彈 ${bomb ? bomb.state : '無'}${bomb && bomb.state === 'planted' ? ` ${bomb.timer.toFixed(1)}s @${bomb.site}` : ''}`;

    const rows = ['名稱        隊伍 狀態    目標          HP   位置'];
    for (const e of game.players) {
      if (e === p) continue;
      const nm = e.name.padEnd(6, '　');
      const st = e.alive ? e.state.padEnd(6) : '陣亡';
      const tg = e.target ? e.target.name : '-';
      const ps = `${e.body.pos.x.toFixed(0)},${e.body.pos.z.toFixed(0)}`;
      rows.push(`${nm} ${e.team}   ${st} ${tg.padEnd(6, '　')} ${String(e.health).padStart(3)}  ${ps}`);
    }
    this.el.bots.textContent = rows.join('\n');
  }

  _updateVisualizers() {
    const game = this.game;
    this.pathGroup.clear();
    this.losGroup.clear();
    this.coneGroup.clear();
    const pathMat = new THREE.LineBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.8 });
    const losMat = new THREE.LineBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.9 });
    const coneMat = new THREE.LineBasicMaterial({ color: 0x4da6ff, transparent: true, opacity: 0.35 });

    for (const bot of game.players) {
      if (!bot.isBot || !bot.alive) continue;
      if (bot.path && bot.pathI < bot.path.length) {
        const pts = [new THREE.Vector3(bot.body.pos.x, 0.1, bot.body.pos.z)];
        for (let i = bot.pathI; i < bot.path.length; i++) {
          pts.push(new THREE.Vector3(bot.path[i].x, 0.1, bot.path[i].z));
        }
        this.pathGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), pathMat));
      }
      if (bot.target && bot.target.alive) {
        const a = bot.eyePos(), c = bot.target.eyePos();
        this.losGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, c]), losMat));
      }
      const eye = bot.eyePos();
      const fwd = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
      for (let i = 0; i <= 12; i++) {
        const ang = -1.05 + (2.1 * i) / 12;
        const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
        const end = eye.clone().addScaledVector(dir, 12);
        end.y = 0.12;
        this.coneGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([eye, end]), coneMat));
      }
    }
  }
}
