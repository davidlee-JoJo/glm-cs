import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SOLDIER_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb';
const TINT = { T: 0xd08a48, CT: 0x5a86c8 };

let loadPromise = null;
function loadSoldier() {
  if (!loadPromise) {
    loadPromise = new Promise((resolve) => {
      new GLTFLoader().load(SOLDIER_URL, (g) => {
        try {
          resolve(prepare(g));
        } catch (e) {
          resolve(null);
        }
      }, undefined, () => resolve(null));
    });
  }
  return loadPromise;
}

function prepare(gltf) {
  const base = gltf.scene;
  const clips = gltf.animations || [];
  const box = new THREE.Box3().setFromObject(base);
  const size = box.getSize(new THREE.Vector3());
  base.scale.setScalar(1.78 / Math.max(size.y, 0.001));
  const box2 = new THREE.Box3().setFromObject(base);
  const c = box2.getCenter(new THREE.Vector3());
  base.position.set(-c.x, -box2.min.y, -c.z);
  return {
    scene: base,
    clips: {
      idle: clips[0] || null,
      run: clips[1] || null,
      walk: clips[3] || clips[1] || null
    }
  };
}

export async function buildCharacter(team) {
  const prep = await loadSoldier();
  if (!prep) return null;
  let obj;
  try {
    obj = SkeletonUtils.clone(prep.scene);
  } catch (e) {
    return null;
  }
  const tint = new THREE.Color(TINT[team]);
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      if (Array.isArray(o.material)) {
        o.material = o.material.map((m) => {
          const c = m.clone();
          c.color = c.color.clone().lerp(tint, 0.45);
          return c;
        });
      } else {
        const c = o.material.clone();
        c.color = c.color.clone().lerp(tint, 0.45);
        o.material = c;
      }
    }
  });
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.62), new THREE.MeshLambertMaterial({ color: 0x1c1f24 }));
  gun.position.set(0.15, 1.22, -0.3);
  gun.rotation.x = 0.08;
  gun.castShadow = true;
  obj.add(gun);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.26), new THREE.MeshLambertMaterial({ color: TINT[team], transparent: true, opacity: 0.55 }));
  vest.position.set(0, 1.16, 0.02);
  obj.add(vest);
  return { obj, clips: prep.clips };
}
