import { PROFILE, ABOUT, SKILLS, CONTACT, PROJECTS } from './data.js';

const els = {};

function q(id) { return document.getElementById(id); }

export function initUI() {
  els.loading = q('loading');
  els.loadingBarFill = q('loadingBarFill');
  els.loadingHint = q('loadingHint');
  els.intro = q('intro');
  els.startBtn = q('startBtn');
  els.hud = q('hud');
  els.hudZone = q('hudZone');
  els.helpBtn = q('helpBtn');
  els.speedValue = q('speedValue');
  els.prompt = q('interactPrompt');
  els.interactText = q('interactText');
  els.modalRoot = q('modalRoot');
  els.modalBackdrop = q('modalBackdrop');
  els.modalCard = q('modalCard');
  els.minimap = q('minimap');
  els.minimapCtx = els.minimap.getContext('2d');
  return els;
}

export function setLoadingProgress(pct, hint) {
  els.loadingBarFill.style.width = `${Math.min(100, pct)}%`;
  if (hint) els.loadingHint.textContent = hint;
}

export function hideLoading() {
  els.loading.style.opacity = '0';
  setTimeout(() => els.loading.classList.add('hidden'), 500);
}

export function showIntro() {
  els.intro.classList.remove('hidden');
}

export function hideIntro() {
  els.intro.style.opacity = '0';
  setTimeout(() => els.intro.classList.add('hidden'), 350);
  els.hud.classList.remove('hidden');
}

export function setZoneLabel(text) {
  els.hudZone.textContent = text;
}

export function showPrompt(text) {
  els.interactText.textContent = text;
  els.prompt.classList.remove('hidden');
}

export function hidePrompt() {
  els.prompt.classList.add('hidden');
}

export function updateSpeed(kmh) {
  els.speedValue.textContent = kmh;
}

// ---------- Modal content ----------
function escapeHtml(str) {
  return str.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function aboutHtml() {
  const paras = ABOUT.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  const timeline = ABOUT.timeline.map((t) => `
    <li>
      <span class="timeline-date">${escapeHtml(t.date)}</span>
      <div class="timeline-body"><h4>${escapeHtml(t.title)}</h4><p>${escapeHtml(t.org)}</p></div>
    </li>`).join('');
  return `
    <button class="modal-close" data-close>×</button>
    <p class="modal-eyebrow">Rumah Faiq</p>
    <h2>About ${escapeHtml(PROFILE.name)}</h2>
    ${paras}
    <ul class="modal-timeline">${timeline}</ul>
  `;
}

function skillsHtml() {
  const cards = SKILLS.map((s) => `
    <div class="skill-card">
      <h3>${escapeHtml(s.title)}</h3>
      <ul>${s.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
    </div>`).join('');
  return `
    <button class="modal-close" data-close>×</button>
    <p class="modal-eyebrow">Bengkel Kemahiran</p>
    <h2>Skills &amp; Expertise</h2>
    <div class="skills-grid">${cards}</div>
  `;
}

function contactHtml() {
  const links = CONTACT.links.map((l) => `
    <a class="contact-link" href="${l.href}" target="_blank" rel="noopener noreferrer">
      <span class="contact-label">${escapeHtml(l.label)}</span>
      <span class="contact-value">${escapeHtml(l.value)}</span>
    </a>`).join('');
  return `
    <button class="modal-close" data-close>×</button>
    <p class="modal-eyebrow">Kedai Kopi</p>
    <h2>Let's Talk</h2>
    <p>${escapeHtml(CONTACT.lead)}</p>
    <div class="contact-links">${links}</div>
  `;
}

function projectHtml(index) {
  const p = PROJECTS[index];
  const linkBtn = p.link
    ? `<a class="project-link-btn" href="${p.link}" target="_blank" rel="noopener noreferrer">Visit site →</a>`
    : `<p style="margin-top:.4rem;font-size:.82rem;">Internal / private project — no public link.</p>`;
  return `
    <button class="modal-close" data-close>×</button>
    <div class="project-swatch" style="--pa:${p.colorA};--pb:${p.colorB}"></div>
    <p class="modal-eyebrow">${escapeHtml(p.tag)}</p>
    <h2>${escapeHtml(p.title)}</h2>
    <p>${escapeHtml(p.desc)}</p>
    ${linkBtn}
    <div class="project-nav">
      <button data-project-nav="-1">← Previous</button>
      <span style="font-size:.8rem;color:var(--text-dim);align-self:center;">${index + 1} / ${PROJECTS.length}</span>
      <button data-project-nav="1">Next →</button>
    </div>
  `;
}

let currentProjectIndex = 0;

export function openModal(kind, payload, onClose) {
  let html = '';
  if (kind === 'about') html = aboutHtml();
  else if (kind === 'skills') html = skillsHtml();
  else if (kind === 'contact') html = contactHtml();
  else if (kind === 'project') {
    currentProjectIndex = payload.projectIndex;
    html = projectHtml(currentProjectIndex);
  }

  els.modalCard.innerHTML = html;
  els.modalRoot.classList.remove('hidden');
  els.modalCard.scrollTop = 0;

  const close = () => {
    els.modalRoot.classList.add('hidden');
    onClose && onClose();
  };

  els.modalBackdrop.onclick = close;
  els.modalCard.querySelectorAll('[data-close]').forEach((btn) => (btn.onclick = close));

  if (kind === 'project') {
    rebindProjectNav(close);
  }

  return close;
}

function rebindProjectNav(close) {
  els.modalCard.querySelectorAll('[data-project-nav]').forEach((btn) => {
    btn.onclick = () => {
      const dir = parseInt(btn.dataset.projectNav, 10);
      currentProjectIndex = (currentProjectIndex + dir + PROJECTS.length) % PROJECTS.length;
      els.modalCard.innerHTML = projectHtml(currentProjectIndex);
      els.modalCard.scrollTop = 0;
      els.modalBackdrop.onclick = close;
      els.modalCard.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
      rebindProjectNav(close);
    };
  });
}

export function closeModal() {
  els.modalRoot.classList.add('hidden');
}

export function isModalOpen() {
  return !els.modalRoot.classList.contains('hidden');
}

// ---------- Minimap ----------
export function drawMinimap(car, zones, bounds) {
  const ctx = els.minimapCtx;
  const size = els.minimap.width;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(10,10,10,0.9)';
  ctx.fillRect(0, 0, size, size);

  const worldW = bounds.maxX - bounds.minX;
  const worldD = bounds.maxZ - bounds.minZ;
  const scale = size / Math.max(worldW, worldD);
  const toMap = (x, z) => [
    (x - bounds.minX) * scale,
    (z - bounds.minZ) * scale,
  ];

  ctx.strokeStyle = 'rgba(247,243,238,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const [bx, bz] = toMap(0, 0);
  ctx.moveTo(bx, bz);
  const [cx, cz] = toMap(0, bounds.maxZ - 20);
  ctx.lineTo(cx, cz);
  ctx.stroke();

  for (const zone of zones) {
    if (zone.kind === 'project') continue;
    const [zx, zz] = toMap(zone.position.x, zone.position.z);
    ctx.fillStyle = zone.kind === 'about' ? '#7fb7c9' : zone.kind === 'skills' ? '#c8ff3d' : '#e85002';
    ctx.beginPath();
    ctx.arc(zx, zz, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const [px, pz] = toMap(car.position.x, car.position.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(car.yaw);
  ctx.fillStyle = '#f7f3ee';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
