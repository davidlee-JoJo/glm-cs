import * as THREE from 'three';

export class HUD {
  constructor(game) {
    this.game = game;
    this.$ = (id) => document.getElementById(id);
    this.el = {
      hud: this.$('hud'), crosshair: this.$('crosshair'), hitmarker: this.$('hitmarker'),
      hp: this.$('hp-value'), armor: this.$('armor-value'), money: this.$('money-value'),
      ammoMag: this.$('ammo-mag'), ammoReserve: this.$('ammo-reserve'), weaponName: this.$('weapon-name'),
      timer: this.$('timer-value'), timerLabel: this.$('timer-label'),
      scoreT: this.$('score-t'), scoreCT: this.$('score-ct'), roundLabel: this.$('round-label'),
      killfeed: this.$('killfeed'), minimap: this.$('minimap'),
      msgCenter: this.$('msg-center'), msgTitle: this.$('msg-title'), msgSub: this.$('msg-sub'),
      interact: this.$('interact-wrap'), interactLabel: this.$('interact-label'), interactFill: this.$('interact-fill'),
      vignette: this.$('vignette'), dmgDir: this.$('dmg-dir'),
      scope: this.$('scope-overlay'),
      bombHud: this.$('bomb-hud'), hint: this.$('hint-bar'), spectate: this.$('spectate-note'),
      scoreboard: this.$('scoreboard'), sbRows: this.$('sb-rows')
    };
    this.ctx = this.el.minimap.getContext('2d');
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = 168;
    this.hitT = 0;
    this.vigT = 0;
    this.dirT = 0;
    this.bannerT = 0;
    this.msgQueue = null;
    this.minimapBase = null;
    this.visCache = new Map();
    this.visT = 0;
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  buildMinimapBase(map) {
    const ctx = this.base.getContext('2d');
    const S = 168, SC = S / (map.cols * 2);
    ctx.fillStyle = 'rgba(20,24,30,0.9)';
    ctx.fillRect(0, 0, S, S);
    const tx = (x) => (x + map.cols) * SC;
    const tz = (z) => (z + map.rows) * SC;
    ctx.fillStyle = 'rgba(150,140,110,0.25)';
    ctx.fillRect(tx(-32), tz(-32), 64 * SC, 64 * SC);
    ctx.fillStyle = 'rgba(90,80,60,0.85)';
    for (const r of map.rects) {
      ctx.fillRect(tx(r.x0), tz(r.z0), (r.x1 - r.x0) * SC, (r.z1 - r.z0) * SC);
    }
    ctx.font = 'bold 13px Consolas';
    ctx.fillStyle = 'rgba(232,180,60,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('A', tx(map.siteA.center.x), tz(map.siteA.center.z) + 5);
    ctx.fillText('B', tx(map.siteB.center.x), tz(map.siteB.center.z) + 5);
    this.minimapBase = this.base;
    this._SC = SC; this._tx = tx; this._tz = tz;
  }

  update(dt) {
    const game = this.game, p = game.player;
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hitmarker.classList.remove('show'); }
    if (this.vigT > 0) { this.vigT -= dt; this.el.vignette.style.opacity = Math.min(0.9, this.vigT * 2); }
    else this.el.vignette.style.opacity = p.alive && p.health <= 30 ? 0.35 : 0;
    if (this.dirT > 0) { this.dirT -= dt; this.el.dmgDir.style.opacity = Math.min(1, this.dirT * 1.5); }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.el.msgCenter.classList.add('hidden');
    }

    this.el.hp.textContent = p.health;
    this.el.hp.classList.toggle('low', p.health <= 30);
    this.el.armor.textContent = Math.round(p.armor);
    this.el.money.textContent = p.money;

    const inst = p.cur;
    const def = inst.def;
    this.el.weaponName.textContent = def.name;
    if (def.kind === 'melee') {
      this.el.ammoMag.textContent = '—';
      this.el.ammoReserve.textContent = '—';
    } else if (def.kind === 'grenade') {
      this.el.ammoMag.textContent = inst.mag;
      this.el.ammoReserve.textContent = '';
      this.el.ammoMag.classList.toggle('low', inst.mag <= 0);
    } else {
      this.el.ammoMag.textContent = inst.mag;
      this.el.ammoReserve.textContent = inst.reserve;
      this.el.ammoMag.classList.toggle('low', inst.mag <= Math.max(1, def.mag * 0.2));
    }

    const th = this.el.timer;
    if (game.state === 'freeze') {
      th.textContent = '0:0' + Math.max(0, Math.ceil(game.freezeLeft));
      this.el.timerLabel.textContent = '凍結時間';
      th.classList.remove('low');
    } else if (game.bomb && game.bomb.state === 'planted') {
      th.textContent = '💣';
      this.el.timerLabel.textContent = '炸彈倒數 ' + Math.max(0, game.bomb.timer).toFixed(1);
      th.classList.add('low');
    } else {
      const t = Math.max(0, game.roundTime);
      const m = Math.floor(t / 60), s = Math.floor(t % 60);
      th.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      this.el.timerLabel.textContent = '回合時間';
      th.classList.toggle('low', t < 20);
    }
    this.el.scoreT.textContent = game.scoreT;
    this.el.scoreCT.textContent = game.scoreCT;
    this.el.roundLabel.textContent = `第 ${game.roundNum} 回合 · ${game.map.def.name} · ${game.config.mode === 'bomb' ? '炸彈攻防' : '團隊殲滅'} · ${game.config.diffName}`;

