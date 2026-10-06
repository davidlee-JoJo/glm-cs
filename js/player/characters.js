import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URLS = {
  CT: { url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb', type: 'soldier', yaw: 0, tint: 0x4a7ac8 },
  T: { url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Xbot.glb', type: 'xbot', yaw: Math.PI, tint: 0xd06838 }
};

const cache = new Map();
function loadModel(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve) => {
      new GLTFLoader().load(url, (g) => resolve(g), undefined, () => resolve(null));
    }));
  }
  return cache.get(url);
}

function skinnedBox(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.computeBoundingBox();
      if (o.boundingBox) box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
    } else if (o.isMesh) {
      if (!o.boundingBox) o.computeBoundingBox();
      if (o.boundingBox) box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
    }
  });
  return box;
}

function pickClip(clips, key, fallbackIdx) {
  const byName = clips.find((c) => c.name && c.name.toLowerCase() === key);
  if (byName) return byName;
  return clips[fallbackIdx] || null;
}

function findBone(root, re) {
  let found = null;
  root.traverse((o) => {
    if (!found && o.isBone && re.test(o.name)) found = o;
  });
  return found;
}

function buildHeadgear(team) {
  if (team === 'CT') {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x2c3e58 })
    );
    m.position.y = 0.06;
    m.castShadow = true;
    return m;
  }
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118, 0.118, 0.055, 14),
    new THREE.MeshLambertMaterial({ color: 0xc04830 })
  );
  m.position.y = 0.1;
  m.castShadow = true;
  return m;
}

export async function buildCharacter(team) {
  const cfg = MODEL_URLS[team];
  const gltf = await loadModel(cfg.url);
  if (!gltf) return null;
  let obj;
  try {
    obj = SkeletonUtils.clone(gltf.scene);
  } catch (e) {
    return null;
  }
  obj.rotation.y = cfg.yaw;
  const box = skinnedBox(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = Math.min(1.25, Math.max(0.8, 1.78 / Math.max(size.y, 0.001)));
  obj.scale.setScalar(s);
  const box2 = skinnedBox(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -box2.min.y, -c.z);
  const tint = new THREE.Color(cfg.tint);
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      if (Array.isArray(o.material)) {
        o.material = o.material.map((m) => {
          const cm = m.clone();
          cm.color = cm.color.clone().lerp(tint, 0.3);
          return cm;
        });
      } else {
        const cm = o.material.clone();
        cm.color = cm.color.clone().lerp(tint, 0.3);
        o.material = cm;
      }
    }
  });
  const head = findBone(obj, /head$/i) || findBone(obj, /head/i);
  const hat = buildHeadgear(team);
  if (head) head.add(hat);
  else {
    hat.position.set(0, 1.62, 0);
    obj.add(hat);
  }
  const clips = gltf.animations || [];
  return {
    obj,
    type: cfg.type,
    clips: {
      idle: pickClip(clips, 'idle', 0),
      run: pickClip(clips, 'run', 1),
      walk: pickClip(clips, 'walk', 3)
    }
  };
}
