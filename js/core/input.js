export class Input {
  constructor(canvas, hooks = {}) {
    this.keys = new Set();
    this.dx = 0; this.dy = 0;
    this.wheel = 0;
    this.lmb = false; this.rmb = false;
    this.locked = false;
    this.hooks = hooks;
    this.sens = 1;
    this.enabled = false;

    const prevent = ['Tab', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9'];
    document.addEventListener('keydown', (e) => {
      if (prevent.includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.hooks.onKeyDown && this.hooks.onKeyDown(e.code, e);
    });
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.hooks.onKeyUp && this.hooks.onKeyUp(e.code, e);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.lmb = this.rmb = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX * this.sens;
      this.dy += e.movementY * this.sens;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) this.lmb = true;
      if (e.button === 2) this.rmb = true;
      if (!this.locked) canvas.requestPointerLock();
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.lmb = false;
      if (e.button === 2) this.rmb = false;
    });
    document.addEventListener('wheel', (e) => {
      if (this.locked) this.wheel += e.deltaY;
    }, { passive: true });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.hooks.onLockChange && this.hooks.onLockChange(this.locked);
    });
  }

  requestLock(canvas) {
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* lock unavailable */ }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  consumeMouse() {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = this.dy = 0;
    return d;
  }
  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
  down(code) { return this.keys.has(code); }
  clearButtons() { this.lmb = this.rmb = false; }
}
