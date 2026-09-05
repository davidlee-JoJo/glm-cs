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

  let fail = false;

  for (const key of ['dust', 'inferno', 'nuke', 'snow', 'fortress', 'harbor']) {
    const info = await page.evaluate((k) => {
      const g = window.__glmcs_game;
      g.startMatch({ mode: 'bomb', difficulty: 'normal', botsPerSide: 3, map: k, sens: 1 });
      return {
        mapKey: g.mapKey,
        name: g.map.def.name,
        bg: g.engine.scene.background.getHex(),
        solids: g.physics.solids.length,
        ceilings: g.physics.solids.filter((s) => s.tag === 'ceiling').length,
        elevs: g.physics.solids.filter((s) => s.tag === 'elev').length,
        fogFar: g.engine.scene.fog.far,
        hemi: g.engine.hemi.intensity.toFixed(2)
      };
    }, key);
    await new Promise((r) => setTimeout(r, 3500));
    const live = await page.evaluate(() => {
      const g = window.__glmcs_game;
      return {
        noFall: g.players.every((p) => p.body.feetY > -0.5),
        alive: g.players.filter((p) => p.alive).length,
        siteOk: ['siteA', 'siteB'].every((s) => {
          const c = g.map[s].center, cell = g.map.worldToCell(c.x, c.z);
          return g.map.walkable(cell.col, cell.row);
        })
      };
    });
    const ok = info.mapKey === key && live.noFall && live.siteOk && live.alive >= 4;
    if (!ok) fail = true;
    console.log(`[${ok ? 'OK' : 'FAIL'}] ${key} (${info.name}) bg=0x${info.bg.toString(16)} fog=${info.fogFar} hemi=${info.hemi} solids=${info.solids} 天花板=${info.ceilings} 高台=${info.elevs} alive=${live.alive} noFall=${live.noFall} sites=${live.siteOk}`);
  }

  const climb = await page.evaluate(() => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', botsPerSide: 2, map: 'fortress', sens: 1 });
    const ph = g.physics;
    const body = new g.physicsNS.Body(-43, 0.95, -26, 0.35, 0.9, 0.35);
    ph.addBody(body);
    let maxFeet = 0;
    for (let i = 0; i < 300; i++) {
      body.vel.x = 0; body.vel.z = 4;
      ph.step(1 / 60);
      maxFeet = Math.max(maxFeet, body.feetY);
    }
    ph.removeBody(body);
    return { max: maxFeet.toFixed(2) };
  });
  const climbOk = parseFloat(climb.max) > 1.9;
  if (!climbOk) fail = true;
  console.log(`[${climbOk ? 'OK' : 'FAIL'}] 要塞城牆樓梯攀爬: 最高 feetY=${climb.max} (平台 2.0)`);

  const climb2 = await page.evaluate(() => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', botsPerSide: 2, map: 'harbor', sens: 1 });
    const ph = g.physics;
    const body = new g.physicsNS.Body(-23, 0.95, -29, 0.35, 0.9, 0.35);
    ph.addBody(body);
    let maxFeet = 0;
    for (let i = 0; i < 300; i++) {
      body.vel.x = 0; body.vel.z = -4;
      ph.step(1 / 60);
      maxFeet = Math.max(maxFeet, body.feetY);
    }
    ph.removeBody(body);
    return { max: maxFeet.toFixed(2) };
  });
  const climb2Ok = parseFloat(climb2.max) > 1.9;
  if (!climb2Ok) fail = true;
  console.log(`[${climb2Ok ? 'OK' : 'FAIL'}] 港區碼頭樓梯攀爬: 最高 feetY=${climb2.max} (平台 2.0)`);

  console.log(`頁面錯誤: ${errors.length ? errors.join(' | ') : '無'}`);
  if (errors.length) fail = true;
  console.log(fail ? 'E2E FAIL' : 'E2E ALL PASS');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('RUNNER FAIL:', e.message); process.exit(1); });
