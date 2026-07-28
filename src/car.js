import * as THREE from 'three';

function flatMat(color, extra) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.15, ...extra });
}

function buildCarMesh() {
  const car = new THREE.Group();
  const bodyColor = 0xe85002;
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8fd0e8, transparent: true, opacity: 0.55, roughness: 0.12, metalness: 0.4, flatShading: true,
  });

  // Lower chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 3.6), flatMat(bodyColor));
  chassis.position.y = 0.48;
  chassis.castShadow = true;
  car.add(chassis);

  // Hood — sloped down toward the front bumper
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.14, 1.2), flatMat(bodyColor));
  hood.position.set(0, 0.8, 1.15);
  hood.rotation.x = 0.09;
  hood.castShadow = true;
  car.add(hood);

  // Trunk — slight rear slope
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.14, 0.95), flatMat(bodyColor));
  trunk.position.set(0, 0.83, -1.3);
  trunk.rotation.x = -0.06;
  trunk.castShadow = true;
  car.add(trunk);

  // Cabin / greenhouse
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.56, 1.85), flatMat(0xf7f3ee));
  cabin.position.set(0, 1.1, -0.05);
  cabin.castShadow = true;
  car.add(cabin);

  // Windshield + rear window (angled, tinted)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.55, 0.08), glassMat);
  windshield.position.set(0, 0.98, 0.87);
  windshield.rotation.x = 0.62;
  car.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.5, 0.08), glassMat);
  rearWindow.position.set(0, 1.0, -0.98);
  rearWindow.rotation.x = -0.55;
  car.add(rearWindow);

  // Side glass strips
  const sideGlassGeo = new THREE.BoxGeometry(0.06, 0.38, 1.5);
  const sideGlassL = new THREE.Mesh(sideGlassGeo, glassMat);
  sideGlassL.position.set(-0.79, 1.14, -0.05);
  car.add(sideGlassL);
  const sideGlassR = new THREE.Mesh(sideGlassGeo, glassMat);
  sideGlassR.position.set(0.79, 1.14, -0.05);
  car.add(sideGlassR);

  // Side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.1, 0.12, 0.24);
  for (const sx of [-1.0, 1.0]) {
    const mirror = new THREE.Mesh(mirrorGeo, flatMat(bodyColor));
    mirror.position.set(sx, 0.95, 0.62);
    mirror.castShadow = true;
    car.add(mirror);
  }

  // Door seams (thin inset lines for a less slab-like body)
  const seamMat = flatMat(0xb33d00);
  for (const z of [0.35, -0.55]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.04), seamMat);
    seam.position.set(0.96, 0.62, z);
    car.add(seam);
    const seamL = seam.clone();
    seamL.position.x = -0.96;
    car.add(seamL);
  }

  // Bumpers
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2, 0.32, 0.28), flatMat(0x1a1a1a));
  bumperF.position.set(0, 0.4, 1.86);
  car.add(bumperF);
  const bumperB = bumperF.clone();
  bumperB.position.z = -1.86;
  car.add(bumperB);

  // Grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.06), flatMat(0x141414));
  grille.position.set(0, 0.56, 1.82);
  car.add(grille);

  // Headlights & taillights
  const headlightGeo = new THREE.BoxGeometry(0.32, 0.2, 0.05);
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xffedb0, emissiveIntensity: 0.7, flatShading: true });
  const taillightMat = new THREE.MeshStandardMaterial({ color: 0xb30000, emissive: 0x660000, emissiveIntensity: 0.5, flatShading: true });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(sx, 0.62, 1.87);
    car.add(hl);
    const tl = new THREE.Mesh(headlightGeo, taillightMat);
    tl.position.set(sx, 0.62, -1.87);
    car.add(tl);
  }

  // Exhaust pipe
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 8), flatMat(0x888888, { roughness: 0.4, metalness: 0.7 }));
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(0.55, 0.32, -1.9);
  car.add(exhaust);

  // Wheels — tire + inset rim for a two-tone look
  const tireMat = flatMat(0x141414, { roughness: 0.95, metalness: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd6da, roughness: 0.35, metalness: 0.75, flatShading: true });
  const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 10);
  const wheels = [];
  for (const [wx, wz] of [[-0.98, 1.15], [0.98, 1.15], [-0.98, -1.2], [0.98, -1.2]]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheel.add(rim);
    wheel.position.set(wx, 0.42, wz);
    car.add(wheel);
    wheels.push(wheel);
  }

  car.userData.frontWheels = [wheels[0], wheels[1]];
  car.userData.allWheels = wheels;
  return car;
}

export class Car {
  constructor(scene, spawn) {
    this.mesh = buildCarMesh();
    this.mesh.position.copy(spawn);
    scene.add(this.mesh);

    this.speed = 0;
    this.yaw = 0; // forward = +Z, toward the boulevard
    this.mesh.rotation.y = this.yaw;

    this.maxSpeed = 30;
    this.maxReverse = 12;
    this.accel = 24;
    this.brakeDecel = 46;
    this.friction = 9;
    this.maxSteer = 2.1;
  }

  get position() {
    return this.mesh.position;
  }

  update(dt, throttle, steer) {
    if (throttle > 0.05) {
      this.speed += this.accel * dt;
    } else if (throttle < -0.05) {
      if (this.speed > 0.5) {
        this.speed -= this.brakeDecel * dt;
      } else {
        this.speed -= this.accel * 0.7 * dt;
      }
    } else {
      const decel = this.friction * dt;
      if (this.speed > 0) this.speed = Math.max(0, this.speed - decel);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + decel);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -this.maxReverse, this.maxSpeed);

    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 5, 0.15, 1);
    const steerDir = this.speed >= 0 ? 1 : -1;
    this.yaw -= steer * this.maxSteer * speedFactor * steerDir * dt;

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.mesh.position.addScaledVector(forward, this.speed * dt);
    this.mesh.rotation.y = this.yaw;

    for (const wheel of this.mesh.userData.allWheels) {
      wheel.rotation.x += this.speed * dt * 1.4;
    }

    return forward;
  }

  get speedKmh() {
    return Math.round(Math.abs(this.speed) * 3.2);
  }
}
