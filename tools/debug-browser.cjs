const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
  await page.goto('http://localhost:8137/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await page.evaluate(() => !!window.__glmcs_game)) break;
  }

  await page.evaluate(() => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', botsPerSide: 1, sens: 1 });
    g.state = 'live';
    g.debug.god = true;
    const p = g.player;
    p.body.pos.set(0, 0.95, 0);
    p.body.vel.set(0, 0, 0);
  });

  const testMove = async (key, yaw, label, expect) => {
    await page.evaluate((y) => {
      const g = window.__glmcs_game;
      g.player.yaw = y;
      g.player.body.pos.set(0, 0.95, 0);
      g.player.body.vel.set(0, 0, 0);
    }, yaw);
    await page.keyboard.down(key);
    await new Promise((r) => setTimeout(r, 600));
    const res = await page.evaluate((k) => {
      const g = window.__glmcs_game;
      const dx = g.player.body.pos.x, dz = g.player.body.pos.z;
      return { dx: +dx.toFixed(2), dz: +dz.toFixed(2) };
    }, key);
    await page.keyboard.up(key);
    await new Promise((r) => setTimeout(r, 100));
    const ok = expect(res);
    console.log(`${label}: moved (${res.dx}, ${res.dz}) ${ok ? 'PASS' : '*** FAIL ***'}`);
  };

  await testMove('KeyW', 0, 'W @ yaw=0 (面向-Z) 應往-Z', (r) => r.dz < -0.5 && Math.abs(r.dx) < 0.5);
  await testMove('KeyS', 0, 'S @ yaw=0 (面向-Z) 應往+Z', (r) => r.dz > 0.5 && Math.abs(r.dx) < 0.5);
  await testMove('KeyD', 0, 'D @ yaw=0 (面向-Z) 應往+X', (r) => r.dx > 0.5 && Math.abs(r.dz) < 0.5);
  await testMove('KeyA', 0, 'A @ yaw=0 (面向-Z) 應往-X', (r) => r.dx < -0.5 && Math.abs(r.dz) < 0.5);
  await testMove('KeyW', -Math.PI / 2, 'W @ yaw=-90° (面向+X) 應往+X', (r) => r.dx > 0.5 && Math.abs(r.dz) < 0.5);
  await testMove('KeyW', Math.PI, 'W @ yaw=180° (面向+Z) 應往+Z', (r) => r.dz > 0.5 && Math.abs(r.dx) < 0.5);

  await browser.close();
})().catch((e) => { console.error('RUNNER FAIL:', e.message); process.exit(1); });
