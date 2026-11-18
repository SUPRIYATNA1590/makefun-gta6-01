// Solmar Heat — vehicles.js: car meshes, street traffic, parked cars and police chases.
import * as THREE from 'three';
import { CAR_COLORS, CAR_MODELS, POLICE, TRAFFIC } from './config.js';
import { mulberry32, pick, range } from './random.js';

export function createCarMesh(model, color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf2f2f2 : color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.wid, model.h * 0.62, model.len), bodyMat);
  body.position.y = model.h * 0.42; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.86, model.h * 0.5, model.len * 0.48), darkMat);
  cabin.position.set(0, model.h * 0.95, -model.len * 0.05); cabin.castShadow = true; g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx * (model.wid / 2 - 0.05), 0.36, wz * model.len * 0.32);
    g.add(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), headMat);
    h.position.set(s * model.wid * 0.32, model.h * 0.42, model.len / 2 + 0.01); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), new THREE.MeshBasicMaterial({ color: 0xd21f1f }));
    t.position.set(s * model.wid * 0.32, model.h * 0.42, -model.len / 2 - 0.01); g.add(t);
  }
  let lightBar = null;
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.7, 0.22, 0.5), darkMat);
    bar.position.set(0, model.h * 1.28, 0); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-model.wid * 0.18, model.h * 1.28, 0); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.52), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(model.wid * 0.18, model.h * 1.28, 0); g.add(blue);
    lightBar = { red, blue };
  }
  g.userData.lightBar = lightBar;
  return g;
}

function makeVehicle(scene, model, color, x, z, heading, isPolice) {
  const group = createCarMesh(model, color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    group, model, color, isPolice: !!isPolice,
    x, z, heading, speed: 0, targetSpeed: 0,
    axis: 'x', dir: 1, street: z, turnedAt: 0, isParked: false, isTraffic: false,
    flash: 0,
  };
}

