import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import styles from './CosmicVFX.module.css';

export default function CosmicVFX() {
  const ref = useRef(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const container = ref.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.1,
      3000
    );
    camera.position.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ── Starfield ──────────────────────────────────────────
    const starCount = prefersReduced ? 800 : 3500;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const seeds = new Float32Array(starCount);

    const tint = (i, r, g, b) => {
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    };

    for (let i = 0; i < starCount; i++) {
      const r = 200 + Math.random() * 900;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const roll = Math.random();
      if (roll < 0.68) tint(i, 0.95, 0.96, 1.0);        // 흰별
      else if (roll < 0.85) tint(i, 0.72, 0.85, 1.0);    // 블루
      else if (roll < 0.95) tint(i, 1.0, 0.78, 0.92);    // 핑크
      else tint(i, 1.0, 0.86, 0.65);                     // 옐로

      sizes[i] = Math.random() * Math.random() * 3.2 + 0.6;
      seeds[i] = Math.random() * 100;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const starMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0 },
        uPR: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aSeed;
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uTime;
        uniform float uPR;
        void main() {
          vColor = color;
          float t = sin(uTime * 1.1 + aSeed) * 0.5 + 0.5;
          float t2 = sin(uTime * 2.6 + aSeed * 1.7) * 0.5 + 0.5;
          vTwinkle = mix(t, t2, 0.4);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPR * (0.5 + vTwinkle * 1.1) * (280.0 / max(-mv.z, 1.0));
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float core = smoothstep(0.5, 0.0, d);
          float glow = smoothstep(0.5, 0.15, d) * 0.35;
          float a = (core + glow) * (0.35 + vTwinkle * 0.8);
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });

    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Nebula clouds (additive 커다란 소프트 블롭) ─────────
    const nebulaColors = [0x6b5bff, 0xff6bd6, 0x00e5ff, 0xc9a8ff];
    const nebulas = nebulaColors.map((col, i) => {
      const geo = new THREE.SphereGeometry(1, 16, 12);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(col) },
          uSeed: { value: Math.random() * 10 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vPos;
          uniform vec3 uColor;
          uniform float uTime;
          uniform float uSeed;
          void main() {
            float d = length(vPos);
            float pulse = sin(uTime * 0.25 + uSeed) * 0.08 + 0.92;
            float a = smoothstep(1.0, 0.0, d) * 0.16 * pulse;
            gl_FragColor = vec4(uColor, a);
          }
        `,
      });
      const m = new THREE.Mesh(geo, mat);
      const scale = 180 + Math.random() * 260;
      m.scale.setScalar(scale);
      m.position.set(
        (Math.random() - 0.5) * 1400,
        (Math.random() - 0.5) * 700,
        -400 - Math.random() * 500
      );
      m.userData.drift = {
        vx: (Math.random() - 0.5) * 0.03,
        vy: (Math.random() - 0.5) * 0.02,
      };
      scene.add(m);
      return m;
    });

    // ── Shooting stars ───────────────────────────────────
    const shootingMat = new THREE.LineBasicMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });
    const shootingStars = [];

    const spawnShootingStar = () => {
      if (prefersReduced) return;
      const startX = (Math.random() - 0.5) * 1400;
      const startY = 200 + Math.random() * 400;
      const dir = new THREE.Vector3(
        -0.8 - Math.random() * 0.4,
        -0.6 - Math.random() * 0.3,
        -0.2
      ).normalize();
      const len = 140 + Math.random() * 80;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array([
        startX, startY, -300,
        startX + dir.x * len, startY + dir.y * len, -300 + dir.z * len,
      ]);
      const col = new Float32Array([
        1.0, 1.0, 1.0,
        0.7, 0.85, 1.0,
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const line = new THREE.Line(geo, shootingMat.clone());
      line.material.opacity = 1;
      scene.add(line);
      shootingStars.push({
        mesh: line,
        vel: dir.clone().multiplyScalar(8),
        life: 0,
        maxLife: 1.6,
      });
    };

    // ── Mouse parallax ────────────────────────────────────
    const targetRot = { x: 0, y: 0 };
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      targetRot.y = x * 0.08;
      targetRot.x = y * 0.05;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    // ── Resize ────────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // ── Visibility pause ─────────────────────────────────
    let paused = false;
    const io = new IntersectionObserver(
      ([entry]) => { paused = !entry.isIntersecting; },
      { threshold: 0 }
    );
    io.observe(container);

    // ── Main loop ────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf;
    let nextShootAt = 2 + Math.random() * 3;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused) return;
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      starMat.uniforms.uTime.value = t;
      stars.rotation.y += dt * 0.02;
      stars.rotation.x = Math.sin(t * 0.07) * 0.04;

      nebulas.forEach((n) => {
        n.material.uniforms.uTime.value = t;
        n.position.x += n.userData.drift.vx;
        n.position.y += n.userData.drift.vy;
        if (Math.abs(n.position.x) > 900) n.userData.drift.vx *= -1;
        if (Math.abs(n.position.y) > 500) n.userData.drift.vy *= -1;
      });

      if (t > nextShootAt) {
        spawnShootingStar();
        nextShootAt = t + 3 + Math.random() * 5;
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.life += dt;
        const pos = s.mesh.geometry.attributes.position.array;
        for (let j = 0; j < pos.length; j += 3) {
          pos[j] += s.vel.x;
          pos[j + 1] += s.vel.y;
          pos[j + 2] += s.vel.z;
        }
        s.mesh.geometry.attributes.position.needsUpdate = true;
        s.mesh.material.opacity = Math.max(0, 1 - s.life / s.maxLife);
        if (s.life >= s.maxLife) {
          scene.remove(s.mesh);
          s.mesh.geometry.dispose();
          s.mesh.material.dispose();
          shootingStars.splice(i, 1);
        }
      }

      camera.rotation.x += (targetRot.x - camera.rotation.x) * 0.04;
      camera.rotation.y += (targetRot.y - camera.rotation.y) * 0.04;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      io.disconnect();
      shootingStars.forEach((s) => {
        scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
      });
      nebulas.forEach((n) => {
        scene.remove(n);
        n.geometry.dispose();
        n.material.dispose();
      });
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={ref} className={styles.canvas} aria-hidden />;
}
