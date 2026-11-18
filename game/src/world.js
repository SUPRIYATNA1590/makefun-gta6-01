// Solmar Heat — world.js: builds Solmar City (procedural 3D, seeded) and its collisions.
// Grid: 5x5 blocks, streets every 70 m. West edge is a beach and the sea.
import * as THREE from 'three';
import { CITY, SEED } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

const P = CITY.pitch;                 // 70 m between street centres
const H = CITY.half;                  // 182 m, city edge
const STREETS = [-175, -105, -35, 35, 105, 175];
const BLOCKS = [-140, -70, 0, 70, 140];

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function windowTexture(base, lit) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 12; y += 28) {
      for (let x = 12; x < w - 12; x += 24) {
        g.fillStyle = Math.random() < 0.55 ? lit : '#20242c';
        g.fillRect(x, y, 14, 18);
      }
    }
  });
}

function signTexture(text, bg, fg) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  });
}

function groundTexture() {
  // One big top-down map of the whole city, drawn once: asphalt, sidewalks, lane dashes.
  const S = 1024, span = 404, x0 = -222, z0 = -182;
  const px = (x) => ((x - x0) / span) * S;
  const pz = (z) => ((z - z0) / 364) * S;
  return canvasTexture(S, S, (g) => {
    g.fillStyle = '#43484f'; g.fillRect(0, 0, S, S);           // asphalt base
    g.fillStyle = '#5d6167';                                     // sidewalks
    for (const bx of BLOCKS) for (const bz of BLOCKS) {
      g.fillRect(px(bx - 33), pz(bz - 33), px(bx + 33) - px(bx - 33), pz(bz + 33) - pz(bz - 33));
    }
    g.fillStyle = '#6e6a5e';                                     // block interiors / plazas
    for (const bx of BLOCKS) for (const bz of BLOCKS) {
      g.fillRect(px(bx - 28), pz(bz - 28), px(bx + 28) - px(bx - 28), pz(bz + 28) - pz(bz - 28));
    }
    g.fillStyle = '#d8c27a';                                     // beach strip (west)
    g.fillRect(0, 0, px(-182) - px(-222), S);
    g.fillStyle = '#c9b078';
    for (let i = 0; i < 40; i += 1) g.fillRect(px(-222) + Math.random() * (px(-182) - px(-222)), Math.random() * S, 3, 3);
    g.strokeStyle = '#e8c93c'; g.lineWidth = 2;                   // centre dashes
    g.setLineDash([14, 18]);
    for (const s of STREETS) {
      g.beginPath(); g.moveTo(px(s), 0); g.lineTo(px(s), S); g.stroke();
      g.beginPath(); g.moveTo(0, pz(s)); g.lineTo(S, pz(s)); g.stroke();
    }
    g.setLineDash([]);
    g.strokeStyle = '#e8e8e8'; g.lineWidth = 3;                   // crosswalks
    for (const sx of STREETS) for (const sz of STREETS) {
      for (let i = -3; i <= 3; i += 1) {
        g.beginPath(); g.moveTo(px(sx - 7 + i * 2), pz(sz - 9)); g.lineTo(px(sx - 7 + i * 2), pz(sz - 5)); g.stroke();
      }
    }
  });
}

