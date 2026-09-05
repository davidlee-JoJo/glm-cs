import { BUY_LIST, WEAPONS, NADE_BY_DEFKEY } from '../player/weapons.js';

export class Menu {
  constructor(game, hooks) {
    this.game = game;
    this.hooks = hooks;
    this.buyOpen = false;
    this.config = {
      mode: 'elim',
      difficulty: 'normal',
      ctBots: 2,
      tBots: 3,
      map: 'dust',
      sens: parseFloat(localStorage.getItem('glmcs_sens') || '1')
    };

    this.el = {
      main: document.getElementById('main-menu'),
      pause: document.getElementById('pause-menu'),
      end: document.getElementById('end-screen'),
      buy: document.getElementById('buy-menu'),
      buyItems: document.getElementById('buy-items'),
      buyMoney: document.getElementById('buy-money'),
      buyTimer: document.getElementById('buy-timer'),
      sensSlider: document.getElementById('sens-slider'),
      sensVal: document.getElementById('sens-val'),
      endTitle: document.getElementById('end-title'),
      endSub: document.getElementById('end-sub'),
      endStats: document.getElementById('end-stats')
    };

    this._bindOptRow('mode-row', (v) => { this.config.mode = v; });
    this._bindOptGroup('map', (v) => { this.config.map = v; });
    this._bindOptRow('diff-row', (v) => { this.config.difficulty = v; });
    this._bindOptRow('mates-row', (v) => { this.config.ctBots = parseInt(v); });
    this._bindOptRow('enemies-row', (v) => { this.config.tBots = parseInt(v); });
    this.el.sensSlider.value = this.config.sens;
    this.el.sensVal.textContent = this.config.sens.toFixed(1);
    this.el.sensSlider.addEventListener('input', () => {
      this.config.sens = parseFloat(this.el.sensSlider.value);
      this.el.sensVal.textContent = this.config.sens.toFixed(1);
      localStorage.setItem('glmcs_sens', this.config.sens);
      if (game.input) game.input.sens = this.config.sens;
    });

    document.getElementById('btn-start').addEventListener('click', () => this.hooks.onStart(this.config));
    document.getElementById('btn-resume').addEventListener('click', () => this.hooks.onResume());
    document.getElementById('btn-restart').addEventListener('click', () => this.hooks.onRestart());
    document.getElementById('btn-quit').addEventListener('click', () => this.hooks.onQuit());
    document.getElementById('btn-again').addEventListener('click', () => this.hooks.onRestart());
    document.getElementById('btn-menu2').addEventListener('click', () => this.hooks.onQuit());
  }

  _bindOptRow(id, cb) {
    const row = document.getElementById(id);
    row.querySelectorAll('.opt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.opt-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        cb(btn.dataset.v);
      });
    });
  }

  _bindOptGroup(name, cb) {
    const rows = document.querySelectorAll(`.opt-row[data-row="${name}"]`);
    rows.forEach((row) => {
      row.querySelectorAll('.opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          rows.forEach((r) => r.querySelectorAll('.opt-btn').forEach((b) => b.classList.remove('selected')));
          btn.classList.add('selected');
          cb(btn.dataset.v);
        });
      });
    });
  }

  applySens() {
    this.game.input.sens = this.config.sens * (this.game.player && this.game.player.scoped ? 0.35 : 1);
  }

  blocking() {
    return this.buyOpen || !this.el.pause.classList.contains('hidden') ||
      !this.el.end.classList.contains('hidden') || !this.el.main.classList.contains('hidden');
  }

  showMain() { this.el.main.classList.remove('hidden'); }
  hideMain() { this.el.main.classList.add('hidden'); }
  showPause() { this.el.pause.classList.remove('hidden'); }
  hidePause() { this.el.pause.classList.add('hidden'); }
  showEnd(title, sub, statsHtml, win) {
    this.el.endTitle.textContent = title;
    this.el.endTitle.className = win ? 'win' : 'lose';
    this.el.endSub.textContent = sub;
    this.el.endStats.innerHTML = statsHtml;
    this.el.end.classList.remove('hidden');
  }
  hideEnd() { this.el.end.classList.add('hidden'); }

  openBuy() {
    this.buyOpen = true;
    this.el.buy.classList.remove('hidden');
    this._renderBuy();
    this.game.input.exitLock();
  }

  closeBuy() {
    this.buyOpen = false;
    this.el.buy.classList.add('hidden');
    this.game.input.requestLock(this.game.engine.renderer.domElement);
  }

  _renderBuy() {
    const p = this.game.player;
    this.el.buyMoney.textContent = `$${p.money}`;
    this.el.buyTimer.textContent = `購買時間 ${Math.max(0, Math.ceil(this.game.buyTimeLeft))}s`;
    this.el.buyItems.innerHTML = '';
    for (const item of BUY_LIST) {
      const def = item.defKey === 'armor' ? { name: '防彈衣' } : WEAPONS[item.defKey];
      const div = document.createElement('div');
      div.className = 'buy-item';
      const owned = item.defKey === 'armor' ? p.armor >= 100 :
        item.defKey === 'helmet' ? !!p.helmet :
        (item.slot === 'grenade' ? !!(p.loadout.grenades[NADE_BY_DEFKEY[item.defKey]]) :
          p.loadout[item.slot] && p.loadout[item.slot].key === item.defKey);
      const cant = p.money < item.price || owned ||
        (item.defKey === 'helmet' && p.armor < 100);
      if (cant) div.classList.add('cant');
      if (owned) div.classList.add('owned');
      div.innerHTML = `<span>${def.name}</span><span class="price">${owned ? '已擁有' : '$' + item.price}</span>`;
      div.addEventListener('click', () => {
        if (this.game.buy(item.defKey)) this._renderBuy();
      });
      this.el.buyItems.appendChild(div);
    }
  }

  refreshBuy() { if (this.buyOpen) this._renderBuy(); }
}
