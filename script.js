// ===== Theme Toggle =====
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('se-theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? '' : 'light';
  if (next) {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('se-theme', next);
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('se-theme');
  }
});

// ===== Active Nav on Scroll =====
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

function updateActiveNav() {
  const scrollY = window.scrollY + 120;
  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    if (scrollY >= top && scrollY < top + height) {
      const id = section.getAttribute('id');
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-section') === id);
      });
    }
  });
}
window.addEventListener('scroll', updateActiveNav, { passive: true });

// ===== Tabs =====
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ===== Accordion =====
document.querySelectorAll('.accordion-header').forEach(header => {
  header.addEventListener('click', () => {
    const item = header.parentElement;
    const isOpen = item.classList.contains('open');
    // Close all
    document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// ===== Checklist Progress =====
const checks = document.querySelectorAll('.check-input');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const totalChecks = checks.length;

function updateProgress() {
  const checked = document.querySelectorAll('.check-input:checked').length;
  const pct = (checked / totalChecks) * 100;
  progressFill.style.width = pct + '%';
  progressText.textContent = `${checked} / ${totalChecks} 项已确认`;
  // Change color when all done
  if (checked === totalChecks) {
    progressFill.style.background = 'linear-gradient(135deg, #00b894, #55efc4)';
  }
}

checks.forEach(c => c.addEventListener('change', updateProgress));

// ===== Particle Background =====
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const particleContainer = document.getElementById('particles');
particleContainer.appendChild(canvas);

function resizeCanvas() {
  canvas.width = particleContainer.offsetWidth;
  canvas.height = particleContainer.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const particles = [];
const PARTICLE_COUNT = 60;

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.5;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.speedY = (Math.random() - 0.5) * 0.3;
    this.opacity = Math.random() * 0.4 + 0.1;
    const colors = ['#f0c040', '#4ecdc4', '#6c5ce7', '#fd79a8'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
    if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.opacity;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

function drawLines() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(78, 205, 196, ${0.06 * (1 - dist / 120)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  drawLines();
  requestAnimationFrame(animate);
}
animate();

// ===== Scroll Reveal =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.phil-card, .proc-card, .principle-card, .flow-step, .age-card, .module-card, .pbl-step, .accordion-item, .comp-card, .checklist-group, .matrix-cell').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});

// CSS for revealed state
const style = document.createElement('style');
style.textContent = '.revealed { opacity: 1 !important; transform: translateY(0) !important; }';
document.head.appendChild(style);

// ===== Matrix Filter =====
let activeAge = 'all';
let activeMod = 'all';

function applyMatrixFilter() {
  document.querySelectorAll('.matrix-cell').forEach(cell => {
    const cellAge = cell.dataset.cellAge;
    const cellMod = cell.dataset.cellMod;
    const ageMatch = activeAge === 'all' || cellAge === activeAge;
    const modMatch = activeMod === 'all' || cellMod === activeMod;
    cell.classList.toggle('hidden', !(ageMatch && modMatch));
  });
}

document.querySelectorAll('[data-age-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-age-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeAge = btn.dataset.ageFilter;
    applyMatrixFilter();
  });
});

document.querySelectorAll('[data-mod-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-mod-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeMod = btn.dataset.modFilter;
    applyMatrixFilter();
  });
});
