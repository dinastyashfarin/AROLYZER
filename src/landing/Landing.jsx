import React from 'react';
import { THREE, MeshoptDecoder } from '../lib/three.js';
import { translator, rich, words, site } from '../content.jsx';
import { Viewer } from './viewer.js';
import { I18N_ATTRS, i18nApply } from './i18n.js';
import { odoSet, fmt, fmt1, capStr } from './format.js';
import { MODEL_URL, STEPS, FEATS, featStep, LOGOS } from './data.js';

export default class Landing extends React.Component {
  static defaultProps = Object.assign({}, site.display, site.calculator);

  getRefs() {
    if (!this._r) {
      var self = this; self._el = {};
      var mk = function (n) { return function (el) { self._el[n] = el; }; };
      this._r = { lc: mk('lc'), bento: mk('bento'), odoKg: mk('odoKg'), odoB: mk('odoB'), odoH: mk('odoH'), ruler: mk('ruler'), tape: mk('tape'), uc: mk('uc'), pv: mk('pv'), stage: mk('stage'), hero: mk('hero'), how: mk('how'), heroTip: mk('heroTip'), howTip: mk('howTip'), bgFar: mk('bgFar'), bgNear: mk('bgNear'), heroH1: mk('heroH1'), heroLow: mk('heroLow'), fields: mk('fields'), f1: mk('f1'), f2: mk('f2'), f3: mk('f3') };
    }
    return this._r;
  }
  st(k, d) { var s = this.state || {}; return s[k] === undefined ? d : s[k]; }
  isId() { return this.st('lang', 'en') === 'id'; }
  isDark() {
    var s = this.state || {};
    if (s.dark !== undefined) return s.dark;
    return !!(this.props.startDark ?? false);
  }
  componentDidMount() {
    var self = this, tries = 0;
    // carry the visitor's theme and language over from the other pages
    try { var pd = localStorage.getItem('arolyzer:dark'), pl = localStorage.getItem('arolyzer:lang'), ns = {}; if (pd !== null) ns.dark = pd === '1'; if (pl === 'id' || pl === 'en') ns.lang = pl; if (Object.keys(ns).length) this.setState(ns); } catch (x) {}
    var go = function () {
      if (self._dead) return;
      var T = THREE;
      fetch(MODEL_URL).then(function (res) { if (!res.ok) throw new Error('model ' + res.status); return res.arrayBuffer(); }).then(function (buf) {
        var ld = new T.GLTFLoader(); ld.setMeshoptDecoder(MeshoptDecoder);
        ld.parse(buf, '', function (g) {
          if (self._dead) return;
          try { self.initGL(T, g.scene); self.setState({ loading: false }); } catch (e) { self.setState({ noGL: true, loading: false }); }
        }, function () { self.setState({ noGL: true, loading: false }); });
      }).catch(function () { self.setState({ noGL: true, loading: false }); });
    };
    go();
    var reduceM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, pRaf = 0;
    // numbers, ruler, rolling figures and wipe titles
    this._syncCalc();
    var rul = this._el.ruler;
    if (rul) {
      var KG_PX = 0.8, startX = 0, startV = 0, dragging = false;
      var clampV = function (v) { return Math.max(10, Math.min(5000, Math.round(v / 10) * 10)); };
      var setV = function (v) { v = clampV(v); if (String(v) !== String(self.st('kg', 500))) self.setState({ kg: String(v) }); };
      rul.addEventListener('pointerdown', function (e) { dragging = true; startX = e.clientX; startV = clampV(Number(self.st('kg', 500)) || 10); rul.classList.add('drag'); try { rul.setPointerCapture(e.pointerId); } catch (x) {} });
      var pendV = null, rulRaf = 0;
      rul.addEventListener('pointermove', function (e) { if (!dragging) return; pendV = startV - (e.clientX - startX) / KG_PX; if (!rulRaf) rulRaf = requestAnimationFrame(function () { rulRaf = 0; if (pendV !== null) setV(pendV); }); });
      var end = function () { if (!dragging) return; dragging = false; rul.classList.remove('drag'); };
      rul.addEventListener('pointerup', end); rul.addEventListener('pointercancel', end);
      rul.addEventListener('keydown', function (e) {
        var v = clampV(Number(self.st('kg', 500)) || 10), step = e.shiftKey ? 100 : 10, nv = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nv = v + step; else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nv = v - step;
        else if (e.key === 'PageUp') nv = v + 500; else if (e.key === 'PageDown') nv = v - 500; else if (e.key === 'Home') nv = 10; else if (e.key === 'End') nv = 5000;
        if (nv !== null) { e.preventDefault(); rul.classList.add('drag'); setV(nv); clearTimeout(rul._kt); rul._kt = setTimeout(function () { rul.classList.remove('drag'); }, 120); }
      });
    }
    var figs = [].slice.call(document.querySelectorAll('[data-odo-fig]')).filter(function (f) { return self._el.ruler ? self._el.ruler.ownerDocument === f.ownerDocument : true; });
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    figs.forEach(function (f) {
      if (f._odoDone) return; var txt = f.textContent.trim(); if (!/[0-9]/.test(txt)) return;
      f.setAttribute('aria-label', txt); var o = document.createElement('span'); o.className = 'odo'; o.setAttribute('aria-hidden', 'true');
      f.textContent = ''; f.appendChild(o); f._odo = o; f._txt = txt; f._odoDone = true;
      odoSet(o, calm ? txt : txt.replace(/[0-9]/g, '0'), true);
    });
    var wts = [].slice.call(document.querySelectorAll('.wt'));
    if (!calm) document.documentElement.classList.add('wt-on');
    var pend = calm ? [] : wts.concat(figs.filter(function (f) { return f._odo; }));
    if (this._el.bento) { if (calm) this._el.bento.classList.add('on'); else pend.push(this._el.bento); }
    if (calm) figs.forEach(function (f) { if (f._odo) odoSet(f._odo, f._txt, false); });
    // reveal titles and roll figures once they reach the lower part of the screen (also catches jumps past them)
    this._revealCheck = function () {
      if (!pend.length) return;
      var H = window.innerHeight || 800;
      pend = pend.filter(function (t) {
        var r = t.getBoundingClientRect();
        if (r.top > H * 0.82) return true;
        if (t._odo) odoSet(t._odo, t._txt, false);
        else if (t.classList.contains('bento')) t.classList.add('on');
        else { if (r.bottom < 0) t.classList.add('wt-now'); t.classList.add('wt-in'); }
        return false;
      });
    };
    this._revealCheck();
    this._onReveal = function () { if (self._revealRaf) return; self._revealRaf = requestAnimationFrame(function () { self._revealRaf = 0; self._revealCheck(); }); };
    window.addEventListener('scroll', this._onReveal, { passive: true });
    // stacked colour panels: the covered panel sinks back as the next one slides over it
    if (!calm) {
      this._stack = function () {
        var f = [self._el.f1, self._el.f2, self._el.f3];
        for (var i = 0; i < 2; i++) {
          var a = f[i], b = f[i + 1]; if (!a || !b) continue;
          var h = a.offsetHeight || 1, bt = b.getBoundingClientRect().top, at = a.getBoundingClientRect().top;
          var cv = Math.max(0, Math.min(1, 1 - (bt - at) / h));
          var v = cv.toFixed(3); if (a._cv !== v) { a._cv = v; a.style.transform = cv > 0 ? 'scale(' + (1 - cv * 0.05).toFixed(4) + ')' : ''; var d = a.querySelector('.fdim'); if (d) d.style.opacity = (cv * 0.45).toFixed(3); }
        }
      };
      this._onStack = function () { if (self._stackRaf) return; self._stackRaf = requestAnimationFrame(function () { self._stackRaf = 0; self._stack(); }); };
      window.addEventListener('scroll', this._onStack, { passive: true });
      this._stack();
    }
    window.addEventListener('resize', this._onReveal);
    var navLast = window.scrollY || 0, navRaf = 0;
    this._onNav = function () {
      if (navRaf) return;
      navRaf = requestAnimationFrame(function () {
        navRaf = 0; var y = window.scrollY || 0, away = self.st('navAway', false), next = away;
        if (y < 90) next = false; else if (y > navLast + 6) next = true; else if (y < navLast - 6) next = false;
        navLast = y; if (next !== away) self.setState({ navAway: next });
      });
    };
    window.addEventListener('scroll', this._onNav, { passive: true });
    if (typeof IntersectionObserver !== 'undefined') {
      var secs = ['how', 'calc', 'specs', 'upclose', 'features', 'price'], vis = {};
      this._sio = new IntersectionObserver(function (en) {
        en.forEach(function (e) { vis[e.target.id] = e.isIntersecting; });
        var cur = ''; secs.forEach(function (id) { if (vis[id]) cur = id; });
        if (cur !== self.st('sec', '')) self.setState({ sec: cur });
      }, { rootMargin: '-45% 0px -50% 0px' });
      secs.forEach(function (id) { var el = document.getElementById(id); if (el) self._sio.observe(el); });
    }
    this._onScroll = function () {
      if (pRaf) return;
      pRaf = requestAnimationFrame(function () {
        pRaf = 0; var y = window.scrollY || 0;
        var sg0 = self._el.stage; if (sg0) { var pe = y > 160 ? 'none' : ''; if (sg0.style.pointerEvents !== pe) sg0.style.pointerEvents = pe; }
        if (y > 1600) return;
        var hh = self._el.heroH1, hl = self._el.heroLow, stg = self._el.stage, wide = window.innerWidth > 1080;
        if (hh) hh.style.transform = wide ? 'translate3d(0,' + (-y * 0.22).toFixed(1) + 'px,0)' : '';
        if (hl) hl.style.transform = wide ? 'translate3d(0,' + (y * 0.08).toFixed(1) + 'px,0)' : '';
        if (stg) stg.style.transform = wide ? 'translate3d(0,' + (-y * 0.07).toFixed(1) + 'px,0)' : '';
      });
    };
    if (!reduceM) window.addEventListener('scroll', this._onScroll, { passive: true });
    // 62.5% chart: crosshair + values under the pointer
    var lc = this._el.lc;
    if (lc) {
      var plot = lc.querySelector('.lc-plot'), tip = lc.querySelector('.lc-tip'), xl = lc.querySelector('.lc-x');
      var ssf = function (t) { t = Math.max(0, Math.min(1, t)); return 3 * t * t - 2 * t * t * t; };
      var showAt = function (cx) {
        var r = plot.getBoundingClientRect(), f = Math.max(0, Math.min(1, (cx - r.left) / r.width));
        var ours = Math.round(ssf(f / 0.375) * 100), kiln = Math.round(ssf(f) * 100), id = self.isId();
        xl.setAttribute('x1', (f * 300).toFixed(1)); xl.setAttribute('x2', (f * 300).toFixed(1));
        tip.style.left = Math.max(18, Math.min(82, f * 100)) + '%';
        tip.textContent = (id ? 'Waktu ' : 'Time ') + Math.round(f * 100) + '% \u00b7 AROLYZER ' + ours + '% \u00b7 ' + (id ? 'Tungku ' : 'Kiln ') + kiln + '%';
        plot.classList.add('hov');
      };
      plot.addEventListener('pointermove', function (e) { showAt(e.clientX); });
      plot.addEventListener('pointerdown', function (e) { showAt(e.clientX); });
      plot.addEventListener('pointerleave', function () { plot.classList.remove('hov'); });
    }
    // decorative loops (panel icons, gas-loop diagram) pause while off screen
    if (typeof IntersectionObserver !== 'undefined') {
      this._lio = new IntersectionObserver(function (en) { en.forEach(function (e) { e.target.classList.toggle('off', !e.isIntersecting); }); }, { rootMargin: '80px' });
      [this._el.bento, this._el.f1, this._el.f2, this._el.f3].forEach(function (el) { if (el) self._lio.observe(el); });
    }
    if (this._el.pv && typeof IntersectionObserver !== 'undefined') { var pvEl = this._el.pv; this._pio = new IntersectionObserver(function (en) { pvEl.classList.toggle('off', !en[0].isIntersecting); }); this._pio.observe(pvEl); }
    // colour panels: reveal once when each panel enters view
    if (this.fieldsArmed()) {
      this._fio = new IntersectionObserver(function (en) {
        var on = Object.assign({}, self.st('fon', {})), ch = false;
        en.forEach(function (e) { if (e.isIntersecting) { on[e.target.getAttribute('data-k')] = true; ch = true; self._fio.unobserve(e.target); } });
        if (ch) self.setState({ fon: on });
      }, { threshold: 0.3 });
      ['f1', 'f2', 'f3'].forEach(function (k) { var el = self._el[k]; if (el) { el.setAttribute('data-k', k); self._fio.observe(el); } });
    }
    this._slow = setTimeout(function () { if (!self._dead && self.st('loading', true)) self.setState({ slow: true }); }, 8000);
  }
  initGL(T, src) {
    var self = this, el = this._el;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var auto = this.props.autoRotate ?? true, dark = this.isDark();
    this.views = [];
    var loopCaps = ['', 'The rocket stove lights.', 'Gas from the reactor spins the fan.', 'The fan feeds the fire.', ''];
    var makers = {
      hero: function (first) {
        return new Viewer(T, el.hero, src, {
          auto: auto, spin: 0.12, stillDots: true, reduce: reduce, fan: reduce ? 0.35 : 0, fire: reduce ? 0.7 : 0.05, gas: 0, dark: self.isDark(), metal: true, loop: !reduce && first,
          introCam: (reduce || !first) ? null : { dyaw: -0.9, pitch: -0.02, distK: 0.8 },
          onLoop: function (ph) { self.setState({ loopCap: loopCaps[ph] }); },
          hover: 0.38,
          view: { yaw: -0.62, pitch: 0.1, dist: 7.6, ty: 2.05 }
        });
      },
      how: function () {
        var v = new Viewer(T, el.how, src, { auto: auto, reduce: reduce, spin: 0.08, dark: self.isDark(), metal: true, view: { yaw: -0.5, pitch: 0.25, dist: 8 } });
        self._shownStep = self.st('step', 0); v.setStep(STEPS[self._shownStep]); return v;
      },
      uc: function () {
        var v = new Viewer(T, el.uc, src, { auto: auto, reduce: reduce, spin: 0.12, dark: true, metal: true, glow: false, isolate: true, shift: -0.16, view: { yaw: -0.55, pitch: 0.2, dist: 7 } });
        self._shownFeat = self.st('feat', 0); v.setStep(featStep(self._shownFeat)); return v;
      }
    };
    var build = function (k, first) {
      if (self._dead || !el[k]) return;
      try { var v = makers[k](first); } catch (e) { return; }
      self[k] = v; self.views.push(v); el[k].classList.add('ready');
    };
    var drop = function (k) {
      var v = self[k]; if (!v) return;
      self.views = self.views.filter(function (x) { return x !== v; });
      try { v.dispose(); } catch (e) {}
      self[k] = null;
    };
    // a lost GPU context (too many 3D views, a busy or sleeping GPU) is rebuilt instead of leaving an empty box
    ['hero', 'how', 'uc'].forEach(function (k) {
      var c = el[k]; if (!c) return;
      c.addEventListener('webglcontextlost', function (e) { e.preventDefault(); }, false);
      c.addEventListener('webglcontextrestored', function () { drop(k); build(k, false); }, false);
    });
    // the hero builds now; the other two only when they come near the screen
    build('hero', true);
    if (typeof IntersectionObserver !== 'undefined') {
      this._lazy = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (!e.isIntersecting) return;
          var k = e.target === el.how ? 'how' : 'uc';
          self._lazy.unobserve(e.target);
          setTimeout(function () { if (!self[k]) build(k, true); }, 0);
        });
      }, { rootMargin: '700px 0px' });
      if (el.how) this._lazy.observe(el.how);
      if (el.uc) this._lazy.observe(el.uc);
    } else { build('how', true); build('uc', true); }
    var last = performance.now(), t0 = last;
    var loop = function (now) {
      if (self._dead) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      for (var i = 0; i < self.views.length; i++) if (self.views[i].visible) self.views[i].frame(dt, (now - t0) / 1000);
      self._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  _i18n() {
    var root = this._el && this._el.hero ? this._el.hero.closest('.page') : document.querySelector('.page');
    if (!root) return;
    var lang = this.st('lang', 'en');
    document.documentElement.lang = lang;
    if (lang === this._lastLang && lang === 'en') return;
    this._lastLang = lang;
    var self = this;
    if (this._mo) { this._mo.disconnect(); }
    i18nApply(root, lang);
    if (lang === 'id') {
      if (!this._mo) this._mo = new MutationObserver(function () { if (self._moBusy) return; self._moBusy = true; requestAnimationFrame(function () { self._moBusy = false; if (self.st('lang', 'en') === 'id') { self._mo.disconnect(); i18nApply(root, 'id'); self._mo.observe(root, self._moOpts); } }); });
      this._moOpts = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS };
      this._mo.observe(root, this._moOpts);
    }
  }
  _syncCalc() {
    var v = this._calcVals || {}, el = this._el || {};
    odoSet(el.odoKg, v.outKg, false); odoSet(el.odoB, v.batches, false); odoSet(el.odoH, String(v.totalHours).replace(/ h$/, ''), false);
    if (el.tape) el.tape.style.transform = 'translateX(' + (-(v.kgRange || 0) * 0.8) + 'px)';
  }
  componentDidUpdate(pp, ps) {
    this._syncCalc();
    this._i18n();
    var s = this.state || {}; ps = ps || {};
    // compare with what the viewers last showed, not prevState: re-renders from scrolling must not replay the swap
    var stp = s.step || 0, ft = s.feat || 0;
    if (this.how && stp !== this._shownStep) { this._shownStep = stp; this.how.setStep(STEPS[stp]); }
    if (this.uc && ft !== this._shownFeat) {
      this._shownFeat = ft; this.uc.setStep(featStep(ft));
      var stg = this._el.uc && this._el.uc.closest('.uc-stage'), lst = stg && stg.querySelector('.uc-list'), it = lst && lst.querySelector('.uc-item.on');
      if (lst && it && lst.scrollWidth > lst.clientWidth) lst.scrollTo({ left: Math.max(0, it.offsetLeft - 16), behavior: 'smooth' });
    }
    var d = this.isDark();
    if (d !== this._lastDark) { this._lastDark = d; (this.views || []).forEach(function (v) { v.setDark(d); }); }
  }
  fieldsArmed() {
    if (this._armed === undefined) this._armed = !!(typeof IntersectionObserver !== 'undefined' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
    return this._armed;
  }
  componentWillUnmount() {
    if (this._fio) this._fio.disconnect();
    if (this._pio) this._pio.disconnect();
    if (this._sio) this._sio.disconnect();
    if (this._mo) this._mo.disconnect();
    if (this._onStack) window.removeEventListener('scroll', this._onStack);
    if (this._lio) this._lio.disconnect();
    if (this._onReveal) { window.removeEventListener('scroll', this._onReveal); window.removeEventListener('resize', this._onReveal); }
    if (this._lazy) this._lazy.disconnect();
    if (this._onNav) window.removeEventListener('scroll', this._onNav);
    this._dead = true; cancelAnimationFrame(this._raf); clearTimeout(this._slow); if (this._onScroll) window.removeEventListener('scroll', this._onScroll);
    (this.views || []).forEach(function (v) { v.dispose(); });
  }
  renderVals() {
    var self = this, P = this.props;
    var step = this.st('step', 0), paused = this.st('paused', false), dark = this.isDark();
    var workL = Math.max(1, P.workingVolumeL ?? 203.29), bulk = Math.max(1, P.bulkDensity ?? 150);
    var cap = Math.max(1, Math.round(workL / 1000 * bulk * 10) / 10), hrs = Math.max(0.5, P.batchHours ?? 3), y = P.yieldPct ?? 30;
    var emptyKg = String(this.st('kg', 500)).trim() === '';
    var kg = Math.min(100000, Math.max(0, Number(this.st('kg', 500)) || 0));
    var out = kg * y / 100, batches = Math.ceil(kg / cap), totalH = batches * hrs;
    var go = function (i) { return function () { self.setState({ step: (i + STEPS.length) % STEPS.length }); }; };
    return {
      r: this.getRefs(),
      dark: dark, light: !dark,
      themeCls: dark ? 'dark' : '',
      langEn: !this.isId(), langId: this.isId(), langEnA: this.isId() ? 'false' : 'true', langIdA: this.isId() ? 'true' : 'false',
      enCls: this.isId() ? '' : 'on', idCls: this.isId() ? 'on' : '', lngCls: this.isId() ? 'r' : '',
      setEn: function () { try { localStorage.setItem('arolyzer:lang', 'en'); } catch (x) {} self.setState({ lang: 'en' }); }, setId: function () { try { localStorage.setItem('arolyzer:lang', 'id'); } catch (x) {} self.setState({ lang: 'id' }); },
      navCls: this.st('navAway', false) ? 'away' : '',
      nav_how: this.st('sec', '') === 'how' ? 'on' : '', nav_calc: this.st('sec', '') === 'calc' ? 'on' : '', nav_specs: this.st('sec', '') === 'specs' ? 'on' : '', nav_upclose: this.st('sec', '') === 'upclose' ? 'on' : '', nav_price: this.st('sec', '') === 'price' ? 'on' : '', nav_features: this.st('sec', '') === 'features' ? 'on' : '',
      cur_how: this.st('sec', '') === 'how' ? 'true' : 'false', cur_calc: this.st('sec', '') === 'calc' ? 'true' : 'false', cur_specs: this.st('sec', '') === 'specs' ? 'true' : 'false', cur_upclose: this.st('sec', '') === 'upclose' ? 'true' : 'false', cur_price: this.st('sec', '') === 'price' ? 'true' : 'false', cur_features: this.st('sec', '') === 'features' ? 'true' : 'false',
      vidPaused: this.st('vidPaused', false), vidPlaying: !this.st('vidPaused', false),
      vidCls: this.st('vidPaused', false) ? 'paused' : '',
      vidLabel: this.st('vidPaused', false) ? 'Play background animation' : 'Pause background animation',
      toggleVid: function () { self.setState({ vidPaused: !self.st('vidPaused', false) }); },
      fieldsCls: this.fieldsArmed() ? 'armed' : '',
      f1on: this.st('fon', {}).f1 ? 'on' : '', f2on: this.st('fon', {}).f2 ? 'on' : '', f3on: this.st('fon', {}).f3 ? 'on' : '',
      modeLabel: dark ? 'Switch to light mode' : 'Switch to night mode',
      toggleDark: function (e) {
        var next = !dark, root = document.documentElement;
        try { localStorage.setItem('arolyzer:dark', next ? '1' : '0'); } catch (x) {}
        var reduceM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var tg = e && e.target && e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : null;
        if (e && e.clientX) { root.style.setProperty('--vx', e.clientX + 'px'); root.style.setProperty('--vy', e.clientY + 'px'); }
        else if (tg) { root.style.setProperty('--vx', (tg.left + tg.width / 2) + 'px'); root.style.setProperty('--vy', (tg.top + tg.height / 2) + 'px'); }
        if (document.startViewTransition && !reduceM) {
          root.classList.add('vt');
          var vt = document.startViewTransition(function () {
            return new Promise(function (res) { self.setState({ dark: next }, res); setTimeout(res, 150); });
          });
          var done = function () { root.classList.remove('vt'); };
          if (vt && vt.finished) vt.finished.then(done, done); else setTimeout(done, 900);
        } else self.setState({ dark: next });
      },
      loading: this.st('loading', true),
      loadMsg: this.st('slow', false) ? 'Still loading the 3D model. Almost there.' : 'Loading the 3D model',
      noGL: this.st('noGL', false),
      heroHover: this.st('heroHover', ''),
      howHover: this.st('howHover', ''),
      feats: FEATS.map(function (f, i) {
        var cur = self.st('feat', 0);
        return { name: f.name, body: f.body, cls: i === cur ? 'on' : '', exp: i === cur ? 'true' : 'false', pick: function () { self.setState({ feat: i }); } };
      }),
      ucName: FEATS[this.st('feat', 0)].name, ucBody: FEATS[this.st('feat', 0)].body,
      ucFirst: this.st('feat', 0) === 0 ? 'off' : '', ucLast: this.st('feat', 0) === FEATS.length - 1 ? 'off' : '',
      ucFirstA: this.st('feat', 0) === 0 ? 'true' : 'false', ucLastA: this.st('feat', 0) === FEATS.length - 1 ? 'true' : 'false',
      ucPrev: function () { self.setState({ feat: Math.max(0, self.st('feat', 0) - 1) }); },
      ucNext: function () { self.setState({ feat: Math.min(FEATS.length - 1, self.st('feat', 0) + 1) }); },
      steps: STEPS.map(function (s, i) {
        return { n: i + 1, title: s.title, body: s.body, on: i === step, cls: i === step ? 'on' : '', parts: (self.isId() ? s.tagsId : s.tags), pick: go(i) };
      }),
      stepCount: 'Step ' + (step + 1) + ' of ' + STEPS.length,
      prev: go(step - 1), next: go(step + 1),
      kg: this.st('kg', 500),
      kgRange: Math.min(5000, Math.max(10, kg)),
      onKg: function (e) { self.setState({ kg: capStr(e.target.value, 100000) }); },
      capacity: fmt1(cap), hours: hrs, yieldPct: y, workL: String(workL), bulk: bulk,
      _c: (this._calcVals = { outKg: emptyKg ? 'Enter an amount' : (out < 10 ? fmt1(out) : fmt(out)), batches: fmt(batches), totalHours: fmt1(totalH) + ' h', kgRange: Math.min(5000, Math.max(10, kg)) }),
      outKg: emptyKg ? 'Enter an amount' : (out < 10 ? fmt1(out) : fmt(out)),
      outUnit: emptyKg ? '' : 'kg',
      outCls: emptyKg ? 'empty' : '',
      formula: emptyKg ? 'Type how many kilograms of dry biomass you have.' : 'of biochar, from ' + fmt(kg) + ' kg × ' + y + '% yield',
      batchLabel: batches === 1 ? 'batch' : 'batches',
      sacks: (function () {
        if (emptyKg || !(batches > 0)) return [];
        var MAX = 24, over = batches > MAX, n = over ? MAX - 1 : batches, raw = kg / cap, frac = raw - Math.floor(raw), out2 = [];
        for (var i = 0; i < n; i++) { var last = !over && i === n - 1 && frac > 0.001; out2.push({ f: last ? Math.max(8, Math.round(frac * 100)) + '%' : '100%' }); }
        return out2;
      })(),
      sackMore: !emptyKg && batches > 24, sackMoreTxt: '+' + fmt(Math.max(0, batches - 23)),
      batches: fmt(batches),
      totalHours: fmt1(totalH) + ' h',
      daysLine: 'of running, about ' + fmt(Math.ceil(totalH / 8)) + (Math.ceil(totalH / 8) === 1 ? ' working day' : ' working days') + ' at 8\u00a0h',
      notEmpty: !emptyKg, emptyKgV: emptyKg,
      cue: this.st('cue', !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)),
      loopCap: this.st('loopCap', ''),
      logos: LOGOS.map(function (n) { return { src: n[0], alt: n[1] }; }),
      marqCls: paused ? 'paused' : '', marqPaused: paused, marqPlaying: !paused,
      marqLabel: paused ? 'Play logos' : 'Pause logos',
      toggleMarq: function () { self.setState({ paused: !paused }); }
    };
  }

  render() {
    const v = this.renderVals();
    const lang = this.isId() ? 'id' : 'en', t = translator('landing', lang);
    return (
      <div className={`page ${v.themeCls}`}>
        <header className={`nav ${v.navCls}`}>
          <div className="in">
            <a className="brand" href="#top" aria-label={t('nav.arolyzer_home')}>
              <img className="ic" src="/assets/icon.webp" alt="" width="201" height="325" />
              <img className="wm wm-l" src="/assets/wordmark-light.webp" alt={t('nav.arolyzer')} width="980" height="169" />
              <img className="wm wm-d" src="/assets/wordmark-dark.webp" alt={t('nav.arolyzer')} width="980" height="169" />
            </a>
            <nav className="navlinks" aria-label={t('nav.main')}>
              <a href="#how" className={v.nav_how} aria-current={v.cur_how}>{t('nav.how_it_works')}</a>
              <a href="#calc" className={v.nav_calc} aria-current={v.cur_calc}>{t('nav.calculator')}</a>
              <a href="#specs" className={v.nav_specs} aria-current={v.cur_specs}>{t('nav.specs')}</a>
              <a href="#upclose" className={v.nav_upclose} aria-current={v.cur_upclose}>{t('nav.up_close')}</a>
              <a href="#features" className={v.nav_features} aria-current={v.cur_features}>{t('nav.features')}</a>
              <a href="#price" className={v.nav_price} aria-current={v.cur_price}>{t('nav.pricing')}</a>
            </nav>
            <div className="nav-r">
              <div className="lng" role="group" aria-label={t('nav.language')}>
                <span className={`lng-t ${v.lngCls}`} aria-hidden="true"></span>
                <button type="button" className={v.enCls} onClick={v.setEn} aria-pressed={v.langEnA} lang="en" data-nt="" aria-label="English">EN</button>
                <button type="button" className={v.idCls} onClick={v.setId} aria-pressed={v.langIdA} lang="id" data-nt="" aria-label="Bahasa Indonesia">ID</button>
              </div>
              <label className="switch" title={v.modeLabel}>
                <input type="checkbox" checked={v.dark} onChange={v.toggleDark} aria-label={t('nav.night_mode')} />
                <span className="slider" aria-hidden="true">
                  <span className="star star_1"></span>
                  <span className="star star_2"></span>
                  <span className="star star_3"></span>
                  <svg viewBox="0 0 16 16" className="cloud" aria-hidden="true">
                    <path transform="matrix(.77976 0 0 .78395-299.99-418.63)" fill="#fff" d="m391.84 540.91c-.421-.329-.949-.524-1.523-.524-1.351 0-2.451 1.084-2.485 2.435-1.395.526-2.388 1.88-2.388 3.466 0 1.874 1.385 3.423 3.182 3.667v.034h12.73v-.006c1.775-.104 3.182-1.584 3.182-3.395 0-1.747-1.309-3.186-2.994-3.379.007-.106.011-.214.011-.322 0-2.707-2.271-4.901-5.072-4.901-2.073 0-3.856 1.202-4.643 2.925"></path>
                  </svg>
                </span>
              </label>
              <a className="btn btn-act" href="/waitlist.html">{t('nav.join_the_waitlist')}</a>
            </div>
          </div>
        </header>
        {/* HERO: the sentence is the layout */}
        <section className="hero" id="top">
          <div className="stage" ref={v.r.stage}>
            <div className="cv">
              <canvas ref={v.r.hero} aria-label={t('hero.n3d_model_of_the_arolyzer')}></canvas>
              {v.loading && (
                <>
                  <div className="loading">
                    <div className="spin"></div>
                    {v.loadMsg}
                  </div>
                </>
              )}
              {v.noGL && (
                <>
                  <div className="loading">{t('hero.the_3d_model_couldn_t')}</div>
                </>
              )}
            </div>
          </div>
          <div className="copy in">
            {/* Hero copy: edit it in content/<lang>/landing.json under "hero". Words slide in one by one. */}
            <React.Fragment key={lang}>
              <h1 ref={v.r.heroH1} className="tr tr-h" lang={lang} aria-label={t('hero.title').join(' ')}>
                {t('hero.title').map((line, i) => (
                  <span className="l" aria-hidden="true" key={i}>{words(line, 0.1 + 0.16 * i, 0.04)}</span>
                ))}
              </h1>
              <div className="low" ref={v.r.heroLow}>
                <div className="acts tr tr-p">
                  <a className="btn btn-act" href="#price" aria-label={t('hero.cta')}>
                    <span aria-hidden="true">{words(t('hero.cta'), 0.75, 0.04)}</span> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg>
                  </a>
                </div>
                <p className="lede tr tr-p" lang={lang}>
                  <span className="tr-sr">{t('hero.lede')}</span>
                  <span aria-hidden="true">{words(t('hero.lede'), 0.45, 0.016)}</span>
                </p>
              </div>
            </React.Fragment>
          </div>
        </section>
        {/* WHY: statements on colour fields */}
        <section className={`fields ${v.fieldsCls}`} id="why" aria-label={t('why.why_arolyzer')}>
          <div className={`field f1 ${v.f1on}`} ref={v.r.f1} style={{ zIndex: "1" }}>
            <span className="fdim" aria-hidden="true"></span>
            <div className="in fgrid">
              <h2 aria-label={t('why.no_fuel_to_buy')}>
                <span className="ln"><span>{t('why.no_fuel')}</span></span>
                <span className="ln"><span>{t('why.to_buy')}</span></span>
              </h2>
              <p>
                <span className="fx fx-fire" aria-hidden="true">
                  <svg viewBox="0 0 48 48" width="48" height="48">
                    <circle cx="24" cy="24" r="21" className="ring"></circle>
                    <g className="fl">
                      <path className="fl-o" d="M24 10c2 5 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 4-11 2 2 3 4 3 6 1-3 2-7 2-12z"></path>
                      <path className="fl-i" d="M24 25c2 2 4 4 4 7a4 4 0 0 1-8 0c0-3 2-4 4-7z"></path>
                    </g>
                  </svg>
                </span>
                {t('why.light_it_once_with_a')}
              </p>
            </div>
          </div>
          <div className={`field f2 ${v.f2on}`} ref={v.r.f2} style={{ zIndex: "2" }}>
            <span className="fdim" aria-hidden="true"></span>
            <div className="in fgrid">
              <h2 aria-label={t('why.nothing_to_plug_in')}>
                <span className="ln"><span>{t('why.nothing')}</span></span>
                <span className="ln"><span>{t('why.to_plug_in')}</span></span>
              </h2>
              <p>
                <span className="fx fx-fan" aria-hidden="true">
                  <svg viewBox="0 0 48 48" width="48" height="48">
                    <circle cx="24" cy="24" r="21" className="ring"></circle>
                    <g className="bl">
                      <path d="M24 24c-2-7 0-14 6-15 4 4 1 11-6 15z"></path>
                      <path d="M24 24c7-2 14 0 15 6-4 4-11 1-15-6z"></path>
                      <path d="M24 24c2 7 0 14-6 15-4-4-1-11 6-15z"></path>
                      <path d="M24 24c-7 2-14 0-15-6 4-4 11-1 15 6z"></path>
                    </g>
                    <circle cx="24" cy="24" r="3" className="hub"></circle>
                  </svg>
                </span>
                {t('why.the_reactor_s_own_gas')}
              </p>
            </div>
          </div>
          <div className={`field f3 ${v.f3on}`} ref={v.r.f3} style={{ zIndex: "3" }}>
            <span className="fdim" aria-hidden="true"></span>
            <div className="in fgrid">
              <h2 aria-label={t('why.three_wastes_one_machine')}>
                <span className="ln"><span>{t('why.three_wastes')}</span></span>
                <span className="ln"><span>{t('why.one_machine')}</span></span>
              </h2>
              <p>
                <span className="fx fx-three" aria-hidden="true">
                  <svg viewBox="0 0 96 48" width="96" height="48">
                    <circle className="w w1" cx="12" cy="24" r="7"></circle>
                    <circle className="w w2" cx="34" cy="24" r="7"></circle>
                    <circle className="w w3" cx="56" cy="24" r="7"></circle>
                    <path className="arr" d="M68 24h12m-4-4 4 4-4 4"></path>
                    <rect className="box" x="82" y="14" width="12" height="20" rx="3"></rect>
                  </svg>
                </span>
                {t('why.palm_mills_have_fruit_bunches')}
              </p>
            </div>
          </div>
        </section>
        {/* TRACTION: who is already running, backing or covering it */}
        <section className="trac" aria-label={t('traction.traction')}>
          <div className="in trac-h"><h2 className="trac-l">{t('traction.supported_by')}</h2></div>
          <div className={`marq ${v.marqCls}`}>
            <div className="track">
              <ul className="set">
                {(v.logos || []).map((l, lIdx) => (
                  <React.Fragment key={lIdx}>
                    <li className="logo"><img src={l.src} alt={l.alt} loading="lazy" decoding="async" /></li>
                  </React.Fragment>
                ))}
              </ul>
              <ul className="set" aria-hidden="true">
                {(v.logos || []).map((l, lIdx) => (
                  <React.Fragment key={lIdx}>
                    <li className="logo"><img src={l.src} alt="" loading="lazy" decoding="async" /></li>
                  </React.Fragment>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section className="sec" id="how">
          <div className="in">
            <div className="ctr-h"><h2 className="wt">{t('how.eight_steps_from_waste_to')}</h2></div>
            <div className="how">
              <ol className="steps">
                {(v.steps || []).map((s, sIdx) => (
                  <React.Fragment key={sIdx}>
                    <li>
                      <button type="button" className={`sbtn ${s.cls}`} onClick={s.pick} aria-pressed={s.on}>
                        <span className="top">
                          <span className="k">{s.n}</span>
                          <span className="st">{s.title}</span>
                        </span>
                        <span className="sd">{s.body}</span>
                        <span className="chips">
                          {(s.parts || []).map((c, cIdx) => (
                            <React.Fragment key={cIdx}>
                              <span>{c}</span>
                            </React.Fragment>
                          ))}
                        </span>
                      </button>
                    </li>
                  </React.Fragment>
                ))}
              </ol>
              <div className="viewer">
                <div className="vdisc" aria-hidden="true"></div>
                <div className="cv">
                  <canvas ref={v.r.how} aria-label={t('how.n3d_model_highlighting_the_parts')}></canvas>
                  {v.loading && (
                    <>
                      <div className="loading">
                        <div className="spin"></div>
                        {v.loadMsg}
                      </div>
                    </>
                  )}
                  <div className="tip" ref={v.r.howTip}>{v.howHover}</div>
                </div>
                <div className="vbar">
                  <span className="lbl">{v.stepCount}</span>
                  <div className="arrows">
                    <button type="button" aria-label={t('how.previous_step')} onClick={v.prev}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
                    </button>
                    <button type="button" aria-label={t('how.next_step')} onClick={v.next}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* CALCULATOR */}
        <section className="sec band" id="calc">
          <div className="in">
            <div className="calc">
              <div>
                <h2>{t('calculator.what_will_your_waste_make')}</h2>
                <p className="lead">{t('calculator.type_in_how_much_dry')}</p>
                <div className="form">
                  <div className="fld">
                    <label htmlFor="calc-kg">{t('calculator.biomass_you_have')}</label>
                    <div className="numrow">
                      <input id="calc-kg" type="number" min="1" max="100000" step="10" value={v.kg} onChange={v.onKg} />
                      <span className="u">{t('calculator.kg_dry')}</span>
                    </div>
                    <div className="ruler" ref={v.r.ruler} role="slider" tabIndex="0" aria-label={t('calculator.biomass_in_kilograms')} aria-valuemin="10" aria-valuemax="5000" aria-valuenow={v.kgRange} aria-valuetext={`${v.kgRange} kilograms`}>
                      <div className="rl-tape" ref={v.r.tape}>
                        <span className="rl-n" style={{ left: "0px" }}>0</span>
                        <span className="rl-n" style={{ left: "400px" }}>500</span>
                        <span className="rl-n" style={{ left: "800px" }}>1,000</span>
                        <span className="rl-n" style={{ left: "1200px" }}>1,500</span>
                        <span className="rl-n" style={{ left: "1600px" }}>2,000</span>
                        <span className="rl-n" style={{ left: "2000px" }}>2,500</span>
                        <span className="rl-n" style={{ left: "2400px" }}>3,000</span>
                        <span className="rl-n" style={{ left: "2800px" }}>3,500</span>
                        <span className="rl-n" style={{ left: "3200px" }}>4,000</span>
                        <span className="rl-n" style={{ left: "3600px" }}>4,500</span>
                        <span className="rl-n" style={{ left: "4000px" }}>5,000</span>
                      </div>
                      <span className="rl-mark" aria-hidden="true"></span>
                    </div>
                  </div>
                  <p className="assume">
                    {rich(t('calculator.one_batch_fills_the_reactor'), { workL: v.workL, capacity: v.capacity, bulk: v.bulk, yieldPct: v.yieldPct, hours: v.hours })}
                  </p>
                </div>
              </div>
              <div className="res" aria-live="polite">
                <div className="big">
                  <span className={`v ${v.outCls}`}>
                    <span className="tr-sr">{v.outKg}</span>
                    <span className="odo" ref={v.r.odoKg} aria-hidden="true"></span>
                    <small>{v.outUnit}</small>
                  </span>
                  <span className="c">{v.formula}</span>
                </div>
                {v.notEmpty && (
                  <>
                    <div className="sackwrap">
                      <div className="sacks" aria-hidden="true">
                        {(v.sacks || []).map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            <span className="sack" style={{ "--f": k.f }}><i></i></span>
                          </React.Fragment>
                        ))}
                        {v.sackMore && (
                          <>
                            <span className="sack-more">{v.sackMoreTxt}</span>
                          </>
                        )}
                      </div>
                      <p className="sack-l">{t('calculator.one_sack_for_each_batch')}</p>
                    </div>
                  </>
                )}
                <div className="rgrid">
                  <div className="rcell">
                    <span className="v">
                      <span className="tr-sr">{v.batches}</span>
                      <span className="odo" ref={v.r.odoB} aria-hidden="true"></span>
                    </span>
                    <span className="c">{v.batchLabel}</span>
                  </div>
                  <div className="rcell">
                    <span className="v">
                      <span className="tr-sr">{v.totalHours}</span>
                      <span className="odo" ref={v.r.odoH} aria-hidden="true"></span>
                      <small className="u-t" aria-hidden="true">{t('calculator.h')}</small>
                    </span>
                    <span className="c">{v.daysLine}</span>
                  </div>
                </div>
                <p className="note">{t('calculator.these_are_estimates_what_you')}</p>
              </div>
            </div>
          </div>
        </section>
        {/* SPECS */}
        <section className="sec" id="specs">
          <div className="in">
            <div className="specs scard">
              <div>
                <h2>{t('specs.unit_specs')}</h2>
                <p className="lead">{t('specs.the_arolyzer_as_we_build')}</p>
                <figure className="render">
                  <img src="/assets/arolyzer-front-left.webp" alt={t('specs.the_arolyzer_seen_from_the')} width="890" height="1450" />
                </figure>
              </div>
              <div className="tbl">
                <table>
                  <tbody>
                    <tr className="first"><th scope="rowgroup" colSpan="2">{t('specs.size_and_output')}</th></tr>
                    <tr className="r">
                      <th scope="row">{t('specs.overall_size_h_w_d')}</th>
                      <td><span className="ph">{t('specs.cm')}</span></td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.weight')}</th>
                      <td>
                        {t('specs.n177_kg')}{" "}
                        <span className="sm">{t('specs.n176_98_kg_empty_without')}</span>
                      </td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.reactor_volume')}</th>
                      <td>
                        {t('specs.n254_12_l')}{" "}
                        <span className="sm">{t('specs.n254_116_056_mm')}</span>
                      </td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.working_volume')}</th>
                      <td>{t('specs.n203_29_l_filled_to')}</td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.load_per_batch')}</th>
                      <td>
                        {t('specs.about_capacity_kg_of_dry', { capacity: v.capacity })}{" "}
                        <span className="ph">{t('specs.at_bulk_kg_m', { bulk: v.bulk })}</span>
                      </td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.batch_time')}</th>
                      <td>
                        {t('specs.about')}{" "}
                        <span className="ph">{t('specs.hours_h', { hours: v.hours })}</span>
                        {t('specs.cooling_included')}
                      </td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.biochar_yield')}</th>
                      <td>
                        <span className="ph">{t('specs.about_yieldpct', { yieldPct: v.yieldPct })}</span>
                        {" "}{t('specs.of_dry_input_by_weight')}
                      </td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.feedstocks')}</th>
                      <td>{t('specs.empty_fruit_bunch_rice_husk')}</td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr><th scope="rowgroup" colSpan="2">{t('specs.build')}</th></tr>
                    <tr className="r">
                      <th scope="row">{t('specs.reactor_lid')}</th>
                      <td>{t('specs.sealed_lid_with_six_bolts')}</td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.monitoring')}</th>
                      <td>{t('specs.pressure_gauge_on_the_lid')}</td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.unloading')}</th>
                      <td>{t('specs.reactor_handle')}</td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.material')}</th>
                      <td>
                        {t('specs.steel_7_948_g_cm')}{" "}
                        <span className="ph">{t('specs.grade_finish')}</span>
                      </td>
                    </tr>
                    <tr className="r">
                      <th scope="row">{t('specs.steel_used')}</th>
                      <td>
                        {t('specs.n22_27_l')}{" "}
                        <span className="sm">{t('specs.n22_267_706_mm')}</span>
                      </td>
                    </tr>
                    <tr className="r"></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
        {/* UP CLOSE */}
        <section className="sec" id="upclose">
          <div className="in">
            <div className="ctr-h"><h2 className="wt">{t('upclose.up_close')}</h2></div>
            <div className="uc">
              <div className="uc-stage">
                <div className="cv">
                  <canvas ref={v.r.uc} aria-label={t('upclose.n3d_model_of_the_arolyzer')}></canvas>
                  {v.loading && (
                    <>
                      <div className="loading">
                        <div className="spin"></div>
                        {v.loadMsg}
                      </div>
                    </>
                  )}
                </div>
                <div className="uc-nav">
                  <div className="uc-arrows">
                    <button type="button" className={`uc-arr ${v.ucFirst}`} onClick={v.ucPrev} aria-disabled={v.ucFirstA} aria-label={t('upclose.previous_part')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"></path></svg>
                    </button>
                    <button type="button" className={`uc-arr ${v.ucLast}`} onClick={v.ucNext} aria-disabled={v.ucLastA} aria-label={t('upclose.next_part')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
                    </button>
                  </div>
                  <ul className="uc-list">
                    {(v.feats || []).map((f, fIdx) => (
                      <React.Fragment key={fIdx}>
                        <li className={`uc-item ${f.cls}`}>
                          <button type="button" className="uc-pill" onClick={f.pick} aria-expanded={f.exp}>
                            <span className="uc-plus" aria-hidden="true">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                                <path d="M12 5v14"></path>
                                <path d="M5 12h14"></path>
                              </svg>
                            </span>
                            <span className="uc-name">{f.name}</span>
                          </button>
                          <p className="uc-text">
                            <b>{f.name}.</b>
                            {" "}{f.body}
                          </p>
                        </li>
                      </React.Fragment>
                    ))}
                  </ul>
                </div>
                <p className="uc-detail" aria-live="polite">
                  <b>{v.ucName}.</b>
                  {" "}{v.ucBody}
                </p>
              </div>
            </div>
          </div>
        </section>
        {/* FEATURES: what the unit is built around */}
        <section className="feats" id="features" aria-labelledby="feats-h">
          <div className="in">
            <div className="ctr-h">
              <h2 id="feats-h" className="wt">{t('features.built_for_the_mill_yard')}</h2>
              <p>{t('features.what_makes_it_work_at')}</p>
            </div>
            <div className="bento" ref={v.r.bento}>
              <article className="bt bt-loop">
                <div className="bt-tx">
                  <span className="fig">{t('features.gas_loop')}</span>
                  <h3>{t('features.gas_drives_the_fan')}</h3>
                  <p>{t('features.gas_from_the_reactor_runs')}</p>
                </div>
                <div className="loop" aria-hidden="true">
                  <svg viewBox="0 0 400 270" className="loop-svg">
                    <rect className="lp-box" x="58" y="40" width="114" height="126" rx="16"></rect>
                    <rect className="lp-box" x="68" y="196" width="94" height="50" rx="12"></rect>
                    <path className="lp-fire" d="M115 236c-14 0-18-10-12-20 2 5 5 6 7 6-2-8 2-15 9-20 0 8 9 11 9 22 0 7-6 12-13 12z"></path>
                    <path className="lp-line" d="M115 40V18H318V176"></path>
                    <path className="lp-line" d="M288 218H164"></path>
                    <path className="lp-line" d="M115 194V168"></path>
                    <path className="lp-pulse p1" pathLength="100" d="M115 40V18H318V176"></path>
                    <path className="lp-pulse p2" pathLength="100" d="M288 218H164"></path>
                    <path className="lp-pulse heat p3" pathLength="100" d="M115 194V168"></path>
                    <circle className="lp-box" cx="318" cy="210" r="32"></circle>
                    <g className="lp-fan">
                      <path d="M318 210c-2-9 0-18 8-20 5 5 1 14-8 20z"></path>
                      <path d="M318 210c9-2 18 0 20 8-5 5-14 1-20-8z"></path>
                      <path d="M318 210c2 9 0 18-8 20-5-5-1-14 8-20z"></path>
                      <path d="M318 210c-9 2-18 0-20-8 5-5 14-1 20 8z"></path>
                    </g>
                    <g className="lp-chars">
                      <circle className="c1" cx="96" cy="120" r="5"></circle>
                      <circle className="c2" cx="116" cy="132" r="5"></circle>
                      <circle className="c3" cx="136" cy="116" r="5"></circle>
                      <circle className="c4" cx="104" cy="146" r="5"></circle>
                      <circle className="c5" cx="128" cy="148" r="5"></circle>
                      <circle className="c6" cx="148" cy="140" r="4"></circle>
                      <circle className="c7" cx="84" cy="138" r="4"></circle>
                    </g>
                  </svg>
                  <span className="lp-l l1">{t('features.reactor')}</span>
                  <span className="lp-l l2">{t('features.gas_pipe')}</span>
                  <span className="lp-l l3">{t('features.fan')}</span>
                  <span className="lp-l l4">{t('features.fire')}</span>
                </div>
              </article>
              <article className="bt bt-fast">
                <div className="bt-tx">
                  <span className="fig" data-odo-fig="">{t('features.n62_5')}</span>
                  <h3>{t('features.faster_batches')}</h3>
                  <p>{t('features.several_burners_heat_the_reactor')}</p>
                </div>
                <figure className="lc" ref={v.r.lc} role="img" aria-label={t('features.line_chart_batch_progress_over')}>
                  <div className="lc-h">
                    <span className="lc-t">{t('features.batch_progress')}</span>
                    <span className="lc-v">
                      <span>{t('features.done_in')}</span>
                      {" "}
                      <b>37.5%</b>
                      {" "}
                      <span>{t('features.of_the_time')}</span>
                    </span>
                  </div>
                  <div className="lc-plot">
                    <svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
                      <line className="lc-grid" x1="0" y1="8" x2="300" y2="8"></line>
                      <line className="lc-grid" x1="0" y1="60" x2="300" y2="60"></line>
                      <line className="lc-base" x1="0" y1="112" x2="300" y2="112"></line>
                      <path className="lc-kiln" d="M0.0 112.0 L3.0 112.0 L6.0 111.9 L9.0 111.7 L12.0 111.5 L15.0 111.2 L18.0 110.9 L21.0 110.5 L24.0 110.1 L27.0 109.6 L30.0 109.1 L33.0 108.5 L36.0 107.9 L39.0 107.2 L42.0 106.5 L45.0 105.7 L48.0 104.9 L51.0 104.0 L54.0 103.1 L57.0 102.2 L60.0 101.2 L63.0 100.2 L66.0 99.1 L69.0 98.0 L72.0 96.9 L75.0 95.8 L78.0 94.6 L81.0 93.3 L84.0 92.1 L87.0 90.8 L90.0 89.5 L93.0 88.2 L96.0 86.9 L99.0 85.5 L102.0 84.1 L105.0 82.7 L108.0 81.3 L111.0 79.8 L114.0 78.4 L117.0 76.9 L120.0 75.4 L123.0 73.9 L126.0 72.4 L129.0 70.8 L132.0 69.3 L135.0 67.8 L138.0 66.2 L141.0 64.7 L144.0 63.1 L147.0 61.6 L150.0 60.0 L153.0 58.4 L156.0 56.9 L159.0 55.3 L162.0 53.8 L165.0 52.2 L168.0 50.7 L171.0 49.2 L174.0 47.6 L177.0 46.1 L180.0 44.6 L183.0 43.1 L186.0 41.6 L189.0 40.2 L192.0 38.7 L195.0 37.3 L198.0 35.9 L201.0 34.5 L204.0 33.1 L207.0 31.8 L210.0 30.5 L213.0 29.2 L216.0 27.9 L219.0 26.7 L222.0 25.4 L225.0 24.2 L228.0 23.1 L231.0 22.0 L234.0 20.9 L237.0 19.8 L240.0 18.8 L243.0 17.8 L246.0 16.9 L249.0 16.0 L252.0 15.1 L255.0 14.3 L258.0 13.5 L261.0 12.8 L264.0 12.1 L267.0 11.5 L270.0 10.9 L273.0 10.4 L276.0 9.9 L279.0 9.5 L282.0 9.1 L285.0 8.8 L288.0 8.5 L291.0 8.3 L294.0 8.1 L297.0 8.0 L300.0 8.0"></path>
                      <path className="lc-area" d="M0.0 112.0 L3.0 111.8 L6.0 111.1 L9.0 110.1 L12.0 108.7 L15.0 106.9 L18.0 104.9 L21.0 102.5 L24.0 99.8 L27.0 96.9 L30.0 93.8 L33.0 90.4 L36.0 86.9 L39.0 83.2 L42.0 79.3 L45.0 75.4 L48.0 71.4 L51.0 67.3 L54.0 63.1 L57.0 59.0 L60.0 54.8 L63.0 50.7 L66.0 46.6 L69.0 42.6 L72.0 38.7 L75.0 35.0 L78.0 31.3 L81.0 27.9 L84.0 24.6 L87.0 21.6 L90.0 18.8 L93.0 16.3 L96.0 14.1 L99.0 12.1 L102.0 10.5 L105.0 9.3 L108.0 8.5 L111.0 8.1 L300.0 8.0 L300.0 112.0 L0 112.0 Z"></path>
                      <path className="lc-ours" pathLength="100" d="M0.0 112.0 L3.0 111.8 L6.0 111.1 L9.0 110.1 L12.0 108.7 L15.0 106.9 L18.0 104.9 L21.0 102.5 L24.0 99.8 L27.0 96.9 L30.0 93.8 L33.0 90.4 L36.0 86.9 L39.0 83.2 L42.0 79.3 L45.0 75.4 L48.0 71.4 L51.0 67.3 L54.0 63.1 L57.0 59.0 L60.0 54.8 L63.0 50.7 L66.0 46.6 L69.0 42.6 L72.0 38.7 L75.0 35.0 L78.0 31.3 L81.0 27.9 L84.0 24.6 L87.0 21.6 L90.0 18.8 L93.0 16.3 L96.0 14.1 L99.0 12.1 L102.0 10.5 L105.0 9.3 L108.0 8.5 L111.0 8.1 L300.0 8.0"></path>
                      <line className="lc-x" x1="0" y1="8" x2="0" y2="112"></line>
                    </svg>
                    <span className="lc-dot d-ours" style={{ left: "37.5%" }}></span>
                    <span className="lc-dot d-kiln" style={{ left: "100%" }}></span>
                    <span className="lc-tip" aria-hidden="true"></span>
                  </div>
                  <div className="lc-leg">
                    <span className="k-ours">{t('features.arolyzer')}</span>
                    <span className="k-kiln">{t('features.single_burner_kiln')}</span>
                  </div>
                </figure>
              </article>
              <article className="bt bt-fert">
                <div className="bt-row">
                  <div>
                    <span className="fig" data-odo-fig="">{t('features.n60')}</span>
                    <h3>{t('features.lower_fertiliser_bill')}</h3>
                  </div>
                  <figure className="ringm" role="img" aria-label={t('features.ring_meter_fertiliser_cost_cut')}>
                    <svg viewBox="0 0 120 120" aria-hidden="true">
                      <circle className="rm-track" cx="60" cy="60" r="48" pathLength="100"></circle>
                      <circle className="rm-val" cx="60" cy="60" r="48" pathLength="100" style={{ "--v": "60" }}></circle>
                    </svg>
                    <span className="rm-c" aria-hidden="true">{t('features.saved')}</span>
                  </figure>
                </div>
                <p>{t('features.biochar_in_the_soil_can')}</p>
              </article>
              <article className="bt bt-crop">
                <span className="fig" data-odo-fig="">{t('features.n8_30')}</span>
                <h3>{t('features.bigger_harvests')}</h3>
                <div className="bars" aria-hidden="true">
                  <div className="bar-r">
                    <span className="bar-l">{t('features.without_biochar')}</span>
                    <span className="bar-t"><i style={{ "--w": "77%" }}></i></span>
                  </div>
                  <div className="bar-r on-us">
                    <span className="bar-l">{t('features.with_biochar')}</span>
                    <span className="bar-t">
                      <i style={{ "--w": "100%" }}></i>
                      <b style={{ "--from": "83%" }}></b>
                    </span>
                  </div>
                </div>
                <p>{t('features.fields_treated_with_biochar_can')}</p>
              </article>
              <article className="bt bt-s">
                <figure className="mini tank" role="img" aria-label={t('features.tank_meter_203_litres_working')}>
                  <span className="tk">
                    <i style={{ "--v": "80%" }}></i>
                    <b style={{ "--v": "80%" }}></b>
                  </span>
                  <span className="mini-l">{t('features.n80_full')}</span>
                </figure>
                <span className="fig" data-odo-fig="">{t('features.n254_l')}</span>
                <h3>{t('features.reactor_tube')}</h3>
                <p>{t('features.room_for_about_capacity_kg', { capacity: v.capacity })}</p>
              </article>
              <article className="bt bt-s">
                <figure className="mini burn" role="img" aria-label={t('features.cross_section_flames_rise_through')}>
                  <svg viewBox="0 0 64 64" aria-hidden="true">
                    <rect className="bn-box" x="6" y="4" width="52" height="56" rx="10"></rect>
                    <rect className="bn-f f-s" x="12" y="22" width="7" height="34" rx="3.5"></rect>
                    <rect className="bn-f f-m" x="28.5" y="10" width="7" height="46" rx="3.5"></rect>
                    <rect className="bn-f f-s2" x="45" y="22" width="7" height="34" rx="3.5"></rect>
                  </svg>
                </figure>
                <span className="fig">{t('features.multi_burner')}</span>
                <h3>{t('features.heat_from_every_side')}</h3>
                <p>{t('features.the_rocket_stove_sends_flames')}</p>
              </article>
              <article className="bt bt-s">
                <span className="fig" data-odo-fig="">{t('features.n0_w')}</span>
                <h3>{t('features.no_mains_power')}</h3>
                <p>{t('features.the_fan_runs_on_the')}</p>
              </article>
              <article className="bt bt-s">
                <span className="fig">
                  <span data-odo-fig="">{t('features.n177')}</span>
                  <span className="u-t">{t('features.kg')}</span>
                </span>
                <h3>{t('features.empty_weight')}</h3>
                <p>{t('features.set_it_up_right_where')}</p>
              </article>
            </div>
          </div>
        </section>
        {/* PRICE: one card over a moving row of units */}
        <section className="price" id="price" aria-labelledby="price-h">
          <div className={`pv ${v.vidCls}`} ref={v.r.pv} aria-hidden="true">
            <svg className="grn" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
              <rect width="1440" height="900" fill="#0E3A2C"></rect>
              <g className="sw" style={{ transformOrigin: "-80.0px 520.0px", "--a": "1.6deg", animationDuration: "10.1s", animationDelay: "-4.3s" }}>
                <path fill="#0C4433" d="M-36.6 500.4Q-2.6 421.5 12.6 393.8Q-16.5 416.6 -36.6 500.4ZM-10.3 487.9Q27.2 391.0 42.4 356.9Q10.2 385.7 -10.3 487.9ZM15.7 475.0Q54.5 360.4 67.9 319.9Q34.4 355.1 15.7 475.0ZM41.5 461.8Q89.3 323.5 106.4 274.7Q65.1 317.1 41.5 461.8ZM67.1 448.3Q119.3 299.1 138.3 246.4Q93.2 291.9 67.1 448.3ZM92.4 434.4Q161.4 289.8 194.7 239.2Q135.9 279.5 92.4 434.4ZM117.5 420.2Q195.6 257.9 233.4 201.3Q166.9 246.3 117.5 420.2ZM142.3 405.6Q200.4 250.0 223.1 195.1Q173.1 241.9 142.3 405.6ZM166.9 390.7Q227.7 228.8 251.6 171.7Q199.3 220.3 166.9 390.7ZM191.3 375.4Q268.3 190.7 301.7 125.7Q235.7 179.6 191.3 375.4ZM215.4 359.8Q288.9 181.0 320.4 118.0Q257.4 170.5 215.4 359.8ZM239.2 343.8Q296.6 183.9 318.0 127.4Q268.5 176.0 239.2 343.8ZM262.9 327.5Q329.5 149.5 355.5 86.6Q298.2 140.2 262.9 327.5ZM286.2 310.9Q349.5 140.4 374.1 80.2Q319.6 131.6 286.2 310.9ZM309.4 293.9Q371.8 121.7 395.3 60.9Q341.6 113.1 309.4 293.9ZM332.3 276.5Q402.2 124.2 435.0 70.9Q375.3 113.9 332.3 276.5ZM354.9 258.9Q425.2 111.0 459.0 59.3Q399.1 100.6 354.9 258.9ZM377.3 240.8Q431.7 117.1 456.3 73.6Q409.9 109.2 377.3 240.8ZM399.5 222.4Q439.0 102.8 452.2 60.5Q418.0 97.5 399.5 222.4ZM421.4 203.7Q469.6 86.1 490.2 44.6Q448.9 79.2 421.4 203.7ZM443.1 184.6Q489.2 76.9 509.7 39.0Q470.3 70.2 443.1 184.6ZM464.6 165.2Q499.2 76.6 513.3 45.4Q483.6 71.8 464.6 165.2ZM485.8 145.4Q515.3 70.4 527.4 44.0Q502.1 66.3 485.8 145.4ZM506.7 125.3Q528.6 74.3 538.3 56.3Q519.6 71.1 506.7 125.3ZM527.4 104.9Q536.6 84.4 540.8 77.2Q533.0 83.1 527.4 104.9ZM547.9 84.1Q547.9 84.1 547.9 84.1Q547.9 84.1 547.9 84.1Z"></path>
                <path fill="#11563F" d="M-36.6 500.4Q37.7 528.7 102.9 580.5Q42.5 514.7 -36.6 500.4ZM-10.3 487.9Q78.5 524.4 156.8 589.0Q84.7 507.7 -10.3 487.9ZM15.7 475.0Q120.7 514.1 212.5 586.3Q127.2 494.5 15.7 475.0ZM41.5 461.8Q172.9 497.5 285.6 574.8Q178.6 473.1 41.5 461.8ZM67.1 448.3Q205.0 497.7 325.3 590.5Q213.2 471.9 67.1 448.3ZM92.4 434.4Q235.6 476.6 359.1 564.0Q242.5 449.9 92.4 434.4ZM117.5 420.2Q281.6 457.7 421.3 547.4Q287.5 427.3 117.5 420.2ZM142.3 405.6Q291.7 445.5 419.8 532.6Q298.2 417.7 142.3 405.6ZM166.9 390.7Q327.9 411.2 462.2 484.3Q330.7 381.7 166.9 390.7ZM191.3 375.4Q378.4 395.5 533.8 476.9Q381.0 361.2 191.3 375.4ZM215.4 359.8Q396.2 378.8 546.3 457.2Q398.6 345.7 215.4 359.8ZM239.2 343.8Q399.5 349.0 530.6 408.2Q399.5 319.8 239.2 343.8ZM262.9 327.5Q441.8 337.3 588.8 406.9Q442.5 304.7 262.9 327.5ZM286.2 310.9Q457.8 315.9 598.2 379.0Q457.8 284.7 286.2 310.9ZM309.4 293.9Q482.1 299.9 623.5 364.2Q482.2 268.5 309.4 293.9ZM332.3 276.5Q491.2 273.6 619.9 325.7Q489.8 244.8 332.3 276.5ZM354.9 258.9Q510.3 246.4 634.6 289.5Q507.2 218.4 354.9 258.9ZM377.3 240.8Q505.5 229.2 607.7 263.7Q502.6 206.1 377.3 240.8ZM399.5 222.4Q518.6 209.3 613.3 239.6Q515.6 188.0 399.5 222.4ZM421.4 203.7Q541.8 191.6 637.7 223.2Q539.0 170.0 421.4 203.7ZM443.1 184.6Q553.3 163.4 639.4 184.5Q548.9 143.7 443.1 184.6ZM464.6 165.2Q554.0 148.7 624.0 166.4Q550.5 132.8 464.6 165.2ZM485.8 145.4Q561.7 133.2 621.5 149.5Q559.1 119.6 485.8 145.4ZM506.7 125.3Q557.7 109.0 596.5 114.2Q554.5 100.0 506.7 125.3ZM527.4 104.9Q548.5 100.4 564.8 104.1Q547.6 96.7 527.4 104.9ZM547.9 84.1Q547.9 84.1 547.9 84.1Q547.9 84.1 547.9 84.1Z"></path>
                <path fill="none" stroke="#0A3A2C" strokeWidth="4.6" strokeLinecap="round" d="M-80.0 520.0Q284.2 360.2 558.9 72.6"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "260.0px 980.0px", "--a": "1.6deg", animationDuration: "11.6s", animationDelay: "-0.2s" }}>
                <path fill="#0C4433" d="M277.5 933.4Q242.5 853.4 202.1 836.8Q229.5 861.0 277.5 933.4ZM287.7 904.7Q240.3 787.8 184.3 762.2Q221.3 798.2 287.7 904.7ZM297.6 876.0Q243.9 750.5 181.4 724.0Q223.5 762.1 297.6 876.0ZM307.2 847.2Q262.1 699.5 203.1 662.2Q237.8 709.9 307.2 847.2ZM316.4 818.3Q250.8 651.0 172.3 613.6Q223.5 665.4 316.4 818.3ZM325.3 789.3Q274.7 620.7 208.0 577.8Q246.9 632.4 325.3 789.3ZM333.8 760.3Q257.6 570.9 167.2 529.2Q226.8 587.6 333.8 760.3ZM342.0 731.2Q281.3 559.6 206.2 518.9Q253.3 573.2 342.0 731.2ZM349.8 702.0Q271.9 518.4 181.2 479.3Q242.1 535.2 349.8 702.0ZM357.3 672.7Q295.2 488.2 216.9 443.4Q264.9 502.2 357.3 672.7ZM364.4 643.4Q294.6 438.8 206.9 389.4Q261.0 454.5 364.4 643.4ZM371.2 614.0Q295.3 428.2 205.8 387.7Q265.1 444.7 371.2 614.0ZM377.6 584.5Q320.5 383.6 243.7 331.6Q287.4 397.0 377.6 584.5ZM383.7 554.9Q317.6 366.8 235.6 322.0Q286.8 381.6 383.7 554.9ZM389.4 525.3Q327.6 370.4 254.0 336.1Q302.3 383.9 389.4 525.3ZM394.8 495.6Q338.3 347.5 270.2 313.8Q314.2 360.0 394.8 495.6ZM399.9 465.8Q340.2 318.1 269.6 285.6Q316.2 331.1 399.9 465.8ZM404.5 436.0Q357.6 300.5 299.1 268.0Q335.4 311.0 404.5 436.0ZM408.9 406.0Q371.1 282.9 321.7 251.8Q350.8 291.6 408.9 406.0ZM412.9 376.0Q373.9 262.5 325.1 235.2Q355.3 271.3 412.9 376.0ZM416.5 346.0Q387.6 238.2 347.7 209.8Q369.8 245.1 416.5 346.0ZM419.9 315.8Q387.1 212.8 344.9 187.3Q370.1 220.3 419.9 315.8ZM422.8 285.6Q399.7 216.8 370.5 200.1Q388.4 222.0 422.8 285.6ZM425.4 255.3Q407.2 204.6 384.7 192.7Q398.9 208.7 425.4 255.3ZM427.7 224.9Q421.7 205.1 413.8 200.1Q418.4 206.5 427.7 224.9ZM429.6 194.5Q429.6 194.5 429.6 194.5Q429.6 194.5 429.6 194.5Z"></path>
                <path fill="#11563F" d="M277.5 933.4Q354.7 898.6 411.8 899.8Q348.0 885.1 277.5 933.4ZM287.7 904.7Q398.1 851.8 479.3 851.6Q388.1 832.6 287.7 904.7ZM297.6 876.0Q420.7 828.1 512.9 834.9Q411.4 806.5 297.6 876.0ZM307.2 847.2Q442.5 783.4 542.2 783.9Q430.4 759.9 307.2 847.2ZM316.4 818.3Q475.2 746.8 592.8 749.6Q461.6 719.2 316.4 818.3ZM325.3 789.3Q474.2 704.7 581.6 696.7Q458.3 679.1 325.3 789.3ZM333.8 760.3Q501.7 652.7 620.8 636.7Q481.6 624.0 333.8 760.3ZM342.0 731.2Q490.3 633.2 595.0 617.4Q472.0 607.9 342.0 731.2ZM349.8 702.0Q510.4 591.0 623.1 571.1Q489.8 563.6 349.8 702.0ZM357.3 672.7Q512.7 562.8 621.4 542.3Q492.3 536.4 357.3 672.7ZM364.4 643.4Q539.1 524.6 662.0 504.1Q517.0 494.8 364.4 643.4ZM371.2 614.0Q530.7 499.1 641.9 476.9Q509.4 472.0 371.2 614.0ZM377.6 584.5Q542.0 463.3 656.2 439.0Q519.6 435.5 377.6 584.5ZM383.7 554.9Q532.0 426.8 632.1 395.2Q508.5 402.0 383.7 554.9ZM389.4 525.3Q514.4 419.0 598.9 393.2Q494.9 398.1 389.4 525.3ZM394.8 495.6Q505.2 384.9 577.3 353.9Q485.1 366.7 394.8 495.6ZM399.9 465.8Q505.9 349.3 573.4 314.8Q484.8 332.0 399.9 465.8ZM404.5 436.0Q498.0 329.4 557.0 297.2Q478.8 314.2 404.5 436.0ZM408.9 406.0Q499.8 317.6 559.5 293.3Q483.7 302.5 408.9 406.0ZM412.9 376.0Q488.6 284.5 535.5 256.0Q472.1 272.2 412.9 376.0ZM416.5 346.0Q483.3 258.0 523.6 229.7Q467.5 247.3 416.5 346.0ZM419.9 315.8Q486.3 232.0 526.9 205.5Q471.2 221.3 419.9 315.8ZM422.8 285.6Q463.3 226.0 486.8 206.2Q452.7 219.6 422.8 285.6ZM425.4 255.3Q458.5 213.5 478.8 200.2Q451.0 208.1 425.4 255.3ZM427.7 224.9Q440.3 208.7 447.9 203.6Q437.4 206.7 427.7 224.9ZM429.6 194.5Q429.6 194.5 429.6 194.5Q429.6 194.5 429.6 194.5Z"></path>
                <path fill="none" stroke="#0A3A2C" strokeWidth="4.8" strokeLinecap="round" d="M260.0 980.0Q409.4 592.6 430.5 177.9"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "1520.0px 480.0px", "--a": "1.6deg", animationDuration: "10.7s", animationDelay: "-3.3s" }}>
                <path fill="#0C4433" d="M1476.2 464.6Q1395.1 494.4 1335.6 576.4Q1402.7 508.5 1476.2 464.6ZM1449.6 454.7Q1352.3 479.6 1279.1 567.3Q1359.4 496.7 1449.6 454.7ZM1423.3 444.5Q1306.9 478.5 1220.2 587.4Q1316.3 498.8 1423.3 444.5ZM1397.1 433.9Q1271.2 454.5 1174.7 557.0Q1278.3 476.7 1397.1 433.9ZM1371.1 422.9Q1216.0 447.4 1097.0 573.0Q1224.7 474.9 1371.1 422.9ZM1345.4 411.6Q1184.9 439.2 1062.2 571.1Q1194.3 467.5 1345.4 411.6ZM1319.8 399.9Q1166.4 432.7 1050.1 564.7Q1176.6 459.6 1319.8 399.9ZM1294.5 387.8Q1134.9 401.9 1010.6 521.0Q1141.8 430.3 1294.5 387.8ZM1269.4 375.4Q1081.9 380.1 933.9 509.8Q1087.8 413.6 1269.4 375.4ZM1244.4 362.7Q1055.2 377.1 907.5 516.4Q1063.0 410.8 1244.4 362.7ZM1219.7 349.6Q1057.3 361.1 930.4 479.8Q1063.8 390.0 1219.7 349.6ZM1195.2 336.1Q1033.4 327.0 903.6 428.0Q1036.2 356.1 1195.2 336.1ZM1170.9 322.3Q989.9 313.1 844.8 427.0Q993.1 345.7 1170.9 322.3ZM1146.7 308.1Q971.7 294.0 830.5 399.9Q973.9 325.6 1146.7 308.1ZM1122.8 293.6Q950.4 272.5 810.2 371.3Q951.3 303.8 1122.8 293.6ZM1099.1 278.7Q947.9 255.0 824.0 337.6Q947.7 282.5 1099.1 278.7ZM1075.7 263.5Q937.5 234.1 823.2 303.9Q936.0 259.3 1075.7 263.5ZM1052.4 247.8Q921.8 216.7 813.2 280.1Q919.8 240.6 1052.4 247.8ZM1029.3 231.9Q899.0 212.2 792.4 284.0Q899.0 235.9 1029.3 231.9ZM1006.4 215.6Q903.4 186.9 817.0 234.1Q901.1 205.8 1006.4 215.6ZM983.7 198.9Q893.7 168.7 817.4 206.4Q890.8 185.3 983.7 198.9ZM961.3 181.9Q874.9 155.8 802.0 194.1Q872.5 171.7 961.3 181.9ZM939.0 164.5Q878.0 140.2 825.6 163.3Q875.3 151.6 939.0 164.5ZM917.0 146.7Q868.8 126.3 827.3 143.7Q866.5 135.3 917.0 146.7ZM895.1 128.6Q876.5 120.5 860.5 127.0Q875.6 123.9 895.1 128.6ZM873.5 110.2Q873.5 110.2 873.5 110.2Q873.5 110.2 873.5 110.2Z"></path>
                <path fill="#11563F" d="M1476.2 464.6Q1451.1 374.6 1416.9 351.1Q1436.2 380.5 1476.2 464.6ZM1449.6 454.7Q1413.4 353.1 1368.7 329.0Q1396.8 361.2 1449.6 454.7ZM1423.3 444.5Q1389.5 318.3 1343.0 284.9Q1368.7 326.3 1423.3 444.5ZM1397.1 433.9Q1362.4 301.8 1314.2 266.7Q1340.6 310.1 1397.1 433.9ZM1371.1 422.9Q1328.4 260.4 1269.1 217.3Q1301.6 270.7 1371.1 422.9ZM1345.4 411.6Q1288.5 247.1 1217.4 207.7Q1261.5 259.9 1345.4 411.6ZM1319.8 399.9Q1260.8 242.6 1189.2 206.4Q1235.2 255.6 1319.8 399.9ZM1294.5 387.8Q1239.6 226.5 1170.6 187.6Q1213.1 238.9 1294.5 387.8ZM1269.4 375.4Q1210.1 185.6 1133.2 138.1Q1178.9 199.2 1269.4 375.4ZM1244.4 362.7Q1197.4 166.2 1129.2 112.7Q1164.8 177.7 1244.4 362.7ZM1219.7 349.6Q1163.5 186.0 1093.2 146.7Q1136.7 198.6 1219.7 349.6ZM1195.2 336.1Q1148.3 171.6 1085.3 129.1Q1121.1 182.6 1195.2 336.1ZM1170.9 322.3Q1115.0 139.3 1042.0 93.1Q1084.9 152.2 1170.9 322.3ZM1146.7 308.1Q1083.7 134.3 1006.4 93.7Q1055.3 148.4 1146.7 308.1ZM1122.8 293.6Q1076.7 116.8 1012.4 69.7Q1047.5 127.8 1122.8 293.6ZM1099.1 278.7Q1046.5 127.1 980.8 90.8Q1021.6 138.9 1099.1 278.7ZM1075.7 263.5Q1038.9 120.3 987.2 82.1Q1015.2 129.2 1075.7 263.5ZM1052.4 247.8Q1010.5 114.1 956.2 80.7Q988.5 123.8 1052.4 247.8ZM1029.3 231.9Q984.0 101.3 927.5 70.1Q962.6 111.5 1029.3 231.9ZM1006.4 215.6Q980.3 107.1 942.6 77.7Q962.3 113.5 1006.4 215.6ZM983.7 198.9Q959.7 103.2 925.5 77.4Q943.8 109.0 983.7 198.9ZM961.3 181.9Q932.7 92.4 896.0 70.2Q918.0 98.9 961.3 181.9ZM939.0 164.5Q915.5 100.7 886.8 85.9Q905.1 105.9 939.0 164.5ZM917.0 146.7Q901.8 94.8 881.5 81.5Q893.2 98.4 917.0 146.7ZM895.1 128.6Q890.2 108.2 883.0 102.7Q886.8 109.4 895.1 128.6ZM873.5 110.2Q873.5 110.2 873.5 110.2Q873.5 110.2 873.5 110.2Z"></path>
                <path fill="none" stroke="#0A3A2C" strokeWidth="4.5" strokeLinecap="round" d="M1520.0 480.0Q1152.9 355.8 861.8 100.0"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "1180.0px 980.0px", "--a": "1.6deg", animationDuration: "12.2s", animationDelay: "-7.8s" }}>
                <path fill="#0C4433" d="M1161.8 933.8Q1085.0 893.7 1017.5 916.8Q1079.9 908.1 1161.8 933.8ZM1151.1 905.4Q1043.2 839.4 946.9 866.2Q1034.3 859.8 1151.1 905.4ZM1140.6 876.9Q1023.6 802.3 918.7 829.7Q1013.5 824.5 1140.6 876.9ZM1130.5 848.3Q994.5 754.1 871.4 781.7Q981.4 780.0 1130.5 848.3ZM1120.6 819.7Q985.3 723.6 862.4 749.9Q971.9 749.4 1120.6 819.7ZM1111.0 791.0Q984.2 686.4 866.7 703.5Q969.1 710.9 1111.0 791.0ZM1101.8 762.2Q971.1 651.5 849.6 667.5Q955.1 676.7 1101.8 762.2ZM1092.9 733.3Q946.4 610.3 810.4 628.8Q928.6 638.6 1092.9 733.3ZM1084.2 704.4Q931.3 584.1 790.6 607.6Q914.2 613.4 1084.2 704.4ZM1075.9 675.4Q927.0 546.5 788.1 563.5Q908.2 575.3 1075.9 675.4ZM1067.8 646.3Q920.7 502.3 780.9 510.8Q899.3 530.9 1067.8 646.3ZM1060.1 617.1Q915.7 473.5 778.0 480.9Q894.2 501.7 1060.1 617.1ZM1052.6 587.8Q919.1 446.1 790.4 448.7Q897.7 472.3 1052.6 587.8ZM1045.5 558.5Q916.8 414.6 791.7 413.7Q895.0 440.0 1045.5 558.5ZM1038.7 529.1Q925.5 390.4 813.6 384.1Q904.2 412.9 1038.7 529.1ZM1032.1 499.7Q910.1 360.4 791.0 358.2Q888.9 384.5 1032.1 499.7ZM1025.9 470.1Q929.9 335.2 832.2 322.6Q908.9 354.6 1025.9 470.1ZM1020.0 440.5Q934.4 327.6 848.5 319.3Q916.9 344.7 1020.0 440.5ZM1014.4 410.8Q933.9 310.1 854.0 304.8Q918.4 326.2 1014.4 410.8ZM1009.0 381.0Q940.4 266.9 867.9 250.6Q922.4 281.0 1009.0 381.0ZM1004.0 351.2Q948.7 260.8 890.4 248.4Q934.4 272.2 1004.0 351.2ZM999.3 321.3Q957.0 241.1 910.7 227.2Q944.1 249.9 999.3 321.3ZM994.9 291.3Q956.7 227.4 916.4 218.1Q946.6 235.2 994.9 291.3ZM990.7 261.2Q965.9 210.7 938.2 201.2Q957.8 215.9 990.7 261.2ZM986.9 231.0Q977.2 212.1 966.4 208.8Q974.1 214.2 986.9 231.0ZM983.4 200.8Q983.4 200.8 983.4 200.8Q983.4 200.8 983.4 200.8Z"></path>
                <path fill="#11563F" d="M1161.8 933.8Q1204.3 855.8 1226.5 828.9Q1190.4 849.3 1161.8 933.8ZM1151.1 905.4Q1211.5 791.1 1242.4 751.6Q1191.2 782.0 1151.1 905.4ZM1140.6 876.9Q1215.2 756.8 1256.7 716.2Q1193.7 745.2 1140.6 876.9ZM1130.5 848.3Q1211.0 700.3 1253.0 649.2Q1184.7 688.0 1130.5 848.3ZM1120.6 819.7Q1191.3 665.9 1224.4 612.0Q1164.1 655.5 1120.6 819.7ZM1111.0 791.0Q1179.9 638.7 1211.9 585.4Q1153.1 628.6 1111.0 791.0ZM1101.8 762.2Q1182.6 608.4 1223.8 555.1Q1155.3 596.2 1101.8 762.2ZM1092.9 733.3Q1179.1 559.4 1221.7 498.8Q1148.3 546.5 1092.9 733.3ZM1084.2 704.4Q1181.9 532.7 1234.0 473.9Q1151.4 517.8 1084.2 704.4ZM1075.9 675.4Q1161.5 494.8 1202.5 431.7Q1129.6 482.1 1075.9 675.4ZM1067.8 646.3Q1162.7 461.0 1210.6 396.6Q1129.9 446.7 1067.8 646.3ZM1060.1 617.1Q1162.9 439.0 1218.2 378.1Q1131.2 423.2 1060.1 617.1ZM1052.6 587.8Q1141.0 412.1 1185.0 351.0Q1109.9 398.9 1052.6 587.8ZM1045.5 558.5Q1131.2 383.5 1173.1 322.5Q1100.2 370.7 1045.5 558.5ZM1038.7 529.1Q1127.6 372.5 1175.0 318.9Q1099.7 358.9 1038.7 529.1ZM1032.1 499.7Q1123.7 337.2 1172.3 281.4Q1094.8 323.1 1032.1 499.7ZM1025.9 470.1Q1106.9 325.1 1149.8 275.2Q1081.1 312.7 1025.9 470.1ZM1020.0 440.5Q1075.2 308.8 1099.2 262.5Q1052.0 300.9 1020.0 440.5ZM1014.4 410.8Q1066.0 291.6 1089.2 249.7Q1045.0 284.1 1014.4 410.8ZM1009.0 381.0Q1070.3 262.6 1101.3 221.5Q1049.3 253.3 1009.0 381.0ZM1004.0 351.2Q1051.6 256.2 1075.2 223.2Q1034.8 249.1 1004.0 351.2ZM999.3 321.3Q1041.4 241.0 1062.9 213.1Q1027.1 234.6 999.3 321.3ZM994.9 291.3Q1029.8 225.5 1047.8 202.7Q1018.1 220.2 994.9 291.3ZM990.7 261.2Q1017.2 211.6 1030.8 194.4Q1008.4 207.5 990.7 261.2ZM986.9 231.0Q995.5 211.5 999.3 204.6Q992.0 210.3 986.9 231.0ZM983.4 200.8Q983.4 200.8 983.4 200.8Q983.4 200.8 983.4 200.8Z"></path>
                <path fill="none" stroke="#0A3A2C" strokeWidth="4.8" strokeLinecap="round" d="M1180.0 980.0Q1025.1 596.1 981.6 184.4"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "720.0px 1000.0px", "--a": "1.6deg", animationDuration: "10.2s", animationDelay: "-7.0s" }}>
                <path fill="#0C4433" d="M722.5 957.9Q670.9 896.6 620.1 894.7Q661.5 906.9 722.5 957.9ZM723.8 932.1Q666.3 852.8 608.0 845.9Q653.9 864.4 723.8 932.1ZM724.8 906.3Q665.2 816.1 603.6 805.6Q651.1 828.3 724.8 906.3ZM725.7 880.4Q638.5 765.1 550.9 756.6Q620.6 782.6 725.7 880.4ZM726.4 854.6Q649.1 750.8 571.1 742.7Q633.0 766.4 726.4 854.6ZM726.9 828.9Q653.7 709.0 576.5 692.4Q634.7 724.0 726.9 828.9ZM727.3 803.1Q626.2 668.3 524.5 658.0Q605.3 688.6 727.3 803.1ZM727.4 777.3Q632.7 627.4 533.6 608.0Q609.0 646.8 727.4 777.3ZM727.3 751.5Q646.5 622.2 561.7 605.1Q626.0 638.7 727.3 751.5ZM727.1 725.7Q644.9 582.0 556.9 559.6Q622.0 599.0 727.1 725.7ZM726.7 700.0Q625.7 560.5 523.4 548.2Q604.0 580.8 726.7 700.0ZM726.0 674.2Q637.8 518.7 543.0 494.3Q613.0 537.0 726.0 674.2ZM725.2 648.5Q640.3 510.3 551.0 491.4Q618.5 527.7 725.2 648.5ZM724.2 622.7Q626.3 479.9 525.8 464.7Q603.9 499.7 724.2 622.7ZM723.0 597.0Q636.0 468.9 546.5 455.1Q615.9 486.6 723.0 597.0ZM721.7 571.3Q646.6 456.3 568.7 442.4Q628.5 471.6 721.7 571.3ZM720.1 545.6Q655.7 427.1 585.9 407.4Q636.8 440.6 720.1 545.6ZM718.3 519.8Q650.8 414.2 580.4 400.9Q634.2 428.0 718.3 519.8ZM716.4 494.1Q654.8 394.3 590.2 380.8Q639.1 407.0 716.4 494.1ZM714.2 468.4Q666.2 381.8 614.3 367.7Q652.4 391.8 714.2 468.4ZM711.9 442.7Q672.2 360.4 627.7 344.6Q659.0 368.8 711.9 442.7ZM709.4 417.1Q672.0 350.1 631.7 339.3Q661.3 357.8 709.4 417.1ZM706.7 391.4Q673.9 332.5 638.6 323.0Q664.6 339.3 706.7 391.4ZM703.8 365.7Q684.0 321.7 661.3 312.7Q676.8 325.9 703.8 365.7ZM700.7 340.0Q692.4 323.0 683.2 319.8Q689.7 324.8 700.7 340.0ZM697.4 314.4Q697.4 314.4 697.4 314.4Q697.4 314.4 697.4 314.4Z"></path>
                <path fill="#11563F" d="M722.5 957.9Q784.8 908.7 827.6 897.8Q775.8 898.2 722.5 957.9ZM723.8 932.1Q800.0 872.4 852.4 859.3Q789.0 859.6 723.8 932.1ZM724.8 906.3Q810.5 843.0 870.0 830.3Q798.8 828.5 724.8 906.3ZM725.7 880.4Q828.5 779.9 895.9 752.1Q810.1 762.8 725.7 880.4ZM726.4 854.6Q824.1 771.5 890.2 751.3Q808.9 755.1 726.4 854.6ZM726.9 828.9Q826.6 731.6 891.9 704.8Q808.8 715.1 726.9 828.9ZM727.3 803.1Q842.2 680.9 916.0 645.3Q820.0 662.0 727.3 803.1ZM727.4 777.3Q850.6 651.7 930.7 616.1Q827.8 631.4 727.4 777.3ZM727.3 751.5Q823.6 634.1 883.2 597.5Q802.5 618.5 727.3 751.5ZM727.1 725.7Q829.2 596.4 891.6 555.5Q805.9 580.0 727.1 725.7ZM726.7 700.0Q842.9 574.0 917.2 536.9Q820.0 555.0 726.7 700.0ZM726.0 674.2Q830.5 529.9 892.5 482.9Q804.6 513.2 726.0 674.2ZM725.2 648.5Q822.1 519.0 880.2 477.3Q798.8 503.5 725.2 648.5ZM724.2 622.7Q823.8 481.0 882.1 434.5Q798.4 465.3 724.2 622.7ZM723.0 597.0Q809.0 468.1 858.3 425.2Q785.9 454.6 723.0 597.0ZM721.7 571.3Q792.7 453.5 831.7 413.5Q771.7 442.5 721.7 571.3ZM720.1 545.6Q791.1 431.3 830.6 392.7Q770.7 420.2 720.1 545.6ZM718.3 519.8Q785.1 413.7 822.5 377.9Q766.1 403.3 718.3 519.8ZM716.4 494.1Q770.3 389.8 797.6 353.5Q751.8 381.6 716.4 494.1ZM714.2 468.4Q766.1 384.2 794.8 355.6Q751.0 376.1 714.2 468.4ZM711.9 442.7Q755.4 362.5 778.1 334.8Q741.2 355.9 711.9 442.7ZM709.4 417.1Q747.6 350.6 768.2 327.8Q735.8 344.7 709.4 417.1ZM706.7 391.4Q739.2 332.4 756.3 312.1Q728.7 327.4 706.7 391.4ZM703.8 365.7Q725.4 322.6 736.1 307.6Q717.7 319.3 703.8 365.7ZM700.7 340.0Q709.1 323.1 713.3 317.2Q706.1 321.9 700.7 340.0ZM697.4 314.4Q697.4 314.4 697.4 314.4Q697.4 314.4 697.4 314.4Z"></path>
                <path fill="none" stroke="#0A3A2C" strokeWidth="4.1" strokeLinecap="round" d="M720.0 1000.0Q742.8 649.0 695.6 300.4"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "-60.0px -40.0px", "--a": "1.6deg", animationDuration: "11.5s", animationDelay: "-3.7s" }}>
                <path fill="#0C4433" d="M-31.1 -15.1Q30.1 -22.5 78.6 -7.5Q28.4 -33.5 -31.1 -15.1ZM-13.1 -0.3Q66.7 -3.7 131.0 20.9Q65.6 -18.1 -13.1 -0.3ZM5.1 14.1Q112.5 0.8 197.7 27.1Q109.5 -18.4 5.1 14.1ZM23.4 28.2Q129.1 17.4 213.2 45.0Q126.5 -1.5 23.4 28.2ZM42.0 41.9Q154.1 27.1 242.8 53.7Q150.8 7.0 42.0 41.9ZM60.7 55.3Q200.8 41.8 312.6 79.1Q197.6 16.7 60.7 55.3ZM79.6 68.3Q206.1 51.5 306.1 81.5Q202.3 28.9 79.6 68.3ZM98.7 80.9Q232.2 64.1 338.0 96.5Q228.4 40.2 98.7 80.9ZM118.0 93.2Q257.1 71.7 366.6 102.3Q252.4 46.9 118.0 93.2ZM137.5 105.2Q278.8 84.1 390.2 115.8Q274.2 58.8 137.5 105.2ZM157.2 116.7Q286.0 93.0 386.8 118.5Q281.0 70.0 157.2 116.7ZM177.1 128.0Q303.2 107.7 402.4 134.9Q298.8 85.2 177.1 128.0ZM197.1 138.8Q337.5 126.0 449.6 163.8Q334.4 100.8 197.1 138.8ZM217.4 149.4Q356.3 138.7 467.4 177.6Q353.6 113.7 217.4 149.4ZM237.8 159.5Q364.9 151.2 466.9 188.0Q362.7 128.3 237.8 159.5ZM258.4 169.3Q373.9 155.8 465.5 184.6Q370.8 135.1 258.4 169.3ZM279.3 178.8Q386.2 169.6 471.7 198.9Q384.0 150.4 279.3 178.8ZM300.3 187.9Q413.5 176.5 503.8 206.2Q410.9 156.2 300.3 187.9ZM321.5 196.6Q415.6 182.8 489.9 204.1Q412.6 165.9 321.5 196.6ZM342.8 205.0Q441.7 194.6 520.3 220.2Q439.2 176.9 342.8 205.0ZM364.4 213.0Q447.7 202.3 513.6 222.3Q445.3 187.4 364.4 213.0ZM386.2 220.7Q458.2 204.5 514.2 216.7Q454.9 191.7 386.2 220.7ZM408.1 228.0Q460.0 216.8 500.4 225.8Q457.7 207.5 408.1 228.0ZM430.3 235.0Q473.4 228.7 507.4 238.5Q472.0 221.0 430.3 235.0ZM452.6 241.6Q469.3 238.8 482.5 242.3Q468.7 235.8 452.6 241.6ZM475.1 247.8Q475.1 247.8 475.1 247.8Q475.1 247.8 475.1 247.8Z"></path>
                <path fill="#11563F" d="M-31.1 -15.1Q-35.1 42.3 -28.3 120.2Q-24.0 42.1 -31.1 -15.1ZM-13.1 -0.3Q-8.5 74.6 8.2 174.4Q5.8 72.4 -13.1 -0.3ZM5.1 14.1Q5.8 115.3 24.1 251.0Q25.2 113.4 5.1 14.1ZM23.4 28.2Q33.0 127.2 58.0 258.6Q51.9 123.7 23.4 28.2ZM42.0 41.9Q53.3 147.0 80.8 286.5Q73.3 143.1 42.0 41.9ZM60.7 55.3Q69.0 186.9 98.6 362.2Q94.1 183.1 60.7 55.3ZM79.6 68.3Q91.2 186.9 121.2 344.5Q113.8 182.8 79.6 68.3ZM98.7 80.9Q132.9 202.3 181.5 361.9Q155.6 194.0 98.7 80.9ZM118.0 93.2Q148.5 221.2 195.2 389.7Q172.5 213.5 118.0 93.2ZM137.5 105.2Q182.2 231.3 240.2 397.0Q205.8 221.0 137.5 105.2ZM157.2 116.7Q195.2 233.1 246.2 386.0Q217.0 224.2 157.2 116.7ZM177.1 128.0Q219.6 239.8 273.4 386.8Q240.5 230.1 177.1 128.0ZM197.1 138.8Q244.4 262.7 304.0 425.6Q267.4 252.1 197.1 138.8ZM217.4 149.4Q264.8 271.6 324.4 432.3Q287.6 260.9 217.4 149.4ZM237.8 159.5Q291.4 267.2 353.3 409.3Q311.3 255.7 237.8 159.5ZM258.4 169.3Q304.6 268.4 359.1 398.9Q323.0 258.3 258.4 169.3ZM279.3 178.8Q323.6 269.8 375.2 389.8Q340.4 260.2 279.3 178.8ZM300.3 187.9Q351.9 282.0 410.0 406.6Q369.3 271.1 300.3 187.9ZM321.5 196.6Q369.6 272.3 421.6 373.1Q383.5 262.3 321.5 196.6ZM342.8 205.0Q392.5 284.6 446.5 390.5Q407.1 274.3 342.8 205.0ZM364.4 213.0Q407.7 279.4 454.2 367.8Q419.9 270.4 364.4 213.0ZM386.2 220.7Q431.5 273.6 477.3 345.6Q441.1 264.5 386.2 220.7ZM408.1 228.0Q441.3 265.6 474.5 317.0Q448.1 259.0 408.1 228.0ZM430.3 235.0Q457.7 265.9 485.2 308.1Q463.3 260.4 430.3 235.0ZM452.6 241.6Q463.4 253.5 474.3 269.7Q465.6 251.3 452.6 241.6ZM475.1 247.8Q475.1 247.8 475.1 247.8Q475.1 247.8 475.1 247.8Z"></path>
                <path fill="none" stroke="#0A3A2C" strokeWidth="3.6" strokeLinecap="round" d="M-60.0 -40.0Q178.8 171.2 487.4 251.1"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "1500.0px -60.0px", "--a": "1.6deg", animationDuration: "13.0s", animationDelay: "-3.3s" }}>
                <path fill="#0C4433" d="M1471.1 -33.3Q1460.5 33.2 1463.6 124.6Q1473.5 34.0 1471.1 -33.3ZM1453.1 -17.4Q1443.6 61.0 1449.6 168.1Q1458.8 61.4 1453.1 -17.4ZM1434.8 -1.9Q1412.2 97.5 1411.4 235.7Q1431.7 99.8 1434.8 -1.9ZM1416.4 13.3Q1392.3 129.9 1393.2 291.4Q1415.0 132.2 1416.4 13.3ZM1397.8 28.2Q1363.8 140.2 1356.0 298.6Q1385.9 144.4 1397.8 28.2ZM1378.9 42.6Q1350.4 166.9 1349.1 340.0Q1374.7 169.9 1378.9 42.6ZM1359.9 56.7Q1317.5 170.0 1303.3 332.8Q1340.0 175.7 1359.9 56.7ZM1340.6 70.5Q1304.6 194.0 1297.3 368.3Q1329.0 198.4 1340.6 70.5ZM1321.1 83.8Q1270.9 198.0 1250.6 364.7Q1293.8 205.0 1321.1 83.8ZM1301.5 96.9Q1246.7 229.5 1225.9 422.0Q1273.1 237.1 1301.5 96.9ZM1281.6 109.5Q1221.1 234.4 1194.4 418.9Q1246.2 243.1 1281.6 109.5ZM1261.5 121.8Q1207.0 235.9 1183.3 404.1Q1229.9 243.7 1261.5 121.8ZM1241.2 133.8Q1176.5 266.9 1148.0 463.5Q1203.3 276.2 1241.2 133.8ZM1220.7 145.3Q1144.0 251.5 1101.1 419.1Q1165.9 263.5 1220.7 145.3ZM1200.0 156.6Q1134.3 264.2 1100.6 428.6Q1156.2 274.1 1200.0 156.6ZM1179.0 167.4Q1099.8 274.8 1055.2 444.9Q1122.0 287.1 1179.0 167.4ZM1157.9 177.9Q1086.6 258.7 1043.6 392.4Q1103.5 270.1 1157.9 177.9ZM1136.6 188.1Q1072.4 265.5 1034.6 391.7Q1088.6 275.7 1136.6 188.1ZM1115.0 197.8Q1046.6 281.8 1006.4 418.0Q1064.0 292.6 1115.0 197.8ZM1093.2 207.3Q1030.8 283.4 994.1 407.1Q1046.7 293.3 1093.2 207.3ZM1071.3 216.3Q1020.0 268.0 987.9 356.4Q1030.9 276.3 1071.3 216.3ZM1049.1 225.0Q1001.3 271.5 971.3 351.8Q1011.3 279.3 1049.1 225.0ZM1026.7 233.4Q988.7 271.6 965.0 337.2Q996.8 277.8 1026.7 233.4ZM1004.1 241.3Q973.0 269.7 953.0 319.9Q979.1 274.8 1004.1 241.3ZM981.3 249.0Q966.6 258.9 956.6 278.6Q968.8 261.4 981.3 249.0ZM958.3 256.2Q958.3 256.2 958.3 256.2Q958.3 256.2 958.3 256.2Z"></path>
                <path fill="#11563F" d="M1471.1 -33.3Q1400.0 -45.6 1341.5 -7.7Q1399.7 -32.7 1471.1 -33.3ZM1453.1 -17.4Q1369.6 -32.2 1301.0 12.1Q1369.2 -17.0 1453.1 -17.4ZM1434.8 -1.9Q1327.7 -23.2 1239.2 31.9Q1326.8 -3.7 1434.8 -1.9ZM1416.4 13.3Q1292.1 -17.1 1188.5 42.9Q1290.0 5.7 1416.4 13.3ZM1397.8 28.2Q1276.3 -5.3 1174.5 50.6Q1273.6 17.0 1397.8 28.2ZM1378.9 42.6Q1246.4 6.4 1135.4 67.7Q1243.5 30.8 1378.9 42.6ZM1359.9 56.7Q1233.3 28.9 1128.4 92.2Q1231.8 52.1 1359.9 56.7ZM1340.6 70.5Q1206.9 34.5 1094.9 96.7Q1204.1 59.1 1340.6 70.5ZM1321.1 83.8Q1191.0 54.1 1082.9 118.3Q1189.2 77.9 1321.1 83.8ZM1301.5 96.9Q1153.4 53.6 1028.8 120.0Q1149.6 80.8 1301.5 96.9ZM1281.6 109.5Q1137.8 71.5 1017.5 138.7Q1134.9 97.9 1281.6 109.5ZM1261.5 121.8Q1132.5 78.9 1023.1 133.2Q1128.3 102.7 1261.5 121.8ZM1241.2 133.8Q1090.6 82.1 962.7 144.5Q1085.4 110.0 1241.2 133.8ZM1220.7 145.3Q1087.6 101.5 974.8 157.9Q1083.4 126.1 1220.7 145.3ZM1200.0 156.6Q1069.4 123.8 960.5 186.2Q1067.1 147.8 1200.0 156.6ZM1179.0 167.4Q1041.2 133.5 926.2 199.8Q1038.8 158.8 1179.0 167.4ZM1157.9 177.9Q1048.0 145.4 955.5 194.4Q1045.1 165.6 1157.9 177.9ZM1136.6 188.1Q1035.0 153.1 948.7 195.1Q1031.5 171.9 1136.6 188.1ZM1115.0 197.8Q1005.2 161.6 912.2 208.0Q1001.7 181.9 1115.0 197.8ZM1093.2 207.3Q992.8 177.0 908.1 221.5Q990.1 195.5 1093.2 207.3ZM1071.3 216.3Q997.3 193.7 935.0 226.3Q995.3 207.4 1071.3 216.3ZM1049.1 225.0Q980.8 207.5 923.8 239.8Q979.5 220.0 1049.1 225.0ZM1026.7 233.4Q972.7 213.6 926.7 235.2Q970.7 223.6 1026.7 233.4ZM1004.1 241.3Q962.1 225.9 926.2 242.6Q960.5 233.6 1004.1 241.3ZM981.3 249.0Q963.6 242.7 948.6 249.9Q963.0 246.0 981.3 249.0ZM958.3 256.2Q958.3 256.2 958.3 256.2Q958.3 256.2 958.3 256.2Z"></path>
                <path fill="none" stroke="#0A3A2C" strokeWidth="3.8" strokeLinecap="round" d="M1500.0 -60.0Q1261.3 166.5 945.7 260.0"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "-60.0px 760.0px", "--a": "2.2deg", animationDuration: "9.7s", animationDelay: "-7.8s" }}>
                <path fill="#157E5C" d="M-21.3 750.9Q14.9 690.1 34.7 669.4Q4.1 684.5 -21.3 750.9ZM2.1 744.7Q50.1 675.6 78.1 652.8Q37.7 668.0 2.1 744.7ZM25.2 738.2Q77.2 648.2 105.1 617.5Q61.2 640.2 25.2 738.2ZM48.2 731.2Q104.6 630.5 134.4 595.9Q86.7 621.9 48.2 731.2ZM70.9 723.7Q142.6 618.3 184.1 583.4Q123.7 607.0 70.9 723.7ZM93.4 715.9Q176.2 593.7 224.0 553.1Q154.3 580.6 93.4 715.9ZM115.7 707.6Q200.1 574.0 247.5 529.0Q176.2 560.8 115.7 707.6ZM137.7 698.9Q205.4 581.2 241.8 540.9Q184.5 570.7 137.7 698.9ZM159.5 689.7Q235.6 548.5 275.0 499.8Q210.5 537.0 159.5 689.7ZM181.1 680.1Q244.1 555.3 275.5 511.9Q221.9 545.9 181.1 680.1ZM202.5 670.1Q273.6 534.7 310.0 487.8Q249.6 523.9 202.5 670.1ZM223.6 659.7Q296.4 517.2 333.1 467.7Q271.2 506.2 223.6 659.7ZM244.5 648.8Q319.4 513.5 358.9 467.0Q295.4 502.1 244.5 648.8ZM265.2 637.6Q327.1 508.4 357.0 463.3Q304.2 499.2 265.2 637.6ZM285.6 625.8Q347.6 508.3 379.4 467.6Q326.7 498.9 285.6 625.8ZM305.8 613.7Q371.9 504.9 408.3 467.9Q352.5 494.6 305.8 613.7ZM325.8 601.1Q379.1 485.8 404.2 445.4Q358.7 477.9 325.8 601.1ZM345.6 588.1Q389.9 487.2 409.9 451.7Q372.1 480.7 345.6 588.1ZM365.1 574.7Q412.7 481.1 436.7 448.6Q396.2 474.0 365.1 574.7ZM384.4 560.8Q431.1 462.7 453.6 428.4Q413.8 455.8 384.4 560.8ZM403.5 546.5Q440.4 467.0 457.8 439.1Q426.3 461.5 403.5 546.5ZM422.3 531.8Q452.2 464.2 465.7 440.4Q440.2 459.8 422.3 531.8ZM440.9 516.7Q469.7 455.5 483.5 434.1Q458.9 451.2 440.9 516.7ZM459.3 501.1Q476.8 459.3 484.4 444.6Q469.5 456.8 459.3 501.1ZM477.5 485.1Q484.4 469.5 487.5 464.0Q481.6 468.5 477.5 485.1ZM495.4 468.6Q495.4 468.6 495.4 468.6Q495.4 468.6 495.4 468.6Z"></path>
                <path fill="#1DA97A" d="M-21.3 750.9Q32.3 787.5 82.1 842.2Q38.8 777.2 -21.3 750.9ZM2.1 744.7Q69.7 783.2 131.2 843.7Q76.4 770.3 2.1 744.7ZM25.2 738.2Q103.8 792.2 176.7 872.7Q113.3 777.0 25.2 738.2ZM48.2 731.2Q141.2 782.7 225.5 864.4Q150.2 765.0 48.2 731.2ZM70.9 723.7Q172.1 783.7 264.5 876.8Q182.6 764.4 70.9 723.7ZM93.4 715.9Q216.4 775.8 326.5 874.9Q226.7 752.4 93.4 715.9ZM115.7 707.6Q250.5 765.5 369.7 866.1Q260.3 740.1 115.7 707.6ZM137.7 698.9Q253.9 747.6 356.5 833.0Q262.2 725.7 137.7 698.9ZM159.5 689.7Q299.6 740.7 422.0 835.8Q308.1 714.4 159.5 689.7ZM181.1 680.1Q302.9 725.1 409.4 808.5Q310.4 702.3 181.1 680.1ZM202.5 670.1Q341.6 703.6 460.3 781.2Q346.9 677.8 202.5 670.1ZM223.6 659.7Q366.5 702.4 489.8 790.2Q373.5 675.8 223.6 659.7ZM244.5 648.8Q388.0 671.9 508.6 741.3Q391.4 645.5 244.5 648.8ZM265.2 637.6Q399.2 651.8 510.6 710.0Q401.1 627.2 265.2 637.6ZM285.6 625.8Q408.4 647.5 511.9 708.7Q411.7 624.9 285.6 625.8ZM305.8 613.7Q424.6 630.4 524.0 685.7Q427.0 608.6 305.8 613.7ZM325.8 601.1Q446.2 600.8 544.0 641.8Q445.4 579.0 325.8 601.1ZM345.6 588.1Q450.0 587.2 534.7 622.2Q449.2 568.3 345.6 588.1ZM365.1 574.7Q464.8 569.2 545.0 598.9Q463.3 551.2 365.1 574.7ZM384.4 560.8Q487.4 558.7 570.9 592.2Q486.5 540.0 384.4 560.8ZM403.5 546.5Q486.7 539.3 553.1 562.0Q484.9 524.4 403.5 546.5ZM422.3 531.8Q491.9 518.8 546.3 532.5Q489.2 506.4 422.3 531.8ZM440.9 516.7Q504.4 503.2 553.8 514.5Q501.6 491.9 440.9 516.7ZM459.3 501.1Q502.1 495.0 535.9 504.9Q500.8 487.4 459.3 501.1ZM477.5 485.1Q493.3 480.9 505.5 483.1Q492.5 478.1 477.5 485.1ZM495.4 468.6Q495.4 468.6 495.4 468.6Q495.4 468.6 495.4 468.6Z"></path>
                <path fill="none" stroke="#0F5E45" strokeWidth="3.8" strokeLinecap="round" d="M-60.0 760.0Q264.6 688.9 505.1 459.5"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "90.0px 1000.0px", "--a": "2.2deg", animationDuration: "8.4s", animationDelay: "-4.7s" }}>
                <path fill="#157E5C" d="M111.5 973.1Q111.2 915.0 101.9 896.1Q101.3 916.0 111.5 973.1ZM124.3 956.4Q114.0 875.5 93.2 851.2Q100.4 878.7 124.3 956.4ZM136.8 939.6Q134.8 845.9 118.7 815.7Q118.9 847.7 136.8 939.6ZM148.9 922.6Q137.5 808.6 110.6 773.6Q118.3 812.4 148.9 922.6ZM160.7 905.4Q153.6 799.2 131.4 765.9Q135.6 802.1 160.7 905.4ZM172.2 888.1Q166.6 761.0 142.5 720.5Q145.1 763.9 172.2 888.1ZM183.3 870.6Q172.6 739.1 143.6 698.3Q150.4 743.1 183.3 870.6ZM194.1 852.9Q188.5 719.7 163.4 677.4Q166.0 722.8 194.1 852.9ZM204.6 835.1Q196.6 708.3 170.5 668.5Q175.2 711.7 204.6 835.1ZM214.8 817.1Q199.4 687.9 167.1 648.8Q177.7 692.7 214.8 817.1ZM224.6 799.0Q205.2 661.1 168.2 620.1Q182.0 666.7 224.6 799.0ZM234.2 780.7Q224.2 658.5 197.3 620.6Q203.5 662.2 234.2 780.7ZM243.3 762.3Q232.7 633.6 204.3 593.7Q211.0 637.5 243.3 762.3ZM252.2 743.7Q240.1 628.4 212.6 593.1Q220.7 632.3 252.2 743.7ZM260.7 724.9Q253.7 588.9 227.0 545.9Q230.6 592.3 260.7 724.9ZM268.9 706.0Q252.5 588.6 221.2 553.6Q232.8 593.4 268.9 706.0ZM276.8 686.9Q260.3 564.5 228.0 527.9Q239.7 569.4 276.8 686.9ZM284.3 667.6Q275.8 572.6 254.3 543.2Q259.8 575.6 284.3 667.6ZM291.6 648.2Q282.6 552.6 260.6 523.1Q266.5 555.7 291.6 648.2ZM298.5 628.6Q281.2 534.0 252.8 506.7Q265.4 538.5 298.5 628.6ZM305.0 608.9Q297.6 533.4 280.0 510.1Q284.9 535.9 305.0 608.9ZM311.3 589.0Q305.4 526.2 291.0 506.9Q294.8 528.2 311.3 589.0ZM317.2 569.0Q313.6 514.7 302.4 497.7Q304.4 516.2 317.2 569.0ZM322.8 548.8Q316.6 512.0 306.0 501.3Q310.5 513.7 322.8 548.8ZM328.0 528.4Q325.7 513.8 321.5 509.5Q323.2 514.4 328.0 528.4ZM332.9 507.9Q332.9 507.9 332.9 507.9Q332.9 507.9 332.9 507.9Z"></path>
                <path fill="#1DA97A" d="M111.5 973.1Q166.4 971.3 210.7 988.5Q165.7 961.3 111.5 973.1ZM124.3 956.4Q201.3 950.1 262.8 971.4Q199.7 936.3 124.3 956.4ZM136.8 939.6Q225.2 933.7 296.1 959.3Q223.6 917.8 136.8 939.6ZM148.9 922.6Q257.0 912.7 343.2 941.8Q254.6 893.3 148.9 922.6ZM160.7 905.4Q259.6 881.7 336.1 897.3Q254.8 864.2 160.7 905.4ZM172.2 888.1Q291.7 869.1 385.7 895.0Q287.6 847.7 172.2 888.1ZM183.3 870.6Q306.3 844.0 401.9 865.4Q300.8 822.1 183.3 870.6ZM194.1 852.9Q314.8 809.7 405.8 818.9Q306.4 788.6 194.1 852.9ZM204.6 835.1Q322.2 804.6 412.9 821.4Q316.1 783.7 204.6 835.1ZM214.8 817.1Q330.7 769.0 417.0 773.5Q321.4 748.8 214.8 817.1ZM224.6 799.0Q350.6 753.5 445.7 762.8Q341.8 731.4 224.6 799.0ZM234.2 780.7Q343.0 734.5 424.0 738.0Q334.1 715.5 234.2 780.7ZM243.3 762.3Q354.6 705.2 435.8 702.9Q343.8 686.0 243.3 762.3ZM252.2 743.7Q351.1 690.4 422.9 686.7Q341.1 673.3 252.2 743.7ZM260.7 724.9Q377.7 664.2 463.1 661.3Q366.3 644.0 260.7 724.9ZM268.9 706.0Q366.3 644.2 435.6 635.3Q354.8 627.6 268.9 706.0ZM276.8 686.9Q380.2 626.0 454.4 619.2Q368.8 608.3 276.8 686.9ZM284.3 667.6Q361.6 615.9 416.0 607.2Q351.9 602.7 284.3 667.6ZM291.6 648.2Q366.1 591.1 417.5 579.0Q355.5 578.5 291.6 648.2ZM298.5 628.6Q371.2 568.8 420.8 554.8Q360.2 556.6 298.5 628.6ZM305.0 608.9Q362.2 561.5 401.1 550.2Q353.5 551.9 305.0 608.9ZM311.3 589.0Q359.5 550.6 392.6 542.0Q352.5 542.5 311.3 589.0ZM317.2 569.0Q355.1 531.3 379.9 520.9Q348.2 525.1 317.2 569.0ZM322.8 548.8Q350.0 524.4 368.3 518.2Q345.6 519.9 322.8 548.8ZM328.0 528.4Q338.5 518.3 345.4 515.6Q336.7 516.6 328.0 528.4ZM332.9 507.9Q332.9 507.9 332.9 507.9Q332.9 507.9 332.9 507.9Z"></path>
                <path fill="none" stroke="#0F5E45" strokeWidth="3.3" strokeLinecap="round" d="M90.0 1000.0Q273.1 777.8 335.5 496.7"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "1500.0px 760.0px", "--a": "2.2deg", animationDuration: "9.6s", animationDelay: "-2.1s" }}>
                <path fill="#157E5C" d="M1462.6 751.2Q1402.5 781.9 1360.0 851.6Q1409.8 792.2 1462.6 751.2ZM1439.9 745.2Q1361.9 771.1 1304.4 847.1Q1368.8 784.6 1439.9 745.2ZM1417.4 738.9Q1334.7 775.4 1275.2 865.3Q1343.7 789.6 1417.4 738.9ZM1395.2 732.1Q1291.6 760.1 1214.1 854.8Q1299.6 778.2 1395.2 732.1ZM1373.2 724.9Q1251.6 752.4 1159.6 858.6Q1259.9 773.8 1373.2 724.9ZM1351.4 717.3Q1231.4 740.0 1140.0 840.6Q1238.8 761.2 1351.4 717.3ZM1329.8 709.2Q1193.7 735.6 1090.0 850.1Q1202.2 759.5 1329.8 709.2ZM1308.5 700.8Q1178.7 727.5 1080.1 838.3Q1187.1 750.4 1308.5 700.8ZM1287.3 691.9Q1160.0 714.5 1062.7 819.8Q1167.6 737.0 1287.3 691.9ZM1266.4 682.6Q1132.4 704.6 1029.7 813.8Q1140.1 728.3 1266.4 682.6ZM1245.7 672.9Q1092.5 687.5 973.3 802.8Q1099.3 714.8 1245.7 672.9ZM1225.3 662.8Q1076.5 670.2 959.7 776.2Q1081.9 696.7 1225.3 662.8ZM1205.0 652.3Q1080.1 655.2 981.5 741.4Q1084.0 677.5 1205.0 652.3ZM1185.0 641.4Q1039.1 639.8 923.0 736.4Q1042.8 666.0 1185.0 641.4ZM1165.2 630.0Q1024.6 622.7 911.9 711.1Q1027.1 648.1 1165.2 630.0ZM1145.6 618.3Q1013.2 613.6 907.4 698.7Q1016.0 637.5 1145.6 618.3ZM1126.3 606.1Q1020.4 585.6 933.1 640.5Q1019.6 604.9 1126.3 606.1ZM1107.1 593.5Q1003.5 570.1 917.5 621.4Q1002.1 589.0 1107.1 593.5ZM1088.2 580.5Q991.6 554.3 910.7 599.1Q989.5 572.1 1088.2 580.5ZM1069.5 567.0Q976.7 541.8 899.0 584.8Q974.7 558.9 1069.5 567.0ZM1051.0 553.2Q972.8 537.3 908.2 577.3Q972.1 551.6 1051.0 553.2ZM1032.8 538.9Q961.4 515.2 900.9 545.3Q959.1 528.4 1032.8 538.9ZM1014.7 524.3Q954.6 505.7 903.9 532.0Q952.9 516.8 1014.7 524.3ZM996.9 509.2Q959.4 491.9 926.9 504.6Q957.4 498.9 996.9 509.2ZM979.3 493.7Q964.2 487.4 951.1 493.0Q963.5 490.2 979.3 493.7ZM961.9 477.8Q961.9 477.8 961.9 477.8Q961.9 477.8 961.9 477.8Z"></path>
                <path fill="#1DA97A" d="M1462.6 751.2Q1438.4 682.0 1408.3 665.5Q1427.1 687.4 1462.6 751.2ZM1439.9 745.2Q1403.2 664.8 1361.4 648.7Q1390.2 672.7 1439.9 745.2ZM1417.4 738.9Q1375.4 650.6 1328.1 633.5Q1361.2 659.5 1417.4 738.9ZM1395.2 732.1Q1358.2 622.8 1311.6 596.4Q1340.3 631.2 1395.2 732.1ZM1373.2 724.9Q1332.6 597.4 1280.4 565.7Q1311.7 606.7 1373.2 724.9ZM1351.4 717.3Q1299.4 597.6 1239.3 572.6Q1280.0 608.8 1351.4 717.3ZM1329.8 709.2Q1268.8 574.3 1199.1 547.0Q1247.0 587.3 1329.8 709.2ZM1308.5 700.8Q1256.8 568.7 1194.9 539.1Q1235.2 580.1 1308.5 700.8ZM1287.3 691.9Q1231.5 565.7 1167.2 539.7Q1211.1 577.7 1287.3 691.9ZM1266.4 682.6Q1225.7 543.2 1171.4 507.5Q1202.7 552.7 1266.4 682.6ZM1245.7 672.9Q1185.5 520.8 1113.6 486.9Q1160.7 534.0 1245.7 672.9ZM1225.3 662.8Q1180.1 511.2 1120.4 472.6Q1155.1 521.7 1225.3 662.8ZM1205.0 652.3Q1162.2 527.0 1108.4 496.9Q1141.6 536.7 1205.0 652.3ZM1185.0 641.4Q1130.6 497.1 1064.6 464.0Q1107.0 509.1 1185.0 641.4ZM1165.2 630.0Q1110.7 492.0 1045.7 461.3Q1088.2 504.0 1165.2 630.0ZM1145.6 618.3Q1107.9 483.4 1056.8 448.3Q1085.6 492.3 1145.6 618.3ZM1126.3 606.1Q1086.6 500.6 1038.4 476.3Q1069.3 509.3 1126.3 606.1ZM1107.1 593.5Q1078.2 486.2 1038.4 458.0Q1060.5 493.1 1107.1 593.5ZM1088.2 580.5Q1055.4 481.5 1013.8 457.3Q1039.1 488.9 1088.2 580.5ZM1069.5 567.0Q1038.4 471.8 998.7 448.4Q1022.8 478.9 1069.5 567.0ZM1051.0 553.2Q1025.7 473.7 993.1 453.9Q1012.6 479.5 1051.0 553.2ZM1032.8 538.9Q1015.8 462.6 990.4 441.4Q1003.1 466.8 1032.8 538.9ZM1014.7 524.3Q993.5 462.4 966.9 447.5Q983.4 467.2 1014.7 524.3ZM996.9 509.2Q988.3 467.4 975.0 455.6Q981.4 469.6 996.9 509.2ZM979.3 493.7Q974.4 477.4 968.0 473.3Q971.8 478.6 979.3 493.7ZM961.9 477.8Q961.9 477.8 961.9 477.8Q961.9 477.8 961.9 477.8Z"></path>
                <path fill="none" stroke="#0F5E45" strokeWidth="3.6" strokeLinecap="round" d="M1500.0 760.0Q1185.5 691.1 952.6 468.9"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "1360.0px 1000.0px", "--a": "2.2deg", animationDuration: "9.3s", animationDelay: "-6.4s" }}>
                <path fill="#157E5C" d="M1338.5 973.1Q1275.1 956.4 1222.1 986.1Q1273.8 968.1 1338.5 973.1ZM1325.7 956.4Q1252.4 937.4 1191.2 971.9Q1251.0 950.8 1325.7 956.4ZM1313.2 939.6Q1219.6 914.4 1141.2 957.9Q1217.6 931.6 1313.2 939.6ZM1301.1 922.6Q1197.6 893.3 1110.7 940.5Q1195.1 912.4 1301.1 922.6ZM1289.3 905.4Q1194.5 871.7 1113.8 910.1Q1191.1 889.2 1289.3 905.4ZM1277.8 888.1Q1161.2 829.9 1059.3 866.6Q1154.0 851.7 1277.8 888.1ZM1266.7 870.6Q1157.4 827.9 1063.7 869.7Q1152.7 848.2 1266.7 870.6ZM1255.9 852.9Q1141.1 797.4 1041.0 834.5Q1134.3 818.8 1255.9 852.9ZM1245.4 835.1Q1137.5 775.4 1042.3 805.9Q1129.8 795.7 1245.4 835.1ZM1235.2 817.1Q1120.0 743.8 1016.7 770.8Q1110.1 765.6 1235.2 817.1ZM1225.4 799.0Q1112.4 722.3 1010.4 746.1Q1101.9 743.8 1225.4 799.0ZM1215.8 780.7Q1110.0 713.7 1015.2 738.8Q1101.0 733.8 1215.8 780.7ZM1206.7 762.3Q1093.7 688.6 992.2 714.1Q1083.7 710.0 1206.7 762.3ZM1197.8 743.7Q1106.0 667.1 1020.8 679.1Q1094.9 684.8 1197.8 743.7ZM1189.3 724.9Q1091.6 649.2 1001.9 664.7Q1080.8 667.9 1189.3 724.9ZM1181.1 706.0Q1080.4 626.5 987.8 641.9Q1069.1 645.9 1181.1 706.0ZM1173.2 686.9Q1091.0 602.1 1012.2 604.9Q1078.3 618.2 1173.2 686.9ZM1165.7 667.6Q1099.6 598.5 1036.1 600.3Q1089.2 611.5 1165.7 667.6ZM1158.4 648.2Q1082.4 579.6 1011.0 586.9Q1072.3 594.4 1158.4 648.2ZM1151.5 628.6Q1092.5 569.7 1036.2 572.6Q1083.7 581.3 1151.5 628.6ZM1145.0 608.9Q1093.0 541.6 1041.0 537.2Q1082.6 552.0 1145.0 608.9ZM1138.7 589.0Q1097.5 539.3 1056.9 537.4Q1089.9 547.5 1138.7 589.0ZM1132.8 569.0Q1104.1 526.7 1074.6 522.0Q1097.5 532.5 1132.8 569.0ZM1127.2 548.8Q1107.1 519.9 1086.4 517.0Q1102.5 523.9 1127.2 548.8ZM1122.0 528.4Q1113.2 516.7 1104.4 515.8Q1111.4 518.5 1122.0 528.4ZM1117.1 507.9Q1117.1 507.9 1117.1 507.9Q1117.1 507.9 1117.1 507.9Z"></path>
                <path fill="#1DA97A" d="M1338.5 973.1Q1356.4 907.2 1360.7 883.9Q1344.9 904.9 1338.5 973.1ZM1325.7 956.4Q1342.1 879.1 1343.3 852.1Q1328.6 877.3 1325.7 956.4ZM1313.2 939.6Q1331.3 840.0 1330.5 805.4Q1314.1 838.2 1313.2 939.6ZM1301.1 922.6Q1323.9 812.7 1325.3 774.4Q1304.9 810.3 1301.1 922.6ZM1289.3 905.4Q1314.9 804.1 1319.9 768.5Q1297.3 801.0 1289.3 905.4ZM1277.8 888.1Q1316.9 759.5 1328.4 714.2Q1294.4 754.4 1277.8 888.1ZM1266.7 870.6Q1290.0 751.1 1290.2 709.5Q1269.3 748.7 1266.7 870.6ZM1255.9 852.9Q1292.0 726.4 1301.5 681.8Q1269.9 721.8 1255.9 852.9ZM1245.4 835.1Q1275.9 711.9 1281.4 668.7Q1254.4 708.3 1245.4 835.1ZM1235.2 817.1Q1275.2 682.9 1286.7 635.6Q1251.8 677.8 1235.2 817.1ZM1225.4 799.0Q1254.6 662.1 1256.9 614.3Q1230.8 659.0 1225.4 799.0ZM1215.8 780.7Q1250.4 657.0 1259.1 613.4Q1228.9 652.6 1215.8 780.7ZM1206.7 762.3Q1237.8 627.5 1242.1 580.3Q1214.4 623.9 1206.7 762.3ZM1197.8 743.7Q1225.0 624.8 1228.4 583.1Q1204.3 621.7 1197.8 743.7ZM1189.3 724.9Q1220.6 602.6 1226.9 559.6Q1199.3 598.8 1189.3 724.9ZM1181.1 706.0Q1217.0 580.1 1226.4 535.8Q1195.0 575.6 1181.1 706.0ZM1173.2 686.9Q1208.6 572.5 1219.5 532.2Q1188.7 567.9 1173.2 686.9ZM1165.7 667.6Q1192.5 574.4 1199.6 541.6Q1176.2 571.0 1165.7 667.6ZM1158.4 648.2Q1193.3 550.1 1206.2 515.5Q1176.1 545.3 1158.4 648.2ZM1151.5 628.6Q1171.7 546.3 1175.1 517.4Q1157.3 544.0 1151.5 628.6ZM1145.0 608.9Q1170.7 527.0 1178.7 498.1Q1156.4 523.6 1145.0 608.9ZM1138.7 589.0Q1160.8 527.6 1169.0 505.9Q1150.0 524.6 1138.7 589.0ZM1132.8 569.0Q1149.8 520.4 1155.9 503.2Q1141.3 518.0 1132.8 569.0ZM1127.2 548.8Q1138.2 515.0 1141.8 503.0Q1132.3 513.5 1127.2 548.8ZM1122.0 528.4Q1126.2 514.2 1127.3 509.3Q1123.7 513.7 1122.0 528.4ZM1117.1 507.9Q1117.1 507.9 1117.1 507.9Q1117.1 507.9 1117.1 507.9Z"></path>
                <path fill="none" stroke="#0F5E45" strokeWidth="3.3" strokeLinecap="round" d="M1360.0 1000.0Q1176.9 777.8 1114.5 496.7"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "-40.0px 150.0px", "--a": "2.2deg", animationDuration: "9.4s", animationDelay: "-0.8s" }}>
                <path fill="#157E5C" d="M-10.0 162.6Q38.2 143.6 74.2 146.1Q34.5 135.2 -10.0 162.6ZM8.5 169.7Q70.6 139.9 116.3 139.8Q65.0 129.1 8.5 169.7ZM27.1 176.4Q108.3 134.7 167.6 132.9Q100.4 120.6 27.1 176.4ZM45.7 182.7Q126.1 147.1 185.7 148.8Q119.3 133.1 45.7 182.7ZM64.3 188.4Q159.3 139.3 228.5 137.0Q150.0 122.9 64.3 188.4ZM83.0 193.8Q185.2 141.9 259.9 140.0Q175.4 124.2 83.0 193.8ZM101.7 198.7Q200.1 148.2 271.8 146.0Q190.5 131.1 101.7 198.7ZM120.5 203.1Q227.6 148.8 306.0 146.9Q217.3 130.3 120.5 203.1ZM139.3 207.1Q254.2 146.5 337.8 143.1Q242.7 126.7 139.3 207.1ZM158.2 210.7Q257.9 154.1 329.8 148.8Q247.2 137.0 158.2 210.7ZM177.1 213.8Q273.6 161.6 343.7 158.0Q263.8 145.0 177.1 213.8ZM196.0 216.4Q312.2 161.5 397.7 161.8Q301.7 141.3 196.0 216.4ZM215.1 218.6Q314.8 154.8 385.6 145.4Q302.9 137.8 215.1 218.6ZM234.1 220.4Q339.0 168.8 416.0 168.0Q329.3 150.7 234.1 220.4ZM253.2 221.7Q341.5 168.9 404.7 162.6Q331.6 153.8 253.2 221.7ZM272.4 222.6Q363.6 165.4 428.6 157.4Q352.9 149.7 272.4 222.6ZM291.6 223.0Q376.7 165.7 436.6 156.0Q366.0 151.2 291.6 223.0ZM310.8 222.9Q394.8 178.7 455.9 176.2Q386.4 164.2 310.8 222.9ZM330.1 222.5Q402.6 183.1 455.2 180.3Q395.2 170.6 330.1 222.5ZM349.4 221.5Q420.8 169.9 470.5 159.9Q411.3 157.8 349.4 221.5ZM368.8 220.1Q435.6 182.0 483.7 178.2Q428.4 170.5 368.8 220.1ZM388.3 218.3Q438.8 181.6 473.9 174.4Q432.0 173.1 388.3 218.3ZM407.7 216.0Q450.6 186.5 480.7 181.3Q445.1 179.2 407.7 216.0ZM427.3 213.3Q457.4 190.8 478.3 186.2Q453.3 185.7 427.3 213.3ZM446.8 210.1Q457.9 202.5 465.6 201.2Q456.5 200.6 446.8 210.1ZM466.5 206.5Q466.5 206.5 466.5 206.5Q466.5 206.5 466.5 206.5Z"></path>
                <path fill="#1DA97A" d="M-10.0 162.6Q5.5 207.8 25.9 267.3Q14.0 204.3 -10.0 162.6ZM8.5 169.7Q31.5 228.9 60.3 306.8Q42.5 223.8 8.5 169.7ZM27.1 176.4Q57.8 254.7 96.1 357.5Q72.3 247.8 27.1 176.4ZM45.7 182.7Q79.9 256.4 120.4 353.5Q93.6 248.9 45.7 182.7ZM64.3 188.4Q113.3 274.2 167.7 387.9Q129.1 263.9 64.3 188.4ZM83.0 193.8Q134.7 286.2 192.6 408.5Q151.8 275.2 83.0 193.8ZM101.7 198.7Q147.9 289.6 200.9 409.7Q164.7 279.7 101.7 198.7ZM120.5 203.1Q183.0 295.2 249.5 418.1Q199.9 282.3 120.5 203.1ZM139.3 207.1Q201.2 309.9 269.1 446.3Q220.1 296.9 139.3 207.1ZM158.2 210.7Q219.9 296.9 284.6 412.4Q235.6 284.2 158.2 210.7ZM177.1 213.8Q237.4 295.6 300.3 405.5Q252.3 283.2 177.1 213.8ZM196.0 216.4Q277.5 304.4 358.6 425.1Q293.4 288.1 196.0 216.4ZM215.1 218.6Q295.7 293.6 373.9 398.7Q309.1 277.7 215.1 218.6ZM234.1 220.4Q311.8 297.1 387.9 403.7Q325.6 281.7 234.1 220.4ZM253.2 221.7Q324.2 286.1 392.7 376.8Q335.7 272.1 253.2 221.7ZM272.4 222.6Q353.8 281.8 430.0 369.0Q364.3 266.0 272.4 222.6ZM291.6 223.0Q364.4 284.7 434.0 372.6Q375.4 270.4 291.6 223.0ZM310.8 222.9Q381.9 276.6 448.7 354.9Q391.4 262.8 310.8 222.9ZM330.1 222.5Q398.0 260.5 459.6 320.5Q404.6 247.5 330.1 222.5ZM349.4 221.5Q420.9 262.7 486.0 327.3Q428.1 249.1 349.4 221.5ZM368.8 220.1Q433.6 253.1 491.7 306.9Q439.3 240.8 368.8 220.1ZM388.3 218.3Q439.8 246.2 486.3 290.7Q444.6 236.4 388.3 218.3ZM407.7 216.0Q453.6 233.9 493.8 266.3Q456.6 225.3 407.7 216.0ZM427.3 213.3Q459.6 227.8 488.3 252.6Q462.1 221.7 427.3 213.3ZM446.8 210.1Q458.9 214.2 469.4 222.0Q459.6 211.9 446.8 210.1ZM466.5 206.5Q466.5 206.5 466.5 206.5Q466.5 206.5 466.5 206.5Z"></path>
                <path fill="none" stroke="#0F5E45" strokeWidth="3.1" strokeLinecap="round" d="M-40.0 150.0Q209.9 259.9 477.2 204.4"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "1490.0px 200.0px", "--a": "2.2deg", animationDuration: "9.3s", animationDelay: "-5.1s" }}>
                <path fill="#157E5C" d="M1460.4 213.6Q1437.4 256.1 1426.3 319.9Q1445.9 259.5 1460.4 213.6ZM1442.2 221.4Q1415.9 277.1 1404.6 359.1Q1427.1 280.9 1442.2 221.4ZM1423.9 228.7Q1381.1 297.8 1358.9 403.7Q1395.2 304.3 1423.9 228.7ZM1405.5 235.6Q1358.3 306.8 1332.9 417.1Q1372.9 314.0 1405.5 235.6ZM1387.1 242.1Q1333.2 320.1 1303.6 442.1Q1349.2 328.4 1387.1 242.1ZM1368.6 248.1Q1305.9 327.4 1269.6 455.0Q1322.4 337.3 1368.6 248.1ZM1350.1 253.6Q1278.9 333.3 1235.9 465.6Q1295.6 344.7 1350.1 253.6ZM1331.5 258.7Q1258.0 349.0 1215.0 495.5Q1276.8 360.7 1331.5 258.7ZM1312.8 263.3Q1239.6 347.8 1195.8 486.8Q1257.3 359.5 1312.8 263.3ZM1294.1 267.6Q1213.7 345.7 1163.0 481.0Q1230.3 358.8 1294.1 267.6ZM1275.3 271.3Q1188.1 345.3 1131.4 479.3Q1204.2 359.7 1275.3 271.3ZM1256.4 274.6Q1173.5 336.9 1118.1 455.1Q1187.2 350.8 1256.4 274.6ZM1237.5 277.5Q1148.2 344.7 1088.6 472.0Q1163.0 359.6 1237.5 277.5ZM1218.5 279.9Q1134.8 344.8 1079.2 466.3Q1149.0 358.7 1218.5 279.9ZM1199.5 281.9Q1101.9 339.6 1034.2 461.1Q1115.2 356.1 1199.5 281.9ZM1180.4 283.4Q1083.5 331.3 1014.7 441.9Q1094.9 347.9 1180.4 283.4ZM1161.2 284.5Q1073.8 324.6 1011.1 421.2Q1083.5 339.6 1161.2 284.5ZM1141.9 285.1Q1064.0 317.2 1007.5 399.4Q1072.0 330.6 1141.9 285.1ZM1122.7 285.3Q1051.8 313.3 1000.3 386.9Q1058.9 325.6 1122.7 285.3ZM1103.3 285.1Q1038.6 313.0 992.0 382.6Q1045.5 324.1 1103.3 285.1ZM1083.9 284.4Q1016.2 308.1 966.5 375.3Q1022.4 319.8 1083.9 284.4ZM1064.4 283.2Q1005.2 303.7 961.7 362.3Q1010.6 314.0 1064.4 283.2ZM1044.8 281.6Q1000.7 296.7 968.1 340.2Q1004.6 304.4 1044.8 281.6ZM1025.2 279.6Q994.2 284.7 970.5 310.0Q996.0 290.2 1025.2 279.6ZM1005.5 277.1Q991.9 280.4 981.6 292.5Q992.9 282.8 1005.5 277.1ZM985.8 274.2Q985.8 274.2 985.8 274.2Q985.8 274.2 985.8 274.2Z"></path>
                <path fill="#1DA97A" d="M1460.4 213.6Q1415.6 186.1 1375.6 197.2Q1411.9 194.6 1460.4 213.6ZM1442.2 221.4Q1386.5 183.7 1336.3 195.5Q1381.4 194.3 1442.2 221.4ZM1423.9 228.7Q1349.3 181.5 1282.5 199.1Q1342.9 195.6 1423.9 228.7ZM1405.5 235.6Q1326.8 186.8 1256.5 206.0Q1320.3 201.7 1405.5 235.6ZM1387.1 242.1Q1301.8 184.2 1224.8 202.3Q1293.9 200.5 1387.1 242.1ZM1368.6 248.1Q1273.8 194.0 1189.8 219.9Q1266.8 211.9 1368.6 248.1ZM1350.1 253.6Q1252.1 192.8 1164.5 216.7Q1243.9 211.3 1350.1 253.6ZM1331.5 258.7Q1227.0 188.1 1132.7 210.3Q1217.3 208.0 1331.5 258.7ZM1312.8 263.3Q1210.3 199.7 1118.7 224.6Q1201.8 219.1 1312.8 263.3ZM1294.1 267.6Q1192.0 203.2 1100.5 227.5Q1183.3 222.5 1294.1 267.6ZM1275.3 271.3Q1171.6 205.6 1078.8 230.1Q1162.8 225.3 1275.3 271.3ZM1256.4 274.6Q1168.8 205.6 1088.1 219.0Q1158.9 222.4 1256.4 274.6ZM1237.5 277.5Q1137.7 211.4 1047.7 233.4Q1128.6 230.4 1237.5 277.5ZM1218.5 279.9Q1132.2 205.0 1051.7 214.7Q1121.3 221.7 1218.5 279.9ZM1199.5 281.9Q1108.9 200.8 1023.9 209.8Q1097.0 218.4 1199.5 281.9ZM1180.4 283.4Q1087.5 215.6 1003.0 232.6Q1078.0 233.4 1180.4 283.4ZM1161.2 284.5Q1085.5 215.1 1014.3 221.7Q1075.3 229.8 1161.2 284.5ZM1141.9 285.1Q1075.0 225.4 1012.3 232.1Q1066.3 238.4 1141.9 285.1ZM1122.7 285.3Q1059.7 234.6 1001.6 243.6Q1052.4 246.7 1122.7 285.3ZM1103.3 285.1Q1048.8 233.3 997.3 237.2Q1041.2 243.9 1103.3 285.1ZM1083.9 284.4Q1024.3 237.4 969.4 246.5Q1017.6 248.8 1083.9 284.4ZM1064.4 283.2Q1013.0 241.3 965.5 248.4Q1007.0 251.2 1064.4 283.2ZM1044.8 281.6Q1007.2 249.5 972.2 253.9Q1002.6 256.7 1044.8 281.6ZM1025.2 279.6Q999.9 258.5 976.4 261.8Q996.8 263.4 1025.2 279.6ZM1005.5 277.1Q995.2 266.4 985.2 266.8Q993.6 268.4 1005.5 277.1ZM985.8 274.2Q985.8 274.2 985.8 274.2Q985.8 274.2 985.8 274.2Z"></path>
                <path fill="none" stroke="#0F5E45" strokeWidth="3.1" strokeLinecap="round" d="M1490.0 200.0Q1244.1 318.6 975.1 272.4"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "720.0px 905.0px", "--a": "0.6deg", animationDuration: "9.0s", animationDelay: "-3.0s" }}>
                <path fill="#0F5E45" d="M-24.9 905.0Q-13.9 811.0 -6.7 748.4Q-8.2 818.9 -6.1 905.0ZM-19.3 905.0Q-6.1 779.5 6.7 695.8Q-1.9 790.0 -5.3 905.0ZM0.6 905.0Q23.6 831.9 50.3 783.2Q28.3 838.0 16.3 905.0ZM9.8 905.0Q11.5 795.9 8.3 723.2Q15.1 805.0 21.5 905.0ZM26.4 905.0Q40.0 847.5 54.1 809.2Q43.8 852.3 38.9 905.0ZM35.5 905.0Q47.2 780.1 56.4 696.9Q52.2 790.6 52.2 905.0ZM46.6 905.0Q39.4 850.9 22.9 814.8Q42.9 855.4 58.1 905.0ZM59.0 905.0Q67.1 819.9 69.7 763.1Q72.7 827.0 77.9 905.0ZM70.0 905.0Q79.1 834.6 87.6 787.7Q82.2 840.5 80.2 905.0ZM79.2 905.0Q70.0 825.4 49.4 772.4Q74.1 832.1 92.7 905.0ZM95.0 905.0Q103.8 809.0 111.0 745.0Q107.5 817.0 107.1 905.0ZM108.6 905.0Q101.3 816.8 80.7 758.0Q107.1 824.2 128.0 905.0ZM118.0 905.0Q112.3 840.2 95.6 797.1Q117.2 845.6 134.4 905.0ZM139.8 905.0Q139.8 794.7 133.5 721.1Q143.6 803.9 152.5 905.0ZM141.5 905.0Q149.8 804.6 155.6 737.6Q153.9 812.9 155.0 905.0ZM159.6 905.0Q184.1 819.0 212.1 761.7Q189.3 826.2 177.0 905.0ZM168.3 905.0Q149.1 785.9 112.6 706.6Q153.7 795.9 183.6 905.0ZM181.4 905.0Q173.9 833.9 153.7 786.5Q179.2 839.8 199.2 905.0ZM192.3 905.0Q216.1 811.3 246.2 748.9Q219.6 819.1 203.7 905.0ZM204.5 905.0Q211.4 807.2 213.5 742.0Q216.3 815.4 220.9 905.0ZM226.0 905.0Q225.3 838.4 217.7 794.0Q229.2 844.0 239.0 905.0ZM227.2 905.0Q249.6 787.0 274.7 708.3Q254.8 796.8 244.3 905.0ZM240.4 905.0Q259.4 790.2 280.5 713.7Q263.8 799.8 255.0 905.0ZM263.4 905.0Q256.8 818.4 241.3 760.7Q260.1 825.6 274.5 905.0ZM266.5 905.0Q269.2 848.2 264.4 810.3Q274.4 852.9 284.0 905.0ZM286.9 905.0Q303.3 790.1 321.6 713.6Q307.1 799.7 299.6 905.0ZM296.4 905.0Q314.0 819.6 332.7 762.7Q318.5 826.7 311.6 905.0ZM306.9 905.0Q333.5 804.8 367.4 738.0Q337.2 813.1 319.1 905.0ZM326.6 905.0Q325.4 849.9 317.4 813.2Q329.1 854.5 339.0 905.0ZM337.0 905.0Q356.3 783.0 378.6 701.6Q360.3 793.1 350.2 905.0ZM348.1 905.0Q346.3 827.3 334.0 775.6Q352.0 833.8 367.2 905.0ZM357.2 905.0Q373.1 801.1 387.1 731.9Q379.1 809.8 377.0 905.0ZM368.3 905.0Q386.3 790.5 404.0 714.2Q391.9 800.1 386.9 905.0ZM383.1 905.0Q391.8 798.8 398.4 728.0Q395.8 807.7 396.2 905.0ZM389.8 905.0Q378.0 806.2 350.7 740.3Q383.8 814.4 409.0 905.0ZM401.4 905.0Q398.8 849.1 385.4 811.8Q404.6 853.7 420.7 905.0ZM420.7 905.0Q410.7 840.8 390.6 798.0Q413.8 846.1 431.1 905.0ZM433.8 905.0Q449.9 805.4 465.4 738.9Q455.1 813.7 451.2 905.0ZM438.3 905.0Q439.4 808.5 432.0 744.1Q444.9 816.5 456.5 905.0ZM459.5 905.0Q443.1 786.8 409.0 708.0Q448.7 796.7 478.2 905.0ZM476.4 905.0Q458.9 783.0 426.5 701.7Q462.5 793.2 488.5 905.0ZM476.2 905.0Q492.6 848.5 508.2 810.9Q498.0 853.2 494.3 905.0ZM497.5 905.0Q509.6 791.6 521.4 716.0Q513.5 801.0 510.4 905.0ZM504.0 905.0Q516.1 844.0 528.3 803.3Q519.7 849.0 516.0 905.0ZM518.8 905.0Q504.9 820.5 477.8 764.1Q508.7 827.5 531.3 905.0ZM530.5 905.0Q529.2 799.5 520.8 729.1Q533.2 808.3 543.7 905.0ZM549.6 905.0Q570.9 814.7 594.7 754.6Q575.7 822.3 565.8 905.0ZM550.0 905.0Q554.7 821.3 552.7 765.4Q560.0 828.2 567.8 905.0ZM569.1 905.0Q575.8 800.3 579.8 730.4Q579.4 809.0 581.2 905.0ZM587.9 905.0Q601.6 844.5 616.3 804.1Q605.1 849.5 599.6 905.0ZM586.0 905.0Q602.3 836.5 616.8 790.8Q608.2 842.2 605.8 905.0ZM599.4 905.0Q606.2 815.7 607.5 756.1Q611.6 823.1 617.3 905.0ZM613.8 905.0Q614.7 815.4 607.0 755.7Q620.2 822.9 632.1 905.0ZM630.2 905.0Q622.8 783.0 605.5 701.7Q626.4 793.2 642.4 905.0ZM645.8 905.0Q636.0 815.1 613.1 755.2Q640.9 822.6 662.2 905.0ZM650.1 905.0Q667.4 794.3 684.5 720.5Q672.8 803.5 667.9 905.0ZM671.0 905.0Q672.9 825.4 668.8 772.3Q677.1 832.0 685.0 905.0ZM688.5 905.0Q703.5 844.8 720.9 804.7Q706.6 849.8 698.7 905.0ZM690.3 905.0Q710.0 832.0 732.0 783.4Q714.5 838.1 705.3 905.0ZM705.0 905.0Q696.2 787.4 675.8 708.9Q700.6 797.2 719.6 905.0ZM718.4 905.0Q737.7 796.7 758.6 724.5Q742.7 805.7 734.8 905.0ZM727.6 905.0Q722.5 827.5 705.7 775.8Q728.1 833.9 746.1 905.0ZM745.8 905.0Q735.0 797.6 711.6 726.0Q739.3 806.5 760.2 905.0ZM759.5 905.0Q748.6 809.3 725.1 745.5Q753.0 817.3 774.1 905.0ZM774.1 905.0Q769.0 833.9 755.0 786.4Q773.0 839.8 787.1 905.0ZM785.1 905.0Q771.2 790.3 744.6 713.8Q774.7 799.8 796.6 905.0ZM792.0 905.0Q797.5 827.5 799.8 775.8Q800.9 833.9 803.6 905.0ZM802.6 905.0Q824.5 837.4 848.7 792.3Q829.7 843.0 819.9 905.0ZM814.0 905.0Q796.6 781.7 763.6 699.5Q800.8 792.0 827.9 905.0ZM836.8 905.0Q854.6 793.8 874.2 719.6Q858.9 803.0 851.1 905.0ZM840.9 905.0Q827.4 805.1 801.1 738.4Q831.0 813.4 853.0 905.0ZM852.7 905.0Q857.2 848.6 855.0 810.9Q862.6 853.3 870.6 905.0ZM870.5 905.0Q881.9 815.0 891.7 754.9Q886.3 822.5 885.1 905.0ZM874.9 905.0Q877.5 807.5 872.8 742.6Q882.7 815.7 892.3 905.0ZM896.5 905.0Q906.4 820.0 912.6 763.4Q911.7 827.1 914.0 905.0ZM902.4 905.0Q917.3 834.5 930.1 787.6Q922.9 840.4 921.2 905.0ZM920.1 905.0Q944.0 800.6 971.4 731.0Q949.0 809.3 936.9 905.0ZM931.2 905.0Q930.2 818.3 920.4 760.5Q935.0 825.5 947.5 905.0ZM936.7 905.0Q954.6 820.8 973.0 764.7Q959.8 827.8 953.8 905.0ZM956.8 905.0Q960.1 833.0 957.7 785.0Q964.4 839.0 971.4 905.0ZM966.8 905.0Q981.3 821.5 993.5 765.9Q987.1 828.5 986.1 905.0ZM976.6 905.0Q995.3 803.9 1016.4 736.5Q999.5 812.3 990.5 905.0ZM992.0 905.0Q971.4 780.8 932.8 698.0Q976.0 791.2 1007.4 905.0ZM1000.6 905.0Q1029.4 794.7 1064.9 721.2Q1033.9 803.9 1015.8 905.0ZM1011.3 905.0Q1020.0 809.6 1024.5 746.1Q1025.2 817.6 1028.5 905.0ZM1029.7 905.0Q1051.1 805.0 1075.7 738.3Q1055.7 813.3 1044.9 905.0ZM1040.1 905.0Q1030.3 782.7 1007.2 701.2Q1035.3 792.9 1056.9 905.0ZM1050.8 905.0Q1039.5 796.1 1012.7 723.5Q1045.5 805.2 1070.6 905.0ZM1065.7 905.0Q1065.2 846.9 1057.4 808.2Q1069.4 851.8 1079.7 905.0ZM1072.6 905.0Q1076.2 820.9 1073.3 764.8Q1081.3 827.9 1089.5 905.0ZM1088.8 905.0Q1086.4 831.9 1074.1 783.2Q1091.6 838.0 1106.3 905.0ZM1108.0 905.0Q1103.2 813.1 1086.9 751.8Q1108.6 820.7 1126.1 905.0ZM1114.0 905.0Q1109.1 835.7 1092.9 789.6Q1114.5 841.5 1131.8 905.0ZM1132.5 905.0Q1137.4 805.3 1136.8 738.9Q1142.0 813.6 1148.2 905.0ZM1137.6 905.0Q1135.7 781.6 1124.6 699.3Q1140.6 791.9 1154.0 905.0ZM1158.9 905.0Q1162.4 792.2 1161.1 717.1Q1166.2 801.6 1171.8 905.0ZM1167.8 905.0Q1183.0 842.0 1199.1 800.0Q1187.1 847.2 1181.3 905.0ZM1184.3 905.0Q1185.1 831.7 1180.0 782.9Q1188.9 837.8 1196.9 905.0ZM1189.3 905.0Q1180.6 837.6 1158.8 792.7Q1185.7 843.2 1206.5 905.0ZM1201.2 905.0Q1200.5 833.4 1192.1 785.6Q1205.0 839.3 1216.0 905.0ZM1216.0 905.0Q1228.9 805.1 1241.4 738.5Q1233.0 813.4 1229.7 905.0ZM1232.1 905.0Q1215.6 789.5 1181.6 712.5Q1221.1 799.1 1250.4 905.0ZM1244.3 905.0Q1233.1 794.5 1207.1 720.9Q1238.6 803.8 1262.6 905.0ZM1252.8 905.0Q1248.1 849.9 1231.2 813.2Q1254.0 854.5 1272.4 905.0ZM1269.6 905.0Q1260.8 833.0 1241.8 785.0Q1264.2 839.0 1281.0 905.0ZM1276.9 905.0Q1273.7 795.1 1263.0 721.8Q1277.1 804.3 1288.4 905.0ZM1293.7 905.0Q1284.1 794.0 1260.2 720.0Q1289.7 803.2 1312.6 905.0ZM1302.6 905.0Q1318.8 794.7 1333.7 721.2Q1324.5 803.9 1321.5 905.0ZM1318.2 905.0Q1308.8 790.6 1286.3 714.3Q1313.9 800.1 1335.1 905.0ZM1326.6 905.0Q1331.0 797.6 1328.3 726.0Q1336.7 806.5 1345.4 905.0ZM1343.0 905.0Q1338.5 832.0 1326.1 783.3Q1341.9 838.0 1354.4 905.0ZM1354.7 905.0Q1358.4 846.8 1358.2 808.0Q1361.8 851.6 1366.1 905.0ZM1363.5 905.0Q1372.6 815.1 1377.0 755.2Q1378.2 822.6 1382.2 905.0ZM1371.6 905.0Q1376.2 790.5 1375.2 714.1Q1380.9 800.0 1387.3 905.0ZM1392.7 905.0Q1391.7 790.5 1383.1 714.1Q1396.0 800.0 1406.9 905.0ZM1407.6 905.0Q1417.9 845.6 1425.3 806.0Q1422.9 850.5 1424.0 905.0ZM1407.4 905.0Q1423.4 807.1 1437.9 741.8Q1429.2 815.3 1426.7 905.0ZM1425.7 905.0Q1432.2 780.3 1434.6 697.2Q1436.7 790.7 1440.5 905.0ZM1444.2 905.0Q1456.5 848.6 1466.7 810.9Q1461.3 853.3 1460.5 905.0ZM1450.7 905.0Q1449.3 789.0 1439.9 711.6Q1453.8 798.6 1465.4 905.0Z"></path>
                <path fill="#157E5C" d="M-26.9 905.0Q-31.6 827.4 -45.9 775.6Q-27.3 833.9 -12.5 905.0ZM-13.8 905.0Q1.4 839.1 17.8 795.1Q5.3 844.6 -0.9 905.0ZM4.7 905.0Q9.9 847.2 11.3 808.7Q13.7 852.0 17.4 905.0ZM11.9 905.0Q25.4 816.4 36.8 757.3Q30.8 823.7 29.8 905.0ZM24.4 905.0Q25.7 851.9 19.8 816.5Q30.5 856.3 40.2 905.0ZM40.9 905.0Q31.0 826.7 7.5 774.4Q36.1 833.2 58.1 905.0ZM59.6 905.0Q51.0 839.5 31.7 795.9Q54.9 845.0 72.6 905.0ZM61.1 905.0Q76.6 858.7 91.9 827.9Q81.4 862.6 77.2 905.0ZM82.5 905.0Q103.9 826.4 128.1 774.0Q108.8 832.9 98.6 905.0ZM95.6 905.0Q108.4 835.2 119.6 788.6Q113.2 841.0 111.6 905.0ZM110.7 905.0Q120.2 857.5 127.2 825.9Q124.6 861.5 125.2 905.0ZM127.3 905.0Q125.3 863.5 117.1 835.9Q128.4 867.0 137.7 905.0ZM139.4 905.0Q151.1 819.6 161.7 762.7Q155.2 826.8 153.1 905.0ZM154.1 905.0Q161.4 826.5 166.1 774.2Q165.2 833.1 166.7 905.0ZM160.6 905.0Q161.3 846.2 155.3 807.0Q165.6 851.1 174.9 905.0ZM177.5 905.0Q165.8 818.6 140.5 761.0Q170.5 825.8 193.2 905.0ZM183.8 905.0Q196.3 862.6 207.1 834.3Q201.0 866.1 199.6 905.0ZM208.9 905.0Q200.8 844.9 181.8 804.8Q205.0 849.9 222.8 905.0ZM218.1 905.0Q243.5 818.4 274.1 760.6Q247.9 825.6 232.9 905.0ZM230.9 905.0Q238.5 863.5 243.9 835.8Q242.2 866.9 243.0 905.0ZM239.0 905.0Q237.2 868.2 226.1 843.6Q242.2 871.2 255.8 905.0ZM251.2 905.0Q241.8 816.8 218.2 758.0Q247.4 824.2 269.9 905.0ZM268.1 905.0Q276.8 868.0 283.7 843.4Q280.5 871.1 280.5 905.0ZM286.2 905.0Q283.6 858.9 270.9 828.1Q289.0 862.7 304.0 905.0ZM303.0 905.0Q316.2 822.8 330.5 768.0Q319.4 829.7 313.9 905.0ZM311.3 905.0Q317.7 830.7 317.6 781.2Q323.5 836.9 330.7 905.0ZM325.0 905.0Q338.0 816.9 352.4 758.2Q341.0 824.3 335.1 905.0ZM335.4 905.0Q350.2 833.9 367.1 786.4Q353.5 839.8 346.2 905.0ZM348.6 905.0Q344.3 829.6 328.5 779.4Q349.9 835.9 367.2 905.0ZM365.7 905.0Q369.6 865.8 367.5 839.6Q374.3 869.0 381.5 905.0ZM377.6 905.0Q372.8 832.4 356.5 784.1Q378.2 838.5 395.6 905.0ZM392.2 905.0Q402.1 834.2 410.0 787.0Q406.4 840.1 406.4 905.0ZM404.2 905.0Q427.6 826.5 453.8 774.2Q433.0 833.1 422.0 905.0ZM419.0 905.0Q416.3 853.2 402.3 818.7Q422.2 857.5 438.7 905.0ZM436.1 905.0Q436.2 824.3 428.3 770.5Q441.0 831.0 452.1 905.0ZM454.4 905.0Q463.5 824.1 470.5 770.2Q467.4 830.9 467.5 905.0ZM459.5 905.0Q461.4 821.0 455.9 765.1Q466.5 828.0 476.4 905.0ZM477.2 905.0Q494.4 820.6 513.9 764.3Q498.3 827.6 490.0 905.0ZM482.1 905.0Q486.6 854.8 485.4 821.3Q491.3 859.0 497.9 905.0ZM504.2 905.0Q493.6 821.1 468.5 765.1Q499.1 828.1 522.5 905.0ZM520.5 905.0Q528.4 822.2 533.8 767.0Q532.2 829.1 533.2 905.0ZM531.3 905.0Q545.9 825.4 558.1 772.4Q551.6 832.1 550.5 905.0ZM539.5 905.0Q547.7 864.4 551.0 837.3Q553.0 867.8 557.4 905.0ZM554.1 905.0Q574.4 828.5 598.8 777.5Q578.1 834.9 566.4 905.0ZM572.7 905.0Q576.3 832.4 575.8 784.0Q580.0 838.5 584.7 905.0ZM580.8 905.0Q597.0 828.4 614.1 777.4Q601.4 834.8 595.4 905.0ZM593.5 905.0Q608.5 825.4 624.9 772.4Q612.2 832.1 605.8 905.0ZM611.5 905.0Q632.8 820.6 657.1 764.3Q637.3 827.6 626.7 905.0ZM625.5 905.0Q620.4 837.2 606.9 792.0Q624.0 842.8 637.4 905.0ZM633.7 905.0Q635.2 831.1 629.7 781.9Q639.9 837.3 649.3 905.0ZM652.5 905.0Q646.2 841.1 631.6 798.5Q649.3 846.4 663.0 905.0ZM670.3 905.0Q666.5 848.8 652.6 811.3Q671.4 853.5 686.6 905.0ZM682.8 905.0Q690.2 860.6 694.5 830.9Q694.2 864.3 696.2 905.0ZM689.9 905.0Q689.8 867.9 679.7 843.1Q695.8 871.0 709.8 905.0ZM711.3 905.0Q718.3 842.7 722.5 801.2Q722.1 847.9 723.9 905.0ZM721.3 905.0Q740.7 846.0 760.9 806.7Q746.0 850.9 739.0 905.0ZM739.0 905.0Q733.0 817.0 718.9 758.3Q736.2 824.3 749.4 905.0ZM745.1 905.0Q740.4 859.2 728.1 828.7Q743.6 863.1 755.6 905.0ZM758.5 905.0Q764.6 822.0 764.2 766.6Q770.5 828.9 777.9 905.0ZM779.0 905.0Q786.4 865.5 790.5 839.2Q790.6 868.8 793.0 905.0ZM782.3 905.0Q778.6 817.2 765.2 758.7Q783.3 824.5 797.9 905.0ZM803.0 905.0Q815.5 817.4 827.3 758.9Q819.7 824.7 816.9 905.0ZM811.3 905.0Q828.9 860.4 845.5 830.6Q834.9 864.1 831.2 905.0ZM825.3 905.0Q826.4 866.9 821.2 841.5Q830.4 870.1 838.8 905.0ZM848.6 905.0Q866.1 820.2 887.2 763.6Q869.3 827.2 859.1 905.0ZM856.1 905.0Q869.1 830.7 878.7 781.1Q875.1 836.9 875.9 905.0ZM861.1 905.0Q874.1 861.2 883.8 832.0Q879.9 864.8 880.5 905.0ZM883.1 905.0Q892.3 852.9 897.4 818.1Q897.6 857.2 900.6 905.0ZM892.9 905.0Q891.4 851.5 883.4 815.8Q894.8 856.0 904.2 905.0ZM910.9 905.0Q910.0 859.9 902.9 829.8Q913.4 863.7 922.4 905.0ZM926.6 905.0Q935.1 868.3 941.9 843.9Q938.7 871.4 938.6 905.0ZM928.8 905.0Q925.3 818.9 910.4 761.5Q931.1 826.1 948.1 905.0ZM954.8 905.0Q946.4 821.0 926.7 765.0Q950.8 828.0 969.3 905.0ZM958.2 905.0Q978.5 818.8 1000.8 761.4Q983.4 826.0 974.5 905.0ZM976.8 905.0Q990.9 850.7 1004.7 814.4Q995.3 855.2 991.6 905.0ZM994.6 905.0Q993.2 861.3 985.7 832.2Q996.3 864.9 1005.2 905.0ZM1005.1 905.0Q1001.7 839.1 987.2 795.2Q1007.3 844.6 1023.8 905.0ZM1016.3 905.0Q1012.1 846.8 999.3 807.9Q1015.9 851.6 1029.1 905.0ZM1035.7 905.0Q1033.3 850.9 1022.2 814.9Q1037.8 855.4 1050.6 905.0ZM1040.6 905.0Q1033.2 820.2 1012.3 763.7Q1039.2 827.3 1060.4 905.0ZM1054.9 905.0Q1066.3 820.7 1077.5 764.4Q1070.0 827.7 1067.0 905.0ZM1073.5 905.0Q1072.5 853.5 1065.0 819.2Q1076.1 857.8 1085.6 905.0ZM1082.1 905.0Q1110.6 815.5 1143.8 755.8Q1116.4 822.9 1101.4 905.0ZM1096.9 905.0Q1110.6 853.4 1126.0 819.0Q1113.8 857.7 1107.4 905.0ZM1118.2 905.0Q1133.8 853.1 1152.2 818.6Q1136.9 857.5 1128.3 905.0ZM1132.8 905.0Q1127.7 850.6 1115.0 814.3Q1130.7 855.1 1142.8 905.0ZM1144.5 905.0Q1140.8 840.6 1128.1 797.6Q1145.1 845.9 1158.9 905.0ZM1160.5 905.0Q1166.7 857.2 1170.2 825.4Q1170.1 861.2 1171.9 905.0ZM1165.0 905.0Q1177.5 827.4 1190.2 775.7Q1181.1 833.9 1177.0 905.0ZM1175.9 905.0Q1184.0 864.3 1188.5 837.1Q1188.4 867.7 1190.9 905.0ZM1190.8 905.0Q1200.1 857.9 1205.5 826.5Q1205.2 861.8 1207.8 905.0ZM1214.0 905.0Q1208.9 837.5 1195.9 792.5Q1212.1 843.1 1224.7 905.0ZM1226.7 905.0Q1236.9 847.0 1247.0 808.3Q1240.1 851.8 1237.2 905.0ZM1237.2 905.0Q1253.2 850.9 1268.1 814.8Q1258.8 855.4 1255.8 905.0ZM1248.9 905.0Q1261.8 868.2 1273.9 843.6Q1266.3 871.2 1263.6 905.0ZM1265.2 905.0Q1265.2 854.6 1255.9 821.0Q1270.7 858.8 1283.5 905.0ZM1273.9 905.0Q1277.6 860.2 1275.2 830.3Q1282.4 863.9 1289.9 905.0ZM1283.5 905.0Q1288.0 840.9 1287.1 798.2Q1292.5 846.3 1298.7 905.0ZM1296.8 905.0Q1315.2 830.4 1333.6 780.7Q1320.8 836.6 1315.4 905.0ZM1313.3 905.0Q1316.2 830.6 1311.8 781.0Q1321.5 836.8 1330.8 905.0ZM1325.1 905.0Q1348.7 821.9 1376.6 766.4Q1353.1 828.8 1340.0 905.0ZM1346.4 905.0Q1351.6 840.4 1354.4 797.3Q1354.7 845.7 1356.6 905.0ZM1365.0 905.0Q1362.3 856.9 1352.7 824.9Q1365.6 860.9 1376.1 905.0ZM1370.1 905.0Q1356.9 824.9 1331.6 771.5Q1360.2 831.6 1381.0 905.0ZM1386.5 905.0Q1382.4 858.5 1368.3 827.4Q1387.2 862.3 1402.5 905.0ZM1401.1 905.0Q1411.6 840.8 1421.8 797.9Q1414.9 846.1 1412.1 905.0ZM1418.1 905.0Q1406.7 830.3 1384.0 780.5Q1410.1 836.5 1429.3 905.0ZM1427.2 905.0Q1425.2 842.0 1416.6 799.9Q1428.5 847.2 1438.4 905.0ZM1436.0 905.0Q1445.3 861.6 1449.9 832.7Q1450.9 865.2 1454.6 905.0ZM1449.9 905.0Q1462.3 838.1 1475.0 793.4Q1465.8 843.6 1461.6 905.0Z"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "-90.0px 930.0px", "--a": "3.0deg", animationDuration: "7.4s", animationDelay: "-3.2s" }}>
                <path fill="#4E9410" d="M-60.1 917.1Q-36.3 858.4 -26.2 837.7Q-46.6 855.0 -60.1 917.1ZM-42.1 908.8Q-13.3 840.0 -0.8 815.7Q-25.4 835.8 -42.1 908.8ZM-24.4 900.1Q11.0 821.1 27.3 793.3Q-2.9 815.9 -24.4 900.1ZM-7.0 891.1Q26.2 801.4 39.1 769.8Q10.5 796.8 -7.0 891.1ZM10.1 881.7Q52.1 784.9 70.9 750.9Q35.0 778.8 10.1 881.7ZM26.9 872.0Q75.5 759.1 97.2 719.4Q55.6 752.0 26.9 872.0ZM43.5 861.9Q86.6 763.4 106.1 728.8Q69.2 757.1 43.5 861.9ZM59.7 851.5Q103.2 725.9 118.7 681.5Q81.2 720.0 59.7 851.5ZM75.6 840.7Q118.1 720.2 133.7 677.7Q97.0 714.4 75.6 840.7ZM91.3 829.6Q128.1 721.2 140.9 682.9Q109.1 716.2 91.3 829.6ZM106.7 818.1Q148.6 713.1 166.0 676.1Q130.1 707.1 106.7 818.1ZM121.8 806.4Q163.9 681.8 178.5 637.9Q142.1 676.2 121.8 806.4ZM136.5 794.2Q181.2 672.1 198.2 629.0Q159.7 666.0 136.5 794.2ZM151.1 781.7Q178.8 677.3 185.0 640.6Q160.6 673.9 151.1 781.7ZM165.3 768.9Q199.1 654.3 208.7 613.9Q179.1 649.9 165.3 768.9ZM179.2 755.7Q207.7 639.1 212.6 598.2Q187.4 635.7 179.2 755.7ZM192.8 742.2Q226.2 642.7 237.7 607.5Q208.8 638.2 192.8 742.2ZM206.2 728.3Q231.6 638.1 238.1 606.3Q215.9 634.9 206.2 728.3ZM219.2 714.1Q244.4 634.6 252.4 606.5Q230.5 631.2 219.2 714.1ZM232.0 699.5Q251.1 619.4 254.1 591.3Q237.2 617.2 232.0 699.5ZM244.4 684.6Q257.6 612.5 257.1 587.4Q245.2 611.2 244.4 684.6ZM256.6 669.4Q268.7 613.0 269.6 593.3Q258.9 611.7 256.6 669.4ZM268.5 653.8Q276.2 606.2 275.0 589.7Q268.0 605.5 268.5 653.8ZM280.1 637.9Q288.1 602.4 289.0 590.0Q282.0 601.5 280.1 637.9ZM291.4 621.6Q293.8 607.0 293.4 601.9Q291.3 606.8 291.4 621.6ZM302.5 604.9Q302.5 604.9 302.5 604.9Q302.5 604.9 302.5 604.9Z"></path>
                <path fill="#72C514" d="M-60.1 917.1Q-8.6 944.6 37.8 988.6Q-3.9 934.8 -60.1 917.1ZM-42.1 908.8Q20.2 938.0 75.7 987.1Q25.2 926.3 -42.1 908.8ZM-24.4 900.1Q48.8 932.5 113.8 988.1Q54.3 918.7 -24.4 900.1ZM-7.0 891.1Q78.4 915.5 152.0 967.0Q82.4 899.6 -7.0 891.1ZM10.1 881.7Q102.1 914.9 182.5 977.2Q107.7 897.7 10.1 881.7ZM26.9 872.0Q136.7 904.2 231.3 971.1Q141.9 883.8 26.9 872.0ZM43.5 861.9Q141.9 882.4 225.3 934.4Q145.1 864.2 43.5 861.9ZM59.7 851.5Q183.3 867.7 286.4 924.1Q185.5 845.0 59.7 851.5ZM75.6 840.7Q194.9 853.7 294.0 905.9Q196.6 831.9 75.6 840.7ZM91.3 829.6Q198.6 838.3 287.3 882.5Q199.6 818.7 91.3 829.6ZM106.7 818.1Q213.7 818.3 300.7 855.2Q213.1 798.9 106.7 818.1ZM121.8 806.4Q245.0 815.7 346.8 866.0Q246.1 793.2 121.8 806.4ZM136.5 794.2Q259.1 798.0 359.4 843.2Q259.1 775.7 136.5 794.2ZM151.1 781.7Q253.2 777.5 335.5 809.1Q251.9 759.1 151.1 781.7ZM165.3 768.9Q278.0 754.2 367.3 781.1Q274.8 734.0 165.3 768.9ZM179.2 755.7Q292.5 742.2 382.4 770.2Q289.4 721.9 179.2 755.7ZM192.8 742.2Q291.4 724.1 368.7 743.6Q287.6 706.5 192.8 742.2ZM206.2 728.3Q293.4 707.3 360.9 721.0Q289.1 691.8 206.2 728.3ZM219.2 714.1Q297.0 695.6 357.2 708.0Q293.2 681.8 219.2 714.1ZM232.0 699.5Q307.3 675.0 364.5 682.4Q302.5 661.8 232.0 699.5ZM244.4 684.6Q310.4 659.2 359.9 663.1Q305.5 647.7 244.4 684.6ZM256.6 669.4Q308.2 648.6 346.8 651.0Q304.2 639.6 256.6 669.4ZM268.5 653.8Q311.0 634.5 342.4 635.1Q307.3 627.1 268.5 653.8ZM280.1 637.9Q312.6 624.9 337.0 626.4Q310.1 619.2 280.1 637.9ZM291.4 621.6Q304.4 615.5 313.9 615.5Q303.2 613.2 291.4 621.6ZM302.5 604.9Q302.5 604.9 302.5 604.9Q302.5 604.9 302.5 604.9Z"></path>
                <path fill="none" stroke="#2F5E0A" strokeWidth="3.1" strokeLinecap="round" d="M-90.0 930.0Q162.7 826.6 308.3 595.8"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "1530.0px 940.0px", "--a": "3.0deg", animationDuration: "7.9s", animationDelay: "-4.8s" }}>
                <path fill="#4E9410" d="M1500.1 927.1Q1449.0 941.9 1411.0 989.6Q1453.1 950.8 1500.1 927.1ZM1482.1 918.8Q1412.3 932.5 1359.2 991.4Q1416.7 944.8 1482.1 918.8ZM1464.4 910.1Q1390.0 918.9 1332.4 976.5Q1393.6 932.1 1464.4 910.1ZM1447.0 901.1Q1360.0 912.7 1292.9 981.2Q1364.5 928.1 1447.0 901.1ZM1429.9 891.7Q1334.6 903.5 1261.0 977.7Q1339.4 920.4 1429.9 891.7ZM1413.1 882.0Q1301.4 895.3 1215.0 981.7Q1306.9 915.1 1413.1 882.0ZM1396.5 871.9Q1277.1 881.7 1183.9 970.3Q1282.1 903.0 1396.5 871.9ZM1380.3 861.5Q1267.4 855.9 1176.9 927.1Q1269.4 876.2 1380.3 861.5ZM1364.4 850.7Q1256.2 837.9 1168.2 900.2Q1256.8 857.5 1364.4 850.7ZM1348.7 839.6Q1224.1 831.0 1123.8 907.6Q1225.9 853.5 1348.7 839.6ZM1333.3 828.1Q1218.5 811.4 1124.7 875.1Q1218.6 832.3 1333.3 828.1ZM1318.2 816.4Q1192.8 795.0 1089.8 862.3Q1192.4 817.9 1318.2 816.4ZM1303.5 804.2Q1184.0 775.1 1084.5 832.8Q1182.0 797.0 1303.5 804.2ZM1288.9 791.7Q1179.1 761.4 1087.1 812.0Q1176.7 781.6 1288.9 791.7ZM1274.7 778.9Q1160.8 740.1 1064.0 787.4Q1156.9 761.1 1274.7 778.9ZM1260.8 765.7Q1170.3 735.1 1093.6 772.9Q1167.3 751.8 1260.8 765.7ZM1247.2 752.2Q1152.8 716.6 1072.2 753.5Q1149.0 734.1 1247.2 752.2ZM1233.8 738.3Q1149.4 698.7 1075.9 726.8Q1144.6 714.5 1233.8 738.3ZM1220.8 724.1Q1139.0 687.8 1068.3 716.3Q1134.8 703.1 1220.8 724.1ZM1208.0 709.5Q1136.5 676.5 1074.3 700.7Q1132.5 689.9 1208.0 709.5ZM1195.6 694.6Q1134.3 662.7 1080.6 681.1Q1130.3 674.2 1195.6 694.6ZM1183.4 679.4Q1134.4 647.3 1090.3 658.3Q1130.0 656.6 1183.4 679.4ZM1171.5 663.8Q1129.1 639.3 1091.5 650.6Q1125.9 647.3 1171.5 663.8ZM1159.9 647.9Q1132.3 628.5 1107.3 633.9Q1129.6 633.7 1159.9 647.9ZM1148.6 631.6Q1137.4 622.3 1127.0 623.7Q1136.1 624.4 1148.6 631.6ZM1137.5 614.9Q1137.5 614.9 1137.5 614.9Q1137.5 614.9 1137.5 614.9Z"></path>
                <path fill="#72C514" d="M1500.1 927.1Q1485.2 871.8 1464.8 857.2Q1476.1 875.4 1500.1 927.1ZM1482.1 918.8Q1464.2 844.7 1438.5 824.5Q1451.9 849.0 1482.1 918.8ZM1464.4 910.1Q1446.0 832.3 1419.1 811.0Q1433.0 836.8 1464.4 910.1ZM1447.0 901.1Q1428.6 809.1 1399.5 783.1Q1413.2 813.8 1447.0 901.1ZM1429.9 891.7Q1416.3 789.9 1389.6 759.5Q1399.2 794.0 1429.9 891.7ZM1413.1 882.0Q1385.2 765.2 1344.8 733.4Q1365.8 772.0 1413.1 882.0ZM1396.5 871.9Q1372.6 746.4 1334.0 710.6Q1351.7 752.6 1396.5 871.9ZM1380.3 861.5Q1358.9 743.8 1323.5 710.0Q1339.2 749.5 1380.3 861.5ZM1364.4 850.7Q1341.6 738.3 1305.9 706.5Q1322.9 744.1 1364.4 850.7ZM1348.7 839.6Q1322.4 710.3 1281.4 673.9Q1300.9 717.1 1348.7 839.6ZM1333.3 828.1Q1318.4 707.0 1287.6 670.5Q1298.0 711.6 1333.3 828.1ZM1318.2 816.4Q1305.6 683.3 1274.9 642.3Q1283.2 687.6 1318.2 816.4ZM1303.5 804.2Q1291.1 676.1 1261.4 636.8Q1269.5 680.4 1303.5 804.2ZM1288.9 791.7Q1279.2 673.1 1253.1 636.3Q1259.2 676.7 1288.9 791.7ZM1274.7 778.9Q1254.8 655.2 1219.7 619.0Q1234.1 660.7 1274.7 778.9ZM1260.8 765.7Q1254.2 666.5 1233.5 635.3Q1237.4 669.2 1260.8 765.7ZM1247.2 752.2Q1243.8 647.4 1224.9 613.9Q1226.1 649.6 1247.2 752.2ZM1233.8 738.3Q1229.3 641.9 1210.8 611.2Q1213.0 644.2 1233.8 738.3ZM1220.8 724.1Q1212.3 631.8 1191.2 603.4Q1196.8 634.8 1220.8 724.1ZM1208.0 709.5Q1204.9 628.0 1189.8 602.0Q1191.1 629.8 1208.0 709.5ZM1195.6 694.6Q1191.9 623.4 1177.9 600.9Q1179.8 625.2 1195.6 694.6ZM1183.4 679.4Q1182.6 619.2 1172.6 599.8Q1172.3 620.3 1183.4 679.4ZM1171.5 663.8Q1168.9 613.4 1159.1 597.5Q1160.4 614.6 1171.5 663.8ZM1159.9 647.9Q1157.0 613.4 1149.4 602.7Q1151.2 614.5 1159.9 647.9ZM1148.6 631.6Q1147.3 616.8 1144.1 612.2Q1144.8 617.2 1148.6 631.6ZM1137.5 614.9Q1137.5 614.9 1137.5 614.9Q1137.5 614.9 1137.5 614.9Z"></path>
                <path fill="none" stroke="#2F5E0A" strokeWidth="3.1" strokeLinecap="round" d="M1530.0 940.0Q1277.3 836.6 1131.7 605.8"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "-70.0px 380.0px", "--a": "3.0deg", animationDuration: "7.6s", animationDelay: "-5.4s" }}>
                <path fill="#9BD05C" d="M-46.2 385.3Q-12.6 360.2 10.7 355.1Q-17.3 354.5 -46.2 385.3ZM-31.7 388.0Q9.2 360.8 38.1 356.3Q4.1 353.8 -31.7 388.0ZM-17.3 390.4Q39.7 351.8 79.8 345.3Q32.5 342.1 -17.3 390.4ZM-2.9 392.3Q60.9 347.7 105.6 339.5Q52.6 336.8 -2.9 392.3ZM11.4 393.8Q75.0 346.0 119.0 336.0Q66.2 335.2 11.4 393.8ZM25.7 394.9Q94.9 349.7 143.8 342.6Q86.4 337.9 25.7 394.9ZM39.9 395.5Q107.0 338.3 152.3 324.3Q96.5 327.1 39.9 395.5ZM54.1 395.8Q121.5 343.7 167.9 332.4Q111.9 332.3 54.1 395.8ZM68.2 395.7Q141.8 343.3 193.1 333.5Q132.1 330.9 68.2 395.7ZM82.2 395.2Q152.1 338.8 199.8 325.9Q141.7 327.1 82.2 395.2ZM96.2 394.2Q171.7 329.8 222.8 314.1Q159.9 317.2 96.2 394.2ZM110.2 392.9Q179.9 328.0 226.2 310.8Q168.1 316.4 110.2 392.9ZM124.0 391.1Q195.5 326.2 243.1 309.3Q183.6 314.3 124.0 391.1ZM137.9 388.9Q196.7 336.4 236.1 323.0Q187.1 326.6 137.9 388.9ZM151.6 386.4Q218.1 328.4 262.8 314.0Q207.5 317.3 151.6 386.4ZM165.3 383.4Q219.2 326.6 253.9 310.2Q208.9 317.7 165.3 383.4ZM179.0 380.0Q229.5 323.7 261.6 306.8Q219.3 315.4 179.0 380.0ZM192.6 376.2Q238.6 328.9 268.5 315.5Q230.0 321.3 192.6 376.2ZM206.1 372.0Q249.8 326.3 278.0 313.1Q241.5 319.1 206.1 372.0ZM219.6 367.4Q256.9 328.9 281.0 317.9Q249.9 322.7 219.6 367.4ZM233.0 362.3Q263.6 322.1 282.2 309.3Q256.4 317.2 233.0 362.3ZM246.3 356.9Q274.7 324.4 292.5 314.5Q268.8 319.7 246.3 356.9ZM259.6 351.1Q283.6 322.1 298.5 313.1Q278.4 318.2 259.6 351.1ZM272.9 344.8Q289.8 324.8 300.3 318.6Q286.1 322.0 272.9 344.8ZM286.1 338.2Q292.7 329.9 296.8 327.3Q291.2 328.9 286.1 338.2ZM299.2 331.1Q299.2 331.1 299.2 331.1Q299.2 331.1 299.2 331.1Z"></path>
                <path fill="#CBF39D" d="M-46.2 385.3Q-30.1 420.1 -11.0 465.9Q-23.7 416.6 -46.2 385.3ZM-31.7 388.0Q-8.9 427.1 16.2 478.8Q-1.8 422.3 -31.7 388.0ZM-17.3 390.4Q15.2 444.5 50.9 516.4Q25.2 437.7 -17.3 390.4ZM-2.9 392.3Q38.9 450.5 82.7 528.6Q49.5 441.9 -2.9 392.3ZM11.4 393.8Q57.8 450.5 105.0 527.4Q68.1 441.2 11.4 393.8ZM25.7 394.9Q77.0 451.6 128.2 529.3Q87.2 441.4 25.7 394.9ZM39.9 395.5Q95.5 454.7 150.6 536.2Q106.2 443.7 39.9 395.5ZM54.1 395.8Q111.6 449.8 167.4 525.4Q121.2 438.5 54.1 395.8ZM68.2 395.7Q127.7 454.5 186.0 536.1Q138.3 442.7 68.2 395.7ZM82.2 395.2Q147.5 446.9 209.3 521.6Q156.7 434.2 82.2 395.2ZM96.2 394.2Q171.8 447.1 242.0 525.6Q181.1 432.5 96.2 394.2ZM110.2 392.9Q186.2 438.6 255.6 509.2Q194.1 424.0 110.2 392.9ZM124.0 391.1Q198.5 441.1 267.4 516.0Q207.3 426.7 124.0 391.1ZM137.9 388.9Q200.2 427.7 257.5 487.0Q207.0 415.7 137.9 388.9ZM151.6 386.4Q222.8 427.6 287.6 492.0Q230.0 414.0 151.6 386.4ZM165.3 383.4Q234.0 409.3 294.1 456.8Q238.3 396.4 165.3 383.4ZM179.0 380.0Q245.1 405.3 303.1 451.5Q249.4 392.9 179.0 380.0ZM192.6 376.2Q251.0 396.9 301.9 435.9Q254.4 385.9 192.6 376.2ZM206.1 372.0Q261.9 392.2 310.6 430.0Q265.3 381.8 206.1 372.0ZM219.6 367.4Q269.0 378.5 311.0 405.4Q270.8 369.4 219.6 367.4ZM233.0 362.3Q279.4 372.7 318.9 397.8Q281.1 364.1 233.0 362.3ZM246.3 356.9Q286.3 364.9 320.2 385.7Q287.6 357.6 246.3 356.9ZM259.6 351.1Q295.3 353.4 324.8 367.7Q295.6 346.9 259.6 351.1ZM272.9 344.8Q297.9 345.7 318.3 355.0Q297.9 341.1 272.9 344.8ZM286.1 338.2Q296.1 339.1 304.4 343.4Q296.2 337.3 286.1 338.2ZM299.2 331.1Q299.2 331.1 299.2 331.1Q299.2 331.1 299.2 331.1Z"></path>
                <path fill="none" stroke="#5C8F22" strokeWidth="2.2" strokeLinecap="round" d="M-70.0 380.0Q128.7 428.8 306.3 327.1"></path>
              </g>
              <g className="sw" style={{ transformOrigin: "1510.0px 420.0px", "--a": "3.0deg", animationDuration: "7.0s", animationDelay: "-1.7s" }}>
                <path fill="#9BD05C" d="M1486.2 425.3Q1463.3 453.1 1449.9 498.3Q1469.1 456.8 1486.2 425.3ZM1471.7 428.0Q1434.3 466.4 1411.1 531.6Q1442.5 472.4 1471.7 428.0ZM1457.3 430.4Q1418.5 467.2 1393.9 531.5Q1426.4 473.6 1457.3 430.4ZM1442.9 432.3Q1397.9 476.5 1369.7 552.9Q1407.4 483.9 1442.9 432.3ZM1428.6 433.8Q1381.1 479.9 1351.3 559.6Q1391.0 487.6 1428.6 433.8ZM1414.3 434.9Q1351.3 486.9 1310.1 582.1Q1362.7 497.3 1414.3 434.9ZM1400.1 435.5Q1339.9 485.1 1300.5 575.9Q1350.7 495.1 1400.1 435.5ZM1385.9 435.8Q1308.9 479.3 1255.1 573.0Q1319.0 492.4 1385.9 435.8ZM1371.8 435.7Q1302.7 480.2 1255.4 570.2Q1312.8 491.8 1371.8 435.7ZM1357.8 435.2Q1288.4 467.8 1238.9 545.3Q1296.3 479.7 1357.8 435.2ZM1343.8 434.2Q1268.8 466.1 1214.6 546.2Q1276.7 479.0 1343.8 434.2ZM1329.8 432.9Q1253.5 459.6 1197.4 535.3Q1260.5 472.8 1329.8 432.9ZM1316.0 431.1Q1239.8 462.8 1184.7 543.5Q1247.7 475.9 1316.0 431.1ZM1302.1 428.9Q1228.2 456.2 1174.0 531.0Q1235.2 469.0 1302.1 428.9ZM1288.4 426.4Q1215.9 446.5 1161.7 513.4Q1221.5 459.2 1288.4 426.4ZM1274.7 423.4Q1198.1 444.7 1140.9 515.2Q1204.1 458.0 1274.7 423.4ZM1261.0 420.0Q1191.9 427.9 1138.3 481.2Q1195.2 440.2 1261.0 420.0ZM1247.4 416.2Q1184.6 428.4 1136.8 481.3Q1188.6 439.5 1247.4 416.2ZM1233.9 412.0Q1171.8 418.7 1123.7 466.2Q1174.7 429.7 1233.9 412.0ZM1220.4 407.4Q1168.8 407.7 1127.9 442.6Q1170.3 416.9 1220.4 407.4ZM1207.0 402.3Q1158.6 404.9 1120.5 439.6Q1160.4 413.6 1207.0 402.3ZM1193.7 396.9Q1152.7 398.3 1120.4 426.9Q1154.0 405.6 1193.7 396.9ZM1180.4 391.1Q1144.4 390.2 1115.8 413.5Q1145.2 396.6 1180.4 391.1ZM1167.1 384.8Q1141.3 382.7 1120.4 398.3Q1141.6 387.4 1167.1 384.8ZM1153.9 378.2Q1143.2 376.6 1134.5 382.5Q1143.2 378.5 1153.9 378.2ZM1140.8 371.1Q1140.8 371.1 1140.8 371.1Q1140.8 371.1 1140.8 371.1Z"></path>
                <path fill="#CBF39D" d="M1486.2 425.3Q1456.4 399.9 1428.6 403.4Q1452.7 405.6 1486.2 425.3ZM1471.7 428.0Q1430.2 387.2 1390.6 389.5Q1424.1 395.3 1471.7 428.0ZM1457.3 430.4Q1413.3 392.6 1372.3 397.8Q1407.8 401.1 1457.3 430.4ZM1442.9 432.3Q1395.8 382.2 1350.4 383.1Q1388.2 391.4 1442.9 432.3ZM1428.6 433.8Q1376.9 383.8 1327.9 387.1Q1369.5 393.9 1428.6 433.8ZM1414.3 434.9Q1354.1 369.8 1295.9 370.4Q1344.2 381.6 1414.3 434.9ZM1400.1 435.5Q1341.8 374.2 1285.8 375.5Q1332.6 385.6 1400.1 435.5ZM1385.9 435.8Q1323.2 364.2 1262.0 363.0Q1312.3 376.5 1385.9 435.8ZM1371.8 435.7Q1314.6 367.7 1258.4 365.5Q1304.2 379.1 1371.8 435.7ZM1357.8 435.2Q1308.3 369.2 1258.5 364.2Q1298.0 379.1 1357.8 435.2ZM1343.8 434.2Q1292.0 363.7 1239.6 357.8Q1281.0 374.1 1343.8 434.2ZM1329.8 432.9Q1276.9 364.5 1224.0 360.0Q1266.3 375.1 1329.8 432.9ZM1316.0 431.1Q1266.1 357.8 1214.8 349.9Q1254.6 367.9 1316.0 431.1ZM1302.1 428.9Q1253.5 359.8 1203.8 353.1Q1242.7 369.7 1302.1 428.9ZM1288.4 426.4Q1244.4 359.0 1198.8 350.9Q1233.8 368.0 1288.4 426.4ZM1274.7 423.4Q1223.6 355.9 1172.2 351.0Q1213.1 366.1 1274.7 423.4ZM1261.0 420.0Q1217.0 361.1 1172.7 356.5Q1207.9 369.9 1261.0 420.0ZM1247.4 416.2Q1210.3 359.2 1171.8 352.3Q1201.3 366.7 1247.4 416.2ZM1233.9 412.0Q1197.3 357.0 1159.5 350.6Q1188.7 364.4 1233.9 412.0ZM1220.4 407.4Q1189.5 362.9 1157.8 358.4Q1182.5 369.1 1220.4 407.4ZM1207.0 402.3Q1179.0 359.5 1150.0 354.4Q1172.3 365.2 1207.0 402.3ZM1193.7 396.9Q1170.5 360.5 1146.3 355.8Q1164.7 365.2 1193.7 396.9ZM1180.4 391.1Q1160.9 358.7 1140.3 354.0Q1155.8 362.7 1180.4 391.1ZM1167.1 384.8Q1152.7 361.8 1137.5 358.8Q1149.0 364.8 1167.1 384.8ZM1153.9 378.2Q1148.1 368.5 1141.9 367.2Q1146.6 369.7 1153.9 378.2ZM1140.8 371.1Q1140.8 371.1 1140.8 371.1Q1140.8 371.1 1140.8 371.1Z"></path>
                <path fill="none" stroke="#5C8F22" strokeWidth="2.2" strokeLinecap="round" d="M1510.0 420.0Q1311.3 468.8 1133.7 367.1"></path>
              </g>
            </svg>
          </div>
          <div className="pwrap">
            <div className="pcard" style={{ boxShadow: "9px 47px 8px 17px #070f3064" }}>
              <h2 id="price-h">{t('pricing.one_unit_ready_from_day')}</h2>
              <p className="plede">{t('pricing.every_unit_arrives_built_and')}</p>
              <div className="pp">
                <span className="peb">{t('pricing.early_bird_free_2_day')}</span>
                <span className="pbig" data-nt="">
                  <span className="u-t">{site.price.currency}</span>
                  {" " + site.price.amount}
                </span>
              </div>
              <ul className="pinc" aria-label={t('pricing.what_s_in_the_price')}>
                <li>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
                  <span>{t('pricing.reactor_with_lid_six_bolts')}</span>
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
                  <span>{t('pricing.insulated_rocket_stove_with_fuel')}</span>
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
                  <span>{t('pricing.gas_driven_fan_no_battery')}</span>
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
                  <span>{t('pricing.gas_pipe_with_globe_valve')}</span>
                </li>
              </ul>
              <div className="pact">
                <a className="btn btn-act" href="https://wa.me/6282251748461" target="_blank" rel="noopener" data-nt="" aria-label="Contact Person on WhatsApp, +62 822 5174 8461">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"></path>
                  </svg>
                  <span className="cp">
                    {"Contact Person "}
                    <span className="cp-n">(+62 822 5174 8461)</span>
                  </span>
                </a>
                <a className="btn btn-line" href="/waitlist.html">{t('pricing.join_the_waitlist')}</a>
              </div>
              <p className="psm">{rich(t('pricing.service_and_training_we_can'))}</p>
            </div>
          </div>
        </section>
        {/* FOOTER: invitation over a cropped name */}
        <footer className="foot" id="contact">
          <div className="in">
            <div className="foot-top">
              <div className="inv">
                <h2>{rich(t('footer.run_one_at_your_mill'))}</h2>
                <p>{t('footer.want_to_see_one_run')}</p>
                <a className="btn btn-act mail" href="https://wa.me/6282251748461" target="_blank" rel="noopener" data-nt="" aria-label="Contact Person on WhatsApp, +62 822 5174 8461">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"></path>
                  </svg>
                  <span className="cp">
                    {"Contact Person "}
                    <span className="cp-n">(+62 822 5174 8461)</span>
                  </span>
                </a>
              </div>
              <div className="fcols rv2">
                <div>
                  <h3>{t('footer.the_machine')}</h3>
                  <ul>
                    <li>{rich(t('footer.how_it_works'))}</li>
                    <li>{rich(t('footer.calculator'))}</li>
                    <li>{rich(t('footer.specs'))}</li>
                    <li>{rich(t('footer.up_close'))}</li>
                    <li>{rich(t('footer.features'))}</li>
                    <li>{rich(t('footer.pricing'))}</li>
                  </ul>
                </div>
                <div>
                  <h3>{t('footer.follow')}</h3>
                  <ul>
                    <li>
                      <a href="https://www.instagram.com/arolyzer.id/" target="_blank" rel="noopener" data-nt="">Instagram @arolyzer.id</a>
                    </li>
                    <li>
                      <a href="https://www.youtube.com/@arolyzer" target="_blank" rel="noopener" data-nt="">YouTube @arolyzer</a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="legal">
              <span data-nt="">© 2026 AROLYZER by Pyrometric</span>
              <span>{t('footer.turn_waste_into_a_circular')}</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }
}
