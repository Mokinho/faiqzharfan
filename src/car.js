import * as THREE from 'three';

function flatMat(color, extra) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.15, ...extra });
}

function buildCarMesh() {
  const car = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 3.4), flatMat(0xe85002));
  body.position.y = 0.62;
  body.castShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.7), flatMat(0xf7f3ee));
  cabin.position.set(0, 1.12, -0.15);
  cabin.castShadow = true;
  car.add(cabin);

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 0.3), flatMat(0x1a1a1a));
  bumperF.position.set(0, 0.42, 1.72);
  car.add(bumperF);
  const bumperB = bumperF.clone();
  bumperB.position.z = -1.72;
  car.add(bumperB);

  const headlightGeo = new THREE.BoxGeometry(0.32, 0.2, 0.05);
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xffedb0, emissiveIntensity: 0.7, flatShading: true });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(sx, 0.65, 1.72);
    car.add(hl);
    const tl = new THREE.Mesh(headlightGeo, new THREE.MeshStandardMaterial({ color: 0xb30000, emissive: 0x660000, emissiveIntensity: 0.5, flatShading: true }));
    tl.position.set(sx, 0.65, -1.72);
    car.add(tl);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12);
  const wheelMat = flatMat(0x1c1c1c, { roughness: 0.9, metalness: 0 });
  const wheels = [];
  for (const [wx, wz] of [[-0.98, 1.1], [0.98, 1.1], [-0.98, -1.1], [0.98, -1.1]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
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
