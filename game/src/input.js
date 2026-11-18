// Solmar Heat — input.js: keyboard + mouse with pointer lock and one-shot presses.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0, mouseDY = 0, mouseDown = false, mouseClicked = false;
  let locked = false;

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); mouseDown = false; });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    mouseDown = true; mouseClicked = true;
    if (!locked && document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });
  window.addEventListener('mouseup', (event) => { if (event.button === 0) mouseDown = false; });

  return {
    keys,
    get locked() { return locked; },
    get mouseDown() { return mouseDown; },
    takeMouseDelta() { const d = { x: mouseDX, y: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    takeClick() { const c = mouseClicked; mouseClicked = false; return c; },
    // One-shot: true once per physical press, then consumed.
    wasPressed(code) { if (pressed.has(code)) { pressed.delete(code); return true; } return false; },
    consumeAll() { pressed.clear(); mouseDX = 0; mouseDY = 0; mouseClicked = false; },
    axis() {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s };
    },
  };
}
