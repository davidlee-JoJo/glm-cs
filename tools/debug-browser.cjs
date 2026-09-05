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

  const result = await page.evaluate(() => {
    const g = window.__glmcs_game;
    const out = [];
    for (const n of [1, 2, 3, 4]) {
      g.startMatch({ mode: 'elim', difficulty: 'normal', botsPerSide: n, sens: 1 });
      const ct = g.players.filter((p) => p.team === 'CT').length;
      const t = g.players.filter((p) => p.team === 'T').length;
      const ctBots = g.bots.filter((b) => b.team === 'CT').length;
      out.push(`botsPerSide=${n}: CT=${ct}(玩家+${ctBots}bot) T=${t} ${ct === t ? 'OK' : '*** 不相等 ***'}`);
    }
    return out.join('\n');
  });
  console.log(result);
  await browser.close();
})().catch((e) => { console.error('RUNNER FAIL:', e.message); process.exit(1); });