    const spread = p.alive ? p.currentSpreadVal() : 0;
    const gap = 4 + spread * 900;
    this.el.crosshair.style.setProperty('--gap', Math.min(40, gap) + 'px');
    this.el.crosshair.style.display = (p.alive && !p.scoped) ? '' : 'none';

    this.el.spectate.classList.toggle('hidden', p.alive || game.state === 'menu');
    this.el.bombHud.classList.toggle('hidden', !(game.bomb && game.bomb.state === 'planted'));
    this.el.scope.classList.toggle('hidden', !p.scoped);

    this._drawMinimap();
  }

  _drawMinimap() {
    if (!this.minimapBase) return;
    const game = this.game, p = game.player;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 168, 168);
    ctx.drawImage(this.minimapBase, 0, 0);
    const SC = this._SC, tx = this._tx, tz = this._tz;

    this.visT -= 1 / 60;
    if (this.visT <= 0) {
      this.visT = 0.25;
      this.visCache.clear();
      for (const e of game.players) {
        if (e.isBot && e.team !== p.team && e.alive) {
          this.visCache.set(e, game.physics.losClear(p.eyePos(), e.eyePos()));
        }
      }
    }

    for (const e of game.players) {
      if (e === p || !e.alive) continue;
      const isEnemy = e.team !== p.team;
      if (isEnemy) {
        const visible = this.visCache.get(e) || (game.time - e.lastShotT < 2);
        if (!visible) continue;
      }
      ctx.fillStyle = e.team === 'T' ? '#e8b45a' : '#6ea8ff';
      ctx.beginPath();
      ctx.arc(tx(e.body.pos.x), tz(e.body.pos.z), 3.2, 0, 7);
      ctx.fill();
    }

    if (game.bomb && (game.bomb.state === 'planted' || game.bomb.state === 'dropped')) {
      const b = game.bomb;
      ctx.fillStyle = b.state === 'planted' ? (Math.floor(game.time * 4) % 2 ? '#ff3b3b' : '#ffb13b') : '#e8b45a';
      ctx.fillRect(tx(b.pos.x) - 3, tz(b.pos.z) - 3, 6, 6);
    }

    if (p.alive) {
      const x = tx(p.body.pos.x), z = tz(p.body.pos.z);
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(-p.yaw);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -5.5);
      ctx.lineTo(4, 4);
      ctx.lineTo(0, 2);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  hitmarker(headshot) {
    this.el.hitmarker.classList.add('show');
    this.el.hitmarker.classList.toggle('hs', !!headshot);
    this.hitT = 0.14;
  }

  damageFlash(dmg) {
    this.vigT = Math.max(this.vigT, Math.min(0.6, dmg / 60));
  }

  damageDirection(attacker, victim) {
    const dx = attacker.body.pos.x - victim.body.pos.x;
    const dz = attacker.body.pos.z - victim.body.pos.z;
    const worldAng = Math.atan2(-dx, -dz);
    let rel = worldAng - victim.yaw;
    this.el.dmgDir.style.transform = `rotate(${-rel}rad)`;
    this.dirT = 1.1;
  }

  killfeedAdd(killer, victim, weaponName, headshot) {
    const div = document.createElement('div');
    div.className = 'kf-entry';
    if (killer === this.game.player || victim === this.game.player) div.classList.add('me');
    const kn = `<span class="${killer.team === 'T' ? 't' : 'ct'}">${killer.name}</span>`;
    const vn = `<span class="${victim.team === 'T' ? 't' : 'ct'}">${victim.name}</span>`;
    div.innerHTML = `${kn}<span class="wpn">${headshot ? '<span class="hs">◎</span>' : ''}[${weaponName}]</span>${vn}`;
    this.el.killfeed.prepend(div);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.5s'; }, 3600);
    setTimeout(() => div.remove(), 4200);
  }

  banner(title, sub, cls = '', dur = 3) {
    this.el.msgTitle.textContent = title;
    this.el.msgTitle.className = cls;
    this.el.msgSub.textContent = sub || '';
    this.el.msgCenter.classList.remove('hidden');
    this.bannerT = dur;
  }

  interact(label, progress) {
    if (label === null) { this.el.interact.classList.add('hidden'); return; }
    this.el.interact.classList.remove('hidden');
    this.el.interactLabel.textContent = label;
    this.el.interactFill.style.width = (progress * 100).toFixed(1) + '%';
  }

  hint(text) {
    if (!text) { this.el.hint.classList.add('hidden'); return; }
    this.el.hint.textContent = text;
    this.el.hint.classList.remove('hidden');
  }

  setSpectating(v) { this.el.spectate.classList.toggle('hidden', !v); }

  scoreboard(show) {
    this.el.scoreboard.classList.toggle('hidden', !show);
    if (show) this.renderScoreboard();
  }

  renderScoreboard() {
    const game = this.game;
    const rows = [...game.players].sort((a, b) => (a.team === b.team ? b.kills - a.kills : (a.team === 'CT' ? -1 : 1)));
    this.el.sbRows.innerHTML = rows.map((p) =>
      `<tr class="${p.alive ? '' : 'dead'} ${p === game.player ? 'me' : ''}">
        <td>${p.name}</td><td class="team-${p.team}">${p.team === 'T' ? '恐怖分子' : '反恐部隊'}</td>
        <td>${p.kills}</td><td>${p.deaths}</td><td>$${p.money}</td>
        <td>${p.alive ? '存活' : '陣亡'}</td></tr>`).join('');
  }
}
