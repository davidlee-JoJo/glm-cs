import * as THREE from 'three';

export const THEMES = {
  dust: {
    sky: 0xb9c6d8, fogNear: 55, fogFar: 175,
    light: { hemi: 1.05, sun: 1.9, sunColor: 0xfff1d6, shadow: 48 },
    floor: '#b39a68', floorLine: 'rgba(70,55,30,0.35)', floorPatch: 'rgba(60,45,25,0.15)',
    wall: '#c9b98d', wallStreak: 'rgba(90,75,45,0.2)', wallBand: 'rgba(120,100,60,0.25)',
    crate: '#9c7440', crateLine: 'rgba(60,40,15,0.6)',
    metal: '#7e868c', concrete: '#9a9a92'
  },
  inferno: {
    sky: 0xcfb59a, fogNear: 50, fogFar: 160,
    light: { hemi: 1.0, sun: 1.8, sunColor: 0xffdfb0, shadow: 48 },
    floor: '#a58a66', floorLine: 'rgba(80,55,30,0.4)', floorPatch: 'rgba(70,50,28,0.18)',
    wall: '#c9925f', wallStreak: 'rgba(120,70,35,0.22)', wallBand: 'rgba(150,85,40,0.28)',
    crate: '#8a6238', crateLine: 'rgba(50,30,10,0.65)',
    metal: '#6d7a70', concrete: '#b0a08c'
  },
  nuke: {
    sky: 0x8fa3b3, fogNear: 45, fogFar: 150,
    light: { hemi: 0.95, sun: 1.6, sunColor: 0xdde8f0, shadow: 48 },
    floor: '#85898d', floorLine: 'rgba(40,45,50,0.4)', floorPatch: 'rgba(50,55,60,0.2)',
    wall: '#a9aeb4', wallStreak: 'rgba(70,75,82,0.25)', wallBand: 'rgba(90,96,104,0.3)',
    crate: '#5f6b73', crateLine: 'rgba(25,30,35,0.6)',
    metal: '#4e5860', concrete: '#909498'
  },
  snow: {
    sky: 0xe3ecf5, fogNear: 55, fogFar: 170,
    light: { hemi: 1.15, sun: 1.7, sunColor: 0xf0f6ff, shadow: 48 },
    floor: '#e9eef5', floorLine: 'rgba(150,165,185,0.3)', floorPatch: 'rgba(190,205,225,0.4)',
    wall: '#b6c6d6', wallStreak: 'rgba(120,140,165,0.2)', wallBand: 'rgba(140,160,185,0.3)',
    crate: '#7a5a38', crateLine: 'rgba(45,30,15,0.6)',
    metal: '#8b98a6', concrete: '#c3cbd5'
  },
  fortress: {
    sky: 0xa8b8ac, fogNear: 60, fogFar: 200,
    light: { hemi: 0.95, sun: 1.75, sunColor: 0xe8e4d0, shadow: 58 },
    floor: '#8f8a7d', floorLine: 'rgba(55,52,45,0.4)', floorPatch: 'rgba(45,42,36,0.18)',
    wall: '#9a958a', wallStreak: 'rgba(60,58,50,0.25)', wallBand: 'rgba(70,66,58,0.3)',
    crate: '#7d6b4a', crateLine: 'rgba(40,32,18,0.6)',
    metal: '#6e7470', concrete: '#a09a8d'
  },
  harbor: {
    sky: 0x1c2740, fogNear: 38, fogFar: 130,
    light: { hemi: 0.5, sun: 0.55, sunColor: 0x8aa4d8, shadow: 58 },
    floor: '#4a5261', floorLine: 'rgba(20,24,32,0.5)', floorPatch: 'rgba(28,34,46,0.35)',
    wall: '#5a6472', wallStreak: 'rgba(30,36,46,0.3)', wallBand: 'rgba(24,28,36,0.4)',
    crate: '#6b4a2e', crateLine: 'rgba(25,16,8,0.65)',
    metal: '#3d4854', concrete: '#565e6a'
  },
  city: {
    sky: 0x9aa8b0, fogNear: 60, fogFar: 210,
    light: { hemi: 1.0, sun: 1.65, sunColor: 0xe0e4da, shadow: 68 },
    floor: '#7d8078', floorLine: 'rgba(45,48,45,0.4)', floorPatch: 'rgba(38,40,38,0.18)',
    wall: '#a8a89a', wallStreak: 'rgba(70,70,62,0.25)', wallBand: 'rgba(60,62,55,0.3)',
    crate: '#8a7448', crateLine: 'rgba(45,35,15,0.6)',
    metal: '#5e686e', concrete: '#98988c'
  }
};

function makeTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function noise(ctx, size, n, alpha) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const s = 1 + Math.random() * 3;
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 230 : 20},${alpha * Math.random()})`;
    ctx.fillRect(x, y, s, s);
  }
}

export function buildMaterials(theme) {
  const floorTex = makeTex(256, (ctx, s) => {
    ctx.fillStyle = theme.floor;
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 900, 0.08);
    ctx.strokeStyle = theme.floorLine;
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * s / 4, 0); ctx.lineTo(i * s / 4, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s / 4); ctx.lineTo(s, i * s / 4); ctx.stroke();
    }
    ctx.fillStyle = theme.floorPatch;
    for (let i = 0; i < 12; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 20 + Math.random() * 40, 6 + Math.random() * 14);
  });
  floorTex.repeat.set(32, 32);

  const wallTex = makeTex(256, (ctx, s) => {
    ctx.fillStyle = theme.wall;
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 700, 0.07);
    ctx.fillStyle = theme.wallBand;
    ctx.fillRect(0, s * 0.72, s, 6);
    ctx.fillStyle = theme.wallStreak;
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * s;
      ctx.fillRect(x, 0, 2 + Math.random() * 3, s * (0.3 + Math.random() * 0.5));
    }
    ctx.strokeStyle = theme.wallStreak;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, s, s);
  });

  const crateTex = makeTex(256, (ctx, s) => {
    ctx.fillStyle = theme.crate;
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 500, 0.06);
    ctx.strokeStyle = theme.crateLine;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, s - 12, s - 12);
    ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * s / 4); ctx.lineTo(s, i * s / 4); ctx.stroke();
    }
    ctx.strokeStyle = theme.crateLine;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.moveTo(s, 0); ctx.lineTo(0, s); ctx.stroke();
    ctx.globalAlpha = 1;
  });

  const metalTex = makeTex(128, (ctx, s) => {
    ctx.fillStyle = theme.metal;
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 400, 0.08);
    ctx.fillStyle = 'rgba(30,35,40,0.5)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      ctx.beginPath(); ctx.arc(16 + i * 32, 16 + j * 32, 3, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(40,45,50,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, s - 4, s - 4);
  });

  const concTex = makeTex(128, (ctx, s) => {
    ctx.fillStyle = theme.concrete;
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 600, 0.09);
  });

  return {
    floor: new THREE.MeshLambertMaterial({ map: floorTex }),
    wall: new THREE.MeshLambertMaterial({ map: wallTex }),
    crate: new THREE.MeshLambertMaterial({ map: crateTex }),
    metal: new THREE.MeshLambertMaterial({ map: metalTex }),
    concrete: new THREE.MeshLambertMaterial({ map: concTex })
  };
}

const TEXEL = 0.5;

function scaleBoxUVs(geo, sx, sy, sz) {
  const uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let su, sv;
    if (ny > 0.5) { su = sx; sv = sz; }
    else if (nx > 0.5) { su = sz; sv = sy; }
    else { su = sx; sv = sy; }
    uv.setXY(i, uv.getX(i) * su * TEXEL, uv.getY(i) * sv * TEXEL);
  }
  uv.needsUpdate = true;
}

export function boxMesh(mat, sx, sy, sz, x, y, z) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  scaleBoxUVs(geo, sx, sy, sz);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function siteDecalTex(letter) {
  return makeTex(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(230,180,60,0.9)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.42, 0, 7); ctx.stroke();
    ctx.font = '900 150px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(230,180,60,0.9)';
    ctx.fillText(letter, s / 2, s / 2 + 8);
  });
}
