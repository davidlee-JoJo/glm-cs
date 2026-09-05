const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8137/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await page.evaluate(() => !!window.__glmcs_game)) break;
  }

  const maps = ['dust', 'inferno', 'nuke', 'snow'];
  for (const key of maps) {
    const info = await page.evaluate((k) => {
      const g = window.__glmcs_game;
      g.startMatch({ mode: 'bomb', difficulty: 'normal', botsPerSide: 3, map: k, sens: 1 });
      return {
        mapKey: g.mapKey,
        name: g.map.def.name,
        theme: g.map.def.theme,
        solids: g.physics.solids.length,
        bg: g.engine.scene.background.getHex(),
        players: g.players.length,
        bomb: g.bomb && g.bomb.state
      };
    }, key);
    await new Promise((r) => setTimeout(r, 4000));
    const live = await page.evaluate((k) => {
      const g = window.__glmcs_game;
      const feet = g.players.map((p) => p.body.pos.y.toFixed(2));
      const allOk = g.players.every((p) => p.body.pos.y > -0.5);
      const siteOk = ['siteA', 'siteB'].every((s) => {
        const c = g.map[s].center, cell = g.map.worldToCell(c.x, c.z);
        return g.map.walkable(cell.col, cell.row);
      });
      const spawnsOk = [...g.map.spawnT, ...g.map.spawnCT].every((p) => {
        const cell = g.map.worldToCell(p.x, p.z);
        return g.map.walkable(cell.col, cell.row);
      });
      return { feet, allOk, siteOk, spawnsOk, alive: g.players.filter((p) => p.alive).length };
    }, key);
    console.log(`[${key}] ${info.name} theme=${info.theme} bg=0x${info.bg.toString(16)} solids=${info.solids} players=${info.players} bomb=${info.bomb}`);
    console.log(`  4秒後: feet=[${live.feet.join(',')}] noFall=${live.allOk} alive=${live.alive} sitesOnFloor=${live.siteOk} spawnsValid=${live.spawnsOk}`);
  }

  const finalKey = await page.evaluate(() => window.__glmcs_game.mapKey);
  console.log(`最終地圖: ${finalKey}`);
  console.log(`頁面錯誤: ${errors.length ? errors.join(' | ') : '無'}`);
  const pass = errors.length === 0;
  console.log(pass ? 'E2E PASS' : 'E2E FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('RUNNER FAIL:', e.message); process.exit(1); });
