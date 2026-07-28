const THROTTLE_KEYS = { forward: ['KeyW', 'ArrowUp'], backward: ['KeyS', 'ArrowDown'] };
const STEER_KEYS = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };
const INTERACT_KEYS = ['KeyE', 'Space'];

export class Controls {
  constructor() {
    this.throttle = 0;
    this.steer = 0;
    this._interactPressed = false;
    this._keys = new Set();
    this._touchThrottle = 0;
    this._touchSteer = 0;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (INTERACT_KEYS.includes(e.code) && !e.repeat) this._interactPressed = true;
      this._keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this._keys.delete(e.code));
    window.addEventListener('blur', () => this._keys.clear());

    this._bindTouch();
  }

  _bindTouch() {
    const wheel = document.getElementById('touchWheel');
    const knob = document.getElementById('touchWheelKnob');
    const gas = document.getElementById('touchGas');
    const brake = document.getElementById('touchBrake');
    const interact = document.getElementById('touchInteract');
    if (!wheel) return;

    let dragging = false;
    const radius = 32;

    const setKnob = (dx, dz) => {
      knob.style.transform = `translate(${dx}px, ${dz}px)`;
    };

    const handleMove = (clientX, clientY) => {
      const rect = wheel.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }
      setKnob(dx, dy);
      this._touchSteer = THREE_clamp(dx / radius, -1, 1);
    };

    const reset = () => {
      dragging = false;
      setKnob(0, 0);
      this._touchSteer = 0;
    };

    wheel.addEventListener('pointerdown', (e) => {
      dragging = true;
      wheel.setPointerCapture(e.pointerId);
      handleMove(e.clientX, e.clientY);
    });
    wheel.addEventListener('pointermove', (e) => {
      if (dragging) handleMove(e.clientX, e.clientY);
    });
    wheel.addEventListener('pointerup', reset);
    wheel.addEventListener('pointercancel', reset);

    gas.addEventListener('pointerdown', () => { this._touchThrottle = 1; });
    gas.addEventListener('pointerup', () => { if (this._touchThrottle === 1) this._touchThrottle = 0; });
    gas.addEventListener('pointercancel', () => { this._touchThrottle = 0; });
    brake.addEventListener('pointerdown', () => { this._touchThrottle = -1; });
    brake.addEventListener('pointerup', () => { if (this._touchThrottle === -1) this._touchThrottle = 0; });
    brake.addEventListener('pointercancel', () => { this._touchThrottle = 0; });

    interact.addEventListener('pointerdown', () => { this._interactPressed = true; });
  }

  update() {
    if (!this.enabled) {
      this.throttle = 0;
      this.steer = 0;
      this._interactPressed = false;
      return;
    }
    let throttle = this._touchThrottle;
    let steer = this._touchSteer;

    if (THROTTLE_KEYS.forward.some((k) => this._keys.has(k))) throttle = 1;
    else if (THROTTLE_KEYS.backward.some((k) => this._keys.has(k))) throttle = -1;

    if (STEER_KEYS.left.some((k) => this._keys.has(k))) steer = -1;
    else if (STEER_KEYS.right.some((k) => this._keys.has(k))) steer = 1;

    this.throttle = throttle;
    this.steer = steer;
  }

  consumeInteract() {
    const pressed = this._interactPressed;
    this._interactPressed = false;
    return pressed;
  }
}

function THREE_clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
