import * as THREE from 'three';
import { PROJECTS } from './data.js';

// ---------- Layout constants (shared with main.js for spawn/camera framing) ----------
export const LAYOUT = {
  plazaRadius: 26,
  aboutPos: new THREE.Vector3(-95, 0, 0),
  skillsPos: new THREE.Vector3(95, 0, 0),
  contactPos: new THREE.Vector3(0, 0, 226),
  boulevardStartZ: 26,
  boulevardSpacing: 8.5,
  bounds: { minX: -118, maxX: 118, minZ: -22, maxZ: 250 },
};

function flatMat(color, extra) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0.02, ...extra });
}

function box(w, h, d, color, extra) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flatMat(color, extra));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(rTop, rBottom, h, color, radialSegments = 8, extra) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, radialSegments), flatMat(color, extra));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cone(r, h, color, radialSegments = 6) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, radialSegments), flatMat(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function group(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

// ---------- Gentle "small planet" curvature ----------
// A large paraboloid approximates a sphere closely at this scale, and is much
// cheaper to compute than true spherical projection. Larger radius = subtler curve.
const PLANET_RADIUS = 3000;
export function bulgeHeight(x, z) {
  return -(x * x + z * z) / (2 * PLANET_RADIUS);
}

// Displaces a PlaneGeometry's vertices to follow the planet curve. The plane is
// defined in local XY (Z=0) before being rotated flat, and that rotation sends
// local Z -> world Y and local Y -> world -Z, so we bake the world-space bulge
// into each vertex's local Z using (localX + centerX, -localY + centerZ).
function applyBulgeToPlane(geometry, centerX, centerZ, extraHeight = 0) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const worldX = pos.getX(i) + centerX;
    const worldZ = -pos.getY(i) + centerZ;
    pos.setZ(i, bulgeHeight(worldX, worldZ) + extraHeight);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

// Lifts every top-level scene object (buildings, decor, billboards — anything
// not tagged as terrain or a light) up to the curved ground height beneath it.
// Gameplay logic (car physics, collisions, zone distances) stays in flat X/Z;
// this only adjusts the rendered Y position, so nothing about driving changes.
function applyWorldBulge(scene) {
  for (const child of scene.children) {
    if (child.userData.terrain || child.isLight) continue;
    child.position.y += bulgeHeight(child.position.x, child.position.z);
  }
}

// Keeps loose decorative scatter (trees, bushes) off the actual drivable roads.
function isNearRoad(x, z, margin = 6) {
  if (Math.hypot(x, z) < LAYOUT.plazaRadius + margin) return true;
  if (Math.abs(x) < 8 + margin && z > -LAYOUT.plazaRadius && z < LAYOUT.contactPos.z + margin) return true;
  if (Math.abs(z) < 8 + margin && x > LAYOUT.aboutPos.x - margin && x < -LAYOUT.plazaRadius) return true;
  if (Math.abs(z) < 8 + margin && x < LAYOUT.skillsPos.x + margin && x > LAYOUT.plazaRadius) return true;
  return false;
}

// ---------- Ground & roads ----------
function buildGround(scene, colliders) {
  const b = LAYOUT.bounds;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const centerX = (b.minX + b.maxX) / 2;
  const centerZ = (b.minZ + b.maxZ) / 2;
  const groundGeo = new THREE.PlaneGeometry(w, d, 64, 64);
  applyBulgeToPlane(groundGeo, centerX, centerZ);
  const ground = new THREE.Mesh(groundGeo, flatMat(0x3f8f4a));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, 0, centerZ);
  ground.receiveShadow = true;
  ground.userData.terrain = true;
  scene.add(ground);

  const roadMat = flatMat(0x2b2b2f);
  const laneMat = flatMat(0xf7f3ee);

  function roadSegment(cx, cz, sx, sz) {
    const segX = Math.max(2, Math.round(sx / 6));
    const segZ = Math.max(2, Math.round(sz / 6));
    const geo = new THREE.PlaneGeometry(sx, sz, segX, segZ);
    applyBulgeToPlane(geo, cx, cz, 0.02);
    const road = new THREE.Mesh(geo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0, cz);
    road.receiveShadow = true;
    road.userData.terrain = true;
    scene.add(road);
  }

  // Plaza (circular-ish, approximated with a wide square-round road under the landmark)
  roadSegment(0, 0, LAYOUT.plazaRadius * 2.1, LAYOUT.plazaRadius * 2.1);
  // West spur -> About
  roadSegment((LAYOUT.aboutPos.x + (-LAYOUT.plazaRadius)) / 2, 0, Math.abs(LAYOUT.aboutPos.x) - LAYOUT.plazaRadius + 18, 16);
  // East spur -> Skills
  roadSegment((LAYOUT.skillsPos.x - LAYOUT.plazaRadius) / 2 + LAYOUT.plazaRadius, 0, Math.abs(LAYOUT.skillsPos.x) - LAYOUT.plazaRadius + 18, 16);
  // Boulevard south -> Contact
  const blvdLen = LAYOUT.contactPos.z - LAYOUT.boulevardStartZ + 30;
  roadSegment(0, LAYOUT.boulevardStartZ + blvdLen / 2 - 15, 16, blvdLen);

  // Lane dashes along the boulevard
  for (let z = LAYOUT.boulevardStartZ; z < LAYOUT.contactPos.z - 10; z += 6) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), laneMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, bulgeHeight(0, z) + 0.03, z);
    dash.userData.terrain = true;
    scene.add(dash);
  }

  // Boundary colliders (invisible walls at map edges)
  colliders.push({ type: 'aabb', minX: b.minX - 5, maxX: b.maxX + 5, minZ: b.minZ - 5, maxZ: b.minZ, hard: true });
  colliders.push({ type: 'aabb', minX: b.minX - 5, maxX: b.maxX + 5, minZ: b.maxZ, maxZ: b.maxZ + 5, hard: true });
  colliders.push({ type: 'aabb', minX: b.minX - 5, maxX: b.minX, minZ: b.minZ - 5, maxZ: b.maxZ + 5, hard: true });
  colliders.push({ type: 'aabb', minX: b.maxX, maxX: b.maxX + 5, minZ: b.minZ - 5, maxZ: b.maxZ + 5, hard: true });
}

// ---------- Decor: palm trees, streetlights, flags ----------
function palmTree(x, z) {
  const g = group(x, 0, z);
  const trunk = cyl(0.28, 0.4, 4.2, 0x8a5a2b, 6);
  trunk.position.y = 2.1;
  trunk.rotation.z = (Math.random() - 0.5) * 0.15;
  g.add(trunk);
  const frondColor = 0x2f9e44;
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), flatMat(frondColor));
    frond.position.y = 4.1;
    frond.rotation.z = Math.PI / 2.6;
    frond.rotation.y = (i / 6) * Math.PI * 2;
    frond.translateOnAxis(new THREE.Vector3(0, 1, 0), 1.1);
    g.add(frond);
  }
  return g;
}

