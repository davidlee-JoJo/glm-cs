import * as THREE from 'three';

export const WEAPONS = {
  knife: {
    key: 'knife', name: '小刀', kind: 'melee', dmg: 55, headMult: 1.6,
    rate: 0.5, range: 2.1, speedMul: 1.08, price: 0, sound: 'knife', killReward: 1500
  },
  usp: {
    key: 'usp', name: 'USP-S', kind: 'gun', dmg: 30, headMult: 4,
    rate: 0.16, mag: 12, reserve: 24, reload: 2.0, spread: 0.008, moveSpread: 0.02,
    recoilV: 0.014, recoilH: 0.006, auto: false, range: 120, speedMul: 1.0,
    price: 0, sound: 'pistol', killReward: 300
  },
  deagle: {
    key: 'deagle', name: 'Desert Eagle', kind: 'gun', dmg: 54, headMult: 4,
    rate: 0.34, mag: 7, reserve: 35, reload: 2.2, spread: 0.011, moveSpread: 0.032,
    recoilV: 0.032, recoilH: 0.011, auto: false, range: 140, speedMul: 0.98,
    price: 700, sound: 'pistol', killReward: 300
  },
  ak47: {
    key: 'ak47', name: 'AK-47', kind: 'gun', dmg: 36, headMult: 4,
    rate: 0.1, mag: 30, reserve: 90, reload: 2.4, spread: 0.007, moveSpread: 0.035,
    recoilV: 0.021, recoilH: 0.011, auto: true, range: 200, speedMul: 0.88,
    price: 2700, sound: 'rifle', killReward: 300
  },
  m4a4: {
    key: 'm4a4', name: 'M4A4', kind: 'gun', dmg: 33, headMult: 4,
    rate: 0.09, mag: 30, reserve: 90, reload: 3.0, spread: 0.006, moveSpread: 0.03,
    recoilV: 0.017, recoilH: 0.009, auto: true, range: 200, speedMul: 0.9,
    price: 3100, sound: 'rifle', killReward: 300
  },
  mp5: {
    key: 'mp5', name: 'MP5-SD', kind: 'gun', dmg: 26, headMult: 4,
    rate: 0.09, mag: 30, reserve: 120, reload: 2.4, spread: 0.012, moveSpread: 0.028,
    recoilV: 0.012, recoilH: 0.007, auto: true, range: 150, speedMul: 0.96,
    price: 1500, sound: 'smg', killReward: 300
  },
  m3: {
    key: 'm3', name: 'M3 霰彈槍', kind: 'gun', dmg: 17, headMult: 2, pellets: 8,
    rate: 0.95, mag: 8, reserve: 32, reload: 3.2, spread: 0.05, moveSpread: 0.07,
    recoilV: 0.045, recoilH: 0.012, auto: false, range: 45, speedMul: 0.92,
    price: 1200, sound: 'shotgun', killReward: 300
  },
  awp: {
    key: 'awp', name: 'AWP', kind: 'gun', dmg: 115, headMult: 2,
    rate: 1.4, mag: 5, reserve: 30, reload: 3.6, spread: 0.0015, moveSpread: 0.08,
    recoilV: 0.05, recoilH: 0.012, auto: false, range: 300, speedMul: 0.78,
    price: 4750, sound: 'awp', killReward: 100, scope: true
  },
  hegrenade: {
    key: 'hegrenade', name: '手榴彈', kind: 'grenade', dmg: 90, radius: 9,
    fuse: 1.7, speedMul: 1.05, price: 300, killReward: 300, vmColor: 0x3a4a2e
  },
  smoke: {
    key: 'smoke', name: '煙霧彈', kind: 'grenade', fuse: 1.6,
    speedMul: 1.0, price: 300, killReward: 300, vmColor: 0x6a7a72
  },
  flash: {
    key: 'flash', name: '閃光彈', kind: 'grenade', fuse: 1.4,
    speedMul: 1.08, price: 200, killReward: 300, vmColor: 0xb8bcc0
  },
  molotov: {
    key: 'molotov', name: '燃燒彈', kind: 'grenade', fuse: 9,
    speedMul: 1.0, price: 600, killReward: 300, vmColor: 0x8a4a20
  }
};

export const GRENADE_TYPES = ['he', 'smoke', 'flash', 'molotov'];
export const NADE_BY_DEFKEY = { hegrenade: 'he', smoke: 'smoke', flash: 'flash', molotov: 'molotov' };
export const DEF_BY_NADE = { he: 'hegrenade', smoke: 'smoke', flash: 'flash', molotov: 'molotov' };

export const BUY_LIST = [
  { defKey: 'deagle', slot: 'secondary', price: 700 },
  { defKey: 'mp5', slot: 'primary', price: 1500 },
  { defKey: 'm3', slot: 'primary', price: 1200 },
  { defKey: 'ak47', slot: 'primary', price: 2700 },
  { defKey: 'm4a4', slot: 'primary', price: 3100 },
  { defKey: 'awp', slot: 'primary', price: 4750 },
  { defKey: 'hegrenade', slot: 'grenade', price: 300 },
  { defKey: 'smoke', slot: 'grenade', price: 300 },
  { defKey: 'flash', slot: 'grenade', price: 200 },
  { defKey: 'molotov', slot: 'grenade', price: 600 },
  { defKey: 'armor', slot: 'gear', price: 1000 },
  { defKey: 'helmet', slot: 'gear', price: 350 }
];

