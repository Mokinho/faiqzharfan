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
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2c2, emissive: 0xffdd88, emissiveIntensity: 0.6, flatShading: true }));
  lamp.position.y = 4.65;
  g.add(lamp);
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
function buildAboutHouse(scene, zones, colliders) {
  const pos = LAYOUT.aboutPos;
  const g = group(pos.x, 0, pos.z);
  g.rotation.y = Math.PI / 2; // face the approach road coming from the plaza (+X)

  const stiltMat = 0x6b4a2b;
  const stiltPositions = [[-3.4, -2.6], [3.4, -2.6], [-3.4, 2.6], [3.4, 2.6]];
  stiltPositions.forEach(([sx, sz]) => {
    const stilt = cyl(0.32, 0.32, 3, stiltMat, 6);
    stilt.position.set(sx, 1.5, sz);
    g.add(stilt);
  });

  const floor = box(8.4, 0.6, 6.4, 0xc9a876);
  floor.position.y = 3.2;
  g.add(floor);

  const walls = box(8, 4, 6, 0xf1e4c8);
  walls.position.y = 5.5;
  g.add(walls);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.6, 3.6, 4), flatMat(0xb33a1e));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 9.3;
  roof.castShadow = true;
  g.add(roof);

  const door = box(1.4, 2.4, 0.15, 0x8a5a2b);
  door.position.set(0, 4.4, 3.02);
  g.add(door);

  for (const dx of [-2.6, 2.6]) {
    const win = box(1.1, 1.1, 0.12, 0x7fb7c9);
    win.position.set(dx, 5.8, 3.02);
    g.add(win);
  }

  const stairs = box(1.6, 0.2, 2.6, 0x8a5a2b);
  stairs.position.set(0, 1.6, 4.6);
  stairs.rotation.x = -0.35;
  g.add(stairs);

  scene.add(g);
  colliders.push({ type: 'circle', x: pos.x, z: pos.z, radius: 6.5 });
  zones.push({ id: 'about', kind: 'about', name: 'Rumah Faiq — About', position: pos.clone(), radius: 10, promptText: 'View About & Experience' });
}

// ---------- Skills: workshop / garage ----------
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

  scene.add(g);
  colliders.push({ type: 'circle', x: pos.x, z: pos.z, radius: 8 });
  zones.push({ id: 'contact', kind: 'contact', name: 'Kedai Kopi — Contact', position: pos.clone(), radius: 12, promptText: 'View Contact Details' });
}

// ---------- Project boulevard billboards ----------
function createBillboardTexture(project) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 512, 320);
  grad.addColorStop(0, project.colorA);
  grad.addColorStop(1, project.colorB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 230, 512, 90);

  ctx.fillStyle = '#f7f3ee';
  ctx.font = '600 34px "Space Grotesk", sans-serif';
  wrapText(ctx, project.title, 28, 275, 456, 38);

  ctx.fillStyle = '#e85002';
  ctx.font = '600 18px "Inter", sans-serif';
  ctx.fillText(project.tag.toUpperCase(), 28, 40);

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
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, flatShading: true })
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
  { base: '#1c2733', dark: '#243342', lit: '#ffe9a8', litChance: 0.35 },
  { base: '#2a2420', dark: '#332b25', lit: '#ffd9a0', litChance: 0.3 },
  { base: '#152229', dark: '#1c2e37', lit: '#bfe8ff', litChance: 0.28 },
  { base: '#241c2a', dark: '#2e2434', lit: '#ffe0f0', litChance: 0.25 },
];

function fillerBuilding(x, z, w, h, d, theme) {
  const texture = getWindowTexture(theme);
  const sideMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, metalness: 0.05 });
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

// A distant, denser skyline scattered beyond the roads/zones so the horizon
// doesn't read as empty grass along the whole drive — kept well clear of
// drivable areas (plaza disc, boulevard corridor, and the two side spurs).
function buildSkyline(scene, colliders) {
  const rand = (min, max) => min + Math.random() * (max - min);
  const b = LAYOUT.bounds;
  const placed = [];

  function tooClose(x, z, minDist) {
    return placed.some((p) => Math.hypot(p.x - x, p.z - z) < minDist);
  }

  function blockedByRoads(x, z) {
    if (Math.hypot(x, z) < LAYOUT.plazaRadius + 34) return true; // plaza, with room for the corner turns
    if (Math.abs(x) < 36 && z > -30 && z < LAYOUT.contactPos.z + 20) return true; // boulevard + tree/shophouse row
    if (Math.abs(z) < 22 && x > LAYOUT.aboutPos.x - 14 && x < -LAYOUT.plazaRadius - 4) return true; // west spur
    if (Math.abs(z) < 22 && x < LAYOUT.skillsPos.x + 14 && x > LAYOUT.plazaRadius + 4) return true; // east spur
    return false;
  }

  const count = 46;
  let attempts = 0;
  let added = 0;
  while (added < count && attempts < count * 8) {
    attempts++;
    const x = rand(b.minX + 8, b.maxX - 8);
    const z = rand(b.minZ + 8, b.maxZ - 8);
    if (blockedByRoads(x, z)) continue;
    if (tooClose(x, z, 13)) continue;

    const w = rand(6, 11);
    const d = rand(6, 11);
    const h = rand(9, 30);
    const theme = SKYLINE_THEMES[Math.floor(Math.random() * SKYLINE_THEMES.length)];
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

function buildLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3f8f4a, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d9, 1.15);
  sun.position.set(60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  scene.fog = new THREE.Fog(0x9fd6ff, 90, 240);
  scene.background = new THREE.Color(0x9fd6ff);
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
  applyWorldBulge(scene);

  return { zones, colliders };
}
