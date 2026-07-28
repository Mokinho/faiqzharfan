import * as THREE from 'three';
import { bulgeHeight } from './world.js';

function flatMat(color, extra) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0.02, ...extra });
}

function buildCatMesh() {
  const cat = new THREE.Group();
  const furColor = 0xd9822b;
  const bellyColor = 0xf7ece0;

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), flatMat(furColor));
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.32;
  body.castShadow = true;
  cat.add(body);

  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.4, 4, 8), flatMat(bellyColor));
  belly.rotation.z = Math.PI / 2;
  belly.position.set(0, 0.2, 0.05);
  cat.add(belly);

  const head = new THREE.Group();
  head.position.set(0.32, 0.4, 0);
  cat.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), flatMat(furColor));
  head.add(skull);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), flatMat(bellyColor));
  snout.position.set(0.15, -0.05, 0);
  head.add(snout);

  const noseMat = flatMat(0x3a2a20);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), noseMat);
  nose.position.set(0.23, -0.04, 0);
  head.add(nose);

  const eyeMat = flatMat(0x1a1a1a);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
    eye.position.set(0.13, 0.02, s * 0.11);
    head.add(eye);
  }

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4), flatMat(furColor));
    ear.position.set(-0.02, 0.16, s * 0.12);
    ear.rotation.x = s * 0.3;
    head.add(ear);
  }

  // Tail: a few chained segments so it can curve and sway
  const tailRoot = new THREE.Group();
  tailRoot.position.set(-0.38, 0.34, 0);
  cat.add(tailRoot);
  const tailSegs = [];
  let parent = tailRoot;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    seg.position.set(i === 0 ? 0 : -0.18, i === 0 ? 0 : 0.05, 0);
    seg.rotation.z = 0.3;
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.05 - i * 0.01, 0.16, 3, 6), flatMat(furColor));
    mesh.rotation.z = Math.PI / 2;
    mesh.position.x = -0.09;
    seg.add(mesh);
    parent.add(seg);
    tailSegs.push(seg);
    parent = seg;
  }

  // Legs: each an upper-leg group (pivots for the walk cycle) + lower leg + paw
  const legGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.32, 6);
  const legs = [];
  const legPositions = [
    ['frontLeft', 0.24, 0.1], ['frontRight', 0.24, -0.1],
    ['backLeft', -0.24, 0.1], ['backRight', -0.24, -0.1],
  ];
  for (const [name, lx, lz] of legPositions) {
    const hip = new THREE.Group();
    hip.position.set(lx, 0.32, lz);
    cat.add(hip);
    const leg = new THREE.Mesh(legGeo, flatMat(furColor));
    leg.position.y = -0.16;
    leg.castShadow = true;
    hip.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), flatMat(0x3a2a20));
    paw.position.y = -0.32;
    hip.add(paw);
    hip.userData.name = name;
    legs.push(hip);
  }

  cat.userData.head = head;
  cat.userData.body = body;
  cat.userData.tailSegs = tailSegs;
  cat.userData.legs = legs;
  return cat;
}

export class Cat {
  constructor(scene, centerX, centerZ, radius = 3) {
    this.mesh = buildCatMesh();
    scene.add(this.mesh);

    this.centerX = centerX;
    this.centerZ = centerZ;
    this.radius = radius;
    this.angle = Math.random() * Math.PI * 2;
    this.walkSpeed = 1.1; // units per second along the patrol circle
    this.walkPhase = 0;

    this._updateTransform();
  }

  _updateTransform() {
    const x = this.centerX + Math.cos(this.angle) * this.radius;
    const z = this.centerZ + Math.sin(this.angle) * this.radius;
    this.mesh.position.set(x, bulgeHeight(x, z), z);
    this.mesh.rotation.y = -this.angle;
  }

  update(dt) {
    const angularSpeed = this.walkSpeed / this.radius;
    this.angle += angularSpeed * dt;
    this._updateTransform();

    this.walkPhase += dt * 7;
    const swing = 0.55;
    const legs = this.mesh.userData.legs;
    legs.forEach((hip) => {
      const isDiagonalA = hip.userData.name === 'frontLeft' || hip.userData.name === 'backRight';
      const phase = isDiagonalA ? this.walkPhase : this.walkPhase + Math.PI;
      hip.rotation.x = Math.sin(phase) * swing;
    });

    const tailSegs = this.mesh.userData.tailSegs;
    tailSegs.forEach((seg, i) => {
      seg.rotation.y = Math.sin(this.walkPhase * 0.4 + i * 0.6) * 0.35;
    });

    this.mesh.userData.body.position.y = 0.32 + Math.abs(Math.sin(this.walkPhase)) * 0.03;
    this.mesh.userData.head.position.y = 0.4 + Math.sin(this.walkPhase * 2) * 0.015;
  }
}