export class WeaponInst {
  constructor(key) {
    this.key = key;
    this.def = WEAPONS[key];
    this.mag = this.def.mag || 0;
    this.reserve = this.def.reserve || 0;
    this.cd = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.burst = 0;
  }
  refill() {
    this.mag = this.def.mag || 0;
    this.reserve = this.def.reserve || 0;
    this.reloading = false;
    this.reloadT = 0;
    this.cd = 0;
  }
}

export function makeLoadout() {
  return {
    primary: null,
    secondary: new WeaponInst('usp'),
    knife: new WeaponInst('knife'),
    grenades: { he: null, smoke: null, flash: null, molotov: null }
  };
}

export function ownedNades(loadout) {
  return GRENADE_TYPES.filter((t) => loadout.grenades[t]);
}

export function currentSpread(shooter, def) {
  const b = shooter.body;
  const sp = Math.hypot(b.vel.x, b.vel.z);
  let s = def.spread || 0;
  s += (sp / 4.8) * (def.moveSpread || 0);
  if (!b.onGround) s += 0.06;
  if (shooter.crouching) s *= 0.65;
  if (def.scope && shooter.scoped === false) s += 0.055;
  return s;
}

function jitterDir(dir, spread) {
  const d = dir.clone();
  if (spread <= 0) return d;
  const up = Math.abs(d.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(d, up).normalize();
  const trueUp = new THREE.Vector3().crossVectors(right, d).normalize();
  const ang = Math.random() * Math.PI * 2;
  const rad = spread * Math.sqrt(Math.random());
  d.addScaledVector(right, Math.cos(ang) * rad).addScaledVector(trueUp, Math.sin(ang) * rad);
  return d.normalize();
}

export function startReload(inst) {
  const def = inst.def;
  if (def.kind !== 'gun' || inst.reloading) return false;
  if (inst.mag >= def.mag || inst.reserve <= 0) return false;
  inst.reloading = true;
  inst.reloadT = def.reload;
  return true;
}

export function updateWeapon(inst, dt) {
  if (inst.cd > 0) inst.cd -= dt;
  if (inst.reloading) {
    inst.reloadT -= dt;
    if (inst.reloadT <= 0) {
      const need = inst.def.mag - inst.mag;
      const take = Math.min(need, inst.reserve);
      inst.mag += take;
      inst.reserve -= take;
      inst.reloading = false;
    }
  }
}

export function fireWeapon(game, shooter, inst, origin, dir, opts = {}) {
  const def = inst.def;
  if (inst.cd > 0 || inst.reloading) return null;
  shooter.protT = 0;

  if (def.kind === 'melee') {
    inst.cd = def.rate;
    game.audio.shot('knife', game.distToPlayer(origin), game.panFor(origin));
    const hit = game.physics.raycast(origin, dir, def.range, { skipBody: shooter.body });
    if (hit && hit.type === 'body') {
      const victim = hit.body.owner;
      game.applyHit(victim, def.dmg, shooter, hit.headshot, def, hit.point);
      return { hit: true, headshot: hit.headshot };
    }
    return { hit: false };
  }

  if (def.kind === 'grenade') {
    inst.cd = def.rate || 1;
    return { hit: false, thrown: true };
  }

  if (inst.mag <= 0) {
    inst.cd = 0.25;
    if (shooter.isBot) startReload(inst);
    else game.audio.empty();
    return null;
  }

  inst.mag--;
  inst.cd = def.rate;

  const spread = (opts.spread !== undefined ? opts.spread : currentSpread(shooter, def)) + (opts.extraSpread || 0);
  const muzzle = origin.clone().addScaledVector(dir, 0.5);
  let hitAny = false, hsAny = false;

  if (def.pellets) {
    for (let i = 0; i < def.pellets; i++) {
      const sd = jitterDir(dir, spread);
      const h = game.physics.raycast(origin, sd, def.range, { skipBody: shooter.body });
      if (h) {
        game.fx.tracer(muzzle, h.point);
        if (h.type === 'body') {
          const falloff = h.dist <= 3.5 ? 1 : Math.max(0.2, 1 - (h.dist - 3.5) * 0.05);
          let dmg = def.dmg * falloff;
          if (h.headshot) dmg *= h.body.owner && h.body.owner.helmet ? Math.min(2, def.headMult) : def.headMult;
          game.applyHit(h.body.owner, dmg, shooter, h.headshot, def, h.point);
          hitAny = true;
          if (h.headshot) hsAny = true;
        } else game.fx.impact(h.point, h.normal);
      } else {
        game.fx.tracer(muzzle, origin.clone().addScaledVector(sd, def.range));
      }
    }
  } else {
    const shootDir = jitterDir(dir, spread);
    const hit = game.physics.raycast(origin, shootDir, def.range, { skipBody: shooter.body });
    if (hit) {
      game.fx.tracer(muzzle, hit.point);
      if (hit.type === 'body') {
        const victim = hit.body.owner;
        const falloff = Math.max(0.7, 1 - hit.dist * 0.002);
        let dmg = def.dmg * falloff;
        if (hit.headshot) dmg *= victim.helmet ? Math.min(2, def.headMult) : def.headMult;
        game.applyHit(victim, dmg, shooter, hit.headshot, def, hit.point);
        hitAny = true;
        hsAny = hit.headshot;
      } else {
        game.fx.impact(hit.point, hit.normal);
      }
    } else {
      game.fx.tracer(muzzle, origin.clone().addScaledVector(shootDir, def.range));
    }
  }

  game.audio.shot(def.sound, game.distToPlayer(origin), game.panFor(origin));
  game.alertBots(origin, shooter);
  shooter.lastShotT = game.time;
  shooter.lastShotPos = origin.clone();
  return { hit: hitAny, headshot: hsAny };
}