// A rounded leafy shade tree (rain-tree style), for variety against the palms.
function canopyTree(x, z) {
  const g = group(x, 0, z);
  const scale = 0.85 + Math.random() * 0.4;
  const trunkH = 2.6 * scale;
  const trunk = cyl(0.22 * scale, 0.32 * scale, trunkH, 0x6b4a2b, 6);
  trunk.position.y = trunkH / 2;
  trunk.rotation.z = (Math.random() - 0.5) * 0.1;
  g.add(trunk);

  const greens = [0x2f9e44, 0x3aa84f, 0x27823a];
  const canopyY = trunkH + 1.6 * scale;
  const blobPositions = [
    [0, 0, 0, 1.6], [0.9, -0.3, 0.5, 1.1], [-0.9, -0.2, -0.4, 1.15],
    [0.4, 0.5, -0.9, 1.05], [-0.5, 0.4, 0.8, 1.0],
  ];
  blobPositions.forEach(([bx, by, bz, br], i) => {
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(br * scale, 0),
      flatMat(greens[i % greens.length])
    );
    blob.position.set(bx * scale, canopyY + by * scale, bz * scale);
    g.add(blob);
  });
  return g;
}

// A low shrub for ground-level greenery near buildings and road edges.
function bush(x, z) {
  const g = group(x, 0, z);
  const scale = 0.6 + Math.random() * 0.5;
  const greens = [0x2f9e44, 0x3aa84f];
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5 * scale, 0),
      flatMat(greens[i % greens.length])
    );
    blob.position.set((Math.random() - 0.5) * 0.5, 0.35 * scale + Math.random() * 0.15, (Math.random() - 0.5) * 0.5);
    g.add(blob);
  }
  return g;
}

// A small roadside shophouse (kedai) used to break up the boulevard's tree line.
function shophouse(x, z, side, hue) {
  const g = group(x, 0, z);
  g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; // face the road, same convention as billboards

  const body = box(3.6, 4.4, 3.2, hue.wall);
  body.position.y = 2.2;
  g.add(body);

  const roof = box(3.9, 0.3, 3.5, hue.roof);
  roof.position.y = 4.55;
  g.add(roof);

  const awning = box(3.9, 0.15, 1.1, hue.roof);
  awning.rotation.x = -0.22;
  awning.position.set(0, 2.85, 1.85);
  g.add(awning);

  const door = box(0.9, 2, 0.1, 0x2a1c12);
  door.position.set(-0.9, 1, 1.62);
  g.add(door);

  const win = box(1.1, 1.1, 0.1, 0x9fd6ff);
  win.position.set(0.8, 2.9, 1.62);
  g.add(win);

  return g;
}

function streetLight(x, z) {
  const g = group(x, 0, z);
  const pole = cyl(0.09, 0.09, 4.6, 0x3a3a3a, 6);
  pole.position.y = 2.3;
  g.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2c2, emissive: 0xffdd88, emissiveIntensity: 1.4, flatShading: true }));
  lamp.position.y = 4.65;
  g.add(lamp);
  return g;
}

// A simple park bench, facing +Z by default — rotate to face the road.
function bench(x, z, facing) {
  const g = group(x, 0, z);
  g.rotation.y = facing;

  const woodColor = 0x8a5a2b;
  const frameColor = 0x2b2b2b;

  const seat = box(1.6, 0.08, 0.5, woodColor);
  seat.position.y = 0.45;
  g.add(seat);

  const back = box(1.6, 0.5, 0.08, woodColor);
  back.position.set(0, 0.74, -0.22);
  back.rotation.x = -0.15;
  g.add(back);

  for (const sx of [-0.65, 0.65]) {
    const legFront = box(0.06, 0.45, 0.06, frameColor);
    legFront.position.set(sx, 0.22, 0.2);
    g.add(legFront);
    const legBack = box(0.06, 0.72, 0.06, frameColor);
    legBack.position.set(sx, 0.36, -0.2);
    g.add(legBack);
    const arm = box(0.06, 0.06, 0.5, frameColor);
    arm.position.set(sx, 0.58, 0);
    g.add(arm);
  }

  return g;
}

function flagPole(x, z, colors) {
  const g = group(x, 0, z);
  const pole = cyl(0.06, 0.06, 5, 0xcccccc, 6);
  pole.position.y = 2.5;
  g.add(pole);
  colors.forEach((c, i) => {
    const flag = box(1.1, 0.5, 0.02, c);
    flag.position.set(0.6, 4.4 - i * 0.55, 0);
    g.add(flag);
  });
  return g;
}

// ---------- Central landmark: KLCC-style twin towers ----------
function buildLandmark(scene, colliders) {
  const g = group(0, 0, 0);
  const base = cyl(13, 14.5, 1.4, 0xd9c3ab, 16);
  base.position.y = 0.7;
  g.add(base);
  const plaza = cyl(11.5, 11.5, 0.3, 0xb9a586, 16);
  plaza.position.y = 1.55;
  g.add(plaza);

  const glassColor = 0x9fd0e0;
  const steelColor = 0xe8ecee;
  const steelMat = new THREE.MeshStandardMaterial({ color: steelColor, roughness: 0.3, metalness: 0.65, flatShading: true });

  // Tapered, tiered tower profile (setbacks like the real KLCC silhouette), tier[i] = [radius, height]
  const tiers = [
    [3.2, 7], [3.2, 0.6], [2.85, 6], [2.85, 0.6], [2.5, 5.5],
    [2.5, 0.5], [2.1, 5], [2.1, 0.5], [1.65, 4.5], [1.65, 0.4], [1.2, 3.5],
  ];

  function tower(offsetX) {
    const t = group(offsetX, 0, 0);
    let y = 1.7;
    let prevR = tiers[0][0] + 0.35;
    tiers.forEach(([r, h], i) => {
      const seg = cyl(r, prevR, h, i % 2 === 0 ? glassColor : steelColor, 12, {
        roughness: i % 2 === 0 ? 0.22 : 0.3,
        metalness: i % 2 === 0 ? 0.55 : 0.65,
      });
      seg.position.y = y + h / 2;
      t.add(seg);
      y += h;
      prevR = r;
    });

    // Mast / spire with a pinnacle, echoing the real towers' antenna masts
    const mastBase = cyl(0.35, 1.2, 3, 0xf7f3ee, 8);
    mastBase.position.y = y + 1.5;
    t.add(mastBase);
    y += 3;
    const mast = cyl(0.08, 0.35, 5.5, 0xf7f3ee, 6);
    mast.position.y = y + 2.75;
    t.add(mast);
    y += 5.5;
    const pinnacle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), steelMat);
    pinnacle.position.y = y + 0.1;
    t.add(pinnacle);

    return t;
  }
  const towerL = tower(-6.2);
  const towerR = tower(6.2);
  g.add(towerL, towerR);

  // Skybridge between the towers (double-deck look), roughly 40% up the shaft
  const bridgeY = 17;
  const bridge = box(7.6, 1.1, 2.1, 0xd9c3ab, { roughness: 0.5, metalness: 0.2 });
  bridge.position.set(0, bridgeY, 0);
  g.add(bridge);
  const bridgeGlass = box(7.65, 0.7, 2.15, 0x9fd0e0, { roughness: 0.2, metalness: 0.5 });
  bridgeGlass.position.set(0, bridgeY + 0.9, 0);
  g.add(bridgeGlass);
  // Diagonal support struts under the bridge
  for (const s of [-1, 1]) {
    const strut = cyl(0.12, 0.12, 5.6, 0xaab0b4, 6, { roughness: 0.4, metalness: 0.6 });
    strut.position.set(s * 3.6, bridgeY - 2.6, 0);
    strut.rotation.z = s * 0.55;
    g.add(strut);
  }

  scene.add(g);
  colliders.push({ type: 'circle', x: 0, z: 0, radius: 14.5 });
}

