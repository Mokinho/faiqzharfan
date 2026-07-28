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

// ---------- Ground & roads ----------
function buildGround(scene, colliders) {
  const b = LAYOUT.bounds;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d, 1, 1),
    flatMat(0x3f8f4a)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = flatMat(0x2b2b2f);
  const laneMat = flatMat(0xf7f3ee);

  function roadSegment(cx, cz, sx, sz) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0.02, cz);
    road.receiveShadow = true;
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
    dash.position.set(0, 0.03, z);
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
    frond.castShadow = true;
    g.add(frond);
  }
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

// ---------- Central landmark: toy twin towers ----------
function buildLandmark(scene, colliders) {
  const g = group(0, 0, 0);
  const base = cyl(9, 10, 1.2, 0xd9c3ab, 8);
  base.position.y = 0.6;
  g.add(base);

  function tower(offsetX) {
    const t = group(offsetX, 0, 0);
    const shaft = cyl(1.6, 2, 16, 0xb9c4cc, 8);
    shaft.position.y = 8.6;
    t.add(shaft);
    const mid = cyl(2.1, 1.6, 1.4, 0xe85002, 8);
    mid.position.y = 16.5;
    t.add(mid);
    const spire = cyl(0.15, 0.5, 5, 0xf7f3ee, 6);
    spire.position.y = 19.8;
    t.add(spire);
    return t;
  }
  const towerL = tower(-3.4);
  const towerR = tower(3.4);
  g.add(towerL, towerR);

  const bridge = box(4.2, 0.6, 1.6, 0xe85002);
  bridge.position.set(0, 12, 0);
  g.add(bridge);

  scene.add(g);
  colliders.push({ type: 'circle', x: 0, z: 0, radius: 11 });
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

function scatterDecor(scene) {
  const rand = (min, max) => min + Math.random() * (max - min);

  // Trees along the boulevard, set back from the billboards
  for (let z = LAYOUT.boulevardStartZ - 6; z < LAYOUT.contactPos.z - 8; z += rand(9, 14)) {
    scene.add(palmTree(-17 - rand(0, 5), z));
    scene.add(palmTree(17 + rand(0, 5), z + rand(-3, 3)));
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
  }

  // Trees scattered around plaza & side streets
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = rand(32, 60);
    scene.add(palmTree(Math.cos(angle) * r, Math.sin(angle) * r * 0.4));
  }
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
  scatterDecor(scene);

  return { zones, colliders };
}
