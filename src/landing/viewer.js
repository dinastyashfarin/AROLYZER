import { PART_NAMES, PART_RULES, GAS_PATH } from './data.js';

export function partOf(o) {
  while (o) {
    for (var i = 0; i < PART_RULES.length; i++) if (PART_RULES[i][1].test(o.name || '')) return PART_RULES[i][0];
    o = o.parent;
  }
  return null;
}

export function Viewer(T, canvas, src, o) {
  var s = this; s.T = T; s.c = canvas; s.o = o || {};
  var dpr = window.devicePixelRatio || 1;
  var r = s.r = new T.WebGLRenderer({ canvas: canvas, antialias: dpr < 1.5, alpha: true, powerPreference: 'default' });
  r.setPixelRatio(Math.min(dpr, 1.5));
  r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  s.scene = new T.Scene();
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  var pm = new T.PMREMGenerator(r);
  s.scene.environment = pm.fromScene(studioEnv(T), 0).texture;
  s.cam = new T.PerspectiveCamera(30, 1, 0.01, 200);
  s.key = new T.DirectionalLight('#FFFFFF', 3); s.key.position.set(-4, 8, 5); s.scene.add(s.key);
  s.key.castShadow = true; s.key.shadow.mapSize.set(1024, 1024);
  var scam = s.key.shadow.camera; scam.left = -3; scam.right = 3; scam.top = 3; scam.bottom = -3; scam.near = 0.5; scam.far = 25;
  s.key.shadow.bias = -0.0004; s.key.shadow.normalBias = 0.02; s.key.shadow.radius = 2;
  s.hemi = new T.HemisphereLight('#FFFFFF', '#C7EFC2', 0.12); s.scene.add(s.hemi);
  s.rim = new T.DirectionalLight('#CBF39D', 1.4); s.rim.position.set(-5, 3, -5); s.scene.add(s.rim);
  s.rim2 = new T.DirectionalLight('#FFFFFF', 1.8); s.rim2.position.set(6, 2.5, -3); s.scene.add(s.rim2);

  var model = src.clone(true);
  s.meshes = []; s.parts = {};
  var fanMesh = null;
  model.traverse(function (m) {
    if (!m.isMesh) return;
    m.material = m.material.clone();
    // glass: plain see-through instead of transmission, which costs a whole extra render pass every frame
    var glass = m.material.transmission > 0;
    if (glass) { m.material.transmission = 0; m.material.thickness = 0; m.material.transparent = true; m.material.opacity = 0.28; m.material.depthWrite = false; }
    m.material.envMapIntensity = 1.8;
    if (m.material.roughness != null) m.material.roughness = Math.max(0.05, m.material.roughness * 0.6);
    var mc = m.material.color;
    if (s.o.metal && mc && !glass && (mc.r + mc.g + mc.b) / 3 > 0.45 && Math.max(mc.r, mc.g, mc.b) - Math.min(mc.r, mc.g, mc.b) < 0.12) {
      mc.set('#D3DAD6'); m.material.metalness = 0.95; m.material.roughness = 0.17; m.material.envMapIntensity = 2.6;
      if ('clearcoat' in m.material) { m.material.clearcoat = 0.5; m.material.clearcoatRoughness = 0.12; }
    }
    m.castShadow = true;
    m.material.userData.op = 1; m.material.userData.base = glass ? 0.28 : 1;
    m.material.userData.em = m.material.emissive ? m.material.emissive.clone() : null;
    m.userData.part = partOf(m);
    s.meshes.push(m);
    if (m.userData.part) (s.parts[m.userData.part] = s.parts[m.userData.part] || []).push(m);
    if (!fanMesh && /^Normal[ _]fan/.test((m.parent && m.parent.name) || '')) fanMesh = m;
  });
  s.dotM = new T.MeshBasicMaterial({ color: '#EA7A0C', transparent: true, opacity: 0, depthTest: false, toneMapped: false });
  var dg = new T.SphereGeometry(0.0056, 10, 10);
  s.path = GAS_PATH.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); });
  s.segL = []; s.totL = 0;
  for (var i = 1; i < s.path.length; i++) { var L = s.path[i].distanceTo(s.path[i - 1]); s.segL.push(L); s.totL += L; }
  s.dots = [];
  for (var d = 0; d < 0; d++) { var dm = new T.Mesh(dg, s.dotM); dm.renderOrder = 10; dm.userData.o = d / 26; model.add(dm); s.dots.push(dm); }
  var holder = new T.Group(); holder.add(model);
  model.updateMatrixWorld(true);
  var box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3());
  var k = 3 / size.y; model.scale.setScalar(k); model.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
  s.scene.add(holder); s.model = model; s.holder = holder;
  holder.updateMatrixWorld(true);

  s.fanAngle = 0; s.fanSpeed = 0; s.fanGoal = s.o.fan || 0;
  if (fanMesh) {
    fanMesh.geometry.computeBoundingBox();
    var c = fanMesh.geometry.boundingBox.getCenter(new T.Vector3());
    var cp = c.clone().applyMatrix4(fanMesh.matrix);
    var par = fanMesh.parent, pivot = new T.Object3D();
    pivot.position.copy(cp); par.add(pivot); pivot.add(fanMesh);
    fanMesh.position.sub(cp);
    var wq = new T.Quaternion(); par.getWorldQuaternion(wq);
    s.fanAxis = new T.Vector3(1, 0, 0).applyQuaternion(wq.invert()).normalize();
    s.fanPivot = pivot;
  }
  (function () {
    var ab = s.partBox(['ash']), sb2 = s.partBox(['stove']);
    if (!ab || !sb2) return;
    var ac = ab.getCenter(new T.Vector3()), sc2 = sb2.getCenter(new T.Vector3()), dir = ac.clone().sub(sc2); dir.y = 0;
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.normalize(); s.drawerYaw = Math.atan2(dir.x, dir.z);
    var asz = ab.getSize(new T.Vector3()), along = Math.abs(asz.x * dir.x) + Math.abs(asz.z * dir.z);
    var world = dir.clone().multiplyScalar(along * 0.9);
    s.drawer = [];
    (s.parts.ash || []).forEach(function (m) {
      var par = m.parent, wp = new T.Vector3(); m.getWorldPosition(wp);
      var a0 = par.worldToLocal(wp.clone()), a1 = par.worldToLocal(wp.clone().add(world));
      m.userData.home = m.position.clone(); m.userData.slide = a1.sub(a0);
      s.drawer.push(m);
    });
  })();
  // reactor tips on its axle (the turning wheel) for unloading; lid lifts off
  (function () {
    var hb = s.partBox(['handle']); if (!hb) return;
    var hinv = new T.Matrix4().copy(s.holder.matrixWorld).invert();
    var hc = hb.getCenter(new T.Vector3()), hz = hb.getSize(new T.Vector3());
    var axis = hz.x < hz.y && hz.x < hz.z ? new T.Vector3(1, 0, 0) : (hz.y < hz.z ? new T.Vector3(0, 1, 0) : new T.Vector3(0, 0, 1));
    var rb = s.partBox(['reactor']); var pivot = new T.Vector3(hc.x, hc.y, hc.z);
    if (rb) { var rc = rb.getCenter(new T.Vector3()); if (axis.z) pivot.z = rc.z; else if (axis.x) pivot.x = rc.x; }
    pivot.applyMatrix4(hinv);
    var ms = [], seen = new Set();
    ['reactor', 'insulator', 'lid', 'bolts', 'gauge', 'valve', 'handle'].forEach(function (k) { (s.parts[k] || []).forEach(function (m) { if (seen.has(m)) return; seen.add(m); ms.push({ m: m, lid: k === 'lid' || k === 'bolts', home: new T.Matrix4().multiplyMatrices(hinv, m.matrixWorld) }); }); });
    s.tipRig = { pivot: pivot, axis: axis, list: ms, angle: -1.62, lift: 0.32, tmp: new T.Matrix4(), rot: new T.Matrix4(), tr: new T.Matrix4(), inv: new T.Matrix4() };
    s.tipT = 0; s.lidT = 0; s.tipGoal = 0; s.lidGoal = 0;
  })();
  s.fire = new T.PointLight('#FF8A2A', 0, 2.2, 2);
  var sb = s.partBox(['stove']);
  if (sb) { var sc = sb.getCenter(new T.Vector3()); s.fire.position.set(sc.x, sc.y + 0.1, sc.z + 0.5); }
  s.scene.add(s.fire);
  var cv = document.createElement('canvas'); cv.width = cv.height = 128;
  var cx = cv.getContext('2d'); var gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(1,14,9,.42)'); gr.addColorStop(.55, 'rgba(1,14,9,.16)'); gr.addColorStop(1, 'rgba(1,14,9,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  var sh = new T.Mesh(new T.PlaneGeometry(3.2, 3.2), new T.MeshBasicMaterial({ map: (function () { var tx = new T.CanvasTexture(cv); tx.encoding = T.sRGBEncoding; return tx; })(), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.002; s.scene.add(sh); s.sh = sh;
  if (s.o.hover || s.o.isolate) { sh.visible = false; }
  s.groundM = new T.ShadowMaterial({ opacity: 0.3 });
  var ground = new T.Mesh(new T.PlaneGeometry(12, 12), s.groundM);
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.001; ground.receiveShadow = true; s.scene.add(ground);
  if (s.o.hover || s.o.isolate) ground.visible = false;

  var v = s.o.view || {};
  s.homeYaw = v.yaw != null ? v.yaw : -0.6; s.homePitch = v.pitch != null ? v.pitch : 0.22;
  s.home = new T.Vector3(0, v.ty != null ? v.ty : 1.45, 0); s.homeDist = v.dist || 8.2;
  s.gy = s.homeYaw; s.gp = s.homePitch; s.gd = s.homeDist; s.gt = s.home.clone(); s.tgt = s.home.clone();
  var ic = s.o.introCam; s.yaw = ic ? s.gy + ic.dyaw : s.gy; s.pitch = ic ? ic.pitch : s.gp; s.dist = ic ? s.gd * ic.distK : s.gd; if (ic) s.tgt.y -= 0.35;
  s.hl = null; s.xray = false; s.lv = { fire: s.o.fire || 0.5, gas: s.o.gas || 0 }; s.lg = { fire: s.lv.fire, gas: s.lv.gas };
  s.idle = 99; s.visible = true; s.auto = s.o.auto !== false; s.reduce = !!s.o.reduce;
  s.ray = new T.Raycaster(); s.ndc = new T.Vector2(); s.hoverId = null;
  s.setDark(!!s.o.dark);

  var down = null;
  s.onDown = function (e) { down = { x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} };
  s.onMove = function (e) {
    if (down) {
      var dx = e.clientX - down.x, dy = e.clientY - down.y; down.x = e.clientX; down.y = e.clientY;
      s.gy -= dx * 0.009; s.gp = Math.max(-0.05, Math.min(1.1, s.gp + dy * 0.006)); s.idle = 0; s.setHover(null, 0, 0);
    } else if (e.pointerType === 'mouse' && s.o.onHover) s.pick(e);
  };
  s.onUp = function () { down = null; };
  s.onLeave = function () { if (!down) s.setHover(null, 0, 0); };
  canvas.addEventListener('pointerdown', s.onDown); canvas.addEventListener('pointermove', s.onMove);
  canvas.addEventListener('pointerup', s.onUp); canvas.addEventListener('pointercancel', s.onUp); canvas.addEventListener('pointerleave', s.onLeave);
  s.ro = new ResizeObserver(function () { s.resize(); }); s.ro.observe(canvas.parentElement);
  s.io = new IntersectionObserver(function (en) { s.visible = en[0].isIntersecting; }, { rootMargin: '120px' }); s.io.observe(canvas);
  s.resize();
}
Viewer.prototype.setDark = function (d) {
  this.r.toneMappingExposure = d ? 1.2 : 1.05;
  this.key.intensity = d ? 3.4 : 3.0;
  this.hemi.intensity = d ? 0.2 : 0.12;
  this.hemi.groundColor.set(d ? '#1DA97A' : '#C7EFC2');
  this.rim.intensity = d ? 3.2 : 1.4;
  this.rim2.intensity = d ? 2.6 : 1.8;
  this.groundM.opacity = d ? 0.5 : 0.3;
};

export function studioEnv(T) {
  var sc = new T.Scene();
  sc.add(new T.Mesh(new T.BoxGeometry(24, 24, 24), new T.MeshBasicMaterial({ color: '#0E1311', side: T.BackSide })));
  function panel(w, h, inten, col, x, y, z) {
    var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(inten), side: T.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
  }
  panel(7, 7, 3.2, '#FFFFFF', 0, 10, 0);
  panel(1.4, 9, 10, '#FFFFFF', -9, 1.5, 3);
  panel(1.1, 9, 8, '#FFFFFF', 9, 2, -2.5);
  panel(6, 1.6, 1.4, '#C7EFC2', 0, 0.5, 10);
  panel(5, 5, 2.4, '#1DA97A', -4, -7, -6);
  return sc;
}
Viewer.prototype.partBox = function (ids) {
  var T = this.T, b = new T.Box3(), any = false, self = this;
  this.holder.updateMatrixWorld(true);
  ids.forEach(function (id) { (self.parts[id] || []).forEach(function (m) { b.expandByObject(m); any = true; }); });
  return any ? b : null;
};
Viewer.prototype.fitDist = function () {
  var vh = this.cam.fov * Math.PI / 360, asp = (this.w || 16) / (this.h || 9), wide = (this.w || 0) > 1080;
  var hh = Math.atan(Math.tan(vh) * asp * (wide ? 0.6 : 0.94));
  var half = Math.min(vh * 0.86, hh);
  var z = this.fitZoom || 1; if (!wide) z = Math.max(z, 0.86) * (asp < 0.75 ? 0.82 : 1.08);
  return Math.max(0.4, (this.fitSz / 2) / Math.sin(half) * z);
};
Viewer.prototype.resize = function () {
  var p = this.c.parentElement, w = p.clientWidth, h = p.clientHeight;
  if (!w || !h) return; this.w = w; this.h = h;
  this.r.setSize(w, h, false); this.cam.aspect = w / h;
  if (this.o.shift && w > 1080) this.cam.setViewOffset(w, h, -w * this.o.shift, 0, w, h); else this.cam.clearViewOffset();
  this.distK = this.o.isolate ? 1 : (this.o.shift && w <= 1080) ? 0.82 : (w / h < 0.9 ? 1.35 : (w / h < 1.25 ? 1.1 : 1));
  if (this.o.isolate && this.fitSz) this.gd = this.fitDist();
  this.cam.updateProjectionMatrix();
};
Viewer.prototype.pick = function (e) {
  var rc = this.c.getBoundingClientRect();
  this.ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
  this.ray.setFromCamera(this.ndc, this.cam);
  var hits = this.ray.intersectObjects(this.meshes, false), id = null;
  for (var i = 0; i < hits.length; i++) { if (hits[i].object.userData.part && hits[i].object.material.opacity > 0.3) { id = hits[i].object.userData.part; break; } }
  this.setHover(id, e.clientX - rc.left, e.clientY - rc.top);
};
Viewer.prototype.setHover = function (id, x, y) {
  var tip = this.o.tip && this.o.tip();
  if (tip) tip.style.transform = id ? 'translate(' + (x + 16) + 'px,' + (y + 12) + 'px)' : 'translate(-999px,-999px)';
  if (id !== this.hoverId) { this.hoverId = id; if (this.o.onHover) this.o.onHover(id ? PART_NAMES[id] : ''); }
};
Viewer.prototype.setStep = function (st) {
  if (this.o.isolate && this.hl && !this.reduce) { this.pend = st; this.pendT = 0.3; return; }
  this.applyStep(st);
};
Viewer.prototype.applyStep = function (st) {
  this.hl = st.parts; this.drawerGoal = st.drawer ? 1 : 0; this.tipGoal = st.tip ? 1 : 0; this.glowCol = st.glow || '#1DA97A';
  if (st.closeLid && !this.reduce) { this.lidT = 1; this.lidGoal = 0; } else this.lidGoal = st.tip ? 1 : 0;
  if (st.drawer && this.drawerYaw != null) { var cy = this.gy, ty = this.drawerYaw + 0.75; ty += Math.round((cy - ty) / (Math.PI * 2)) * Math.PI * 2; this.gy = ty; this.gp = 0.32; } this.xray = !!st.xray; this.fanGoal = st.fan; this.lg.fire = st.fire; this.lg.gas = st.gas; this.idle = 0;
  var b = this.partBox(st.parts);
  if (b) {
    var c = b.getCenter(new this.T.Vector3()), sz = b.getSize(new this.T.Vector3()).length();
    this.gt.copy(c); this.gd = Math.max(3.2, Math.min(9, sz * 2.6 + 2.2));
    if (this.o.isolate) {
      this.fitSz = sz; this.fitZoom = st.zoom || 1;
      this.gd = this.fitDist();
      if (this.started && !this.reduce) { this.tgt.copy(c); this.dist = this.gd * 1.55; this.gy += 0.85; this.gp = 0.22; this.pitch = 0.5; }
      this.started = true;
    }
  }
};
Viewer.prototype.frame = function (dt, t) {
  var s = this, k = 1 - Math.exp(-dt * ((s.o.introCam && t < 3.4) ? 1.35 : 4.5));
  s.idle += dt;
  if (s.o.loop && !s.loopDone) {
    if (s.tLoop == null) s.tLoop = t;
    var e = t - s.tLoop, ph = e < 0.6 ? 0 : e < 1.6 ? 1 : e < 2.6 ? 2 : e < 8 ? 3 : 4;
    s.lg.fire = ph >= 1 ? 1 : 0.05; s.fanGoal = ph >= 2 ? 1 : 0; s.lg.gas = ph === 3 ? 1 : 0;
    if (ph !== s.loopPh) { s.loopPh = ph; if (s.o.onLoop) s.o.onLoop(ph); }
    if (ph === 4) { s.loopDone = true; s.fanGoal = 0.6; s.lg.fire = 0.7; }
  }
  if (s.auto && !s.reduce && s.idle > 2) s.gy += dt * (s.o.spin || 0.15);
  if (s.o.hover && s.holder) {
    s.holder.position.y = s.o.hover;
  }
  s.yaw += (s.gy - s.yaw) * k; s.pitch += (s.gp - s.pitch) * k; s.dist += (s.gd - s.dist) * k; s.tgt.lerp(s.gt, k);
  for (var q in s.lv) s.lv[q] += (s.lg[q] - s.lv[q]) * (1 - Math.exp(-dt * 2.5));
  if (s.tipRig) {
    var kk = 1 - Math.exp(-dt * (s.reduce ? 30 : 4)), pT = s.tipT, pL = s.lidT;
    s.tipT += ((s.tipGoal || 0) - s.tipT) * kk;
    var lg2 = s.lidGoal || 0; if (lg2 && s.tipT < 0.85) lg2 = 0; // lid lifts only once the reactor is tipped
    s.lidT += (lg2 - s.lidT) * (1 - Math.exp(-dt * (s.reduce ? 30 : 4.5)));
    if (Math.abs(s.tipT - pT) > 1e-5 || Math.abs(s.lidT - pL) > 1e-5 || !s.tipInit) {
      s.tipInit = true; var rg = s.tipRig, P = rg.pivot;
      rg.rot.makeRotationAxis(rg.axis, rg.angle * s.tipT);
      for (var ti = 0; ti < rg.list.length; ti++) {
        var it = rg.list[ti], M = rg.tmp.copy(it.home);
        if (it.lid) M.premultiply(rg.tr.makeTranslation(0, rg.lift * s.lidT, 0));
        M.premultiply(rg.tr.makeTranslation(-P.x, -P.y, -P.z)).premultiply(rg.rot).premultiply(rg.tr.makeTranslation(P.x, P.y, P.z)).premultiply(s.holder.matrixWorld);
        it.m.parent.updateMatrixWorld(true);
        M.premultiply(rg.inv.copy(it.m.parent.matrixWorld).invert());
        M.decompose(it.m.position, it.m.quaternion, it.m.scale);
      }
    }
  }
  // ash drawer slides out of the stove on the last step
  if (s.drawer) {
    var dg = s.drawerGoal || 0; s.drawerT = (s.drawerT || 0) + (dg - (s.drawerT || 0)) * (1 - Math.exp(-dt * (s.reduce ? 30 : 4.5)));
    for (var di = 0; di < s.drawer.length; di++) { var dm = s.drawer[di]; dm.position.copy(dm.userData.home).addScaledVector(dm.userData.slide, s.drawerT); }
  }
  var d = s.dist * (s.distK || 1);
  s.cam.position.set(s.tgt.x + d * Math.cos(s.pitch) * Math.sin(s.yaw), s.tgt.y + d * Math.sin(s.pitch), s.tgt.z + d * Math.cos(s.pitch) * Math.cos(s.yaw));
  s.cam.lookAt(s.tgt);
  if (s.pendT > 0) { s.pendT -= dt; if (s.pendT <= 0) { s.applyStep(s.pend); s.pend = null; } }
  var pulse = 0.16 + Math.sin(t * 3) * 0.07;
  for (var i = 0; i < s.meshes.length; i++) {
    var me = s.meshes[i], m = me.material, pid = me.userData.part;
    var on = s.hl ? s.hl.indexOf(pid) >= 0 : false;
    var goal = s.hl && !on ? 0.1 : (on && s.xray ? 0.4 : 1);
    if (s.o.isolate) {
      goal = (s.pendT > 0 || !on) ? 0 : 1;
      m.userData.op += (goal - m.userData.op) * (1 - Math.exp(-dt * (goal ? 6 : 14)));
      me.visible = m.userData.op > 0.01;
    } else
    m.userData.op += (goal - m.userData.op) * k;
    var base = m.userData.base || 1, tr = m.userData.op < 0.98 || base < 1;
    if (tr !== m.transparent) { m.transparent = tr; m.needsUpdate = true; }
    m.opacity = m.userData.op * base; m.depthWrite = base === 1 && m.userData.op > 0.6;
    if (m.emissive) {
      var lit = s.o.glow !== false && (on || (!s.hl && s.hoverId && pid === s.hoverId));
      if (lit) { m.emissive.set(s.glowCol || '#1DA97A'); m.emissiveIntensity = pulse; } else if (m.userData.em) { m.emissive.copy(m.userData.em); m.emissiveIntensity = 1; }
    }
  }
  s.fanSpeed += (s.fanGoal - s.fanSpeed) * (1 - Math.exp(-dt * 1.2));
  if (s.fanPivot) { s.fanAngle += dt * s.fanSpeed * (s.reduce ? 4 : 22); s.fanPivot.quaternion.setFromAxisAngle(s.fanAxis, s.fanAngle); }
  s.fire.intensity = s.lv.fire * 3.2 * (s.reduce ? 1 : 0.88 + Math.sin(t * 13) * 0.08 + Math.sin(t * 29) * 0.04);
  s.dotM.opacity = Math.min(1, s.lv.gas * 1.1);
  if (s.lv.gas > 0.02) {
    for (var j = 0; j < s.dots.length; j++) {
      var u = ((s.dots[j].userData.o + (s.o.stillDots ? 0 : t * 0.16)) % 1) * s.totL, seg = 0;
      while (seg < s.segL.length - 1 && u > s.segL[seg]) { u -= s.segL[seg]; seg++; }
      s.dots[j].visible = true;
      s.dots[j].position.lerpVectors(s.path[seg], s.path[seg + 1], Math.min(1, u / s.segL[seg]));
    }
  } else for (var z = 0; z < s.dots.length; z++) s.dots[z].visible = false;
  s.r.render(s.scene, s.cam);
};
Viewer.prototype.dispose = function () {
  var c = this.c;
  c.removeEventListener('pointerdown', this.onDown); c.removeEventListener('pointermove', this.onMove);
  c.removeEventListener('pointerup', this.onUp); c.removeEventListener('pointercancel', this.onUp); c.removeEventListener('pointerleave', this.onLeave);
  this.ro.disconnect(); this.io.disconnect(); this.r.dispose();
};
