import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URLS = {
  CT: { url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb', type: 'soldier' },
  T: { url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Xbot.glb', type: 'xbot' }
};
const TINT = { T: 0xd06838, CT: 0x4a7ac8 };

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
  const box = skinnedBox(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = Math.min(1.25, Math.max(0.8, 1.78 / Math.max(size.y, 0.001)));
  obj.scale.setScalar(s);
  const box2 = skinnedBox(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -box2.min.y, -c.z);
  const tint = new THREE.Color(TINT[team]);
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      if (Array.isArray(o.material)) {
        o.material = o.material.map((m) => {
          const cm = m.clone();
          cm.color = cm.color.clone().lerp(tint, 0.45);
          return cm;
        });
      } else {
        const cm = o.material.clone();
        cm.color = cm.color.clone().lerp(tint, 0.45);
        o.material = cm;
      }
    }
  });
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.62), new THREE.MeshLambertMaterial({ color: 0x1c1f24 }));
  gun.position.set(0.15, 1.22, -0.3);
  gun.rotation.x = 0.08;
  gun.castShadow = true;
  obj.add(gun);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.28), new THREE.MeshLambertMaterial({ color: TINT[team] }));
  vest.position.set(0, 1.18, 0.02);
  vest.castShadow = true;
  obj.add(vest);
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
