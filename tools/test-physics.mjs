import * as THREE from 'three';
import { PhysicsWorld, Body, AABB } from '../js/core/physics.js';

let pass = 0, fail = 0;
const ok = (cond, name) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.error(`  FAIL ${name}`); }
};

const world = new PhysicsWorld();
world.addSolid(0, -0.25, 0, 40, 0.5, 40, 'floor');
world.addSolid(0, 2, -6, 10, 4, 1, 'wall-north');
world.addSolid(6, 2, 0, 1, 4, 10, 'wall-east');
world.addSolid(0, 0.65, 6, 1.8, 1.3, 1.8, 'crate');

console.log('--- gravity + ground rest ---');
const b = new Body(0, 3, 0, 0.35, 0.9, 0.35);
world.addBody(b);
for (let i = 0; i < 240; i++) world.step(1 / 60);
ok(Math.abs(b.feetY - 0) < 0.02, `body rests on floor (feetY=${b.feetY.toFixed(3)})`);
ok(b.onGround === true, 'onGround true at rest');

console.log('--- horizontal move + wall clamp ---');
b.vel.set(5, 0, -5);
for (let i = 0; i < 120; i++) world.step(1 / 60);
const distToWall = Math.abs(b.pos.z - (-6 + 0.5 + 0.35 + 0.001));
ok(distToWall < 0.05, `stopped at north wall (z=${b.pos.z.toFixed(3)}, err=${distToWall.toFixed(3)})`);
ok(b.vel.z === 0, 'vel.z zeroed on impact');

console.log('--- no tunneling at high speed ---');
const fast = new Body(-15, 2, 0, 0.35, 0.9, 0.35);
world.addBody(fast);
fast.vel.set(80, 0, 0);
for (let i = 0; i < 60; i++) world.step(1 / 60);
ok(fast.pos.x < 6 - 0.35, `high-speed body clamped at east wall (x=${fast.pos.x.toFixed(3)})`);
world.removeBody(fast);

console.log('--- step up onto low ledge ---');
world.addSolid(10, 0.25, 6, 2, 0.5, 2, 'ledge');
const stepper = new Body(8, 0.901, 6, 0.35, 0.9, 0.35);
world.addBody(stepper);
for (let i = 0; i < 60; i++) world.step(1 / 60);
stepper.vel.set(4, 0, 0);
for (let i = 0; i < 180; i++) world.step(1 / 60);
ok(Math.abs(stepper.feetY - 0.5) < 0.03, `stepped onto 0.5m ledge (feetY=${stepper.feetY.toFixed(3)})`);

console.log('--- jump onto 1.0m crate ---');
world.addSolid(-8, 0.5, 10, 1.8, 1.0, 1.8, 'crate-test');
const mounter = new Body(-10.5, 0.901, 10, 0.35, 0.9, 0.35);
world.addBody(mounter);
for (let i = 0; i < 30; i++) world.step(1 / 60);
mounter.vel.set(4, 6.6, 0);
for (let i = 0; i < 150; i++) {
  world.step(1 / 60);
  if (mounter.onGround && mounter.feetY > 0.9) mounter.vel.x = 0;
}
ok(Math.abs(mounter.feetY - 1.0) < 0.03, `jumped onto crate (feetY=${mounter.feetY.toFixed(3)})`);

console.log('--- jump ---');
const jumper = new Body(0, 2, 10, 0.35, 0.9, 0.35);
world.addBody(jumper);
for (let i = 0; i < 60; i++) world.step(1 / 60);
jumper.vel.y = 6.4;
let peak = 0;
for (let i = 0; i < 90; i++) { world.step(1 / 60); peak = Math.max(peak, jumper.feetY); }
ok(peak > 0.9 && peak < 1.15, `jump peak height ${peak.toFixed(2)}m`);
for (let i = 0; i < 120; i++) world.step(1 / 60);
ok(jumper.onGround, 'lands after jump');

console.log('--- raycast: wall, floor, miss ---');
const hitWall = world.raycast(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), 50);
ok(hitWall && hitWall.type === 'world' && Math.abs(hitWall.dist - 5.5) < 0.01, `wall hit dist ${hitWall.dist.toFixed(2)}`);
ok(hitWall.normal.z === 1, 'wall normal faces +z');
const miss = world.raycast(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, 1), 50, { bodies: false });
ok(miss === null, 'ray into open space misses');

console.log('--- raycast: headshot priority ---');
const dummy = new Body(0, 2, 12, 0.35, 0.9, 0.35, {
  headFn: () => new AABB(dummy.pos.x - 0.2, dummy.pos.y + 0.44, dummy.pos.z - 0.2,
    dummy.pos.x + 0.2, dummy.pos.y + 0.9, dummy.pos.z + 0.2)
});
dummy.blockBullets = true;
world.addBody(dummy);
const hs = world.raycast(new THREE.Vector3(0, 2.85, 20), new THREE.Vector3(0, 0, -1), 50);
ok(hs && hs.type === 'body' && hs.headshot === true, 'top-down ray registers headshot');
const bs = world.raycast(new THREE.Vector3(0, 2, 20), new THREE.Vector3(0, 0, -1), 50);
ok(bs && bs.type === 'body' && bs.headshot === false, 'chest ray registers body shot');
const wallBlocks = world.raycast(new THREE.Vector3(0, 2, -10), new THREE.Vector3(0, 0, 1), 50);
ok(wallBlocks.type === 'world', 'wall blocks ray to body');

console.log('--- grenade projectile bounce ---');
let exploded = false;
const mesh = null;
world.spawnProjectile({
  pos: new THREE.Vector3(0, 4, 10), vel: new THREE.Vector3(3, 0, 0),
  radius: 0.09, bounce: 0.45, fuse: 1.0, owner: null, mesh,
  onExplode: () => { exploded = true; }
});
let bounced = 0;
world.projectiles[0].onBounce = () => bounced++;
for (let i = 0; i < 90; i++) world.step(1 / 60);
ok(exploded, 'grenade explodes after fuse');
ok(bounced > 0, `grenade bounced ${bounced} time(s)`);
ok(world.projectiles.length === 0, 'grenade removed after explode');

console.log('--- LOS check ---');
const a = new THREE.Vector3(0, 2, 5);
const c = new THREE.Vector3(0, 2, -8);
ok(!world.losClear(a, c), 'LOS blocked by wall');
const d = new THREE.Vector3(0, 2, 10);
ok(world.losClear(a, d), 'LOS clear on open ground');

console.log(`\nPHYSICS TEST: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
