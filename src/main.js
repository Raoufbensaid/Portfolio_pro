// Hero 3D scene (Three.js). Fails silently to the static hero if WebGL is unavailable.
import * as THREE from 'three';

const canvas = document.getElementById('hero-3d');
const hero = document.querySelector('.hero');
const portrait = document.querySelector('.portrait');
const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
let noMotion = motionMq.matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
} catch (e) { canvas.remove(); }

if (renderer) {
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // Core: wireframe icosahedron + glowing vertices + faint inner solid
  const anchor = new THREE.Group();
  const group = new THREE.Group();
  anchor.add(group);
  scene.add(anchor);

  const coreGeo = new THREE.IcosahedronGeometry(1.7, 1);
  const coreMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.5 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  const vertsMat = new THREE.PointsMaterial({ size: 0.09, transparent: true, opacity: 0.95 });
  const verts = new THREE.Points(coreGeo, vertsMat);
  const innerMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.1 });
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), innerMat);
  group.add(core, verts, inner);

  // Orbits with satellites
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6 });
  const satMat = new THREE.MeshBasicMaterial();
  const satGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const orbits = [
    { r: 2.7, tilt: [1.25, 0.35, 0], speed: 0.55 },
    { r: 3.25, tilt: [-0.5, 0.95, 0.2], speed: -0.38 },
    { r: 3.8, tilt: [0.2, -0.6, 0.9], speed: 0.24 }
  ].map((o, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(o.r, 0.01, 8, 160), ringMat);
    ring.rotation.set(...o.tilt);
    const sat = new THREE.Mesh(satGeo, satMat);
    ring.add(sat);
    group.add(ring);
    return { ...o, ring, sat, phase: i * 2.1 };
  });

  // Ambient particle field
  const N = innerWidth < 768 ? 320 : 760;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 5 + Math.random() * 11;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.65;
    pos[i * 3 + 2] = r * Math.cos(ph) - 5;
  }
  const fieldGeo = new THREE.BufferGeometry();
  fieldGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const fieldMat = new THREE.PointsMaterial({ size: 0.04, transparent: true, opacity: 0.55 });
  const field = new THREE.Points(fieldGeo, fieldMat);
  scene.add(field);

  // Theme-aware colors from CSS tokens
  const applyColors = () => {
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim();
    const strong = cs.getPropertyValue('--accent-strong').trim();
    const subtle = cs.getPropertyValue('--fg-subtle').trim();
    coreMat.color.set(accent);
    vertsMat.color.set(strong);
    innerMat.color.set(accent);
    ringMat.color.set(accent);
    satMat.color.set(strong);
    fieldMat.color.set(subtle);
    if (noMotion) render();
  };
  new MutationObserver(applyColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Place the sculpture behind the portrait, sized to it
  const layout = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    const hr = hero.getBoundingClientRect();
    const pr = portrait.getBoundingClientRect();
    const cx = pr.left + pr.width / 2 - hr.left;
    const cy = pr.top + pr.height / 2 - hr.top;
    anchor.position.set((cx / w - 0.5) * visW, -(cy / h - 0.5) * visH, 0);
    const s = ((pr.width / w) * visW) / 4.3;
    anchor.scale.setScalar(s);
    if (noMotion) render();
  };

  // Pointer parallax + scroll
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / innerWidth - 0.5;
    mouse.ty = e.clientY / innerHeight - 0.5;
  }, { passive: true });

  const render = () => renderer.render(scene, camera);
  const clock = new THREE.Clock();
  let running = true, rafId = 0, t = 0;

  const tick = () => {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!noMotion) {
      t += dt;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      const scroll = Math.min(1, scrollY / hero.clientHeight);
      group.rotation.y = t * 0.18 + mouse.x * 0.8;
      group.rotation.x = Math.sin(t * 0.3) * 0.15 + mouse.y * 0.5 + scroll * 1.2;
      core.rotation.z = t * 0.1;
      inner.rotation.set(-t * 0.25, t * 0.3, 0);
      const pulse = 1 + Math.sin(t * 1.6) * 0.04;
      inner.scale.setScalar(pulse);
      orbits.forEach((o) => {
        const a = o.phase + t * o.speed;
        o.sat.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r, 0);
      });
      field.rotation.y = t * 0.02 + mouse.x * 0.15;
      field.rotation.x = mouse.y * 0.1;
      anchor.position.z = -scroll * 3;
    }
    render();
  };

  const start = () => { if (!rafId && running && !noMotion && !document.hidden) { clock.getDelta(); tick(); } };
  const stop = () => { cancelAnimationFrame(rafId); rafId = 0; };

  motionMq.addEventListener('change', (e) => { noMotion = e.matches; if (noMotion) { stop(); render(); } else start(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  new IntersectionObserver(([en]) => { running = en.isIntersecting; running ? start() : stop(); }).observe(hero);
  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(layout, 120); });

  // Wait for the portrait reveal so its final position is measured
  applyColors();
  layout();
  setTimeout(layout, 800);
  render();
  start();
  requestAnimationFrame(() => canvas.classList.add('ready'));
}
