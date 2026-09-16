import * as THREE from "three";
import { gsap } from "gsap";

import "./style.css";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Header / navigation ----------
const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");

menuToggle?.addEventListener("click", () => {
  const open = header.classList.toggle("nav-open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
});

document.querySelectorAll(".desktop-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    header.classList.remove("nav-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

// ---------- Cursor glow ----------
const cursorGlow = document.querySelector(".cursor-glow");
if (cursorGlow && !reduceMotion) {
  window.addEventListener("pointermove", (event) => {
    gsap.to(cursorGlow, {
      x: event.clientX,
      y: event.clientY,
      duration: 0.45,
      ease: "power3.out",
      overwrite: true
    });
  });
}

// ---------- Three.js hero scene ----------
const canvas = document.querySelector("#hero-canvas");

if (canvas && !reduceMotion) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  group.position.set(2.4, 0.2, 0);
  scene.add(group);

  const wireGeometry = new THREE.IcosahedronGeometry(2.05, 2);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x638cff,
    wireframe: true,
    transparent: true,
    opacity: 0.22
  });
  const wire = new THREE.Mesh(wireGeometry, wireMaterial);
  group.add(wire);

  const coreGeometry = new THREE.IcosahedronGeometry(1.55, 3);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x8d68ff,
    wireframe: true,
    transparent: true,
    opacity: 0.18
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  group.add(core);

  const particleCount = 800;
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const radius = 3.1 + Math.random() * 2.7;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    sizes[i] = Math.random() * 1.5 + 0.5;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const particleMaterial = new THREE.PointsMaterial({
    color: 0x789aff,
    size: 0.025,
    transparent: true,
    opacity: 0.58,
    sizeAttenuation: true
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  group.add(particles);

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Keep the 3D object away from the copy on smaller screens.
    group.position.x = width < 900 ? 2.3 : 2.7;
    group.scale.setScalar(width < 600 ? 0.78 : width < 900 ? 0.88 : 1);
  };

  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();

  const render = () => {
    const t = clock.getElapsedTime();
    wire.rotation.x = t * 0.08;
    wire.rotation.y = t * 0.13;
    core.rotation.x = -t * 0.1;
    core.rotation.y = -t * 0.17;
    particles.rotation.y = t * 0.018;
    particles.rotation.x = Math.sin(t * 0.15) * 0.06;

    group.rotation.y += (pointer.x * 0.11 - group.rotation.y) * 0.025;
    group.rotation.x += (-pointer.y * 0.08 - group.rotation.x) * 0.025;
    group.position.y = 0.2 + Math.sin(t * 0.65) * 0.08;

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };

  render();
}

// ---------- Scroll reveal ----------
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((el, index) => {
  if (reduceMotion) el.classList.add("is-visible");
  else {
    el.style.transitionDelay = `${Math.min(index * 35, 280)}ms`;
    revealObserver.observe(el);
  }
});

// ---------- Skill bar animation ----------
const skillBars = document.querySelectorAll(".skill-bar i");
const skillObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.transform = "scaleX(1)";
        skillObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.7 }
);
skillBars.forEach((bar) => skillObserver.observe(bar));

// ---------- 3D tilt cards ----------
if (!reduceMotion) {
  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const rotateY = ((x / rect.width) - 0.5) * 7;
      const rotateX = ((y / rect.height) - 0.5) * -7;

      gsap.to(card, {
        rotateX,
        rotateY,
        transformPerspective: 900,
        duration: 0.35,
        ease: "power2.out",
        overwrite: true
      });
    });

    card.addEventListener("pointerleave", () => {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.65,
        ease: "elastic.out(1, .55)"
      });
    });
  });
}

// ---------- Hero entrance ----------
if (!reduceMotion) {
  gsap.from(".hero-title", {
    y: 45,
    opacity: 0,
    duration: 1.05,
    delay: 0.15,
    ease: "power4.out"
  });
  gsap.from(".hero .eyebrow", {
    y: 15,
    opacity: 0,
    duration: 0.65,
    delay: 0.05,
    ease: "power3.out"
  });
}

