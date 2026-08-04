import * as THREE from 'three';
import { bulgeHeight } from './world.js';

function flatMat(color, extra) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.15, ...extra });
}

function buildCarMesh() {
  const car = new THREE.Group();
  const bodyColor = 0xe3e6e8; // Tesla-style pearl white
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2a3138, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.5, flatShading: true,
  });

  // Lower chassis — low, smooth EV body, no visible grille/exhaust
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.44, 3.7), flatMat(bodyColor));
  chassis.position.y = 0.42;
  chassis.castShadow = true;
  car.add(chassis);

  // Short, gently sloped hood — EV cab-forward proportions
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 0.85), flatMat(bodyColor));
  hood.position.set(0, 0.72, 1.42);
  hood.rotation.x = 0.13;
  hood.castShadow = true;
  car.add(hood);

  // Long fastback trunk line
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 1.25), flatMat(bodyColor));
  trunk.position.set(0, 0.82, -1.25);
  trunk.rotation.x = -0.12;
  trunk.castShadow = true;
  car.add(trunk);

  // Panoramic glass roof — one continuous dark glass panel from windshield to trunk
  const glassRoof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 2.15), glassMat);
  glassRoof.position.set(0, 1.03, -0.15);
  glassRoof.castShadow = true;
  car.add(glassRoof);

  // Windshield + rear glass (angled, blending into the panoramic roof)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.52, 0.08), glassMat);
  windshield.position.set(0, 0.92, 0.85);
  windshield.rotation.x = 0.6;
  car.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.46, 0.08), glassMat);
  rearWindow.position.set(0, 0.94, -1.15);
  rearWindow.rotation.x = -0.5;
  car.add(rearWindow);

  // Side glass strips
  const sideGlassGeo = new THREE.BoxGeometry(0.06, 0.34, 1.75);
  const sideGlassL = new THREE.Mesh(sideGlassGeo, glassMat);
  sideGlassL.position.set(-0.79, 1.06, -0.15);
  car.add(sideGlassL);
  const sideGlassR = new THREE.Mesh(sideGlassGeo, glassMat);
  sideGlassR.position.set(0.79, 1.06, -0.15);
  car.add(sideGlassR);

  // Compact aero side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.09, 0.1, 0.2);
  for (const sx of [-1.0, 1.0]) {
    const mirror = new THREE.Mesh(mirrorGeo, flatMat(bodyColor));
    mirror.position.set(sx, 0.9, 0.62);
    mirror.castShadow = true;
    car.add(mirror);
  }

  // Bumpers — body-colored with a thin black lower diffuser (no chrome/plastic grille)
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.3, 0.24), flatMat(bodyColor));
  bumperF.position.set(0, 0.4, 1.9);
  car.add(bumperF);
  const bumperB = bumperF.clone();
  bumperB.position.z = -1.9;
  car.add(bumperB);

  const diffuserGeo = new THREE.BoxGeometry(1.9, 0.08, 0.1);
  const diffuserMat = flatMat(0x141414);
  const diffuserF = new THREE.Mesh(diffuserGeo, diffuserMat);
  diffuserF.position.set(0, 0.24, 1.95);
  car.add(diffuserF);
  const diffuserB = diffuserF.clone();
  diffuserB.position.z = -1.95;
  car.add(diffuserB);

  // Headlights, taillights & reverse lights — slim EV light units
  const headlightGeo = new THREE.BoxGeometry(0.34, 0.13, 0.05);
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xffedb0, emissiveIntensity: 1.6, flatShading: true });
  const taillightMat = new THREE.MeshStandardMaterial({ color: 0xb30000, emissive: 0x660000, emissiveIntensity: 0.6, flatShading: true });
  const reverseLightGeo = new THREE.BoxGeometry(0.14, 0.16, 0.05);
  const reverseLights = [];
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(sx, 0.6, 1.91);
    car.add(hl);

    const tl = new THREE.Mesh(headlightGeo, taillightMat);
    tl.position.set(sx, 0.6, -1.91);
    car.add(tl);

    // Off by default; Car.update() lights these up bright red while reversing.
    const reverseMat = new THREE.MeshStandardMaterial({ color: 0x3a0a0a, emissive: 0xff2020, emissiveIntensity: 0, flatShading: true });
    const rl = new THREE.Mesh(reverseLightGeo, reverseMat);
    rl.position.set(sx * 0.42, 0.6, -1.92);
    car.add(rl);
    reverseLights.push(rl);
  }

  // Full-width rear light bar — cosmetic strip linking the two taillights,
  // echoing the Model 3's signature connected tail light.
  const lightBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.05, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x8a0000, emissive: 0x990000, emissiveIntensity: 0.5, flatShading: true })
  );
  lightBar.position.set(0, 0.6, -1.91);
  car.add(lightBar);

  // Real headlight spotlights — no shadow casting to keep this cheap
  const headlightTarget = new THREE.Object3D();
  headlightTarget.position.set(0, 0, 14);
  car.add(headlightTarget);
  const spotlights = [];
  for (const sx of [-0.65, 0.65]) {
    const spot = new THREE.SpotLight(0xfff2d0, 45, 26, 0.5, 0.45, 1.6);
    spot.position.set(sx, 0.65, 1.9);
    spot.target = headlightTarget;
    spot.castShadow = false;
    car.add(spot);
    spotlights.push(spot);
  }
  car.userData.reverseLights = reverseLights;
  car.userData.spotlights = spotlights;

  // Wheels — tire + inset rim, with a flat aero cover disc for the Tesla look
  const tireMat = flatMat(0x141414, { roughness: 0.95, metalness: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd6da, roughness: 0.35, metalness: 0.75, flatShading: true });
  const aeroCoverMat = new THREE.MeshStandardMaterial({ color: 0xe8ebec, roughness: 0.3, metalness: 0.6, flatShading: true });
  const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 10);
  const aeroCoverGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.02, 16);
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
    const aeroCover = new THREE.Mesh(aeroCoverGeo, aeroCoverMat);
    aeroCover.rotation.z = Math.PI / 2;
    aeroCover.position.x = wx > 0 ? 0.17 : -0.17;
    wheel.add(aeroCover);
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
    this.mesh.position.y = bulgeHeight(this.mesh.position.x, this.mesh.position.z);
    this.mesh.rotation.y = this.yaw;

    for (const wheel of this.mesh.userData.allWheels) {
      wheel.rotation.x += this.speed * dt * 1.4;
    }

    const reversing = this.speed < -0.1;
    for (const rl of this.mesh.userData.reverseLights) {
      rl.material.emissiveIntensity = reversing ? 2.4 : 0;
    }

    return forward;
  }

  get speedKmh() {
    return Math.round(Math.abs(this.speed) * 3.2);
  }
}
