// Solmar Heat — hud.js: cash, health, wanted stars, ammo, objective, minimap, toasts.
export function createHud() {
  const el = (id) => document.getElementById(id);
  const moneyEl = el('hud-money');
  const healthFill = el('hud-health-fill');
  const starsEl = el('hud-stars');
  const ammoEl = el('hud-ammo');
  const weaponEl = el('hud-weapon');
  const speedEl = el('hud-speed');
  const objectiveEl = el('hud-objective');
  const toastEl = el('hud-toast');
  const dialogueEl = el('hud-dialogue');
  const hitmarkerEl = el('hud-hitmarker');
  const damageEl = el('hud-damage');
  const clockEl = el('hud-clock');
  const minimap = el('hud-minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;
  let toastTimer = 0, dialogueTimer = 0, hitTimer = 0;

  function mapX(x) { return ((x + 222) / 404) * 220; }
  function mapZ(z) { return ((z + 182) / 364) * 220; }

  function drawMinimap(ctx) {
    if (!mctx) return;
    const p = ctx.player;
    mctx.fillStyle = '#10141a'; mctx.fillRect(0, 0, 220, 220);
    mctx.fillStyle = '#c9b078'; mctx.fillRect(0, 0, mapX(-182), 220); // beach
    mctx.fillStyle = '#2a7fa8'; mctx.fillRect(0, 0, mapX(-222), 220); // sea
    mctx.fillStyle = '#3a3f46';
    for (const bx of ctx.world.blockCenters) for (const bz of ctx.world.blockCenters) {
      mctx.fillRect(mapX(bx - 28), mapZ(bz - 28), mapX(bx + 28) - mapX(bx - 28), mapZ(bz + 28) - mapZ(bz - 28));
    }
    mctx.strokeStyle = '#565b63'; mctx.lineWidth = 5;
    for (const s of ctx.world.streetCenters) {
      mctx.beginPath(); mctx.moveTo(mapX(s), 0); mctx.lineTo(mapX(s), 220); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, mapZ(s)); mctx.lineTo(220, mapZ(s)); mctx.stroke();
    }
    const step = ctx.missions.currentStep();
    if (step) {
      mctx.fillStyle = '#ffd23c';
      const bx = mapX(step.x), bz = mapZ(step.z);
      mctx.save(); mctx.translate(bx, bz); mctx.rotate(Math.PI / 4); mctx.fillRect(-5, -5, 10, 10); mctx.restore();
    }
    for (const c of ctx.vehicles.police) {
      mctx.fillStyle = '#4a90ff';
      mctx.beginPath(); mctx.arc(mapX(c.x), mapZ(c.z), 3.5, 0, Math.PI * 2); mctx.fill();
    }
    for (const e of ctx.peds.enemies) {
      if (e.dead) continue;
      mctx.fillStyle = '#ff4040';
      mctx.beginPath(); mctx.arc(mapX(e.x), mapZ(e.z), 3, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow.
    const px = mapX(p.pos.x), pz = mapZ(p.pos.z);
    mctx.save();
    mctx.translate(px, pz);
    mctx.rotate(-p.yaw + Math.PI);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
    mctx.restore();
  }

  return {
    toast(msg) { toastEl.textContent = msg; toastTimer = 3.5; toastEl.style.opacity = '1'; },
    showDialogue(text) { dialogueEl.textContent = text; dialogueTimer = 7; dialogueEl.style.opacity = '1'; },
    flashHitmarker() { hitTimer = 0.25; hitmarkerEl.style.opacity = '1'; },
    update(dt, ctx) {
      const p = ctx.player;
      moneyEl.textContent = `$${p.money.toLocaleString('en-US')}`;
      healthFill.style.width = `${Math.max(0, p.health)}%`;
      healthFill.style.background = p.health > 50 ? '#3cff7a' : p.health > 25 ? '#ffd23c' : '#ff4040';
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < p.wanted ? '★' : '☆';
      starsEl.textContent = stars;
      starsEl.style.color = p.wanted > 0 ? '#ffd23c' : '#8b93a3';
      const w = p.weapons[p.weapon];
      ammoEl.textContent = p.reloadTimer > 0 ? 'RELOADING…' : `${w.ammo} / ${w.reserve}`;
      weaponEl.textContent = p.weapon === 'pistol' ? 'PISTOL' : 'SHOTGUN';
      speedEl.textContent = p.car ? `${Math.round(Math.abs(p.carSpeed) * 3.6)} km/h` : '';
      objectiveEl.textContent = ctx.missions.objectiveText();
      const mins = Math.floor(ctx.time / 60) % 24;
      const hours = 18 + Math.floor(ctx.time / 3600);
      clockEl.textContent = `${String(hours % 24).padStart(2, '0')}:${String(Math.floor(ctx.time % 60)).padStart(2, '0')}  SOLMAR CITY`;
      if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toastEl.style.opacity = '0'; }
      if (dialogueTimer > 0) { dialogueTimer -= dt; if (dialogueTimer <= 0) dialogueEl.style.opacity = '0'; }
      if (hitTimer > 0) { hitTimer -= dt; if (hitTimer <= 0) hitmarkerEl.style.opacity = '0'; }
      if (p.hurtFlash > 0) { p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2.5); damageEl.style.opacity = String(p.hurtFlash * 0.55); }
      drawMinimap(ctx);
    },
  };
}