// ---------- About: kampung house on stilts ----------
function windowWithFrame(g, x, y, z, w, h, glowLit) {
  const frame = box(w + 0.28, h + 0.28, 0.1, 0x5a3a20);
  frame.position.set(x, y, z);
  g.add(frame);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0x7fb7c9, emissive: glowLit ? 0xffdf9e : 0x000000, emissiveIntensity: glowLit ? 0.7 : 0,
      roughness: 0.3, metalness: 0.2, flatShading: true,
    })
  );
  glass.position.set(x, y, z + 0.03);
  g.add(glass);
  for (const sx of [-1, 1]) {
    const shutter = box(0.22, h + 0.1, 0.08, 0x2f6b4a);
    shutter.position.set(x + sx * (w / 2 + 0.24), y, z - 0.02);
    g.add(shutter);
  }
}

function buildAboutHouse(scene, zones, colliders) {
  const pos = LAYOUT.aboutPos;
  const g = group(pos.x, 0, pos.z);
  g.rotation.y = Math.PI / 2; // face the approach road coming from the plaza (+X)

  const stiltMat = 0x6b4a2b;
  const stiltPositions = [[-3.4, -2.6], [3.4, -2.6], [-3.4, 2.6], [3.4, 2.6], [-3.4, 4.4], [3.4, 4.4]];
  stiltPositions.forEach(([sx, sz]) => {
    const stilt = cyl(0.34, 0.36, 3, stiltMat, 8);
    stilt.position.set(sx, 1.5, sz);
    g.add(stilt);
  });

  // Main floor + porch deck extension
  const floor = box(8.4, 0.6, 6.4, 0xc9a876);
  floor.position.y = 3.2;
  g.add(floor);
  const porchDeck = box(8.4, 0.5, 2.2, 0xbfa06e);
  porchDeck.position.set(0, 3.15, 4.5);
  g.add(porchDeck);

  const walls = box(8, 4, 6, 0xf6ead2);
  walls.position.y = 5.5;
  g.add(walls);
  // Painted lower skirting for a two-tone facade
  const skirt = box(8.05, 1, 6.05, 0x2f6b4a);
  skirt.position.y = 3.9;
  g.add(skirt);

  // Hip roof with overhanging eaves + ridge cap
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 3.6, 4), flatMat(0xb33a1e));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 9.3;
  roof.castShadow = true;
  g.add(roof);
  const ridgeCap = cyl(0.18, 0.18, 3.4, 0x8a2a1a, 6);
  ridgeCap.rotation.z = Math.PI / 2;
  ridgeCap.position.y = 10.85;
  g.add(ridgeCap);
  const fascia = box(8.6, 0.25, 6.6, 0x8a2a1a);
  fascia.position.y = 7.55;
  g.add(fascia);

  // Porch roof overhang, supported on two pillars
  const porchRoof = box(8.6, 0.25, 2.8, 0xb33a1e);
  porchRoof.rotation.x = -0.12;
  porchRoof.position.set(0, 7.1, 4.9);
  g.add(porchRoof);
  for (const sx of [-3.4, 3.4]) {
    const pillar = cyl(0.16, 0.16, 3.6, 0xf6ead2, 8);
    pillar.position.set(sx, 5.0, 5.6);
    g.add(pillar);
  }

  // Porch railing
  for (const sx of [-2.6, -1.3, 0, 1.3, 2.6]) {
    const baluster = cyl(0.06, 0.06, 0.9, 0xf6ead2, 6);
    baluster.position.set(sx, 3.75, 5.55);
    g.add(baluster);
  }
  const railTop = box(6.6, 0.1, 0.1, 0xf6ead2);
  railTop.position.set(0, 4.2, 5.55);
  g.add(railTop);

  const door = box(1.5, 2.5, 0.15, 0x8a5a2b);
  door.position.set(0, 4.45, 3.02);
  g.add(door);
  const doorFrame = box(1.72, 2.72, 0.08, 0x5a3a20);
  doorFrame.position.set(0, 4.45, 2.96);
  g.add(doorFrame);

  windowWithFrame(g, -2.7, 5.8, 3.02, 1.1, 1.1, true);
  windowWithFrame(g, 2.7, 5.8, 3.02, 1.1, 1.1, true);
  windowWithFrame(g, -3.5, 5.8, 0, 1.0, 1.0, false);
  windowWithFrame(g, 3.5, 5.8, 0, 1.0, 1.0, true);

  const stairs = box(1.8, 0.2, 2.6, 0x8a5a2b);
  stairs.position.set(0, 1.6, 6.0);
  stairs.rotation.x = -0.35;
  g.add(stairs);
  for (const sx of [-0.95, 0.95]) {
    const stairRail = box(0.08, 0.9, 2.6, 0xf6ead2);
    stairRail.position.set(sx, 2.15, 6.0);
    stairRail.rotation.x = -0.35;
    g.add(stairRail);
  }

  // Front yard fence with a gate gap facing the road
  const fenceZ = 8.2;
  const fenceColor = 0xf6ead2;
  for (const sx of [-5.4, -4.4, -3.4, 3.4, 4.4, 5.4]) {
    const post = cyl(0.08, 0.08, 1.1, fenceColor, 6);
    post.position.set(sx, 0.55, fenceZ);
    g.add(post);
  }
  for (const sx of [-4.9, 4.9]) {
    const rail = box(2.1, 0.09, 0.09, fenceColor);
    rail.position.set(sx, 0.75, fenceZ);
    g.add(rail);
    const railLow = box(2.1, 0.09, 0.09, fenceColor);
    railLow.position.set(sx, 0.35, fenceZ);
    g.add(railLow);
  }
  for (const [fx, fz] of [[-8, 0], [8, 0], [0, -6]]) {
    const sideFence = box(fz === 0 ? 0.12 : 6, 1.1, fz === 0 ? 6 : 0.12, fenceColor);
    sideFence.position.set(fx, 0.55, fenceZ - 3 + (fz === 0 ? 0 : fz));
    g.add(sideFence);
  }

  // Mailbox near the gate
  const mailPost = cyl(0.06, 0.06, 1.3, 0x8a5a2b, 6);
  mailPost.position.set(4.9, 0.65, fenceZ + 1);
  g.add(mailPost);
  const mailBox = box(0.5, 0.35, 0.3, 0xc1272d);
  mailBox.position.set(4.9, 1.35, fenceZ + 1);
  g.add(mailBox);

  // Flower planters flanking the stairs
  for (const sx of [-1.6, 1.6]) {
    const pot = cyl(0.4, 0.3, 0.5, 0xb33a1e, 8);
    pot.position.set(sx, 0.25, 7.1);
    g.add(pot);
    const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), flatMat(0x3aa84f));
    plant.position.set(sx, 0.65, 7.1);
    g.add(plant);
  }

  scene.add(g);
  colliders.push({ type: 'circle', x: pos.x, z: pos.z, radius: 6.5 });
  zones.push({ id: 'about', kind: 'about', name: 'Rumah Faiq — About', position: pos.clone(), radius: 10, promptText: 'View About & Experience' });
}

