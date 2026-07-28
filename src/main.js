import * as THREE from 'three';
import { buildWorld, LAYOUT, bulgeHeight } from './world.js';
import { Car } from './car.js';
import { Cat } from './cat.js';
import { Controls } from './controls.js';
import { SoundEngine } from './audio.js';
import * as UI from './ui.js';

const sound = new SoundEngine();

UI.initUI();

// ---------- Renderer / scene / camera ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 500);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- World & car ----------
const { zones, colliders } = buildWorld(scene);
const car = new Car(scene, new THREE.Vector3(0, 0, 19));
const controls = new Controls();
const cat = new Cat(scene, LAYOUT.aboutPos.x + 8, LAYOUT.aboutPos.z, 3);

const circleColliders = colliders.filter((c) => c.type === 'circle');
const CAR_RADIUS = 1.1;
const BOUND_MARGIN = 3;

const cameraTarget = new THREE.Vector3();
const desiredCamPos = new THREE.Vector3();

let currentZone = null;
let activeModalClose = null;

document.getElementById('helpBtn').addEventListener('click', () => {
  controls.enabled = false;
  UI.showIntro();
});

document.getElementById('startBtn').addEventListener('click', () => {
  UI.hideIntro();
  controls.enabled = true;
  sound.init();
  sound.resume();
  clock.getDelta();
});

const soundBtn = document.getElementById('soundBtn');
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    const muted = !sound.muted;
    sound.setMuted(muted);
    soundBtn.textContent = muted ? '🔇' : '🔊';
  });
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && activeModalClose) activeModalClose();
});

let wasColliding = false;
function resolveCollisions() {
  const p = car.mesh.position;
  let colliding = false;
  let impactSpeed = 0;
  for (const c of circleColliders) {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const dist = Math.hypot(dx, dz);
    const minDist = c.radius + CAR_RADIUS;
    if (dist > 0.0001 && dist < minDist) {
      const push = (minDist - dist);
      p.x += (dx / dist) * push;
      p.z += (dz / dist) * push;
      impactSpeed = Math.max(impactSpeed, Math.abs(car.speed));
      car.speed *= 0.55;
      colliding = true;
    }
  }
  if (colliding && !wasColliding && impactSpeed > 2.5) {
    sound.playCollision();
  }
  wasColliding = colliding;

  const b = LAYOUT.bounds;
  p.x = THREE.MathUtils.clamp(p.x, b.minX + BOUND_MARGIN, b.maxX - BOUND_MARGIN);
  p.z = THREE.MathUtils.clamp(p.z, b.minZ + BOUND_MARGIN, b.maxZ - BOUND_MARGIN);
  p.y = bulgeHeight(p.x, p.z);
}

function updateZoneProximity() {
  let nearest = null;
  let nearestDist = Infinity;
  for (const zone of zones) {
    const dx = car.position.x - zone.position.x;
    const dz = car.position.z - zone.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < zone.radius && dist < nearestDist) {
      nearest = zone;
      nearestDist = dist;
    }
  }
  currentZone = nearest;
  if (nearest) {
    UI.setZoneLabel(nearest.name);
    UI.showPrompt(nearest.promptText);
  } else {
    UI.setZoneLabel('Jalan Faiq');
    UI.hidePrompt();
  }
}

function handleInteract() {
  const pressed = controls.consumeInteract();
  if (!pressed || !currentZone || UI.isModalOpen()) return;
  controls.enabled = false;
  activeModalClose = UI.openModal(currentZone.kind, { projectIndex: currentZone.projectIndex }, () => {
    controls.enabled = true;
    activeModalClose = null;
  });
}

function updateCamera(dt, forward) {
  const behind = forward.clone().multiplyScalar(-8.5);
  desiredCamPos.copy(car.position).add(behind);
  desiredCamPos.y = car.position.y + 4.6;

  const camLerp = 1 - Math.exp(-5.5 * dt);
  camera.position.lerp(desiredCamPos, camLerp);

  const lookTarget = car.position.clone().addScaledVector(forward, 3);
  lookTarget.y += 1.1;
  cameraTarget.lerp(lookTarget, 1 - Math.exp(-7 * dt));
  camera.lookAt(cameraTarget);
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  controls.update();
  handleInteract();

  const forward = car.update(dt, controls.throttle, controls.steer);
  resolveCollisions();
  updateZoneProximity();
  updateCamera(dt, forward);
  cat.update(dt);
  sound.updateEngine(car.speed, controls.throttle);
  sound.setReversing(car.speed < -0.1);

  UI.updateSpeed(car.speedKmh);
  UI.drawMinimap(car, zones, LAYOUT.bounds);

  renderer.render(scene, camera);
}

// ---------- Boot sequence ----------
let progress = 0;
const hints = ['Warming up the engine…', 'Paving Jalan Faiq…', 'Planting palm trees…', 'Polishing the billboards…'];
function boot() {
  progress += 4 + Math.random() * 10;
  UI.setLoadingProgress(progress, hints[Math.min(hints.length - 1, Math.floor(progress / 26))]);
  if (progress < 100) {
    requestAnimationFrame(boot);
  } else {
    UI.setLoadingProgress(100, 'Ready to roll!');
    setTimeout(() => {
      UI.hideLoading();
      UI.showIntro();
      camera.position.set(0, 4.6, 5.5);
      camera.lookAt(0, 1, 14);
      controls.enabled = false;
      animate();
    }, 250);
  }
}
boot();