// ---------- Project modal ----------
const projectData = {
  deliverconnect: {
    kicker: "FULL STACK · MOBILE · DATA",
    title: "DeliverConnect",
    description:
      "Marketplace de livraison collaborative conçu comme une expérience de bout en bout : publication, matching, tracking GPS, communication, paiement et pilotage.",
    architecture: [
      "API REST Node.js / Express + MongoDB / Mongoose",
      "Authentification JWT + Stripe Connect",
      "Tracking GPS temps réel via Socket.io + Leaflet / OpenStreetMap",
      "Chat WebSocket + notifications SMS Vonage",
      "Dashboard React / Vite / Recharts + backend Railway"
    ],
    tech: ["React Native", "Expo", "Node.js", "Express", "MongoDB", "Socket.io", "Stripe", "Leaflet", "Vonage"],
    github: "https://github.com/Raoufbensaid"
  },
  sales: {
    kicker: "DATA ANALYTICS",
    title: "Analyse des ventes E-commerce",
    description:
      "Projet data orienté décision : nettoyage multi-tables, modélisation SQL, segmentation, KPIs, prévision simple et exposition automatisée des indicateurs dans un dashboard.",
    architecture: [
      "Collecte et nettoyage via Python, Pandas et NumPy",
      "Modélisation relationnelle SQL + requêtes analytiques",
      "Segmentation client, panier moyen, retours et promotions",
      "API FastAPI exposant les KPIs et alertes anomalies",
      "Dashboard Power BI avec filtres période, catégorie et région"
    ],
    tech: ["Python", "Pandas", "NumPy", "SQL", "PostgreSQL", "FastAPI", "Power BI"],
    github: "https://github.com/Raoufbensaid"
  }
};

const modal = document.querySelector("#project-modal");
const modalTitle = document.querySelector("#modal-title");
const modalKicker = document.querySelector("#modal-kicker");
const modalDescription = document.querySelector("#modal-description");
const modalArchitecture = document.querySelector("#modal-architecture");
const modalTech = document.querySelector("#modal-tech");
const modalGithub = document.querySelector("#modal-github");

function openProject(key) {
  const project = projectData[key];
  if (!project || !modal) return;

  modalKicker.textContent = project.kicker;
  modalTitle.textContent = project.title;
  modalDescription.textContent = project.description;
  modalArchitecture.innerHTML = project.architecture.map((item) => `<li>${item}</li>`).join("");
  modalTech.innerHTML = project.tech.map((item) => `<span>${item}</span>`).join("");
  modalGithub.href = project.github;

  modal.hidden = false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => modal.classList.add("is-open"));
}

function closeProject() {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

document.querySelectorAll("[data-open-project]").forEach((button) => {
  button.addEventListener("click", () => openProject(button.dataset.openProject));
});
document.querySelectorAll("[data-close-modal]").forEach((element) => {
  element.addEventListener("click", closeProject);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal?.hidden) closeProject();
});

// ---------- Contact form ----------
const form = document.querySelector("#contact-form");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "").trim();
  const message = String(data.get("message") || "").trim();

  const subject = encodeURIComponent(`Opportunité — ${name}`);
  const body = encodeURIComponent(
    `Bonjour Raouf,\n\n${message}\n\nMon email : ${email}\n\nBien cordialement,\n${name}`
  );

  window.location.href = `mailto:bensaidabderraouf1@gmail.com?subject=${subject}&body=${body}`;
});

// ---------- Small accessibility / active-section behavior ----------
const navLinks = [...document.querySelectorAll(".desktop-nav a")];
const sections = [...document.querySelectorAll("main section[id]")];

const activeObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  },
  { rootMargin: "-40% 0px -55% 0px" }
);

sections.forEach((section) => activeObserver.observe(section));
