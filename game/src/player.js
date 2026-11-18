// Solmar Heat — player.js: Mara Reyes on foot and behind the wheel, combat, wanted level.
import * as THREE from 'three';
import { CAR, PLAYER, WANTED } from './config.js';

function createPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xe86a1e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 0.36), jacket);
  torso.position.y = 1.06; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
  head.position.y = 1.64; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 1.68; g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.72, 0.25), pants);
  legL.position.set(-0.17, 0.36, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x141414 }));
  gun.position.set(0.32, 1.15, 0.3); g.add(gun);
  g.userData = { legL, legR, gun };
  return g;
}

export function createPlayer(scene, world) {
  const mesh = createPlayerMesh();
  scene.add(mesh);
  const tracers = [];
  const player = {
    mesh,
    pos: new THREE.Vector3(120, 0, 120),
    velY: 0, onGround: true, yaw: 0, camYaw: Math.PI, camPitch: 0.32,
    onFoot: true, car: null, carSpeed: 0, steer: 0,
    health: PLAYER.maxHealth, money: 0, wanted: 0,
    weapons: { pistol: { ammo: 12, reserve: 120 }, shotgun: { ammo: 6, reserve: 24 } },
    weapon: 'pistol', reloadTimer: 0, fireTimer: 0,
    lastSeen: 0, decayTimer: 0, bustedTimer: 0, dead: false, deadReason: '',
    walkPhase: 0, moveSpeed: 0,
  };

  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
    scene.add(line);
    tracers.push({ line, life: 0.09 });
  }

  function raiseWanted(n, ctx) {
    if (player.wanted === 0) ctx.audio.setSiren(true);
    player.wanted = Math.min(5, player.wanted + n);
    player.lastSeen = ctx.time;
  }

  function shoot(ctx) {
    const w = player.weapons[player.weapon];
    if (player.reloadTimer > 0 || player.fireTimer > 0 || w.ammo <= 0) {
      if (w.ammo <= 0 && player.reloadTimer <= 0) reload(ctx);
      return;
    }
    player.fireTimer = player.weapon === 'pistol' ? 0.22 : 0.7;
    w.ammo -= 1;
    ctx.audio.playGunshot();
    ctx.shotsFiredRecently = 1.5;
    const cam = ctx.camera;
    const origin = cam.position.clone();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const range = player.weapon === 'pistol' ? PLAYER.pistolRange : PLAYER.shotgunRange;
    const pellets = player.weapon === 'pistol' ? 1 : PLAYER.shotgunPellets;
    let hitAny = false;
    for (let p = 0; p < pellets; p += 1) {
      const spread = player.weapon === 'pistol' ? 0.012 : 0.05;
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * spread; d.y += (Math.random() - 0.5) * spread; d.z += (Math.random() - 0.5) * spread;
      d.normalize();
      let best = null, bestDist = range, bestKind = null;
      for (const t of ctx.peds.listTargets()) {
        const to = new THREE.Vector3(t.x - origin.x, t.y - origin.y, t.z - origin.z);
        const dist = to.length();
        if (dist > range) continue;
        const angle = to.normalize().angleTo(d);
        if (angle < 0.055 && dist < bestDist) { best = t; bestDist = dist; bestKind = t.kind; }
      }
      if (!best) {
        for (const car of ctx.vehicles.allCars()) {
          const to = new THREE.Vector3(car.x - origin.x, 0.8 - origin.y, car.z - origin.z);
          const dist = to.length();
          if (dist > range) continue;
          const angle = to.normalize().angleTo(d);
          if (angle < 0.07 && dist < bestDist) { best = car; bestDist = dist; bestKind = 'car'; }
        }
      }
      const end = origin.clone().addScaledVector(d, best ? bestDist : range);
      addTracer(origin.clone().addScaledVector(d, 1.2), end);
      if (!best) continue;
      hitAny = true;
      const dmg = player.weapon === 'pistol' ? PLAYER.pistolDamage : PLAYER.shotgunDamage;
      if (bestKind === 'car') {
        raiseWanted(1, ctx);
      } else {
        const ref = best.ref;
        if (bestKind === 'enemy') {
          ref.health -= dmg;
          if (ref.health <= 0 && !ref.dead) { ref.dead = true; ctx.audio.playCash(); }
        } else {
          ref.dead = true;
          raiseWanted(bestKind === 'cop' ? WANTED.killCop : WANTED.killPed, ctx);
        }
      }
    }
    if (hitAny) ctx.hud.flashHitmarker();
  }

  function reload(ctx) {
    const w = player.weapons[player.weapon];
    if (w.reserve <= 0 || w.ammo >= (player.weapon === 'pistol' ? PLAYER.pistolAmmo : 6)) return;
    player.reloadTimer = 0.9;
  }

  function enterCar(ctx) {
    const v = ctx.vehicles.nearestParked(player.pos.x, player.pos.z, 4.5);
    if (!v) return;
    ctx.vehicles.removeParked(v);
    v.isParked = false;
    player.car = v;
    player.onFoot = false;
    player.carSpeed = 0;
    player.pos.set(v.x, 0, v.z);
    player.yaw = v.heading;
    mesh.visible = false;
    ctx.audio.startEngine();
    if (!v.isStarter && !v.wasDriven) raiseWanted(WANTED.stealCar, ctx);
    v.wasDriven = true;
    ctx.hud.toast(`Driving the ${v.model.name}`);
  }

  function exitCar(ctx) {
    const v = player.car;
    if (!v) return;
    v.speed = 0;
    v.isParked = true;
    ctx.vehicles.parkCar(v);
    const side = { x: v.x + Math.cos(v.heading) * 2.2, z: v.z - Math.sin(v.heading) * 2.2 };
    player.pos.set(side.x, 0, side.z);
    player.onFoot = true;
    player.car = null;
    mesh.visible = true;
    ctx.audio.stopEngine();
    ctx.audio.setEngine(0, false);
  }

  function drive(dt, input, ctx) {
    const v = player.car;
    const axis = input.axis();
    const fwd = axis.forward;
    const steerTarget = -axis.strafe * CAR.steer * Math.max(0.35, 1 - Math.abs(player.carSpeed) / CAR.maxSpeed * 0.55);
    player.steer += (steerTarget - player.steer) * Math.min(1, dt * 8);
    const handbrake = input.keys.has('Space');
    if (fwd > 0) player.carSpeed += CAR.accel * dt;
    else if (fwd < 0) {
      player.carSpeed += (player.carSpeed > 0.5 ? -CAR.brake : -CAR.reverseAccel) * dt;
    } else {
      player.carSpeed -= Math.sign(player.carSpeed) * Math.min(Math.abs(player.carSpeed), (handbrake ? 26 : 8) * dt);
    }
    if (handbrake) player.carSpeed *= Math.max(0, 1 - dt * 1.6);
    player.carSpeed -= player.carSpeed * CAR.drag * dt * 0.4;
    player.carSpeed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, player.carSpeed));
    if (Math.abs(player.carSpeed) > 0.2) {
      player.yaw += player.steer * (player.carSpeed / 4.4) * dt * (handbrake ? 1.7 : 1);
    }
    v.heading = player.yaw;
    v.speed = player.carSpeed;
    const nx = v.x + Math.sin(player.yaw) * player.carSpeed * dt;
    const nz = v.z + Math.cos(player.yaw) * player.carSpeed * dt;
    const p = { x: nx, z: nz };
    if (world.collideCircle(p, 1.7)) {
      if (Math.abs(player.carSpeed) > 12) ctx.audio.playCrash();
      player.carSpeed *= 0.55;
    }
    v.x = p.x; v.z = p.z;
    player.pos.set(v.x, 0, v.z);
    // Bump traffic cars and peds.
    for (const o of ctx.vehicles.allCars()) {
      if (o === v) continue;
      const d = Math.hypot(o.x - v.x, o.z - v.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d);
        o.x += ((o.x - v.x) / d) * push * 0.5;
        o.z += ((o.z - v.z) / d) * push * 0.5;
        o.group.position.set(o.x, 0, o.z);
        if (Math.abs(player.carSpeed) > 6) { player.carSpeed *= 0.85; ctx.audio.playCrash(); }
      }
    }
    for (const ped of ctx.peds.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - v.x, ped.z - v.z);
      if (d < 1.9 && Math.abs(player.carSpeed) > 3) {
        ped.dead = true;
        raiseWanted(WANTED.killPed, ctx);
        player.carSpeed *= 0.9;
        ctx.audio.playCrash();
      }
    }
    ctx.audio.setEngine(Math.abs(player.carSpeed) / CAR.maxSpeed, true);
    v.group.position.set(v.x, 0, v.z);
    v.group.rotation.y = v.heading;
  }

  function walk(dt, input, ctx) {
    const axis = input.axis();
    const delta = input.takeMouseDelta();
    player.camYaw -= delta.x * 0.0028;
    player.camPitch = Math.max(-0.15, Math.min(1.1, player.camPitch + delta.y * 0.0022));
    const fx = -Math.sin(player.camYaw), fz = -Math.cos(player.camYaw);
    const rx = -fz, rz = fx;
    let mx = fx * axis.forward + rx * axis.strafe;
    let mz = fz * axis.forward + rz * axis.strafe;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.moveSpeed = ml * speed;
    player.pos.x += mx * player.moveSpeed * dt;
    player.pos.z += mz * player.moveSpeed * dt;
    if (ml > 0) {
      const targetYaw = Math.atan2(mx, mz);
      let dy = targetYaw - player.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      player.yaw += dy * Math.min(1, dt * 12);
    }
    const p = { x: player.pos.x, z: player.pos.z };
    world.collideCircle(p, PLAYER.radius);
    player.pos.x = p.x; player.pos.z = p.z;
    if (input.wasPressed('Space') && player.onGround) {
      player.velY = PLAYER.jumpSpeed;
      player.onGround = false;
    }
    if (!player.onGround) {
      player.velY -= PLAYER.gravity * dt;
      player.pos.y += player.velY * dt;
      if (player.pos.y <= 0) { player.pos.y = 0; player.velY = 0; player.onGround = true; }
    }
    player.walkPhase += dt * player.moveSpeed * 1.6;
    const swing = Math.sin(player.walkPhase) * (player.moveSpeed > 0.5 ? 0.55 : 0);
    mesh.userData.legL.rotation.x = swing;
    mesh.userData.legR.rotation.x = -swing;
    mesh.position.set(player.pos.x, player.pos.y, player.pos.z);
    mesh.rotation.y = player.yaw;
    // Combat.
    if (input.takeClick() || input.mouseDown) shoot(ctx);
    if (input.wasPressed('KeyR')) reload(ctx);
    if (input.wasPressed('Digit1')) { player.weapon = 'pistol'; ctx.hud.toast('Pistol'); }
    if (input.wasPressed('Digit2')) { player.weapon = 'shotgun'; ctx.hud.toast('Shotgun'); }
    if (input.wasPressed('KeyE')) enterCar(ctx);
    if (input.wasPressed('KeyF')) ctx.missions.interact();
  }

  player.damage = function damage(amount, source) {
    if (player.dead) return;
    player.health -= amount;
    player.hurtFlash = 1;
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
      player.deadReason = source === 'cop' ? 'busted' : 'wasted';
    }
  };
  player.addMoney = function addMoney(n) { player.money += n; };
  player.heal = function heal(n) { player.health = Math.min(PLAYER.maxHealth, player.health + n); };
  player.update = function update(dt, input, ctx) {
      if (player.dead) return;
      player.fireTimer = Math.max(0, player.fireTimer - dt);
      if (player.reloadTimer > 0) {
        player.reloadTimer -= dt;
        if (player.reloadTimer <= 0) {
          const w = player.weapons[player.weapon];
          const mag = player.weapon === 'pistol' ? PLAYER.pistolAmmo : 6;
          const need = mag - w.ammo;
          const take = Math.min(need, w.reserve);
          w.ammo += take; w.reserve -= take;
        }
      }
      // Wanted decay: stars fall once the police lose sight of the player.
      if (player.wanted > 0) {
        const nearPolice = ctx.vehicles.police.some((c) => Math.hypot(c.x - player.pos.x, c.z - player.pos.z) < 34);
        if (nearPolice) player.lastSeen = ctx.time;
        else if (ctx.time - player.lastSeen > WANTED.decayDelay) {
          player.decayTimer += dt;
          if (player.decayTimer > WANTED.decayInterval) {
            player.decayTimer = 0;
            player.wanted -= 1;
            if (player.wanted === 0) { ctx.audio.setSiren(false); ctx.vehicles.clearPolice(); }
          }
        }
      }
      if (player.bustedTimer > 2) { player.dead = true; player.deadReason = 'busted'; }
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        const t = tracers[i];
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09);
        if (t.life <= 0) { scene.remove(t.line); t.line.geometry.dispose(); tracers.splice(i, 1); }
      }
      if (player.onFoot) walk(dt, input, ctx);
      else {
        const delta = input.takeMouseDelta();
        player.camYaw -= delta.x * 0.0022;
        player.camPitch = Math.max(0.05, Math.min(0.9, player.camPitch + delta.y * 0.0018));
        drive(dt, input, ctx);
        if (input.wasPressed('KeyE')) exitCar(ctx);
        if (input.wasPressed('KeyF')) ctx.missions.interact();
      }
      mesh.userData.gun.visible = player.onFoot;
    };
  return player;
}
