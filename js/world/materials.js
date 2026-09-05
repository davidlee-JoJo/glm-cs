import * as THREE from 'three';

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

export function buildMaterials() {
  const floorTex = makeTex(256, (ctx, s) => {
    ctx.fillStyle = '#b39a68';
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 900, 0.08);
    ctx.strokeStyle = 'rgba(70,55,30,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * s / 4, 0); ctx.lineTo(i * s / 4, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s / 4); ctx.lineTo(s, i * s / 4); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,45,25,0.15)';
    for (let i = 0; i < 12; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 20 + Math.random() * 40, 6 + Math.random() * 14);
  });
  floorTex.repeat.set(32, 32);

  const wallTex = makeTex(256, (ctx, s) => {
    ctx.fillStyle = '#c9b98d';
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 700, 0.07);
    ctx.fillStyle = 'rgba(120,100,60,0.25)';
    ctx.fillRect(0, s * 0.72, s, 6);
    ctx.fillStyle = 'rgba(90,75,45,0.2)';
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * s;
      ctx.fillRect(x, 0, 2 + Math.random() * 3, s * (0.3 + Math.random() * 0.5));
    }
    ctx.strokeStyle = 'rgba(80,65,40,0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, s, s);
  });

  const crateTex = makeTex(256, (ctx, s) => {
    ctx.fillStyle = '#9c7440';
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 500, 0.06);
    ctx.strokeStyle = 'rgba(60,40,15,0.6)';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, s - 12, s - 12);
    ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * s / 4); ctx.lineTo(s, i * s / 4); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(40,26,10,0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.moveTo(s, 0); ctx.lineTo(0, s); ctx.stroke();
  });

  const metalTex = makeTex(128, (ctx, s) => {
    ctx.fillStyle = '#7e868c';
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
    ctx.fillStyle = '#9a9a92';
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
