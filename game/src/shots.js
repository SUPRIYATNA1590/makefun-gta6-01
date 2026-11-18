// Solmar Heat — shots.js: stages the four screenshot scenes from the real game.
// Each scene plays the live simulation forward, so the frame is what a real game looks like.
import { PLAYER } from './config.js';

function stubInput(forward, clickAt) {
  let step = 0;
  return {
    keys: new Set(forward ? ['KeyW'] : []),
    axis() { return { forward: forward ? 1 : 0, strafe: 0 }; },
    takeMouseDelta() { return { x: 0, y: 0 }; },
    takeClick() { step += 1; return clickAt === step; },
    get mouseDown() { return false; },
    wasPressed() { return false; },
    consumeAll() {},
  };
}

function runSteps(ctx, seconds, input) {
  const dt = 1 / 60;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i += 1) ctx.stepWorld(dt, input || stubInput(false, -1));
}

/**
 * Stage one named scene and return the screen state to draw.
 * start: title menu over a slow city orbit. play: on foot downtown.
 * chase: driving getaway, 3 stars, police behind, mission on the HUD.
 * mission: dockside shootout with the guards in frame.
 */
export function stageShot(name, ctx) {
  const player = ctx.player;
  if (name === 'start') {
    ctx.state = 'menu';
    runSteps(ctx, 2, stubInput(false, -1));
    return 'menu';
  }
  ctx.state = 'playing';
  ctx.audio.setEnabled(false);
  if (name === 'play') {
    ctx.missions.setProgress(0, 0);
    player.pos.set(35, 0, 60);
    player.yaw = Math.PI;
    player.camYaw = 0;
    player.camPitch = 0.3;
    runSteps(ctx, 5, stubInput(true, -1));
  } else if (name === 'chase') {
    ctx.missions.setProgress(4, 1900);
    const car = ctx.vehicles.starter;
    ctx.vehicles.removeParked(car);
    car.isParked = false;
    car.x = -60; car.z = -35; car.heading = Math.PI / 2;
    player.car = car; player.onFoot = false; player.carSpeed = 24;
    player.pos.set(car.x, 0, car.z);
    player.yaw = Math.PI / 2;
    player.camYaw = Math.PI / 2;
    player.camPitch = 0.25;
    player.wanted = 3;
    player.lastSeen = ctx.time;
    player.mesh.visible = false;
    ctx.audio.startEngine();
    runSteps(ctx, 4.5, stubInput(true, -1));
    // Pull two police cars into the frame ahead of the getaway car, facing it.
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    const rx = fz, rz = -fx;
    ctx.vehicles.police.slice(0, 2).forEach((cop, i) => {
      const side = i === 0 ? 4 : -4;
      cop.x = player.pos.x + fx * (26 + i * 8) + rx * side;
      cop.z = player.pos.z + fz * (26 + i * 8) + rz * side;
      cop.heading = player.yaw + Math.PI;
      cop.speed = 12;
      cop.group.position.set(cop.x, 0, cop.z);
      cop.group.rotation.y = cop.heading;
    });
    document.getElementById('hud-toast').style.opacity = '0';
    document.getElementById('hud-dialogue').style.opacity = '0';
  } else if (name === 'mission') {
    ctx.missions.setProgress(3, 1450);
    player.pos.set(-108, 0, -52);
    player.yaw = -1.98;
    player.camYaw = 1.16;
    player.camPitch = 0.22;
    player.weapon = 'shotgun';
    player.weapons.shotgun.ammo = 6;
    runSteps(ctx, 2.5, stubInput(false, 90));
    runSteps(ctx, 0.4, stubInput(false, -1));
  } else {
    ctx.missions.setProgress(0, 0);
    player.pos.set(35, 0, 60);
    player.camYaw = 0;
    runSteps(ctx, 3, stubInput(true, -1));
  }
  return 'playing';
}