// ---------- Skills: workshop / garage ----------
// A simple low-poly scooter, facing +Z by default (matches the group-forward
// convention used throughout this file).
function buildScooter(color) {
  const g = new THREE.Group();

  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12);
  const wheelMat = flatMat(0x1a1a1a, { roughness: 0.9 });
  const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.set(0, 0.28, 0.55);
  frontWheel.castShadow = true;
  g.add(frontWheel);
  const rearWheel = frontWheel.clone();
  rearWheel.position.z = -0.5;
  g.add(rearWheel);

  const footboard = box(0.32, 0.06, 0.9, 0x2b2b2b);
  footboard.position.y = 0.42;
  g.add(footboard);

  const bodyShield = box(0.36, 0.55, 0.35, color);
  bodyShield.position.set(0, 0.68, 0.5);
  bodyShield.rotation.x = 0.15;
  g.add(bodyShield);

  const seat = box(0.3, 0.12, 0.7, 0x1a1a1a);
  seat.position.set(0, 0.62, -0.15);
  g.add(seat);
  const seatBack = box(0.3, 0.2, 0.15, 0x1a1a1a);
  seatBack.position.set(0, 0.72, -0.5);
  g.add(seatBack);

  const forkPost = cyl(0.03, 0.03, 0.5, 0x888888, 6);
  forkPost.rotation.x = -0.25;
  forkPost.position.set(0, 0.68, 0.55);
  g.add(forkPost);

  const handlebar = box(0.04, 0.04, 0.5, 0x2b2b2b);
  handlebar.position.set(0, 0.92, 0.58);
  g.add(handlebar);
  for (const s of [-1, 1]) {
    const grip = cyl(0.03, 0.03, 0.12, 0x1a1a1a, 6);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(s * 0.24, 0.92, 0.58);
    g.add(grip);
  }

  const headlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xffedb0, emissiveIntensity: 0.6, flatShading: true })
  );
  headlight.position.set(0, 0.65, 0.7);
  g.add(headlight);

  return g;
}

function buildSkillsWorkshop(scene, zones, colliders) {
  const pos = LAYOUT.skillsPos;
  const g = group(pos.x, 0, pos.z);
  g.rotation.y = -Math.PI / 2; // face the approach road coming from the plaza (-X)

  const base = box(10, 5.4, 8, 0x3a4048);
  base.position.y = 2.7;
  g.add(base);

  const roof = box(11, 0.5, 8.6, 0xe85002);
  roof.position.y = 5.65;
  g.add(roof);

  const doorL = box(3.6, 3.6, 0.2, 0x1a1a1a);
  doorL.position.set(-1.9, 1.9, 4.02);
  g.add(doorL);
  const doorR = box(3.6, 3.6, 0.2, 0x1a1a1a);
  doorR.position.set(1.9, 1.9, 4.02);
  g.add(doorR);
  for (let i = 0; i < 3; i++) {
    const bar = box(6.9, 0.12, 0.22, 0x555555);
    bar.position.set(0, 0.9 + i * 1.1, 4.05);
    g.add(bar);
  }

  const chimney = cyl(0.5, 0.6, 2.4, 0x555555, 6);
  chimney.position.set(3.6, 6.6, -2.6);
  g.add(chimney);

  // Gear sign
  const sign = cyl(1.4, 1.4, 0.25, 0xc8ff3d, 10);
  sign.rotation.x = Math.PI / 2;
  sign.position.set(0, 4.2, 4.4);
  g.add(sign);

  // Scooters parked outside the bengkel
  const scooter1 = buildScooter(0xd9622b);
  scooter1.position.set(-4.4, 0, 5.4);
  scooter1.rotation.y = 0.35;
  g.add(scooter1);
  const scooter2 = buildScooter(0x1c4f82);
  scooter2.position.set(-3.1, 0, 5.9);
  scooter2.rotation.y = -0.2;
  g.add(scooter2);

  scene.add(g);
  colliders.push({ type: 'circle', x: pos.x, z: pos.z, radius: 7.5 });
  zones.push({ id: 'skills', kind: 'skills', name: 'Bengkel Kemahiran — Skills', position: pos.clone(), radius: 11, promptText: 'View Skills & Expertise' });
}

// ---------- Contact: kedai kopi (coffee shop) ----------
function buildContactKedai(scene, zones, colliders) {
  const pos = LAYOUT.contactPos;
  const g = group(pos.x, 0, pos.z);
  // Front-facing details below are built on the -Z face directly, since the
  // boulevard approaches the kedai from -Z — no group rotation needed.

  const shop = box(9, 4.6, 7, 0xe8d3a0);
  shop.position.y = 2.3;
  g.add(shop);

  const roof = box(10, 0.5, 7.8, 0x8a2e1f);
  roof.position.y = 4.85;
  g.add(roof);

  const awning = box(7.4, 0.18, 2.2, 0xc1272d);
  awning.rotation.x = -0.28;
  awning.position.set(0, 3.55, -4.1);
  g.add(awning);
  const awningPost = (x) => {
    const post = cyl(0.08, 0.08, 1.8, 0x8a2e1f, 6);
    post.position.set(x, 2.55, -4.9);
    g.add(post);
  };
  awningPost(-3.3);
  awningPost(3.3);

  const counterWin = box(6.4, 1.8, 0.15, 0xfff6df);
  counterWin.position.set(0, 2.6, -3.55);
  g.add(counterWin);

  // Little tables outside
  for (const [tx, tz] of [[-4.2, -6], [4.2, -6.4]]) {
    const table = cyl(0.9, 0.9, 0.15, 0xf7f3ee, 10);
    table.position.set(tx, 1.1, tz);
    g.add(table);
    const leg = cyl(0.12, 0.12, 1.05, 0x555555, 6);
    leg.position.set(tx, 0.55, tz);
    g.add(leg);
  }

  const sign = box(3.2, 0.9, 0.15, 0x1a1a1a);
  sign.position.set(0, 5.6, -3.9);
  g.add(sign);

  // A signboard for the kedai itself, planted a bit up the boulevard so
  // drivers see it coming before they arrive.
  const kedaiBillboardPost = cyl(0.18, 0.22, 3.4, 0x3a3a3a, 6);
  kedaiBillboardPost.position.set(11, 1.7, -20);
  g.add(kedaiBillboardPost);

  const kedaiTexture = createKedaiBillboardTexture();
  const kedaiPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.25),
    new THREE.MeshStandardMaterial({
      map: kedaiTexture, emissiveMap: kedaiTexture, emissive: 0xffffff, emissiveIntensity: 0.9,
      roughness: 0.8, flatShading: true,
    })
  );
  kedaiPanel.position.set(11, 3.9, -20);
  kedaiPanel.rotation.y = Math.PI; // face oncoming traffic driving up the boulevard
  kedaiPanel.castShadow = true;
  g.add(kedaiPanel);

  const kedaiFrame = box(3.8, 2.45, 0.12, 0x1a1a1a);
  kedaiFrame.position.set(11, 3.9, -19.92);
  g.add(kedaiFrame);

  scene.add(g);
  colliders.push({ type: 'circle', x: pos.x, z: pos.z, radius: 8 });
  colliders.push({ type: 'circle', x: pos.x + 11, z: pos.z - 20, radius: 1.3 });
  zones.push({ id: 'contact', kind: 'contact', name: 'Kedai Kopi — Contact', position: pos.clone(), radius: 12, promptText: 'View Contact Details' });
}