export function buildCity(scene) {
  const rng = mulberry32(SEED);
  const colliders = [];
  const landmarks = {};
  const clouds = [];

  const facadeA = windowTexture('#7a6a58', '#ffd98a');
  const facadeB = windowTexture('#5d6b7a', '#ffe9a8');
  const facadeC = windowTexture('#8a7f8a', '#ffd98a');
  const facades = [facadeA, facadeB, facadeC];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const palmTrunk = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const palmLeaf = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

  // Ground, beach and sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(404, 364),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(-20, 0, 0); ground.receiveShadow = true;
  scene.add(ground);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 364),
    new THREE.MeshLambertMaterial({ color: 0x2a7fa8 }),
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(-292, -0.4, 0);
  scene.add(sea);

  function addBox(w, h, d, x, z, mat, y) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, (y ?? h / 2), z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  function addCollider(x, z, hw, hd) { colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd }); }

  function tower(x, z, w, d, hgt) {
    const mat = new THREE.MeshLambertMaterial({ map: pick(rng, facades) });
    addBox(w, hgt, d, x, z, mat);
    addBox(w * 0.5, 2.5, d * 0.5, x, z, roofMat, hgt + 1.2);
    addCollider(x, z, w / 2, d / 2);
  }

  function landmarkBlock(bx, bz, kind) {
    if (kind === 'bank') {
      tower(bx, bz, 34, 30, 26);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(30, 7), new THREE.MeshBasicMaterial({ map: signTexture('SOLMAR GRAND BANK', '#123a5c', '#ffd98a') }));
      sign.position.set(bx, 20, bz + 15.2); scene.add(sign);
      landmarks.bank = { x: bx, z: bz };
    } else if (kind === 'diner') {
      const mat = new THREE.MeshLambertMaterial({ color: 0xd2691e });
      addBox(20, 7, 14, bx, bz, mat);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.MeshBasicMaterial({ map: signTexture('SUNSET DINER', '#7a1e1e', '#ffe9a8') }));
      sign.position.set(bx, 8.5, bz + 7.2); scene.add(sign);
      addCollider(bx, bz, 10, 7);
      landmarks.diner = { x: bx, z: bz };
    } else if (kind === 'marina') {
      const mat = new THREE.MeshLambertMaterial({ color: 0x3c6f8a });
      addBox(18, 6, 12, bx, bz, mat);
      addCollider(bx, bz, 9, 6);
      landmarks.marina = { x: bx, z: bz };
    } else if (kind === 'chopshop') {
      const mat = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
      addBox(24, 8, 16, bx, bz, mat);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), new THREE.MeshBasicMaterial({ map: signTexture('CHOP SHOP', '#222226', '#e8b93c') }));
      sign.position.set(bx, 9.5, bz + 8.2); scene.add(sign);
      addCollider(bx, bz, 12, 8);
      landmarks.chopshop = { x: bx, z: bz };
    } else if (kind === 'safehouse') {
      const mat = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
      addBox(16, 8, 12, bx, bz, mat);
      addBox(17, 3, 13, bx, bz, new THREE.MeshLambertMaterial({ color: 0x8a3c2e }), 9.5);
      addCollider(bx, bz, 8, 6);
      landmarks.safehouse = { x: bx, z: bz };
    } else if (kind === 'docks') {
      const mat = new THREE.MeshLambertMaterial({ map: facadeB });
      addBox(26, 9, 16, bx, bz, mat);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), new THREE.MeshBasicMaterial({ map: signTexture('SOLMAR DOCKS', '#3a2a1a', '#ffd98a') }));
      sign.position.set(bx, 10.5, bz + 8.2); scene.add(sign);
      addCollider(bx, bz, 13, 8);
      landmarks.docks = { x: bx, z: bz };
    }
  }

  const LANDMARKS = { '0,0': 'bank', '70,-70': 'diner', '-140,70': 'marina', '140,-140': 'chopshop', '140,140': 'safehouse', '-140,-70': 'docks' };
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const key = `${bx},${bz}`;
      if (LANDMARKS[key]) { landmarkBlock(bx, bz, LANDMARKS[key]); continue; }
      const n = rangeInt(rng, 1, 3);
      for (let i = 0; i < n; i += 1) {
        const ox = n === 1 ? 0 : (i === 0 ? -14 : 14);
        const oz = n === 1 ? 0 : (i === 0 ? -14 : 14);
        tower(bx + ox, bz + oz, range(rng, 16, 26), range(rng, 16, 26), range(rng, 9, 38));
      }
    }
  }

  // Palm trees along the beach and sidewalks, streetlights at intersections.
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), palmTrunk);
    trunk.position.y = 3; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.9), palmLeaf);
      leaf.position.y = 6.2; leaf.rotation.y = (i / 5) * Math.PI * 2; leaf.rotation.z = 0.5;
      leaf.translateX(1.4); leaf.castShadow = true; g.add(leaf);
    }
    g.position.set(x, 0, z); scene.add(g);
  }
  for (let z = -170; z <= 170; z += 28) { palm(-190, z); palm(-204, z + 14); }
  for (const sx of STREETS) for (const sz of STREETS) {
    if (rng() < 0.6) palm(sx + 10, sz + 10);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), poleMat);
    pole.position.set(sx + 8.5, 3.5, sz + 8.5); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
    lamp.position.set(sx + 8.5, 7.1, sz + 8.5); scene.add(lamp);
  }
  // Big SOLMAR sign over the beach road.
  const bigSign = new THREE.Mesh(new THREE.PlaneGeometry(46, 11), new THREE.MeshBasicMaterial({ map: signTexture('SOLMAR CITY', '#123a5c', '#ffffff') }));
  bigSign.position.set(-182, 16, 0); bigSign.rotation.y = Math.PI / 2; scene.add(bigSign);

  // Clouds drift above the city.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i += 1) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 6, 11), 8, 6), cloudMat);
      s.scale.y = 0.35; s.position.set(j * 8 - 8, 0, range(rng, -3, 3)); c.add(s);
    }
    c.position.set(range(rng, -200, 200), range(rng, 55, 80), range(rng, -180, 180));
    scene.add(c); clouds.push(c);
  }

  function isRoad(x, z) {
    for (const s of STREETS) {
      if (Math.abs(x - s) <= 7 || Math.abs(z - s) <= 7) return true;
    }
    return false;
  }
  function nearestStreet(v) {
    let best = STREETS[0];
    for (const s of STREETS) if (Math.abs(v - s) < Math.abs(v - best)) best = s;
    return best;
  }
  function collideCircle(p, r) {
    // Push a circle out of building colliders; returns true on a hit.
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r;
        } else {
          p.x = c.maxX + r;
        }
      }
    }
    p.x = Math.max(-215, Math.min(180, p.x));
    p.z = Math.max(-180, Math.min(180, p.z));
    return hit;
  }
  function randomRoadPoint(r) {
    const horizontal = r() < 0.5;
    const s = pick(r, STREETS);
    const along = range(r, -170, 170);
    return horizontal ? { x: along, z: s } : { x: s, z: along };
  }

  return {
    colliders, landmarks, isRoad, nearestStreet, collideCircle, randomRoadPoint,
    streetCenters: STREETS, blockCenters: BLOCKS, half: H,
    animate(dt) { for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 220) c.position.x = -220; } },
  };
}
