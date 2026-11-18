// Solmar Heat — main.js: boot, fixed-step loop, screens, save/load, screenshot mode.
// ?shot=start|play|chase|mission stages that scene and sets window.__shotReady.
import { CONTROLS, DIALOGUE, GAME_TITLE, SAVE_KEY, SEED } from './config.js';
import { mulberry32 } from './random.js';
import { buildCity } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { createVehicles } from './vehicles.js';
import { createPeds } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createMissions } from './missions.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SEED;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const render = createRenderer(canvas);
const world = buildCity(render.scene);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();
const vehicles = createVehicles(render.scene, world);
const peds = createPeds(render.scene, world);
const player = createPlayer(render.scene, world);

const ctx = {
  state: 'menu', time: 0, camera: render.camera, scene: render.scene,
  world, input, audio, hud, vehicles, peds, player, missions: null,
  shotsFiredRecently: 0, saveGame: null, stepWorld: null,
};
const missions = createMissions(render.scene, ctx);
ctx.missions = missions;
window.__solmar = ctx; // debug handle: state, player, missions, vehicles, peds

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.missionIndex !== 'number') return null;
    return data;
  } catch { return null; }
}
function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: missions.missionIndex, money: player.money, savedAt: Date.now(),
    }));
  } catch { /* storage off: progress lasts this visit only */ }
}
ctx.saveGame = saveGame;

function stepWorld(dt, inp) {
  ctx.time += dt;
  ctx.shotsFiredRecently = Math.max(0, ctx.shotsFiredRecently - dt);
  player.update(dt, inp, ctx);
  vehicles.update(dt, ctx);
  peds.update(dt, ctx);
  missions.update(dt);
  world.animate(dt);
  render.updateCamera(dt, ctx);
  if (ctx.state === 'playing') hud.update(dt, ctx);
}

ctx.stepWorld = stepWorld;

const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const endEl = document.getElementById('end');
const hudEl = document.getElementById('hud');
const endTitle = document.getElementById('end-title');
const endText = document.getElementById('end-text');

function showOnly(which) {
  menuEl.style.display = which === 'menu' ? 'flex' : 'none';
  pauseEl.style.display = which === 'pause' ? 'flex' : 'none';
  endEl.style.display = which === 'end' ? 'flex' : 'none';
  hudEl.style.display = which === 'playing' ? 'block' : 'none';
  canvas.style.cursor = which === 'playing' ? 'none' : 'default';
}

function announce(message) { statusEl.textContent = message; }

function startGame(fresh) {
  const save = fresh ? null : readSave();
  player.health = 100;
  player.wanted = 0;
  player.dead = false;
  player.deadReason = '';
  player.bustedTimer = 0;
  player.pos.set(120, 0, 120);
  player.yaw = Math.PI;
  player.camYaw = Math.PI;
  player.onFoot = true;
  if (player.car) { player.car = null; }
  player.mesh.visible = true;
  if (save) missions.setProgress(save.missionIndex, save.money || 0);
  else missions.setProgress(0, 0);
  audio.unlock();
  audio.startMusic();
  hud.showDialogue(DIALOGUE.intro);
  ctx.state = 'playing';
  showOnly('playing');
  announce(`${GAME_TITLE}. Playing.`);
}

function endGame(reason) {
  ctx.state = reason;
  audio.setSiren(false);
  audio.stopEngine();
  audio.playBusted();
  endTitle.textContent = reason === 'busted' ? 'BUSTED' : 'WASTED';
  endText.textContent = reason === 'busted' ? DIALOGUE.busted : DIALOGUE.wasted;
  showOnly('end');
  announce(`${endTitle.textContent}.`);
}

function respawn() {
  player.health = 100;
  player.wanted = 0;
  player.dead = false;
  player.deadReason = '';
  player.bustedTimer = 0;
  player.money = Math.max(0, player.money - 200);
  vehicles.clearPolice();
  player.pos.set(133, 0, 133);
  player.yaw = Math.PI;
  player.camYaw = Math.PI;
  if (player.car) { player.car = null; player.onFoot = true; player.mesh.visible = true; }
  ctx.state = 'playing';
  showOnly('playing');
  saveGame();
}

document.getElementById('btn-start').addEventListener('click', () => { audio.unlock(); audio.playClick(); startGame(true); });
document.getElementById('btn-continue').addEventListener('click', () => { audio.unlock(); audio.playClick(); startGame(false); });
document.getElementById('btn-resume').addEventListener('click', () => { ctx.state = 'playing'; showOnly('playing'); });
document.getElementById('btn-respawn').addEventListener('click', () => { audio.playClick(); respawn(); });
document.getElementById('btn-menu').addEventListener('click', () => { ctx.state = 'menu'; showOnly('menu'); audio.stopMusic(); });

function runShot(name) {
  const save = readSave();
  document.getElementById('btn-continue').style.display = save ? 'inline-block' : 'none';
  document.getElementById('menu-save').textContent = save
    ? `Save found: mission ${save.missionIndex + 1} of 6, $${(save.money || 0).toLocaleString('en-US')}`
    : 'No save yet — a new story starts at the safehouse.';
  if (save) missions.setProgress(save.missionIndex, save.money || 0);
  stageShot(name, ctx);
  showOnly(ctx.state === 'menu' ? 'menu' : 'playing');
  let painted = 0;
  function paint() {
    render.draw();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const save = readSave();
  document.getElementById('btn-continue').style.display = save ? 'inline-block' : 'none';
  document.getElementById('menu-save').textContent = save
    ? `Save found: mission ${save.missionIndex + 1} of 6, $${(save.money || 0).toLocaleString('en-US')}`
    : 'No save yet — a new story starts at the safehouse.';
  showOnly('menu');
  announce(`${GAME_TITLE}. Press Start.`);
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, 0.25);
    last = now;
    if (input.wasPressed('Escape')) {
      if (ctx.state === 'playing') { ctx.state = 'pause'; showOnly('pause'); }
      else if (ctx.state === 'pause') { ctx.state = 'playing'; showOnly('playing'); }
    }
    if (ctx.state === 'playing') {
      while (accumulator >= 1 / 60) { stepWorld(1 / 60, input); accumulator -= 1 / 60; }
      if (player.dead) endGame(player.deadReason);
    } else if (ctx.state === 'menu') {
      while (accumulator >= 1 / 60) { ctx.time += 1 / 60; world.animate(1 / 60); render.updateCamera(1 / 60, ctx); accumulator -= 1 / 60; }
    } else {
      accumulator = 0;
    }
    render.draw();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ctx.state === 'playing') { ctx.state = 'pause'; showOnly('pause'); }
  });
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
