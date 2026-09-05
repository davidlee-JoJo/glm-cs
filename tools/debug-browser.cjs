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

  const buyRes = await page.evaluate(() => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', ctBots: 1, tBots: 1, map: 'dust', sens: 1 });
    g.player.money = 16000;
    const r = {};
    r.he = g.buy('hegrenade');
    r.smoke = g.buy('smoke');
    r.flash = g.buy('flash');
    r.molotov = g.buy('molotov');
    r.dupeSmoke = g.buy('smoke');
    r.keys = Object.keys(g.player.loadout.grenades).filter((k) => g.player.loadout.grenades[k]).sort().join(',');
    return r;
  });
  const buyOk = buyRes.he && buyRes.smoke && buyRes.flash && buyRes.molotov && !buyRes.dupeSmoke &&
    buyRes.keys === 'flash,he,molotov,smoke';
  if (!buyOk) fail = true;
  console.log(`[${buyOk ? 'OK' : 'FAIL'}] 購買4種手雷 dupe拒絕=${!buyRes.dupeSmoke} keys=${buyRes.keys}`);

  const nadeA = await page.evaluate(async () => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', ctBots: 0, tBots: 1, map: 'dust', sens: 1 });
    g.debug.god = true;
    const V3 = g.player.body.pos.constructor;
    const dir = new V3(0, -0.3, -1).normalize();
    const out = { smokes: 0, blocked: null, expired: false, blindMax: 0, fired: false, fireDmg: 0, fireClean: false };
    const bot = g.bots[0];
    const fp = bot.body.pos.clone(); fp.y = 0.1;
    const hp0 = bot.health;
    g.molotovExplode({ pos: fp, owner: null });
    out.fired = g.fires.length === 1;
    await new Promise((r) => setTimeout(r, 1600));
    out.fireDmg = hp0 - bot.health;
    g.player.blindT = 0;
    g.throwGrenade(g.player, g.player.eyePos(), dir, 'flash');
    const t2 = performance.now();
    while (performance.now() - t2 < 3500) {
      out.blindMax = Math.max(out.blindMax, g.player.blindT);
      if (out.blindMax > 1) break;
      await new Promise((r) => setTimeout(r, 80));
    }
    const eye = g.player.eyePos();
    g.throwGrenade(g.player, eye, dir, 'smoke');
    const t0 = performance.now();
    while (performance.now() - t0 < 4000 && g.physics.smokes.length === 0) await new Promise((r) => setTimeout(r, 100));
    out.smokes = g.physics.smokes.length;
    if (g.physics.smokes.length) {
      const s = g.physics.smokes[0];
      const hx = s.pos.x - eye.x, hz = s.pos.z - eye.z;
      const L = Math.hypot(hx, hz) || 1;
      const a = new V3(s.pos.x - (hx / L) * 8, 1.2, s.pos.z - (hz / L) * 8);
      const b = new V3(s.pos.x + (hx / L) * 8, 1.2, s.pos.z + (hz / L) * 8);
      out.blocked = !g.physics.losClear(a, b);
    }
    const t3 = performance.now();
    while (performance.now() - t3 < 16000 && (g.fires.length > 0 || g.physics.smokes.length > 0)) {
      await new Promise((r) => setTimeout(r, 250));
    }
    out.fireClean = g.fires.length === 0;
    out.expired = g.physics.smokes.length === 0;
    return out;
  });
  const nadeOk = nadeA.smokes === 1 && nadeA.blocked && nadeA.expired && nadeA.blindMax > 1 &&
    nadeA.fired && nadeA.fireDmg > 0 && nadeA.fireClean;
  if (!nadeOk) fail = true;
  console.log(`[${nadeOk ? 'OK' : 'FAIL'}] 煙/閃/火: smokes=${nadeA.smokes} 遮蔽=${nadeA.blocked} 過期=${nadeA.expired} 致盲=${nadeA.blindMax.toFixed(1)}s 火區=${nadeA.fired} 燒傷=${nadeA.fireDmg} 熄滅=${nadeA.fireClean}`);

  const botHe = await page.evaluate(async () => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', ctBots: 0, tBots: 1, map: 'dust', sens: 1 });
    g.debug.god = true;
    const bot = g.bots[0];
    bot.loadout.grenades.he = new g.weaponNS.WeaponInst('hegrenade');
    bot.loadout.grenades.he.mag = 1;
    const p = g.player.body.pos;
    bot.body.pos.set(p.x + 6, p.y, p.z + 6);
    bot.target = g.player;
    bot._enter('engage');
    bot.nadeCd = 0;
    bot.reactionT = 0;
    const t0 = performance.now();
    let thrown = false;
    while (performance.now() - t0 < 8000) {
      if (!bot.loadout.grenades.he) { thrown = true; break; }
      await new Promise((r) => setTimeout(r, 100));
    }
    return { thrown, alive: bot.alive };
  });
  const heOk = botHe.thrown;
  if (!heOk) fail = true;
  console.log(`[${heOk ? 'OK' : 'FAIL'}] 機器人交戰丟HE: thrown=${botHe.thrown} bot存活=${botHe.alive}`);

  const botFlash = await page.evaluate(async () => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', ctBots: 1, tBots: 0, map: 'dust', sens: 1 });
    g.debug.god = true;
    const bot = g.bots[0];
    bot.loadout.grenades.flash = new g.weaponNS.WeaponInst('flash');
    bot.loadout.grenades.flash.mag = 1;
    const p = g.player.body.pos;
    const L = Math.hypot(p.x, p.z) || 1;
    bot.body.pos.set(p.x - (p.x / L) * 14, p.y, p.z - (p.z / L) * 14);
    bot._enter('seek');
    bot.alertPos = p.clone();
    bot.nadeCd = 0;
    const t0 = performance.now();
    let thrown = false, blinded = false;
    while (performance.now() - t0 < 8000) {
      if (!bot.loadout.grenades.flash) thrown = true;
      if (g.player.blindT > 1) { blinded = true; break; }
      await new Promise((r) => setTimeout(r, 100));
    }
    return { thrown, blinded, blind: g.player.blindT.toFixed(2) };
  });
  const bfOk = botFlash.thrown && botFlash.blinded;
  if (!bfOk) fail = true;
  console.log(`[${bfOk ? 'OK' : 'FAIL'}] 機器人推進前丟閃光: thrown=${botFlash.thrown} 玩家被致盲=${botFlash.blinded} (${botFlash.blind}s)`);

  const weapons2 = await page.evaluate(() => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', ctBots: 0, tBots: 1, map: 'dust', sens: 1 });
    g.debug.god = true;
    const p = g.player;
    p.money = 16000;
    const r = {};
    r.mp5 = g.buy('mp5');
    r.mp5Key = p.loadout.primary ? p.loadout.primary.key : null;
    r.m3 = g.buy('m3');
    r.m3Key = p.loadout.primary ? p.loadout.primary.key : null;
    r.helmetNoArmor = g.buy('helmet');
    r.armor = g.buy('armor');
    r.helmet = g.buy('helmet');
    r.spent = 16000 - p.money;
    const bot = g.bots[0];
    bot.body.pos.set(p.body.pos.x + 1.4, p.body.pos.y, p.body.pos.z + 1.4);
    bot.armor = 0; bot.helmet = true; bot.health = 500;
    p.loadout.secondary = new g.weaponNS.WeaponInst('usp');
    p._equip(2);
    let origin = p.eyePos();
    let dir = bot.eyePos().clone().sub(origin).normalize();
    g.weaponNS.fireWeapon(g, p, p.cur, origin, dir);
    r.hsHelmet = 500 - bot.health;
    bot.helmet = false; bot.health = 500;
    p.cur.cd = 0;
    origin = p.eyePos();
    dir = bot.eyePos().clone().sub(origin).normalize();
    g.weaponNS.fireWeapon(g, p, p.cur, origin, dir);
    r.hsNoHelmet = 500 - bot.health;
    p.loadout.primary = new g.weaponNS.WeaponInst('m3');
    p._equip(1);
    bot.helmet = false; bot.health = 500; bot.armor = 0;
    origin = p.eyePos();
    dir = bot.eyePos().clone().sub(origin).normalize();
    g.weaponNS.fireWeapon(g, p, p.cur, origin, dir);
    r.sgDmg = 500 - bot.health;
    bot.health = 100; bot.armor = 0; bot.helmet = false;
    p.cur.cd = 0;
    origin = p.eyePos();
    dir = bot.body.pos.clone().sub(origin).normalize();
    g.weaponNS.fireWeapon(g, p, p.cur, origin, dir);
    r.sgKill = !bot.alive;
    bot.money = 5000; bot.armor = 0; bot.helmet = false; bot.loadout.primary = null;
    g.roundNum = 3;
    g.botBuy(bot);
    r.botArmor = bot.armor;
    r.botHelmet = bot.helmet;
    r.botGun = bot.loadout.primary ? bot.loadout.primary.key : 'none';
    return r;
  });
  const w2Ok = weapons2.mp5 && weapons2.mp5Key === 'mp5' && weapons2.m3 && weapons2.m3Key === 'm3' &&
    !weapons2.helmetNoArmor && weapons2.armor && weapons2.helmet && weapons2.spent === 4050 &&
    weapons2.hsHelmet === 60 && weapons2.hsNoHelmet === 120 && weapons2.sgDmg > 60 && weapons2.sgKill &&
    weapons2.botArmor === 100 && weapons2.botHelmet;
  if (!w2Ok) fail = true;
  console.log(`[${w2Ok ? 'OK' : 'FAIL'}] MP5/M3/頭盔: spent=$${weapons2.spent} 頭盔爆頭${weapons2.hsHelmet}/無盔${weapons2.hsNoHelmet} 霰彈=${weapons2.sgDmg} 3m一擊必殺=${weapons2.sgKill} bot盔=${weapons2.botHelmet}/${weapons2.botGun}`);

  const buyUi = await page.evaluate(() => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', ctBots: 0, tBots: 1, map: 'dust', sens: 1 });
    g.player.money = 5000;
    g.menu.openBuy();
    return {
      items: document.querySelectorAll('#buy-items .buy-item').length,
      unlocked: !g.input.locked && document.pointerLockElement === null
    };
  });
  const moneyBefore = await page.evaluate(() => window.__glmcs_game.player.money);
  await page.click('#buy-items [data-key="smoke"]');
  await new Promise((r) => setTimeout(r, 300));
  const buyUi2 = await page.evaluate(() => {
    const g = window.__glmcs_game;
    const smokeItem = document.querySelector('#buy-items [data-key="smoke"]');
    return {
      money: g.player.money,
      owned: smokeItem.classList.contains('owned'),
      unlockedNow: !g.input.locked && document.pointerLockElement === null,
      noFatal: !document.getElementById('msg-title').textContent.includes('發生錯誤')
    };
  });
  const buyUiOk = buyUi.items === 12 && buyUi2.unlockedNow && buyUi2.money === moneyBefore - 300 && buyUi2.owned && buyUi2.noFatal;
  if (!buyUiOk) fail = true;
  console.log(`[${buyUiOk ? 'OK' : 'FAIL'}] 購買選單互動: 項目=${buyUi.items} 解除鎖定=${buyUi2.unlockedNow} 點擊購買=${moneyBefore}→${buyUi2.money} 已擁有=${buyUi2.owned}`);

  const dmTest = await page.evaluate(async () => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'dm', difficulty: 'normal', ctBots: 2, tBots: 2, map: 'dust', sens: 1 });
    g.debug.god = true;
    const r = {};
    r.mode = g.config.mode;
    r.bombIdle = g.bomb.state === 'idle';
    r.playerMoney = g.player.money;
    r.roundTime = g.roundTime;
    g.buyTimeLeft = 0;
    r.buyAnytime = g.canBuy();
    const bot = g.bots[0];
    const deathPos = bot.body.pos.clone();
    g.player.kills = 0;
    g.onKill(g.player, bot, g.weaponNS.WEAPONS.usp, false);
    r.killCounted = g.player.kills === 1;
    r.respawnScheduled = bot.respawnT === 3 && !bot.alive;
    const t0 = performance.now();
    while (performance.now() - t0 < 9000 && !bot.alive) await new Promise((res) => setTimeout(res, 200));
    r.botRespawned = bot.alive;
    r.movedAway = bot.body.pos.distanceTo(deathPos) > 5;
    r.protected = bot.protT > g.time;
    const hp = g.player.health;
    g.player.protT = g.time + 2;
    g.applyHit(g.player, 50, bot, false, g.weaponNS.WEAPONS.usp, g.player.body.pos.clone());
    r.protBlocks = g.player.health === hp;
    g.player.protT = 0;
    g.player.kills = 24;
    g.onKill(g.player, g.bots[1], g.weaponNS.WEAPONS.usp, false);
    r.matchEnded = g.state === 'matchEnd';
    return r;
  });
  const dmOk = dmTest.mode === 'dm' && dmTest.bombIdle && dmTest.playerMoney === 16000 &&
    dmTest.roundTime === 600 && dmTest.buyAnytime && dmTest.killCounted && dmTest.respawnScheduled &&
    dmTest.botRespawned && dmTest.movedAway && dmTest.protected && dmTest.protBlocks && dmTest.matchEnded;
  if (!dmOk) fail = true;
  console.log(`[${dmOk ? 'OK' : 'FAIL'}] 死鬥模式: 金錢=${dmTest.playerMoney} 隨時購買=${dmTest.buyAnytime} 擊殺計數=${dmTest.killCounted} 3s重生=${dmTest.botRespawned} 遠離屍位=${dmTest.movedAway} 保護=${dmTest.protected}/${dmTest.protBlocks} 25殺終局=${dmTest.matchEnded}`);

  const surv = await page.evaluate(async () => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'survival', difficulty: 'normal', ctBots: 1, tBots: 0, map: 'dust', sens: 1 });
    g.debug.god = true;
    const r = {};
    r.mode = g.config.mode;
    r.wave1Bots = g.bots.filter((b) => b.team === 'T').length;
    r.playerMoney = g.player.money;
    for (const b of g.bots.filter((x) => x.team === 'T')) {
      g.onKill(g.player, b, g.weaponNS.WEAPONS.usp, false);
    }
    const t0 = performance.now();
    while (performance.now() - t0 < 24000 && g.roundNum < 2) await new Promise((res) => setTimeout(res, 200));
    r.wave2 = g.roundNum === 2;
    r.wave2Bots = g.bots.filter((b) => b.team === 'T').length;
    r.teammateAlive = g.bots.filter((b) => b.team === 'CT').every((b) => b.alive);
    r.waveDiffHarder = g.bots.find((b) => b.team === 'T').diff.reaction <= g.config.diff.reaction;
    g.debug.god = false;
    g.onKill(g.bots.find((b) => b.team === 'T'), g.player, g.weaponNS.WEAPONS.usp, false);
    r.endedOnDeath = g.state === 'matchEnd';
    return r;
  });
  const survOk = surv.mode === 'survival' && surv.wave1Bots === 2 && surv.playerMoney === 2000 &&
    surv.wave2 && surv.wave2Bots === 3 && surv.teammateAlive && surv.waveDiffHarder && surv.endedOnDeath;
  if (!survOk) fail = true;
  console.log(`[${survOk ? 'OK' : 'FAIL'}] 生存模式: 首波=${surv.wave1Bots}敵 起始金=${surv.playerMoney} 第2波=${surv.wave2}(${surv.wave2Bots}敵) 隊友重生=${surv.teammateAlive} 難度遞增=${surv.waveDiffHarder} 陣亡終局=${surv.endedOnDeath}`);

  const b5 = await page.evaluate(async () => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'bomb', difficulty: 'normal', ctBots: 2, tBots: 2, map: 'dust', sens: 1 });
    g.debug.god = true;
    const r = {};
    const ct = g.bots.find((b) => b.team === 'CT');
    const t = g.bots.find((b) => b.team === 'T');
    const center = g.map.patrol[4] || g.map.patrol[0];
    ct.body.pos.set(center.x - 9, 0.95, center.z);
    t.body.pos.set(center.x + 9, 0.95, center.z);
    ct.yaw = Math.atan2(-(t.body.pos.x - ct.body.pos.x), -(t.body.pos.z - ct.body.pos.z));
    ct.targetYaw = ct.yaw;
    ct.radioCd = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 5000 && !(ct.state === 'engage' && ct.crouching)) {
      await new Promise((res) => setTimeout(res, 150));
    }
    r.engage = ct.state === 'engage';
    r.crouch = ct.crouching;
    r.radioSpot = [...document.getElementById('radio-feed').children].some((d) => d.textContent.includes('發現敵人'));
    for (let i = 0; i < 6; i++) g.hud.radioFeed('訊息' + i, 'CT');
    r.feedCap = document.getElementById('radio-feed').children.length <= 4;
    const ct2 = g.bots.filter((b) => b.team === 'CT' && b.alive && b !== ct)[0] || ct;
    ct2._campRolled = false;
    g.bomb.state = 'planted';
    g.bomb.pos.copy(g.map.siteA.center);
    ct2._pickPatrolGoal();
    r.campRolled = ct2._campRolled && typeof ct2.camp === 'boolean';
    ct2.camp = true;
    ct2.body.pos.set(g.bomb.pos.x + 6, 0.95, g.bomb.pos.z + 6);
    ct2.state = 'patrol';
    ct2.idleT = 0;
    const t1 = performance.now();
    while (performance.now() - t1 < 4000 && ct2.camp) await new Promise((res) => setTimeout(res, 100));
    r.campConsumed = !ct2.camp;
    return r;
  });
  const b5Ok = b5.engage && b5.crouch && b5.radioSpot && b5.feedCap && b5.campRolled && b5.campConsumed;
  if (!b5Ok) fail = true;
  console.log(`[${b5Ok ? 'OK' : 'FAIL'}] 無線電+蹲伏+埋伏: 交戰=${b5.engage} 遠距蹲射=${b5.crouch} 廣播=${b5.radioSpot} 訊息上限=${b5.feedCap} 埋伏骰=${b5.campRolled} 埋伏執行=${b5.campConsumed}`);

  const b6 = await page.evaluate(async () => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'elim', difficulty: 'normal', ctBots: 1, tBots: 3, map: 'dust', sens: 1 });
    g.debug.god = true;
    const r = {};
    const V3 = g.player.body.pos.constructor;
    const camPos = g.engine.camera.position;
    const fwd = new V3();
    g.engine.camera.getWorldDirection(fwd);
    const rightV = new V3(-fwd.z, 0, fwd.x).normalize();
    r.panRight = g.panFor(camPos.clone().addScaledVector(rightV, 6));
    r.panLeft = g.panFor(camPos.clone().addScaledVector(rightV, -6));
    r.panOk = r.panRight > 0.5 && r.panLeft < -0.5;
    const ts = g.bots.filter((b) => b.team === 'T' && b.alive);
    g.onKill(g.player, ts[0], g.weaponNS.WEAPONS.usp, false);
    g.onKill(g.player, ts[1], g.weaponNS.WEAPONS.usp, false);
    r.banner = document.getElementById('msg-title').textContent;
    r.streak = g.killStreak === 2;
    const killer = ts[2] || ts[0];
    g.debug.god = false;
    g.onKill(killer, g.player, g.weaponNS.WEAPONS.usp, false);
    r.dcam = g.deathCamT > 2 && !!g.deathCamTarget;
    const t0 = performance.now();
    while (performance.now() - t0 < 4000 && g.deathCamT > 0) await new Promise((res) => setTimeout(res, 150));
    r.dcamEnd = g.deathCamT <= 0;
    return r;
  });
  const b6Ok = b6.panOk && b6.streak && b6.banner.includes('雙殺') && b6.dcam && b6.dcamEnd;
  if (!b6Ok) fail = true;
  console.log(`[${b6Ok ? 'OK' : 'FAIL'}] 音效定位+連殺+死亡鏡頭: panR=${b6.panRight.toFixed(2)} panL=${b6.panLeft.toFixed(2)} 連殺=${b6.streak}(${b6.banner}) 死亡鏡頭=${b6.dcam}→結束=${b6.dcamEnd}`);

  const mmFix = await page.evaluate(async () => {
    const g = window.__glmcs_game;
    g.startMatch({ mode: 'survival', difficulty: 'normal', ctBots: 0, tBots: 0, map: 'dust', sens: 1 });
    g.debug.god = true;
    const r = {};
    for (const b of g.bots.filter((x) => x.team === 'T')) g.onKill(g.player, b, g.weaponNS.WEAPONS.usp, false);
    const t0 = performance.now();
    while (performance.now() - t0 < 24000 && g.roundNum < 2) await new Promise((res) => setTimeout(res, 200));
    r.wave2 = g.roundNum === 2;
    r.rosterSync = g.players.filter((p) => p.team === 'T').length === g.bots.filter((b) => b.team === 'T').length;
    const t1 = performance.now();
    while (performance.now() - t1 < 15000 && g.state !== 'live') await new Promise((res) => setTimeout(res, 200));
    await new Promise((res) => setTimeout(res, 2500));
    r.noAutoSkip = g.state === 'live' && g.roundNum === 2 && g.players.some((p) => p.team === 'T' && p.alive);
    const bot = g.bots.find((b) => b.team === 'T' && b.alive);
    const pe = g.player.eyePos();
    let spot = null;
    for (const pt of g.map.patrol) {
      if (Math.hypot(pt.x - pe.x, pt.z - pe.z) < 20) continue;
      bot.body.pos.set(pt.x, 0.95, pt.z);
      if (!g.physics.losClear(pe, bot.eyePos())) { spot = pt; break; }
    }
    r.occluded = !!spot;
    if (spot) {
      bot.state = 'patrol';
      bot.blindT = 99;
      bot.idleT = 999;
      bot.target = null;
      bot.alertPos = null;
      bot.path = null;
      bot.goal = null;
      await new Promise((res) => setTimeout(res, 500));
      const ctx2 = g.hud.el.minimap.getContext('2d');
      const isOrange = (d) => d[3] > 0 && d[0] > 130 && d[0] - d[2] > 60 && d[1] - d[2] > 20;
      const sample = (x, z) => {
        const xi = Math.max(0, Math.min(167, Math.round(g.hud._tx(x))));
        const zi = Math.max(0, Math.min(167, Math.round(g.hud._tz(z))));
        return ctx2.getImageData(xi, zi, 1, 1).data;
      };
      const d0 = sample(bot.body.pos.x, bot.body.pos.z);
      r.hiddenBefore = !isOrange(d0);
      r.diag0 = `a${d0[3]},rgb${d0[0]},${d0[1]},${d0[2]},visCache=${g.hud.visCache.get(bot)},shotDt=${(g.time - bot.lastShotT).toFixed(1)}`;
      bot.cur.cd = 0;
      const dir = new (g.player.body.pos.constructor)(pe.x - bot.body.pos.x, 0, pe.z - bot.body.pos.z).normalize();
      g.weaponNS.fireWeapon(g, bot, bot.cur, bot.eyePos(), dir);
      const shotX = bot.lastShotPos.x, shotZ = bot.lastShotPos.z;
      await new Promise((res) => setTimeout(res, 200));
      const d1 = sample(shotX, shotZ);
      r.heardDot = isOrange(d1);
      await new Promise((res) => setTimeout(res, 2200));
      const d2 = sample(shotX, shotZ);
      r.dotExpired = !isOrange(d2);
      r.diag2 = `a${d2[3]},rgb${d2[0]},${d2[1]},${d2[2]},shotDt=${(g.time - bot.lastShotT).toFixed(1)}`;
    }
    return r;
  });
  const mmOk = mmFix.wave2 && mmFix.rosterSync && mmFix.noAutoSkip && mmFix.occluded &&
    mmFix.hiddenBefore && mmFix.heardDot && mmFix.dotExpired;
  if (!mmOk) fail = true;
  console.log(`[${mmOk ? 'OK' : 'FAIL'}] 生存名單+小地圖: 第2波=${mmFix.wave2} 名單同步=${mmFix.rosterSync} 不自動跳波=${mmFix.noAutoSkip} 遮蔽=${mmFix.occluded} 隱藏敵無點=${mmFix.hiddenBefore} 槍聲亮點=${mmFix.heardDot} 1.5s消退=${mmFix.dotExpired}`);
  if (!mmOk) {
    console.log(`  diag0: ${mmFix.diag0}`);
    console.log(`  diag2: ${mmFix.diag2}`);
  }

  console.log(`頁面錯誤: ${errors.length ? errors.join(' | ') : '無'}`);
  if (errors.length) fail = true;
  console.log(fail ? 'E2E FAIL' : 'E2E ALL PASS');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('RUNNER FAIL:', e.message); process.exit(1); });
