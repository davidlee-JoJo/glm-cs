import * as THREE from 'three';

export class Engine {
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb9c6d8);
    this.scene.fog = new THREE.Fog(0xb9c6d8, 55, 175);

    this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.05, 400);
    this.camera.rotation.order = 'YXZ';

    this.hemi = new THREE.HemisphereLight(0xd9e8ff, 0x9a8a68, 1.05);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.9);
    sun.position.set(35, 65, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 5; sc.far = 160;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.sun = sun;

    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.01, 8);
    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.3));
    const vdir = new THREE.DirectionalLight(0xffffff, 1.1);
    vdir.position.set(0.6, 1, 0.4);
    this.vmScene.add(vdir);

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h;
    this.vmCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setFov(f) {
    if (Math.abs(this.camera.fov - f) > 0.01) {
      this.camera.fov = f;
      this.camera.updateProjectionMatrix();
    }
  }

  render(showVM = true) {
    this.renderer.render(this.scene, this.camera);
    if (showVM) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.vmScene, this.vmCamera);
      this.renderer.autoClear = true;
    }
  }
}
