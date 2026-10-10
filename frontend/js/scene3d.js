(function () {
  const canvas = document.getElementById("bg");
  if (!canvas || typeof THREE === "undefined") return;

  const card = document.querySelector(".auth-card");
  if (card && window.matchMedia("(hover: hover)").matches) {
    document.addEventListener("mousemove", (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      card.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
    });
  }

  try {
    const portrait = window.innerWidth < 700;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 14;

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(5, 8, 6);
    scene.add(sun);

    const world = new THREE.Group();
    scene.add(world);

    // ---------- helpers ----------
    const mat = (c, extra) =>
      new THREE.MeshLambertMaterial(Object.assign(
        { color: c, emissive: c, emissiveIntensity: 0.15 }, extra || {}));

    function roundedShape(w, h, r) {
      const s = new THREE.Shape();
      const x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }
    function rbox(w, h, d, r, c, extra) {
      const geo = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
        depth: d, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 6,
      });
      geo.translate(0, 0, -d / 2);
      return new THREE.Mesh(geo, mat(c, extra));
    }
    const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    const cyl = (r1, r2, h, c, seg) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 20), mat(c));
    const torus = (r, t, c, arc) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 20, arc || Math.PI * 2), mat(c));

    function texPlane(w, h, pw, ph, draw) {
      const cv = document.createElement("canvas");
      cv.width = pw; cv.height = ph;
      draw(cv.getContext("2d"), pw, ph);
      const t = new THREE.CanvasTexture(cv);
        return new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: t })
      );
    }

    const items = [];

    // ---------- objects ----------
    function idCard() {
      const g = new THREE.Group();
      g.add(rbox(2.4, 1.5, 0.06, 0.12, 0xffffff));
      const face = texPlane(2.3, 1.42, 512, 320, (c, w, h) => {
        c.fillStyle = "#ffffff"; c.fillRect(0, 0, w, h);
        const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#19d3ff"); gr.addColorStop(1, "#4d6bff");
        c.fillStyle = gr; c.fillRect(0, 0, w, 80);
        c.fillStyle = "#fff"; c.font = "bold 40px system-ui, sans-serif"; c.fillText("STUDENT ID", 24, 54);
        c.fillStyle = "#cfd8dc"; c.fillRect(28, 110, 130, 170);
        c.fillStyle = "#90a4ae"; c.beginPath(); c.arc(93, 170, 32, 0, 7); c.fill();
        c.beginPath(); c.ellipse(93, 280, 52, 52, 0, Math.PI, 0); c.fill();
        c.fillStyle = "#b0bec5"; c.fillRect(190, 120, 280, 20); c.fillRect(190, 158, 210, 16); c.fillRect(190, 190, 250, 16);
        c.fillStyle = "#263238";
        for (let x = 190; x < 470; x += 9) c.fillRect(x, 245, (x % 3) + 3, 50);
      });
      face.position.z = 0.065; g.add(face);
      const hole = box(0.5, 0.08, 0.1, 0x222233); hole.position.set(0, 0.62, 0); g.add(hole);
      return g;
    }

    function backpack() {
      const g = new THREE.Group();
      g.add(rbox(1.7, 2.2, 0.9, 0.35, 0xff8a2b));
      const pocket = rbox(1.3, 0.95, 0.3, 0.2, 0xff5a2b); pocket.position.set(0, -0.5, 0.55); g.add(pocket);
      const zip = box(1.2, 0.05, 0.05, 0x3a2418); zip.position.set(0, -0.12, 0.72); g.add(zip);
      const pull = box(0.1, 0.2, 0.06, 0xffd23f); pull.position.set(0.4, -0.2, 0.74); g.add(pull);
      const flap = box(1.5, 0.05, 0.05, 0x3a2418); flap.position.set(0, 0.55, 0.47); g.add(flap);
      const handle = torus(0.3, 0.07, 0x3a2418, Math.PI); handle.position.y = 1.15; g.add(handle);
      [-0.55, 0.55].forEach((x) => { const s = box(0.18, 1.2, 0.08, 0x3a2418); s.position.set(x, 0.1, -0.5); g.add(s); });
      return g;
    }

    function headphones() {
      const g = new THREE.Group();
      g.add(torus(0.95, 0.09, 0x8b5cff, Math.PI));
      [-0.95, 0.95].forEach((x) => {
        const cup = cyl(0.42, 0.42, 0.3, 0xff4d8d); cup.rotation.z = Math.PI / 2; cup.position.set(x, 0, 0); g.add(cup);
        const pad = torus(0.32, 0.11, 0x2a2a3a); pad.rotation.y = Math.PI / 2; pad.position.set(x * 0.86, 0, 0); g.add(pad);
      });
      const cushion = box(0.7, 0.07, 0.2, 0x2a2a3a); cushion.position.y = 0.93; g.add(cushion);
      return g;
    }

    function phone() {
      const g = new THREE.Group();
      g.add(rbox(1.1, 2.2, 0.1, 0.16, 0x3dff9a));
      const screen = texPlane(0.98, 2.06, 256, 512, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#2b1055"); gr.addColorStop(1, "#0b3a6b");
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = "#fff"; c.font = "bold 46px system-ui, sans-serif"; c.fillText("9:41", 78, 90);
        const cols = ["#ff4d8d", "#ffd23f", "#19d3ff", "#3dff9a", "#ff8a2b", "#a66bff"];
        for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
          c.fillStyle = cols[(r + k) % cols.length]; c.fillRect(30 + k * 75, 160 + r * 80, 56, 56);
        }
      });
      screen.position.z = 0.065; g.add(screen);
      const lens = cyl(0.09, 0.09, 0.05, 0x111118, 14); lens.rotation.x = Math.PI / 2; lens.position.set(-0.3, 0.85, -0.08); g.add(lens);
      return g;
    }

    function bottle() {
      const g = new THREE.Group();
      const pts = [[0, 0], [0.42, 0], [0.5, 0.1], [0.5, 1.45], [0.4, 1.75], [0.22, 1.95], [0.22, 2.1], [0, 2.1]]
        .map((p) => new THREE.Vector2(p[0], p[1]));
      const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), mat(0x19d3ff, { metalness: 0.3, roughness: 0.35 }));
      body.position.y = -1.05; g.add(body);
      const cap = cyl(0.27, 0.27, 0.35, 0xff4d8d); cap.position.y = 1.2; g.add(cap);
      const band = cyl(0.51, 0.51, 0.35, 0xffffff); band.position.y = 0.1; g.add(band);
      return g;
    }

    function book() {
      const g = new THREE.Group();
      g.add(rbox(1.6, 2.1, 0.5, 0.06, 0xff4d8d));
      const pages = box(1.45, 1.95, 0.4, 0xfffaf0); pages.position.set(0.08, 0, 0); g.add(pages);
      const cover = texPlane(1.5, 2.0, 256, 340, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#ff4d8d"); gr.addColorStop(1, "#a63cff");
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = "#ffffff"; c.fillRect(34, 50, 188, 70);
        c.fillStyle = "#a63cff"; c.fillRect(48, 68, 130, 12); c.fillRect(48, 92, 90, 12);
        c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.arc(128, 230, 50, 0, 7); c.fill();
      });
      cover.position.z = 0.285; g.add(cover);
      return g;
    }

    function key() {
      const g = new THREE.Group();
      const gold = 0xffc933;
      const ring = torus(0.5, 0.14, gold); ring.material.metalness = 0.5; g.add(ring);
      const shaft = box(1.8, 0.2, 0.18, gold); shaft.position.x = 1.3; g.add(shaft);
      const t1 = box(0.2, 0.45, 0.18, gold); t1.position.set(1.85, -0.3, 0); g.add(t1);
      const t2 = box(0.2, 0.3, 0.18, gold); t2.position.set(1.45, -0.22, 0); g.add(t2);
      const tag = rbox(0.6, 0.45, 0.06, 0.1, 0xff4d8d); tag.position.set(-0.75, -0.2, 0); g.add(tag);
      return g;
    }

    function notes() {
      const g = new THREE.Group();
      const paper = (c, i) => {
        const s = rbox(1.7, 2.2, 0.03, 0.04, c); s.position.set(i * 0.1, -i * 0.08, i * 0.07); s.rotation.z = (i - 1) * 0.1; return s;
      };
      g.add(paper(0xf3f3f3, 0)); g.add(paper(0xfff1a8, 1));
      const top = texPlane(1.62, 2.12, 256, 340, (c, w, h) => {
        c.fillStyle = "#ffffff"; c.fillRect(0, 0, w, h);
        c.strokeStyle = "#7ec8ff"; c.lineWidth = 2;
        for (let y = 60; y < h; y += 28) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        c.strokeStyle = "#ff6b8b"; c.beginPath(); c.moveTo(42, 0); c.lineTo(42, h); c.stroke();
        c.fillStyle = "#2b3a67"; c.font = "bold 26px system-ui, sans-serif"; c.fillText("Notes", 60, 40);
      });
      top.position.set(0.2, -0.16, 0.2); top.rotation.z = 0.1; g.add(top);
      return g;
    }

    function sticky() {
      const g = new THREE.Group();
      g.add(rbox(1.3, 1.3, 0.04, 0.05, 0xffe94d));
      const face = texPlane(1.24, 1.24, 256, 256, (c, w, h) => {
        c.fillStyle = "#ffe94d"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#c2410c"; c.font = "bold 34px system-ui, sans-serif"; c.fillText("LOST!", 70, 70);
        c.fillStyle = "#d97706"; c.fillRect(40, 110, 170, 10); c.fillRect(40, 145, 130, 10); c.fillRect(40, 180, 150, 10);
      });
      face.position.z = 0.03; g.add(face);
      return g;
    }

    // ---------- placement ----------
    const defs = [
      [idCard, -7.2, 3.6, 1],
      [backpack, 7.2, -3.4, 1],
      [headphones, 0.3, 5.4, 0.85],
      [phone, -9.4, 0.2, 0.9],
      [bottle, -7.2, -3.6, 0.9],
      [book, 7.2, 3.4, 1],
      [key, 9.4, 0.4, 1],
      [notes, -4.4, 5.0, 0.9],
      [sticky, 3.8, -5.4, 0.85],
    ];
    const mobileSlots = [[-2.2, 5.7], [2.3, 5.5], [0.1, 5.9], [-2.2, -5.6], [2.3, -5.5], [0.1, -5.9]];

    const chosen = portrait ? defs.slice(0, mobileSlots.length) : defs;
    chosen.forEach((d, i) => {
      const g = d[0]();
      const x = portrait ? mobileSlots[i][0] : d[1];
      const y = portrait ? mobileSlots[i][1] : d[2];
      g.position.set(x, y, 0);
      g.scale.setScalar(portrait ? 0.5 : d[3]);
      g.rotation.set((Math.random() - 0.5) * 0.8, Math.random() * 6, (Math.random() - 0.5) * 0.4);
      g.userData = { speed: 0.003 + Math.random() * 0.004, offset: Math.random() * 6, baseY: y };
      world.add(g);
      items.push(g);
    });

    // chamakti dots
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 120; i++) pts.push((Math.random() - 0.5) * 36, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 10 - 4);
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.8 }));
    scene.add(stars);

    const mouse = { x: 0, y: 0 };
    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX / window.innerWidth - 0.5;
      mouse.y = e.clientY / window.innerHeight - 0.5;
    });

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      world.scale.setScalar(portrait ? 1 : Math.max(0.5, Math.min(1, camera.aspect / 1.6)));
    }
    window.addEventListener("resize", resize);
    resize();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let t = 0;
        let last = 0;
    function animate(now) {
      requestAnimationFrame(animate);
      if (document.hidden || now - last < 33) return;
      last = now;
      if (!reduced) {
        t += 0.02;
        items.forEach((g) => {
          g.rotation.y += g.userData.speed * 4;
          g.rotation.x += g.userData.speed;
          g.position.y = g.userData.baseY + Math.sin(t + g.userData.offset) * 0.4;
        });
        stars.rotation.y += 0.0008;
        camera.position.x += (mouse.x * 2 - camera.position.x) * 0.1;
        camera.position.y += (-mouse.y * 2 - camera.position.y) * 0.1;
        camera.lookAt(0, 0, 0);
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  } catch (e) {
    console.warn("3D background disabled:", e);
  }
})();