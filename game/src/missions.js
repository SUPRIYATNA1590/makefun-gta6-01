// Solmar Heat — missions.js: the six-mission story chain, objectives, beacons and payouts.
import * as THREE from 'three';
import { DIALOGUE, MISSIONS } from './config.js';

function createBeacon(scene, color) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30; g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 8),
    new THREE.MeshBasicMaterial({ color }),
  );
  core.position.y = 1.2; g.add(core);
  g.visible = false;
  scene.add(g);
  return g;
}

export function createMissions(scene, ctx) {
  const beacon = createBeacon(scene, 0xffd23c);
  const caseBeacon = createBeacon(scene, 0x3cff7a);
  let missionIndex = 0;
  let stepIndex = 0;
  let enemiesSpawned = false;
  let killsAtStart = 0;
  let escapeArmed = false;
  let completed = 0;
  let storyDone = false;
  let toastTimer = 0;

  // Cash bundles and health packs scattered around the city.
  const pickups = [];
  const cashSpots = [
    [-105, -35], [35, -105], [-35, 105], [105, 35], [-175, -105], [175, 105],
    [-35, -175], [105, -105], [-105, 175], [175, -35], [35, 175], [-175, 35],
  ];
  const cashGeo = new THREE.BoxGeometry(0.9, 0.35, 0.6);
  const cashMat = new THREE.MeshBasicMaterial({ color: 0x3cff7a });
  const healthGeo = new THREE.BoxGeometry(0.8, 0.8, 0.2);
  const healthMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const [x, z] of cashSpots) {
    const m = new THREE.Mesh(cashGeo, cashMat);
    m.position.set(x, 0.7, z); scene.add(m);
    pickups.push({ mesh: m, x, z, kind: 'cash', taken: false });
  }
  for (const [x, z] of [[114.5, -25.5], [-95.5, 114.5], [-25.5, -95.5], [44.5, 44.5]]) {
    const m = new THREE.Mesh(healthGeo, healthMat);
    m.position.set(x, 0.9, z); scene.add(m);
    pickups.push({ mesh: m, x, z, kind: 'health', taken: false });
  }

  function current() { return MISSIONS[missionIndex] || null; }
  function currentStep() { const m = current(); return m ? m.steps[stepIndex] : null; }

  function placeBeacon() {
    const step = currentStep();
    beacon.visible = false; caseBeacon.visible = false;
    if (!step) return;
    if (step.type === 'pickup') {
      caseBeacon.position.set(step.x, 0, step.z);
      caseBeacon.visible = true;
    } else {
      beacon.position.set(step.x, 0, step.z);
      beacon.visible = true;
    }
  }

  function advanceStep() {
    stepIndex += 1;
    const m = current();
    if (m && stepIndex >= m.steps.length) {
      ctx.player.addMoney(m.reward);
      ctx.audio.playMissionDone();
      const key = `${m.id}Done`;
      ctx.hud.toast(`${m.title} complete — +$${m.reward}`);
      ctx.hud.showDialogue(DIALOGUE[key] || '');
      missionIndex += 1;
      stepIndex = 0;
      completed += 1;
      enemiesSpawned = false;
      escapeArmed = false;
      if (missionIndex >= MISSIONS.length) {
        storyDone = true;
        ctx.hud.showDialogue(DIALOGUE.m6Done);
        ctx.hud.toast('Story complete — free roam Solmar City!');
      }
      ctx.saveGame();
    }
    placeBeacon();
  }

  function startStep() {
    const step = currentStep();
    if (!step) return;
    if (step.type === 'combat' && !enemiesSpawned) {
      enemiesSpawned = true;
      killsAtStart = ctx.peds.killCount();
      ctx.peds.spawnEnemies(step.x, step.z, step.enemies);
      ctx.hud.toast('Hostiles on the docks — clear them out!');
    }
    if (step.type === 'escape' && !escapeArmed) {
      escapeArmed = true;
      ctx.player.wanted = step.wanted;
      ctx.player.lastSeen = ctx.time;
      ctx.audio.setSiren(true);
      ctx.hud.toast(`Wanted level ${step.wanted} — lose the heat!`);
    }
    if (step.type === 'steal') {
      ctx.hud.toast('That Comet GT is the target. Take it.');
    }
  }

  function update(dt) {
    toastTimer = Math.max(0, toastTimer - dt);
    const step = currentStep();
    const m = current();
    if (!step || !m) { beacon.visible = false; caseBeacon.visible = false; return; }
    startStep();
    const p = ctx.player.pos;
    const dx = p.x - step.x, dz = p.z - step.z;
    const dist = Math.hypot(dx, dz);
    if (step.type === 'goto' || step.type === 'talk' || step.type === 'deliver') {
      const inCar = step.type === 'deliver' ? !!ctx.player.car : true;
      if (dist < step.radius && inCar) advanceStep();
    } else if (step.type === 'steal') {
      if (ctx.player.car && ctx.player.car.isTarget) advanceStep();
    } else if (step.type === 'combat') {
      const kills = ctx.peds.killCount() - killsAtStart;
      step.label = `Clear the dock guards (${Math.min(kills, step.enemies)}/${step.enemies})`;
      if (kills >= step.enemies) advanceStep();
    } else if (step.type === 'escape') {
      if (ctx.player.wanted === 0 && dist < step.radius) advanceStep();
    }
    // Spin the beacons and bob the pickups.
    beacon.rotation.y += dt * 1.2;
    caseBeacon.rotation.y += dt * 1.2;
    for (const pk of pickups) {
      if (pk.taken) continue;
      pk.mesh.rotation.y += dt * 1.5;
      pk.mesh.position.y = 0.7 + Math.sin(ctx.time * 2 + pk.x) * 0.15;
      const d = Math.hypot(p.x - pk.x, p.z - pk.z);
      if (d < 2.2) {
        pk.taken = true;
        pk.mesh.visible = false;
        if (pk.kind === 'cash') { ctx.player.addMoney(100); ctx.audio.playCash(); ctx.hud.toast('Cash bundle +$100'); }
        else { ctx.player.heal(40); ctx.audio.playPickup(); ctx.hud.toast('Health +40'); }
      }
    }
  }

  function interact() {
    const step = currentStep();
    if (!step) return;
    const p = ctx.player.pos;
    const dist = Math.hypot(p.x - step.x, p.z - step.z);
    if ((step.type === 'talk' || step.type === 'pickup') && dist < step.radius + 1.5) advanceStep();
  }

  function objectiveText() {
    const m = current();
    if (!m) return storyDone ? 'Free roam — Solmar City is yours' : '';
    const step = currentStep();
    return `${m.title}: ${step ? step.label : ''}`;
  }

  function setProgress(index, money) {
    missionIndex = Math.max(0, Math.min(index, MISSIONS.length));
    stepIndex = 0;
    completed = missionIndex;
    storyDone = missionIndex >= MISSIONS.length;
    ctx.player.money = money || 0;
    placeBeacon();
  }

  return {
    update, interact, objectiveText, current, currentStep,
    get missionIndex() { return missionIndex; },
    get completed() { return completed; },
    get storyDone() { return storyDone; },
    setProgress,
  };
}