// ---------- Project boulevard billboards ----------
// Small procedural vector icon set standing in for each project's category —
// drawn with plain canvas paths so no external image assets are needed.
function drawIcon(ctx, type, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const s = size;
  const shade = 'rgba(0,0,0,0.35)';

  switch (type) {
    case 'tag':
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.1);
      ctx.lineTo(s * 0.05, -s * 0.45);
      ctx.lineTo(s * 0.45, -s * 0.05);
      ctx.lineTo(s * 0.05, s * 0.45);
      ctx.lineTo(-s * 0.45, s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(-s * 0.2, -s * 0.22, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'coin':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade;
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = shade;
      ctx.font = `700 ${Math.round(s * 0.42)}px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, s * 0.03);
      break;
    case 'coffee':
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, -s * 0.15);
      ctx.lineTo(s * 0.28, -s * 0.15);
      ctx.lineTo(s * 0.22, s * 0.35);
      ctx.quadraticCurveTo(0, s * 0.48, -s * 0.16, s * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.arc(s * 0.36, -s * 0.02, s * 0.14, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();
      ctx.strokeStyle = shade;
      ctx.lineWidth = s * 0.045;
      for (const dx of [-s * 0.1, s * 0.08]) {
        ctx.beginPath();
        ctx.moveTo(dx, -s * 0.22);
        ctx.quadraticCurveTo(dx - s * 0.05, -s * 0.34, dx, -s * 0.44);
        ctx.stroke();
      }
      break;
    case 'people':
      for (const dx of [-s * 0.2, s * 0.2]) {
        ctx.beginPath();
        ctx.arc(dx, -s * 0.18, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(dx - s * 0.2, s * 0.4);
        ctx.quadraticCurveTo(dx, -s * 0.02, dx + s * 0.2, s * 0.4);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 'car':
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, s * 0.1);
      ctx.lineTo(-s * 0.3, -s * 0.08);
      ctx.lineTo(-s * 0.1, -s * 0.22);
      ctx.lineTo(s * 0.18, -s * 0.22);
      ctx.lineTo(s * 0.36, -s * 0.05);
      ctx.lineTo(s * 0.42, s * 0.1);
      ctx.lineTo(s * 0.42, s * 0.22);
      ctx.lineTo(-s * 0.42, s * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade;
      for (const dx of [-s * 0.22, s * 0.22]) {
        ctx.beginPath();
        ctx.arc(dx, s * 0.24, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'building': {
      ctx.fillRect(-s * 0.32, -s * 0.42, s * 0.64, s * 0.84);
      ctx.fillStyle = shade;
      const cols = 3, rows = 4;
      const w = s * 0.1, h = s * 0.1;
      const gapX = (s * 0.64 - w * cols) / (cols + 1);
      const gapY = (s * 0.84 - h * rows) / (rows + 1);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillRect(-s * 0.32 + gapX + (w + gapX) * c, -s * 0.42 + gapY + (h + gapY) * r, w, h);
        }
      }
      break;
    }
    case 'moon':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(s * 0.18, -s * 0.08, s * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'rack':
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-s * 0.4, -s * 0.36 + i * (s * 0.24), s * 0.8, s * 0.14);
      }
      break;
    case 'chart':
      [0.3, 0.55, 0.4, 0.75].forEach((h, i) => {
        ctx.fillRect(-s * 0.4 + i * (s * 0.22), s * 0.4 - s * h, s * 0.16, s * h);
      });
      break;
    case 'leaf':
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.42);
      ctx.quadraticCurveTo(s * 0.4, -s * 0.1, 0, s * 0.42);
      ctx.quadraticCurveTo(-s * 0.4, -s * 0.1, 0, -s * 0.42);
      ctx.fill();
      ctx.strokeStyle = shade;
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.32);
      ctx.lineTo(0, s * 0.3);
      ctx.stroke();
      break;
    case 'plane':
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.45);
      ctx.lineTo(s * 0.1, s * 0.1);
      ctx.lineTo(s * 0.42, s * 0.28);
      ctx.lineTo(s * 0.42, s * 0.36);
      ctx.lineTo(s * 0.08, s * 0.24);
      ctx.lineTo(s * 0.05, s * 0.44);
      ctx.lineTo(s * 0.16, s * 0.5);
      ctx.lineTo(0, s * 0.46);
      ctx.lineTo(-s * 0.16, s * 0.5);
      ctx.lineTo(-s * 0.05, s * 0.44);
      ctx.lineTo(-s * 0.08, s * 0.24);
      ctx.lineTo(-s * 0.42, s * 0.36);
      ctx.lineTo(-s * 0.42, s * 0.28);
      ctx.lineTo(-s * 0.1, s * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case 'column':
      for (const dx of [-s * 0.28, 0, s * 0.28]) {
        ctx.fillRect(dx - s * 0.06, -s * 0.3, s * 0.12, s * 0.6);
      }
      ctx.fillRect(-s * 0.42, -s * 0.4, s * 0.84, s * 0.1);
      ctx.fillRect(-s * 0.42, s * 0.3, s * 0.84, s * 0.1);
      break;
    case 'tent':
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.42);
      ctx.lineTo(s * 0.42, s * 0.38);
      ctx.lineTo(-s * 0.42, s * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.1);
      ctx.lineTo(s * 0.14, s * 0.38);
      ctx.lineTo(-s * 0.14, s * 0.38);
      ctx.closePath();
      ctx.fill();
      break;
    case 'cap':
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.3);
      ctx.lineTo(s * 0.42, -s * 0.05);
      ctx.lineTo(0, s * 0.2);
      ctx.lineTo(-s * 0.42, -s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.16, s * 0.02, s * 0.32, s * 0.16);
      ctx.beginPath();
      ctx.moveTo(s * 0.3, -s * 0.02);
      ctx.lineTo(s * 0.34, s * 0.3);
      ctx.lineTo(s * 0.24, s * 0.3);
      ctx.closePath();
      ctx.fill();
      break;
    case 'globe':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade;
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, 0);
      ctx.lineTo(s * 0.42, 0);
      ctx.stroke();
      for (const ry of [0.42, 0.24]) {
        ctx.beginPath();
        ctx.ellipse(0, 0, s * ry, s * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'cube': {
      const q = s * 0.34;
      ctx.beginPath();
      ctx.moveTo(0, -q * 1.2);
      ctx.lineTo(q, -q * 0.5);
      ctx.lineTo(q, q * 0.7);
      ctx.lineTo(0, q * 1.35);
      ctx.lineTo(-q, q * 0.7);
      ctx.lineTo(-q, -q * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade;
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(0, -q * 1.2);
      ctx.lineTo(0, q * 0.1);
      ctx.moveTo(0, q * 0.1);
      ctx.lineTo(q, -q * 0.5);
      ctx.moveTo(0, q * 0.1);
      ctx.lineTo(-q, -q * 0.5);
      ctx.moveTo(0, q * 0.1);
      ctx.lineTo(0, q * 1.35);
      ctx.stroke();
      break;
    }
    default:
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}

function createBillboardTexture(project) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');

  // Card background with a subtle vignette for depth
  const grad = ctx.createLinearGradient(0, 0, 512, 320);
  grad.addColorStop(0, project.colorA);
  grad.addColorStop(1, project.colorB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);
  const vignette = ctx.createRadialGradient(256, 140, 40, 256, 140, 340);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 512, 320);

  // Browser-style chrome bar, echoing the mockup cards on the original site
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(0, 0, 512, 34);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(20 + i * 18, 17, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(84, 9, 400, 16);

  // Hero icon badge
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(256, 122, 58, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, project.icon || 'tag', 256, 122, 72, '#f7f3ee');

  // Content-line placeholders, like a page preview under the hero
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(176, 198, 160, 9);
  ctx.fillRect(206, 214, 100, 7);

  // Bottom label strip
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(0, 230, 512, 90);

  ctx.fillStyle = '#f7f3ee';
  ctx.font = '600 34px "Space Grotesk", sans-serif';
  wrapText(ctx, project.title, 28, 275, 456, 38);

  ctx.fillStyle = '#e85002';
  ctx.font = '600 18px "Inter", sans-serif';
  ctx.fillText(project.tag.toUpperCase(), 28, 58);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A dedicated signboard for the kedai kopi itself, styled like a real shop
// sign rather than the project billboards' website-mockup look.
function createKedaiBillboardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 512, 320);
  grad.addColorStop(0, '#c1272d');
  grad.addColorStop(1, '#7a1a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);

  ctx.strokeStyle = 'rgba(255,246,234,0.4)';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 512 - 28, 320 - 28);

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(256, 108, 62, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, 'coffee', 256, 108, 78, '#fff6ea');

  ctx.fillStyle = '#fff6ea';
  ctx.textAlign = 'center';
  ctx.font = '700 46px "Space Grotesk", sans-serif';
  ctx.fillText('KEDAI KOPI', 256, 232);

  ctx.fillStyle = 'rgba(255,246,234,0.85)';
  ctx.font = '600 20px "Inter", sans-serif';
  ctx.fillText("Let's talk — just ahead", 256, 268);
  ctx.textAlign = 'left';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word + ' ';
    } else {
      line = test;
    }
  }
  lines.push(line);
  const startY = y - (lines.length - 1) * lineHeight;
  lines.forEach((l, i) => ctx.fillText(l.trim(), x, startY + i * lineHeight));
}

function buildBillboards(scene, zones, colliders) {
  PROJECTS.forEach((project, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const z = LAYOUT.boulevardStartZ + Math.floor(i / 2) * LAYOUT.boulevardSpacing * 2 + (i % 2) * LAYOUT.boulevardSpacing;
    const x = side * 11;

    const g = group(x, 0, z);
    g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

    const post = cyl(0.18, 0.22, 3.4, 0x3a3a3a, 6);
    post.position.y = 1.7;
    g.add(post);

    const texture = createBillboardTexture(project);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 2.25),
      new THREE.MeshStandardMaterial({
        map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0.9,
        roughness: 0.8, flatShading: true,
      })
    );
    panel.position.y = 3.9;
    panel.castShadow = true;
    g.add(panel);

    const frame = box(3.8, 2.45, 0.12, 0x1a1a1a);
    frame.position.set(0, 3.9, -0.08);
    g.add(frame);

    scene.add(g);
    colliders.push({ type: 'circle', x, z, radius: 1.3 });
    zones.push({
      id: `project-${i}`,
      kind: 'project',
      name: project.title,
      position: new THREE.Vector3(x, 0, z),
      radius: 6,
      promptText: `View ${project.title}`,
      projectIndex: i,
    });
  });
}

// ---------- Filler skyline: generic buildings with lit-window facades ----------
const windowTextureCache = new Map();
function getWindowTexture(theme) {
  if (windowTextureCache.has(theme)) return windowTextureCache.get(theme);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = theme.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cols = 5;
  const rows = 10;
  const padX = 6;
  const padY = 8;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() < theme.litChance;
      ctx.fillStyle = lit ? theme.lit : theme.dark;
      ctx.fillRect(c * cellW + padX / 2, r * cellH + padY / 2, cellW - padX, cellH - padY);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  windowTextureCache.set(theme, texture);
  return texture;
}

const SKYLINE_THEMES = [
  { type: 'tower', base: '#1c2733', dark: '#243342', lit: '#ffe9a8', litChance: 0.35 },
  { type: 'tower', base: '#2a2420', dark: '#332b25', lit: '#ffd9a0', litChance: 0.3 },
  { type: 'tower', base: '#152229', dark: '#1c2e37', lit: '#bfe8ff', litChance: 0.28 },
  { type: 'tower', base: '#241c2a', dark: '#2e2434', lit: '#ffe0f0', litChance: 0.25 },
];

// Colorful low/mid-rise heritage shophouse fronts — the Penang side of the
// "crowded Malaysian city" look, mixed in among the taller Johor-style towers.
const SHOPHOUSE_THEMES = [
  { type: 'shophouse', base: '#e8b4bc', frame: '#fff6ea', awning: '#c1272d', lit: '#ffe9a8', litChance: 0.4 },
  { type: 'shophouse', base: '#a9c9a0', frame: '#fff6ea', awning: '#2f6b4a', lit: '#ffd9a0', litChance: 0.35 },
  { type: 'shophouse', base: '#f2d98d', frame: '#5a3a20', awning: '#1c4f82', lit: '#bfe8ff', litChance: 0.3 },
  { type: 'shophouse', base: '#9fc9d9', frame: '#fff6ea', awning: '#e07a2b', lit: '#ffe0f0', litChance: 0.35 },
  { type: 'shophouse', base: '#e0c8a0', frame: '#5a3a20', awning: '#5a2c6b', lit: '#ffe9a8', litChance: 0.3 },
];
const ALL_SKYLINE_THEMES = [...SKYLINE_THEMES, ...SHOPHOUSE_THEMES];

const shophouseTextureCache = new Map();
function getShophouseTexture(theme) {
  if (shophouseTextureCache.has(theme)) return shophouseTextureCache.get(theme);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = theme.base;
  ctx.fillRect(0, 0, 128, 256);

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, 128, 10);

  const cols = 2, rows = 3;
  const cellW = 128 / cols;
  const cellH = (256 - 56) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + 14;
      const wy = 14 + r * cellH + 10;
      const ww = cellW - 28;
      const wh = cellH - 24;
      ctx.fillStyle = theme.frame;
      ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
      const lit = Math.random() < theme.litChance;
      ctx.fillStyle = lit ? theme.lit : 'rgba(0,0,0,0.55)';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.stroke();
    }
  }

  // Ground-floor awning band, like a shopfront
  ctx.fillStyle = theme.awning;
  ctx.fillRect(0, 210, 128, 46);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  shophouseTextureCache.set(theme, texture);
  return texture;
}

function fillerBuilding(x, z, w, h, d, theme) {
  const texture = theme.type === 'shophouse' ? getShophouseTexture(theme) : getWindowTexture(theme);
  const sideMat = new THREE.MeshStandardMaterial({
    map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0.85,
    roughness: 0.85, metalness: 0.05,
  });
  const capMat = flatMat(0x11161c);
  // Box face order: +x, -x, +y, -y, +z, -z
  const materials = [sideMat, sideMat, capMat, capMat, sideMat, sideMat];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
  mesh.position.y = h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const roofCap = box(w * 1.04, 0.4, d * 1.04, 0x11161c);
  roofCap.position.y = h + 0.2;

  const g = group(x, 0, z);
  g.add(mesh, roofCap);
  return g;
}

// A dense skyline scattered beyond the roads/zones — mixing tall Johor-style
// glass towers with colorful Penang-style shophouse fronts for a crowded
// Malaysian city feel — kept clear of the drivable areas and the zone
// buildings themselves (tight circular exclusions, not broad strips), so
// buildings can crowd right up alongside About/Skills/Contact.
function buildSkyline(scene, colliders) {
  const rand = (min, max) => min + Math.random() * (max - min);
  const b = LAYOUT.bounds;
  const placed = [];

  function tooClose(x, z, minDist) {
    return placed.some((p) => Math.hypot(p.x - x, p.z - z) < minDist);
  }

  function blockedByRoads(x, z) {
    if (Math.hypot(x, z) < LAYOUT.plazaRadius + 16) return true; // plaza itself, with room for the corner turns
    if (Math.abs(x) < 30 && z > -22 && z < LAYOUT.contactPos.z + 18) return true; // boulevard + tree/shophouse row
    if (Math.abs(z) < 10 && x > LAYOUT.aboutPos.x - 10 && x < -LAYOUT.plazaRadius - 2) return true; // west spur road
    if (Math.abs(z) < 10 && x < LAYOUT.skillsPos.x + 10 && x > LAYOUT.plazaRadius + 2) return true; // east spur road
    if (Math.hypot(x - LAYOUT.aboutPos.x, z - LAYOUT.aboutPos.z) < 11) return true; // About house footprint
    if (Math.hypot(x - LAYOUT.skillsPos.x, z - LAYOUT.skillsPos.z) < 11) return true; // Skills workshop footprint
    if (Math.hypot(x - LAYOUT.contactPos.x, z - LAYOUT.contactPos.z) < 13) return true; // Contact kedai footprint
    return false;
  }

  const count = 130;
  let attempts = 0;
  let added = 0;
  while (added < count && attempts < count * 12) {
    attempts++;
    const x = rand(b.minX + 6, b.maxX - 6);
    const z = rand(b.minZ + 6, b.maxZ - 6);
    if (blockedByRoads(x, z)) continue;
    if (tooClose(x, z, 9)) continue;

    const theme = ALL_SKYLINE_THEMES[Math.floor(Math.random() * ALL_SKYLINE_THEMES.length)];
    const isShophouse = theme.type === 'shophouse';
    const w = isShophouse ? rand(5, 8) : rand(6, 11);
    const d = isShophouse ? rand(6, 9) : rand(6, 11);
    const h = isShophouse ? rand(7, 13) : rand(9, 30);
    scene.add(fillerBuilding(x, z, w, h, d, theme));
    colliders.push({ type: 'circle', x, z, radius: Math.max(w, d) / 2 + 1 });
    placed.push({ x, z });
    added++;
  }
}

// ---------- Traffic lights (lampu isyarat) at the plaza junctions ----------
function trafficLight(x, z, facing) {
  const g = group(x, 0, z);
  g.rotation.y = facing;

  const pole = cyl(0.1, 0.12, 4.2, 0x2b2b2b, 8);
  pole.position.y = 2.1;
  g.add(pole);

  const housing = box(0.4, 1.15, 0.35, 0x1a1a1a);
  housing.position.set(0, 4.0, 0.24);
  g.add(housing);

  const lensColors = [0xff3b30, 0xffcc00, 0x2fbf4f];
  lensColors.forEach((c, i) => {
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 10),
      new THREE.MeshStandardMaterial({
        color: c, emissive: c, emissiveIntensity: i === 2 ? 1.1 : 0.12, flatShading: true,
      })
    );
    lens.position.set(0, 4.42 - i * 0.36, 0.42);
    g.add(lens);
  });

  return g;
}

function zebraCrossing(cx, cz, width, alongX) {
  const g = new THREE.Group();
  const stripeCount = 6;
  for (let i = 0; i < stripeCount; i++) {
    const offset = (i - (stripeCount - 1) / 2) * 1.1;
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? 0.6 : width, alongX ? width : 0.6), flatMat(0xf7f3ee));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(cx + (alongX ? offset : 0), 0.025, cz + (alongX ? 0 : offset));
    g.add(stripe);
  }
  return g;
}

function buildTrafficLights(scene) {
  const r = LAYOUT.plazaRadius;
  // South junction (plaza -> boulevard)
  scene.add(trafficLight(-9, r - 2, 0));
  scene.add(trafficLight(9, r - 2, Math.PI));
  scene.add(zebraCrossing(0, r - 1, 16, true));

  // West junction (plaza -> About)
  scene.add(trafficLight(-r + 2, -9, -Math.PI / 2));
  scene.add(trafficLight(-r + 2, 9, Math.PI / 2));
  scene.add(zebraCrossing(-r + 1, 0, 16, false));

  // East junction (plaza -> Skills)
  scene.add(trafficLight(r - 2, -9, Math.PI / 2));
  scene.add(trafficLight(r - 2, 9, -Math.PI / 2));
  scene.add(zebraCrossing(r - 1, 0, 16, false));
}

function scatterDecor(scene, colliders) {
  const rand = (min, max) => min + Math.random() * (max - min);
  const anyTree = (x, z) => (Math.random() < 0.5 ? palmTree(x, z) : canopyTree(x, z));
  const shopPalette = [
    { wall: 0xe8d3a0, roof: 0xc1272d },
    { wall: 0xdce8d0, roof: 0x2f6b4a },
    { wall: 0xf2e2c8, roof: 0x1c4f82 },
    { wall: 0xead6e8, roof: 0x5a2c6b },
  ];

  // Trees along the boulevard, set back from the billboards — with the occasional
  // small shophouse mixed in so the street doesn't read as an unbroken tree line.
  let slot = 0;
  for (let z = LAYOUT.boulevardStartZ - 6; z < LAYOUT.contactPos.z - 8; z += rand(9, 14)) {
    const leftX = -17 - rand(0, 5);
    const rightX = 17 + rand(0, 5);
    const rightZ = z + rand(-3, 3);

    if (slot % 3 === 1) {
      scene.add(shophouse(leftX, z, -1, shopPalette[slot % shopPalette.length]));
      colliders.push({ type: 'circle', x: leftX, z, radius: 2.4 });
      if (Math.random() < 0.6) scene.add(bush(leftX + rand(-1.5, 1.5), z + 2.6));
    } else {
      scene.add(anyTree(leftX, z));
    }

    if (slot % 3 === 2) {
      scene.add(shophouse(rightX, rightZ, 1, shopPalette[(slot + 2) % shopPalette.length]));
      colliders.push({ type: 'circle', x: rightX, z: rightZ, radius: 2.4 });
      if (Math.random() < 0.6) scene.add(bush(rightX + rand(-1.5, 1.5), rightZ + 2.6));
    } else {
      scene.add(anyTree(rightX, rightZ));
    }
    slot++;
  }

  // Streetlights along the boulevard
  for (let z = LAYOUT.boulevardStartZ; z < LAYOUT.contactPos.z - 10; z += 17) {
    scene.add(streetLight(-9.5, z));
    scene.add(streetLight(9.5, z + 8.5));
  }

  // Benches along the boulevard sidewalks, facing the road
  for (let z = LAYOUT.boulevardStartZ + 10; z < LAYOUT.contactPos.z - 10; z += 24) {
    scene.add(bench(-7.2, z, Math.PI / 2));
    scene.add(bench(7.2, z + 12, -Math.PI / 2));
  }

  // Flags around the plaza (Malaysian-inspired palette used decoratively)
  const flagColors = [0xc1272d, 0xf7f3ee, 0x0033a0, 0xffcc00];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = LAYOUT.plazaRadius + 4;
    scene.add(flagPole(Math.cos(angle) * r, Math.sin(angle) * r, [flagColors[i % flagColors.length]]));
    scene.add(bush(Math.cos(angle) * (r + 3), Math.sin(angle) * (r + 3)));
  }

  // Trees scattered around plaza & side streets, kept clear of the roads
  for (let i = 0; i < 14; i++) {
    let x, z;
    let attempts = 0;
    do {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(32, 60);
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r * 0.4;
      attempts++;
    } while (isNearRoad(x, z) && attempts < 10);
    if (!isNearRoad(x, z)) scene.add(anyTree(x, z));
  }

  // Bushes lining the About/Skills/Contact building fronts
  scene.add(bush(LAYOUT.aboutPos.x + 5, LAYOUT.aboutPos.z - 5));
  scene.add(bush(LAYOUT.aboutPos.x + 5, LAYOUT.aboutPos.z + 5));
  scene.add(bush(LAYOUT.skillsPos.x - 5, LAYOUT.skillsPos.z - 5));
  scene.add(bush(LAYOUT.skillsPos.x - 5, LAYOUT.skillsPos.z + 5));
  scene.add(bush(LAYOUT.contactPos.x - 5, LAYOUT.contactPos.z - 8));
  scene.add(bush(LAYOUT.contactPos.x + 5, LAYOUT.contactPos.z - 8));

  buildSkyline(scene, colliders);
  buildTrafficLights(scene);
}

function buildStarfield(scene) {
  const count = 500;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 450 + Math.random() * 150;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * 0.4 * Math.PI; // keep stars up near the zenith, away from the sunset glow
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) + 40;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.7 });
  const stars = new THREE.Points(geo, mat);
  scene.add(stars);

  // A simple decorative moon, already rising while the sunset is still going
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(9, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf3f4ec, emissive: 0xf0d9c2, emissiveIntensity: 0.8, flatShading: true })
  );
  moon.position.set(-140, 130, 160);
  scene.add(moon);
}

// A big inward-facing sphere painted with a vertical gradient stands in for a
// proper sunset sky — fog:false keeps it from being washed out to flat fog color.
function buildSkyDome(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#160f2c');
  grad.addColorStop(0.32, '#3d2148');
  grad.addColorStop(0.52, '#8a3a4a');
  grad.addColorStop(0.7, '#d9622b');
  grad.addColorStop(0.85, '#f2a13c');
  grad.addColorStop(1, '#ffd28a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(480, 24, 16),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(dome);
}

function buildLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xffb877, 0x2a1f16, 0.6);
  scene.add(hemi);

  const fill = new THREE.AmbientLight(0x4a3324, 0.28);
  scene.add(fill);

  const sunsetLight = new THREE.DirectionalLight(0xff9a4d, 0.85);
  sunsetLight.position.set(150, 30, -70);
  sunsetLight.castShadow = true;
  sunsetLight.shadow.mapSize.set(2048, 2048);
  sunsetLight.shadow.camera.left = -140;
  sunsetLight.shadow.camera.right = 140;
  sunsetLight.shadow.camera.top = 140;
  sunsetLight.shadow.camera.bottom = -140;
  sunsetLight.shadow.camera.far = 260;
  sunsetLight.shadow.bias = -0.0015;
  scene.add(sunsetLight);

  scene.fog = new THREE.Fog(0xd9773c, 70, 230);

  buildSkyDome(scene);
  buildStarfield(scene);
}

// ---------- Perimeter fence: hides the edge of the finite ground plane ----------
let fenceTileTexture = null;
function getFenceTileTexture() {
  if (fenceTileTexture) return fenceTileTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#7a5230';
  ctx.fillRect(0, 0, 64, 160);

  // Plank seams
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, 3, 160);
  ctx.fillRect(61, 0, 3, 160);

  // Wood grain lines
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(8 + i * 10, 14);
    ctx.lineTo(8 + i * 10, 146);
    ctx.stroke();
  }

  // Top cap rail + bottom base rail
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, 64, 14);
  ctx.fillRect(0, 138, 64, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 14, 64, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  fenceTileTexture = texture;
  return texture;
}

function buildPerimeterFence(scene) {
  const b = LAYOUT.bounds;
  const height = 3.4;
  const plankWidth = 2.2; // world units per texture tile, keeps plank scale consistent
  const segLen = 22;

  function segment(cx, cz, length, alongX) {
    const tex = getFenceTileTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(length / plankWidth, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05, flatShading: true });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(alongX ? length : 0.5, height, alongX ? 0.5 : length),
      mat
    );
    mesh.position.set(cx, height / 2 + bulgeHeight(cx, cz), cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.terrain = true; // already positioned on the curve; skip the generic bulge pass
    scene.add(mesh);
  }

  for (let x = b.minX; x < b.maxX; x += segLen) {
    const len = Math.min(segLen, b.maxX - x);
    const cx = x + len / 2;
    segment(cx, b.minZ, len, true);
    segment(cx, b.maxZ, len, true);
  }
  for (let z = b.minZ; z < b.maxZ; z += segLen) {
    const len = Math.min(segLen, b.maxZ - z);
    const cz = z + len / 2;
    segment(b.minX, cz, len, false);
    segment(b.maxX, cz, len, false);
  }

  // Corner posts for a finished look
  const postMat = 0x5a3a20;
  for (const [cx, cz] of [[b.minX, b.minZ], [b.maxX, b.minZ], [b.minX, b.maxZ], [b.maxX, b.maxZ]]) {
    const post = cyl(0.4, 0.45, height + 0.6, postMat, 8);
    post.position.set(cx, (height + 0.6) / 2 + bulgeHeight(cx, cz), cz);
    post.userData.terrain = true;
    scene.add(post);
  }
}

export function buildWorld(scene) {
  const zones = [];
  const colliders = [];

  buildLighting(scene);
  buildGround(scene, colliders);
  buildLandmark(scene, colliders);
  buildAboutHouse(scene, zones, colliders);
  buildSkillsWorkshop(scene, zones, colliders);
  buildContactKedai(scene, zones, colliders);
  buildBillboards(scene, zones, colliders);
  scatterDecor(scene, colliders);
  buildPerimeterFence(scene);
  applyWorldBulge(scene);

  return { zones, colliders };
}
