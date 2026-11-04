// Erupting volcano background (Three.js). Fails silently to the static page if WebGL is unavailable.
import * as THREE from 'three';

const canvas = document.getElementById('scene-3d');
const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
let noMotion = motionMq.matches;
const small = innerWidth < 768;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !small, powerPreference: 'high-performance' });
} catch (e) { canvas.remove(); }

if (renderer) {
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0c0706, 30, 85);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const camBase = new THREE.Vector3(0, 4, 27);
  const target = new THREE.Vector3(0, 6, 0);

  // ---------- Procedural textures ----------
  const radialTexture = (stops) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const dotTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]);
  const glowTex = radialTexture([[0, 'rgba(255,214,150,1)'], [0.18, 'rgba(255,120,40,0.85)'], [0.5, 'rgba(210,30,10,0.28)'], [1, 'rgba(120,0,0,0)']]);
  const smokeTex = radialTexture([[0, 'rgba(255,255,255,0.6)'], [0.45, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight(0x4a140c, 0x050202, 0.55));
  const rimLight = new THREE.DirectionalLight(0xff4a26, 0.9);
  rimLight.position.set(-14, 10, -12);
  scene.add(rimLight);
  const craterLight = new THREE.PointLight(0xff5a1f, 260, 45, 1.4);
  craterLight.position.set(0, 10.6, 0.6);
  scene.add(craterLight);

  // ---------- Volcano cone (lathe + rocky displacement) ----------
  const CRATER_Y = 10.3;
  const profile = new THREE.SplineCurve([
    new THREE.Vector2(0.01, 9.3), new THREE.Vector2(1.3, 9.45), new THREE.Vector2(2.0, 10.4),
    new THREE.Vector2(2.6, 10.15), new THREE.Vector2(3.8, 8.6), new THREE.Vector2(5.6, 6.0),
    new THREE.Vector2(8.2, 3.3), new THREE.Vector2(11.5, 1.3), new THREE.Vector2(16, 0.25), new THREE.Vector2(24, 0)
  ]).getPoints(60);
  const rock = (a, y) => 1 + 0.055 * Math.sin(a * 7 + y * 0.8) + 0.035 * Math.sin(a * 13 - y * 1.7) + 0.02 * Math.sin(a * 31 + y * 3.1);

  const coneGeo = new THREE.LatheGeometry(profile, small ? 72 : 120);
  const p = coneGeo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const glowAttr = new Float32Array(p.count);
  const dark = new THREE.Color(0x140a08), mid = new THREE.Color(0x2b1410), hot = new THREE.Color(0x5a1a0c);
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(x, z);
    const s = rock(a, y);
    p.setXYZ(i, x * s, y + 0.12 * Math.sin(a * 11 + y * 2), z * s);
    const h = Math.min(1, y / CRATER_Y);
    tmp.copy(dark).lerp(mid, Math.sin(a * 5 + y) * 0.5 + 0.5).lerp(hot, Math.pow(h, 3));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    // self-illumination: molten crater walls, hot rock fading down from the rim
    const inner = Math.hypot(x, z) < 2.05 && y > 9;
    glowAttr[i] = inner ? 1 : THREE.MathUtils.smoothstep(y, 7.5, 10.4) * (0.35 + 0.15 * Math.sin(a * 9 + y * 3));
  }
  coneGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  coneGeo.setAttribute('aGlow', new THREE.BufferAttribute(glowAttr, 1));
  coneGeo.computeVertexNormals();
  const coneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const glowUniform = { value: 1 };
  coneMat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glowUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.32, 0.07) * vGlow * uGlow;');
  };
  const cone = new THREE.Mesh(coneGeo, coneMat);
  scene.add(cone);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshStandardMaterial({ color: 0x0d0706, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // Lava lake + crater glow
  const lake = new THREE.Mesh(new THREE.CircleGeometry(2.05, 48), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.y = 9.85;
  scene.add(lake);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.set(0, CRATER_Y + 0.6, 0);
  scene.add(glow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
  halo.position.set(0, CRATER_Y + 3, -2);
  halo.scale.setScalar(30);
  scene.add(halo);

  // Lava streams down the slopes (follow the same rock displacement as the cone)
  const surfacePoint = (t, a) => {
    const idx = Math.min(profile.length - 1, Math.floor(t * (profile.length - 1)));
    const v = profile[idx];
    const s = rock(a, v.y) * 1.012 + 0.03;
    return new THREE.Vector3(Math.sin(a) * v.x * s, v.y + 0.12 * Math.sin(a * 11 + v.y * 2) + 0.06, Math.cos(a) * v.x * s);
  };
  const streamCore = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const streamGlow = new THREE.MeshBasicMaterial({ color: 0xff3010, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const streams = [-0.35, 0.25, 0.9, -1.1, 2.6].map((a0, k) => {
    const pts = [];
    const start = 0.25, end = 0.5 + (k % 3) * 0.1;
    for (let i = 0; i <= 24; i++) {
      const t = start + (end - start) * (i / 24);
      pts.push(surfacePoint(t, a0 + Math.sin(i * 0.7 + k) * 0.05));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.045, 5), streamCore));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.13, 6), streamGlow));
    scene.add(group);
    return group;
  });

  // ---------- Lava bombs (ballistic particles) ----------
  const MAX = small ? 600 : 1400;
  const bPos = new Float32Array(MAX * 3).fill(-999);
  const bCol = new Float32Array(MAX * 3);
  const bVel = new Float32Array(MAX * 3);
  const bLife = new Float32Array(MAX).fill(1);
  const bMax = new Float32Array(MAX).fill(1);
  const bombGeo = new THREE.BufferGeometry();
  bombGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bombGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  const bombs = new THREE.Points(bombGeo, new THREE.PointsMaterial({
    size: small ? 0.55 : 0.48, map: dotTex, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  bombs.frustumCulled = false;
  scene.add(bombs);
  let cursor = 0;
  const spawn = (n, power) => {
    for (let k = 0; k < n; k++) {
      const i = cursor++ % MAX;
      const a = Math.random() * Math.PI * 2;
      const spread = Math.random() * 2.6 * power;
      bPos[i * 3] = (Math.random() - 0.5) * 1.6;
      bPos[i * 3 + 1] = CRATER_Y - 0.2;
      bPos[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
      bVel[i * 3] = Math.cos(a) * spread;
      bVel[i * 3 + 1] = (7 + Math.random() * 7) * power;
      bVel[i * 3 + 2] = Math.sin(a) * spread;
      bLife[i] = 0;
      bMax[i] = 1.8 + Math.random() * 2.2;
    }
  };
  const hotC = new THREE.Color(1, 0.86, 0.5), warmC = new THREE.Color(1, 0.32, 0.06), coldC = new THREE.Color(0.35, 0.04, 0.02);
  const updateBombs = (dt) => {
    for (let i = 0; i < MAX; i++) {
      if (bLife[i] >= bMax[i]) continue;
      bLife[i] += dt;
      bVel[i * 3 + 1] -= 9.8 * dt;
      bPos[i * 3] += bVel[i * 3] * dt;
      bPos[i * 3 + 1] += bVel[i * 3 + 1] * dt;
      bPos[i * 3 + 2] += bVel[i * 3 + 2] * dt;
      const k = bLife[i] / bMax[i];
      if (bPos[i * 3 + 1] < 0 || k >= 1) { bLife[i] = bMax[i]; bPos[i * 3 + 1] = -999; continue; }
      if (k < 0.35) tmp.copy(hotC).lerp(warmC, k / 0.35); else tmp.copy(warmC).lerp(coldC, (k - 0.35) / 0.65);
      bCol[i * 3] = tmp.r; bCol[i * 3 + 1] = tmp.g; bCol[i * 3 + 2] = tmp.b;
    }
    bombGeo.attributes.position.needsUpdate = true;
    bombGeo.attributes.color.needsUpdate = true;
  };

  // ---------- Embers drifting up across the whole sky ----------
  const E = small ? 220 : 500;
  const ePos = new Float32Array(E * 3), eSpd = new Float32Array(E);
  for (let i = 0; i < E; i++) {
    ePos[i * 3] = (Math.random() - 0.5) * 70;
    ePos[i * 3 + 1] = Math.random() * 40;
    ePos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 2;
    eSpd[i] = 0.6 + Math.random() * 1.6;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    size: 0.16, map: dotTex, color: 0xff7a30, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  embers.frustumCulled = false;
  scene.add(embers);
  const updateEmbers = (dt, t) => {
    for (let i = 0; i < E; i++) {
      ePos[i * 3 + 1] += eSpd[i] * dt;
      ePos[i * 3] += (Math.sin(t * 0.8 + i) * 0.4 + 0.5) * dt;
      if (ePos[i * 3 + 1] > 40) { ePos[i * 3 + 1] = 0; ePos[i * 3] = (Math.random() - 0.5) * 70; }
    }
    emberGeo.attributes.position.needsUpdate = true;
  };

  // ---------- Ash plume (smoke sprites) ----------
  const SMOKE = small ? 26 : 44;
  const smoke = Array.from({ length: SMOKE }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x5a3b36, transparent: true, depthWrite: false, opacity: 0 }));
    scene.add(s);
    return { s, life: (i / SMOKE) * 9, max: 9, vx: 0, vy: 0, rot: 0 };
  });
  const resetSmoke = (o) => {
    o.life = 0; o.max = 7 + Math.random() * 4;
    o.s.position.set((Math.random() - 0.5) * 1.5, CRATER_Y + 3.5, (Math.random() - 0.5) * 1.5 - 1.5);
    o.vx = 0.5 + Math.random() * 0.8; o.vy = 1.6 + Math.random() * 1.4;
    o.s.material.rotation = Math.random() * Math.PI * 2;
    o.rot = (Math.random() - 0.5) * 0.3;
  };
  smoke.forEach((o) => { const l = o.life; resetSmoke(o); o.life = l; o.s.position.y += o.vy * l; o.s.position.x += o.vx * l; });
  const updateSmoke = (dt) => {
    smoke.forEach((o) => {
      o.life += dt;
      if (o.life >= o.max) resetSmoke(o);
      const k = o.life / o.max;
      o.s.position.x += o.vx * dt;
      o.s.position.y += o.vy * dt * (1 - k * 0.5);
      o.s.material.rotation += o.rot * dt;
      o.s.scale.setScalar(4 + k * 16);
      // fade in slowly so the plume never blacks out the crater glow
      o.s.material.opacity = Math.pow(Math.sin(Math.PI * k), 2) * 0.6;
    });
  };

  // ---------- Fire column (additive sprites jetting out of the crater) ----------
  const FIRE = small ? 18 : 30;
  const fire = Array.from({ length: FIRE }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    scene.add(s);
    return { s, life: (i / FIRE) * 1.4, max: 1.4, vx: 0, vy: 0 };
  });
  const resetFire = (o, power) => {
    o.life = 0; o.max = 0.9 + Math.random() * 0.8;
    o.s.position.set((Math.random() - 0.5) * 1.2, CRATER_Y, (Math.random() - 0.5) * 1.2);
    o.vx = (Math.random() - 0.5) * 1.5; o.vy = (5 + Math.random() * 5) * power;
  };
  fire.forEach((o) => resetFire(o, 1));
  let firePower = 1;
  const updateFire = (dt) => {
    fire.forEach((o) => {
      o.life += dt;
      if (o.life >= o.max) resetFire(o, firePower);
      const k = o.life / o.max;
      o.s.position.x += o.vx * dt;
      o.s.position.y += o.vy * dt * (1 - k * 0.6);
      o.s.scale.setScalar((1.6 + k * 4.5) * (0.8 + firePower * 0.3));
      o.s.material.opacity = (1 - k) * 0.75;
    });
  };

  // ---------- Explosions: burst + light flash + shockwave ----------
  const shock = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 72),
    new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  shock.rotation.x = -Math.PI / 2;
  shock.position.y = CRATER_Y + 0.2;
  scene.add(shock);
  let boom = 0, shockT = 9, nextBoom = 1.2, shake = 0;
  const explode = () => {
    spawn(small ? 260 : 520, 1.55);
    boom = 1; shockT = 0; shake = 0.5;
    nextBoom = 4 + Math.random() * 4;
  };

  // ---------- Layout, input, loop ----------
  const layout = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const portraitMode = camera.aspect < 0.9;
    // phones: volcano framed higher and wider so it rises around the portrait
    camBase.set(portraitMode ? 0 : -1.5, portraitMode ? 3 : 2.2, portraitMode ? 30 : 21);
    target.set(portraitMode ? 0 : -1.5, portraitMode ? 3.5 : 9.5, 0);
  };
  layout();
  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { layout(); if (noMotion) render(); }, 120); });

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  let t = 0, sinceSpawn = 0;
  const step = (dt) => {
    t += dt;
    sinceSpawn += dt;
    // steady fountain
    const rate = small ? 45 : 90;
    const n = Math.floor(sinceSpawn * rate);
    if (n > 0) { spawn(n, 0.75 + Math.random() * 0.2); sinceSpawn -= n / rate; }
    nextBoom -= dt;
    if (nextBoom <= 0) explode();

    updateBombs(dt);
    updateEmbers(dt, t);
    updateSmoke(dt);
    firePower = 1 + boom * 1.6;
    updateFire(dt);

    boom = Math.max(0, boom - dt * 1.4);
    shake = Math.max(0, shake - dt);
    shockT += dt;
    const sk = Math.min(1, shockT / 1.4);
    shock.scale.setScalar(1 + sk * 26);
    shock.material.opacity = (1 - sk) * 0.8 * (shockT < 1.4 ? 1 : 0);

    const flicker = 0.85 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04;
    craterLight.intensity = 140 * flicker + boom * 700;
    glowUniform.value = 0.8 * flicker + boom * 0.8;
    glow.scale.setScalar(8 + boom * 14 + Math.sin(t * 3) * 0.6);
    glow.material.opacity = 0.85 + boom * 0.15;
    halo.material.opacity = 0.3 + boom * 0.45;
    lake.material.color.setHSL(0.06 + Math.sin(t * 2) * 0.01, 1, 0.55 + boom * 0.2);
    streams.forEach((g, i) => { g.children[0].material.opacity = 0.8 + Math.sin(t * 2 + i) * 0.15; });
  };

  const render = () => {
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    const scroll = Math.min(1, scrollY / innerHeight);
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0;
    camera.position.set(camBase.x + mouse.x * 3 + sx, camBase.y - mouse.y * 1.5 + scroll * 5 + sy, camBase.z - scroll * 4);
    camera.lookAt(target.x, target.y + scroll * 6, target.z);
    renderer.render(scene, camera);
  };

  // Reduced motion: simulate a moment of eruption and keep a still frame
  const stillFrame = () => {
    for (let i = 0; i < 150; i++) step(1 / 60);
    mouse.x = mouse.tx = mouse.y = mouse.ty = 0;
    shake = 0;
    render();
  };

  const clock = new THREE.Clock();
  let rafId = 0;
  const tick = () => {
    rafId = requestAnimationFrame(tick);
    step(Math.min(clock.getDelta(), 0.05));
    render();
  };
  const start = () => { if (!rafId && !noMotion && !document.hidden) { clock.getDelta(); tick(); } };
  const stop = () => { cancelAnimationFrame(rafId); rafId = 0; };

  motionMq.addEventListener('change', (e) => { noMotion = e.matches; if (noMotion) { stop(); stillFrame(); } else start(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  addEventListener('scroll', () => { if (noMotion) render(); }, { passive: true });

  if (noMotion) stillFrame(); else start();
  requestAnimationFrame(() => canvas.classList.add('ready'));
}
