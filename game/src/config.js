// Solmar Heat — config.js: tuning, city layout, story missions, names.
// Original city "Solmar City", original characters, no commercial-game content.
export const GAME_TITLE = 'SOLMAR HEAT';
export const CITY_NAME = 'Solmar City';
export const SEED = 20261119;
export const SAVE_KEY = 'solmar-heat-save-v1';

export const CITY = {
  // City is a grid of blocks. Streets run every BLOCK+STREET metres.
  blocks: 5,            // blocks per side (5x5 = 25 blocks)
  blockSize: 56,        // metres of buildable block
  streetWidth: 14,      // metres of road between blocks
  get pitch() { return this.blockSize + this.streetWidth; },
  get half() { return (this.blocks * this.pitch + this.streetWidth) / 2; },
  beachWidth: 40,       // sand + sea strip on the west edge
};

export const PLAYER = {
  walkSpeed: 7, runSpeed: 11, jumpSpeed: 8.5, gravity: 22,
  maxHealth: 100, radius: 0.6, height: 1.8,
  pistolDamage: 34, pistolRange: 60, pistolAmmo: 12, pistolReserve: 120,
  shotgunDamage: 18, shotgunPellets: 6, shotgunRange: 26,
};

export const CAR = {
  accel: 22, brake: 34, reverseAccel: 12, maxSpeed: 42, maxReverse: 12,
  steer: 1.9, grip: 6.5, drag: 0.35,
};

export const TRAFFIC = { count: 22, speedMin: 9, speedMax: 14 };
export const PEDS = { count: 36, speedMin: 1.1, speedMax: 2.2 };
export const POLICE = { maxCars: 5, maxCops: 6, chaseSpeed: 26, ramDamage: 6 };

export const WANTED = {
  decayDelay: 14,      // seconds unseen before stars start falling
  decayInterval: 9,    // seconds per star lost while hidden
  stealCar: 1, shoot: 2, killPed: 2, killCop: 2, hitAndRun: 1,
};

export const MISSIONS = [
  {
    id: 'm1', title: 'First Fare', giver: 'Mara Reyes',
    brief: 'Mara needs wheels and a reputation. Drive to the Sunset Diner and pick up the package from Lou.',
    steps: [
      { type: 'goto', label: 'Drive to Sunset Diner', x: 63, z: -63, radius: 6 },
      { type: 'talk', label: 'Meet Lou at the diner door', x: 63, z: -56, radius: 4 },
    ],
    reward: 250,
  },
  {
    id: 'm2', title: 'Three Drops', giver: 'Lou',
    brief: 'Lou has three parcels for three corners of Solmar. Deliver them all — on foot or by car, your call.',
    steps: [
      { type: 'goto', label: 'Drop 1: Marina kiosk', x: -133, z: 63, radius: 5 },
      { type: 'goto', label: 'Drop 2: Palm Court', x: 133, z: 133, radius: 5 },
      { type: 'goto', label: 'Drop 3: North Gate', x: -63, z: -133, radius: 5 },
    ],
    reward: 400,
  },
  {
    id: 'm3', title: 'Hot Wheels', giver: 'Mara Reyes',
    brief: 'A sunrise-yellow Comet GT is parked by the marina. Take it — the owner will call the cops — and bring it to the chop shop.',
    steps: [
      { type: 'steal', label: 'Steal the Comet GT at the marina', x: -133, z: 91, radius: 6, car: 'comet' },
      { type: 'deliver', label: 'Deliver the Comet to the chop shop', x: 133, z: -133, radius: 7 },
    ],
    reward: 800,
  },
  {
    id: 'm4', title: 'Dockside Deal', giver: 'Vic Delgado',
    brief: 'Vic’s deal at the docks went sour. His crew is pinned down. Clear the four dock guards and grab the case.',
    steps: [
      { type: 'combat', label: 'Clear the dock guards (0/4)', x: -133, z: -63, radius: 16, enemies: 4 },
      { type: 'pickup', label: 'Grab the case', x: -133, z: -70, radius: 4 },
    ],
    reward: 1200,
  },
  {
    id: 'm5', title: 'Harbor Chase', giver: 'Vic Delgado',
    brief: 'The case is hot and the Solmar PD wants it back. Lose the 3-star heat and reach the safehouse on Palm Court.',
    steps: [
      { type: 'escape', label: 'Lose the police, then reach the safehouse', x: 133, z: 133, radius: 7, wanted: 3 },
    ],
    reward: 1500,
  },
  {
    id: 'm6', title: 'The Big Score', giver: 'Mara Reyes',
    brief: 'One last job: the Solmar Grand Bank. Grab the cash, survive the 4-star response, and bring it home to the safehouse.',
    steps: [
      { type: 'goto', label: 'Reach Solmar Grand Bank', x: 0, z: 0, radius: 7 },
      { type: 'pickup', label: 'Grab the cash', x: 0, z: 7, radius: 4 },
      { type: 'escape', label: 'Escape the 4-star heat to the safehouse', x: 133, z: 133, radius: 7, wanted: 4 },
    ],
    reward: 5000,
  },
];

export const DIALOGUE = {
  intro: 'Solmar City, 6:47 PM. Mara Reyes — getaway driver, no crew, one borrowed sedan — is about to make a name.',
  m1Done: 'Lou: "You drive like you mean it. I got more work, if you want it."',
  m2Done: 'Lou: "Three drops, no questions. You’re reliable, kid."',
  m3Done: 'Chop shop: "Clean Comet. Vic Delgado wants to meet you."',
  m4Done: 'Vic: "You saved my crew. The case is yours to carry."',
  m5Done: 'Vic: "You shook the whole PD. Respect."',
  m6Done: 'Mara: "The Grand Bank. The whole city. We did it — Solmar is ours."',
  busted: 'BUSTED — The Solmar PD caught up with you. Bail posted, back on the street.',
  wasted: 'WASTED — Solmar City keeps moving without you. Patched up at the clinic.',
};

export const CAR_COLORS = [0xd23c2e, 0x2e6fd2, 0xe8b93c, 0x3cb371, 0xe8e8e8, 0x222226, 0x8a5fc0, 0xd2691e];
export const CAR_MODELS = [
  { name: 'Sedan', len: 4.4, wid: 1.9, h: 1.35, top: 34 },
  { name: 'Comet GT', len: 4.2, wid: 1.9, h: 1.15, top: 46 },
  { name: 'Van', len: 5.2, wid: 2.1, h: 2.1, top: 30 },
  { name: 'Taxi', len: 4.4, wid: 1.9, h: 1.4, top: 34 },
  { name: 'Pickup', len: 4.8, wid: 2.0, h: 1.7, top: 36 },
];
export const PED_SHIRTS = [0xe8e8e8, 0x3c6fd2, 0xd23c6f, 0x3cb371, 0xe8b93c, 0x8a5fc0, 0x222226, 0xd2691e];

export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look / aim (click to shoot)'],
  ['Shift', 'Sprint'],
  ['Space', 'Jump / handbrake'],
  ['E', 'Enter / exit car'],
  ['F', 'Interact / pick up'],
  ['R', 'Reload'],
  ['1 / 2', 'Pistol / shotgun'],
  ['Esc', 'Pause'],
];
