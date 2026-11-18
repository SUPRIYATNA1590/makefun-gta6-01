// Solmar Heat — render.js: three.js renderer, golden-hour light, chase and orbit cameras.
import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc8e8);
  scene.fog = new THREE.Fog(0xc8d8e8, 200, 520);

  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 900);
  camera.position.set(0, 40, 120);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.0);
  sun.position.set(140, 160, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const camPos = new THREE.Vector3(0, 40, 120);
  const camLook = new THREE.Vector3(0, 0, 0);
  let orbitAngle = 0;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function updateCamera(dt, ctx) {
    const p = ctx.player;
    if (ctx.state === 'menu') {
      orbitAngle += dt * 0.05;
      const r = 190;
      camPos.set(Math.sin(orbitAngle) * r - 20, 95, Math.cos(orbitAngle) * r);
      camLook.set(-20, 0, 0);
    } else if (p.car) {
      const fwdX = Math.sin(p.yaw), fwdZ = Math.cos(p.yaw);
      const dist = 9 + Math.abs(p.carSpeed) * 0.05;
      const height = 3.6 + p.camPitch * 2;
      const want = new THREE.Vector3(p.pos.x - fwdX * dist, height, p.pos.z - fwdZ * dist);
      camPos.lerp(want, Math.min(1, dt * 5));
      camLook.lerp(new THREE.Vector3(p.pos.x + fwdX * 8, 1.6, p.pos.z + fwdZ * 8), Math.min(1, dt * 7));
    } else {
      const dist = 7.6, height = 2.7 + p.camPitch * 3.2;
      const want = new THREE.Vector3(
        p.pos.x + Math.sin(p.camYaw) * dist,
        p.pos.y + height,
        p.pos.z + Math.cos(p.camYaw) * dist,
      );
      camPos.lerp(want, Math.min(1, dt * 14));
      const fwdX = -Math.sin(p.camYaw), fwdZ = -Math.cos(p.camYaw);
      camLook.lerp(new THREE.Vector3(p.pos.x + fwdX * 3, p.pos.y + 1.6 - p.camPitch * 1.2, p.pos.z + fwdZ * 3), Math.min(1, dt * 14));
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  return {
    renderer, scene, camera,
    updateCamera,
    draw() { renderer.render(scene, camera); },
  };
}
