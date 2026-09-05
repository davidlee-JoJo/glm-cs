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

  for (const key of ['dust', 'inferno', 'nuke', 'snow', 'fortress', 'harbor', 'city']) {
    const info = await page.evaluate((k) => {
      const g = window.__glmcs_game;
      g.startMatch({ mode: 'bomb', difficulty: 'normal', ctBots: 2, tBots: 3, map: k, sens: 1 });
      return {
        mapKey: g.mapKey,
        name: g.map.def.name,
        bg: g.engine.scene.background.getHex(),
        solids: g.physics.solids.length,
        ceilings: g.physics.solids.filter((s) => s.tag === 'ceiling').length,
        elevs: g.physics.solids.filter((s) => s.tag === 'elev').length,
        fogFar: g.engine.scene.fog.far
      };
    }, key);
    await new Promise((r) => setTimeout(r, 3000));
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
    console.log(`[${ok ? 'OK' : 'FAIL'}] ${key} (${info.name}) bg=0x${info.bg.toString(16)} fog=${info.fogFar} solids=${info.solids} 室內=${info.ceilings} 高台=${info.elevs} alive=${live.alive} noFall=${live.noFall} sites=${live.siteOk}`);
  }

  const counts = await page.evaluate(() => {
    const g = window.__glmcs_game;
    const out = [];
    for (const [ct, t] of [[0, 1], [2, 3], [5, 8]]) {
      g.startMatch({ mode: 'elim', difficulty: 'normal', ctBots: ct, tBots: t, map: 'dust', sens: 1 });
      const cb = g.bots.filter((b) => b.team === 'CT').length;
      const tb = g.bots.filter((b) => b.team === 'T').length;
      out.push(`隊友${ct}+敵人${t}: 實際 CT bot=${cb} T bot=${tb} 總人數=${g.players.length} ${cb === ct && tb === t ? 'OK' : '***FAIL***'}`);
    }
    return out.join('\n');
  });
  if (counts.includes('FAIL')) fail = true;
  console.log(counts);

  const menuBtns = await page.evaluate(() => {
    document.querySelector('#enemies-row .opt-btn[data-v="6"]').click();
    document.querySelector('#mates-row .opt-btn[data-v="4"]').click();
    return { e: document.querySelector('#enemies-row .opt-btn.selected').dataset.v, m: document.querySelector('#mates-row .opt-btn.selected').dataset.v };
  });
  const viaMenu = await page.evaluate(() => {
    const g = window.__glmcs_game;
    g.startMatch(window.__glmcs_menu_cfg || g.menu.config);
    return { ct: g.bots.filter((b) => b.team === 'CT').length, t: g.bots.filter((b) => b.team === 'T').length };
  });
  const menuOk = menuBtns.e === '6' && menuBtns.m === '4' && viaMenu.ct === 4 && viaMenu.t === 6;
  if (!menuOk) fail = true;
  console.log(`[${menuOk ? 'OK' : 'FAIL'}] 選單點選 隊友4/敵人6 → 實際 CT bot=${viaMenu.ct} T bot=${viaMenu.t}`);

  const cityPatrol = await page.evaluate(() => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'bomb', difficulty: 'normal', ctBots: 4, tBots: 6, map: 'city', sens: 1 });
    g._t0 = g.players.map((p) => ({ x: p.body.pos.x, z: p.body.pos.z }));
    return g.players.length;
  });
  await new Promise((r) => setTimeout(r, 9000));
  const cityLive = await page.evaluate(() => {
    const g = window.__glmcs_game;
    return g.players.map((p, i) => ({
      team: p.team, alive: p.alive,
      move: Math.hypot(p.body.pos.x - g._t0[i].x, p.body.pos.z - g._t0[i].z).toFixed(1),
      feet: p.body.feetY.toFixed(2)
    }));
  });
  const bots = cityLive.slice(1);
  const cityOk = bots.every((b) => b.alive && parseFloat(b.move) > 1 && parseFloat(b.feet) > -0.5);
  if (!cityOk) fail = true;
  console.log(`[${cityOk ? 'OK' : 'FAIL'}] 都市巷戰 11 人混戰 9 秒: ${JSON.stringify(bots)}`);

  const climb = await page.evaluate(() => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', ctBots: 2, tBots: 2, map: 'fortress', sens: 1 });
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
    return maxFeet.toFixed(2);
  });
  const climbOk = parseFloat(climb) > 1.9;
  if (!climbOk) fail = true;
  console.log(`[${climbOk ? 'OK' : 'FAIL'}] 要塞樓梯攀爬: 最高 feetY=${climb} (平台 2.0)`);

  console.log(`頁面錯誤: ${errors.length ? errors.join(' | ') : '無'}`);
  if (errors.length) fail = true;
  console.log(fail ? 'E2E FAIL' : 'E2E ALL PASS');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('RUNNER FAIL:', e.message); process.exit(1); });