export function createVehicles(scene, world) {
  const rng = mulberry32(777);
  const traffic = [];
  const police = [];
  const parked = [];

  function laneOffset(axis, dir) { return axis === 'x' ? dir * 2.8 : -dir * 2.8; }
  function spawnTrafficOne() {
    const p = world.randomRoadPoint(rng);
    const horizontal = Math.abs(p.z - world.nearestStreet(p.z)) < 0.1;
    const axis = horizontal ? 'x' : 'z';
    const dir = rng() < 0.5 ? 1 : -1;
    const model = pick(rng, CAR_MODELS);
    const v = makeVehicle(scene, model, pick(rng, CAR_COLORS), p.x, p.z, axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), false);
    v.axis = axis; v.dir = dir; v.street = axis === 'x' ? p.z : p.x;
    v.targetSpeed = range(rng, TRAFFIC.speedMin, TRAFFIC.speedMax);
    v.speed = v.targetSpeed; v.isTraffic = true;
    traffic.push(v);
    return v;
  }
  function spawnParked(x, z, heading, modelName, color) {
    const model = CAR_MODELS.find((m) => m.name === modelName) || CAR_MODELS[0];
    const v = makeVehicle(scene, model, color, x, z, heading, false);
    v.isParked = true;
    parked.push(v);
    return v;
  }
  // Parked cars along the streets and in the marina lot.
  for (let i = 0; i < 12; i += 1) {
    const p = world.randomRoadPoint(rng);
    const along = p.x; const street = p.z;
    spawnParked(along, street + (rng() < 0.5 ? 5.6 : -5.6), rng() * Math.PI * 2, pick(rng, CAR_MODELS).name, pick(rng, CAR_COLORS));
  }
  // The sunrise-yellow Comet GT for mission 3, parked in the marina lot.
  const comet = spawnParked(-133, 91, Math.PI / 2, 'Comet GT', 0xe8b93c);
  comet.isTarget = true;
  // The player's own starter sedan near the safehouse start.
  const starter = spawnParked(120, 126, 0, 'Sedan', 0x2e6fd2);
  starter.isStarter = true;

  function carAhead(v) {
    for (const o of traffic) {
      if (o === v || o.axis !== v.axis || Math.abs(o.street - v.street) > 1.5) continue;
      const along = v.axis === 'x' ? o.x - v.x : o.z - v.z;
      if (along * v.dir > 0 && along * v.dir < 9) return true;
    }
    return false;
  }

  function updateTraffic(dt) {
    for (const v of traffic) {
      const target = carAhead(v) ? 0 : v.targetSpeed;
      v.speed += Math.max(-18 * dt, Math.min(10 * dt, target - v.speed));
      const along = v.axis === 'x' ? v.x : v.z;
      const next = along + v.dir * v.speed * dt;
      // At an intersection, sometimes turn onto the crossing street.
      for (const s of world.streetCenters) {
        if (Math.abs(next - s) < 1.2 && Math.abs(v.turnedAt - s) > 4 && rng() < 0.45) {
          const newAxis = v.axis === 'x' ? 'z' : 'x';
          const newDir = rng() < 0.5 ? 1 : -1;
          const cross = v.axis === 'x' ? v.z : v.x;
          if (v.axis === 'x') { v.x = s; v.z = cross + laneOffset(newAxis, newDir); }
          else { v.z = s; v.x = cross + laneOffset(newAxis, newDir); }
          v.axis = newAxis; v.dir = newDir; v.street = newAxis === 'x' ? v.z : v.x;
          v.turnedAt = s;
          v.heading = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
          break;
        }
      }
      if (v.axis === 'x') { v.x = next; v.z = v.street + laneOffset('x', v.dir); }
      else { v.z = next; v.x = v.street + laneOffset('z', v.dir); }
      if (Math.abs(v.x) > 178 || Math.abs(v.z) > 178) {
        const p = world.randomRoadPoint(rng);
        v.x = p.x; v.z = p.z; v.speed = v.targetSpeed;
      }
      v.group.position.set(v.x, 0, v.z);
      v.group.rotation.y = v.heading;
    }
  }

  function spawnPoliceNear(x, z) {
    const p = world.randomRoadPoint(rng);
    const dx = p.x - x, dz = p.z - z;
    const d = Math.hypot(dx, dz) || 1;
    const px = x + (dx / d) * 55, pz = z + (dz / d) * 55;
    const v = makeVehicle(scene, CAR_MODELS[0], 0xf2f2f2, px, pz, 0, true);
    v.speed = 10; v.isPolice = true;
    police.push(v);
    return v;
  }

  function updatePolice(dt, ctx) {
    const player = ctx.player;
    const want = Math.min(player.wanted, 3) + (player.wanted >= 4 ? 2 : 0);
    while (police.length < Math.min(want, POLICE.maxCars) && player.wanted > 0) spawnPoliceNear(player.pos.x, player.pos.z);
    for (let i = police.length - 1; i >= 0; i -= 1) {
      const v = police[i];
      if (player.wanted === 0) { scene.remove(v.group); police.splice(i, 1); continue; }
      const dx = player.pos.x - v.x, dz = player.pos.z - v.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - v.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      v.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      v.speed += ((dist > 14 ? POLICE.chaseSpeed : POLICE.chaseSpeed * 0.75) - v.speed) * Math.min(1, dt * 1.5);
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      const p = { x: v.x, z: v.z };
      if (world.collideCircle(p, 1.6)) { v.x = p.x; v.z = p.z; v.speed *= 0.55; }
      // Ram the player's car.
      if (player.car && dist < 3.4) {
        player.car.speed *= 0.82;
        player.damage(POLICE.ramDamage * dt * 2, 'police');
        ctx.audio.playCrash();
      }
      v.flash += dt;
      const bar = v.group.userData.lightBar;
      if (bar) {
        const on = Math.floor(v.flash * 6) % 2 === 0;
        bar.red.material.color.setHex(on ? 0xff2020 : 0x551010);
        bar.blue.material.color.setHex(on ? 0x101055 : 0x2040ff);
      }
      v.group.position.set(v.x, 0, v.z);
      v.group.rotation.y = v.heading;
    }
  }

  return {
    traffic, police, parked, comet, starter,
    spawnTrafficOne,
    update(dt, ctx) {
      if (traffic.length < TRAFFIC.count) spawnTrafficOne();
      updateTraffic(dt);
      updatePolice(dt, ctx);
    },
    clearPolice() { for (const v of police) scene.remove(v.group); police.length = 0; },
    nearestParked(x, z, radius) {
      let best = null, bestD = radius;
      for (const v of parked) {
        const d = Math.hypot(v.x - x, v.z - z);
        if (d < bestD) { bestD = d; best = v; }
      }
      return best;
    },
    removeParked(v) { const i = parked.indexOf(v); if (i >= 0) parked.splice(i, 1); },
    parkCar(v) { if (!parked.includes(v)) parked.push(v); },
    allCars() { return [...traffic, ...parked, ...police]; },
  };
}
