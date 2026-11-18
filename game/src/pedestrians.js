// Solmar Heat — pedestrians.js: sidewalk walkers, fleeing crowds, on-foot cops and mission guards.
import * as THREE from 'three';
import { PEDS, PED_SHIRTS, PLAYER } from './config.js';
import { mulberry32, pick, range } from './random.js';

function createPedMesh(shirt, isCop, isEnemy) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x1a2a4a : isEnemy ? 0x5a1a1a : shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const pantsMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x141c2e : 0x2a2d33 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirtMat);
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  if (isCop || isEnemy) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.26, 0.12, 10), pantsMat);
    cap.position.y = 1.8; g.add(cap);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), pantsMat);
  legL.position.set(-0.16, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export function createPeds(scene, world) {
  const rng = mulberry32(4242);
  const peds = [];
  const enemies = [];
  const tracers = [];

  function sidewalkPoint() {
    const s = pick(rng, world.streetCenters);
    const along = range(rng, -170, 170);
    const side = rng() < 0.5 ? 9.5 : -9.5;
    return rng() < 0.5 ? { x: along, z: s + side } : { x: s + side, z: along };
  }
  function spawnPed() {
    const p = sidewalkPoint();
    const group = createPedMesh(pick(rng, PED_SHIRTS), false, false);
    group.position.set(p.x, 0, p.z);
    scene.add(group);
    const ped = {
      group, x: p.x, z: p.z, heading: rng() * Math.PI * 2, speed: range(rng, PEDS.speedMin, PEDS.speedMax),
      target: sidewalkPoint(), state: 'walk', phase: rng() * 6, dead: false, deadTimer: 0, kind: 'ped',
    };
    peds.push(ped);
    return ped;
  }
  function spawnEnemies(x, z, count) {
    const made = [];
    for (let i = 0; i < count; i += 1) {
      const ex = x + range(rng, -10, 10), ez = z + range(rng, -10, 10);
      const group = createPedMesh(0x5a1a1a, false, true);
      group.position.set(ex, 0, ez);
      scene.add(group);
      const e = {
        group, x: ex, z: ez, heading: 0, speed: 0, target: { x: ex, z: ez },
        state: 'guard', phase: 0, dead: false, deadTimer: 0, kind: 'enemy',
        health: 60, shootTimer: range(rng, 0.5, 1.5), postX: ex, postZ: ez,
      };
      enemies.push(e); made.push(e);
    }
    return made;
  }
  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line, life: 0.12 });
  }
  function updateTracers(dt) {
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.12) * 0.9;
      if (t.life <= 0) { scene.remove(t.line); t.line.geometry.dispose(); tracers.splice(i, 1); }
    }
  }

  function updatePed(p, dt, ctx) {
    if (p.dead) {
      p.deadTimer += dt;
      p.group.rotation.x = Math.min(Math.PI / 2, p.group.rotation.x + dt * 6);
      return;
    }
    const player = ctx.player;
    const dx = p.x - player.pos.x, dz = p.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    let speed = p.speed;
    if (p.state !== 'guard' && (ctx.shotsFiredRecently > 0 || (player.wanted > 0 && dist < 18))) {
      p.state = 'flee';
    }
    if (p.state === 'flee') {
      speed = p.speed * 2.6;
      p.target = { x: p.x + (dx / (dist || 1)) * 20, z: p.z + (dz / (dist || 1)) * 20 };
      if (dist > 40) p.state = 'walk';
    }
    const tx = p.target.x - p.x, tz = p.target.z - p.z;
    const td = Math.hypot(tx, tz);
    if (td < 1.2) { p.target = p.state === 'guard' ? { x: p.postX, z: p.postZ } : sidewalkPoint(); return; }
    p.heading = Math.atan2(tx, tz);
    p.x += (tx / td) * speed * dt;
    p.z += (tz / td) * speed * dt;
    const pos = { x: p.x, z: p.z };
    world.collideCircle(pos, 0.5);
    p.x = pos.x; p.z = pos.z;
    p.phase += dt * speed * 2.2;
    const swing = Math.sin(p.phase) * 0.5;
    p.group.userData.legL.rotation.x = swing;
    p.group.userData.legR.rotation.x = -swing;
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = p.heading;
  }

  function updateEnemies(dt, ctx) {
    const player = ctx.player;
    for (const e of enemies) {
      if (e.dead) { e.deadTimer += dt; e.group.rotation.x = Math.min(Math.PI / 2, e.group.rotation.x + dt * 6); continue; }
      const dx = player.pos.x - e.x, dz = player.pos.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.heading = Math.atan2(dx, dz);
      e.group.rotation.y = e.heading;
      if (dist < 45 && ctx.state === 'playing') {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = range(rng, 0.9, 1.6);
          addTracer(new THREE.Vector3(e.x, 1.4, e.z), new THREE.Vector3(player.pos.x, 1.2, player.pos.z));
          ctx.audio.playEnemyShot();
          if (Math.random() < 0.55) player.damage(range(rng, 5, 10), 'enemy');
        }
      }
      // Drift back to post when the player is far.
      if (dist > 30) {
        const px = e.postX - e.x, pz = e.postZ - e.z;
        const pd = Math.hypot(px, pz);
        if (pd > 1) { e.x += (px / pd) * 2 * dt; e.z += (pz / pd) * 2 * dt; }
      }
      e.group.position.set(e.x, 0, e.z);
    }
  }

  function updateCops(dt, ctx) {
    const player = ctx.player;
    let cops = peds.filter((p) => p.kind === 'cop' && !p.dead);
    const want = player.wanted >= 2 && !player.car ? 2 : 0;
    while (cops.length < want) {
      const p = spawnPed();
      p.kind = 'cop';
      scene.remove(p.group);
      p.group = createPedMesh(0x1a2a4a, true, false);
      p.group.position.set(player.pos.x + range(rng, -25, 25), 0, player.pos.z + range(rng, -25, 25));
      scene.add(p.group);
      p.x = p.group.position.x; p.z = p.group.position.z;
      p.speed = 5.2;
      cops.push(p);
    }
    for (const c of cops) {
      const dx = player.pos.x - c.x, dz = player.pos.z - c.z;
      const dist = Math.hypot(dx, dz);
      if (player.wanted === 0 || player.car) { c.state = 'walk'; c.kind = 'ped'; continue; }
      c.target = { x: player.pos.x, z: player.pos.z };
      if (dist < 1.7) {
        player.damage(14 * dt, 'cop');
        player.bustedTimer = (player.bustedTimer || 0) + dt;
      } else {
        player.bustedTimer = 0;
      }
    }
  }

  return {
    peds, enemies,
    spawnEnemies,
    update(dt, ctx) {
      if (peds.length < PEDS.count) spawnPed();
      for (const p of peds) updatePed(p, dt, ctx);
      updateEnemies(dt, ctx);
      updateCops(dt, ctx);
      updateTracers(dt);
      for (let i = peds.length - 1; i >= 0; i -= 1) {
        if (peds[i].dead && peds[i].deadTimer > 25) { scene.remove(peds[i].group); peds.splice(i, 1); }
      }
      for (let i = enemies.length - 1; i >= 0; i -= 1) {
        if (enemies[i].dead && enemies[i].deadTimer > 25) { scene.remove(enemies[i].group); enemies.splice(i, 1); }
      }
    },
    listTargets() {
      const out = [];
      for (const p of peds) if (!p.dead) out.push({ x: p.x, z: p.z, y: 1.2, kind: p.kind, ref: p });
      for (const e of enemies) if (!e.dead) out.push({ x: e.x, z: e.z, y: 1.2, kind: 'enemy', ref: e });
      return out;
    },
    killCount() { return enemies.filter((e) => e.dead).length; },
  };
}
