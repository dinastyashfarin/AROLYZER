import React from 'react';
import { translator, rich } from '../content.jsx';
import { joinWaitlist } from '../lib/api.js';
import { ROLES, OPS, TONS, EMAIL } from './data.js';
import { WL_ATTRS, wlApply } from './i18n.js';
import { prefGet, prefSet } from './prefs.js';

export default class Waitlist extends React.Component {
  st(k, d) { var s = this.state || {}; return s[k] === undefined ? d : s[k]; }
  componentDidMount() {
    var d = prefGet('dark'), l = prefGet('lang'), ns = {};
    if (d !== null) ns.dark = d === '1';
    if (l === 'id' || l === 'en') ns.lang = l;
    if (Object.keys(ns).length) this.setState(ns); else this._i18n();
  }
  componentDidUpdate() { this._i18n(); }
  componentWillUnmount() { if (this._mo) this._mo.disconnect(); }
  _i18n() {
    var root = this._root; if (!root) return;
    var lang = this.st('lang', 'en'), self = this;
    if (lang === this._lastLang && lang === 'en') return;
    this._lastLang = lang;
    if (this._mo) this._mo.disconnect();
    wlApply(root, lang);
    if (lang === 'id') {
      if (!this._mo) this._mo = new MutationObserver(function () { if (self._moBusy) return; self._moBusy = true; requestAnimationFrame(function () { self._moBusy = false; if (self.st('lang', 'en') === 'id') { self._mo.disconnect(); wlApply(root, 'id'); self._mo.observe(root, self._moOpts); } }); });
      this._moOpts = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: WL_ATTRS };
      this._mo.observe(root, this._moOpts);
    }
  }
  renderVals() {
    var self = this, step = this.st('step', 1), f = this.st('f', { name: '', email: '', phone: '', co: '', loc: '', website: '', consent: false }), tried = this.st('tried', {});
    var role = this.st('role', 0), op = this.st('op', -1), ton = this.st('ton', 1);
    var phase = this.st('phase', 'form'), done = phase === 'done', busy = phase === 'busy';
    var setF = function (k) { return function (e) { var nf = Object.assign({}, self.st('f', f)); nf[k] = k === 'consent' ? e.target.checked : e.target.value; self.setState({ f: nf }); }; };
    var errs = {
      name: f.name.trim().length < 2 ? 'Add your name.' : '',
      email: !EMAIL.test(f.email.trim()) ? 'Use an email like name@company.com.' : '',
      co: f.co.trim().length < 2 ? 'Add your company or mill name.' : '',
      op: op < 0 ? 'Pick the closest one.' : '',
      consent: !f.consent ? 'Tick this so we’re allowed to email you.' : ''
    };
    var need = { 1: ['name', 'email'], 2: ['co', 'op', 'consent'] };
    var shown = function (k) { return tried[k] ? errs[k] : ''; };
    var ok = function (s) { return need[s].every(function (k) { return !errs[k]; }); };
    var seg = function (n, i) { return { w: 'calc((100% - 8px) / ' + n + ')', x: 'translateX(' + (i * 100) + '%)' }; };
    var sr = seg(ROLES.length, role), stn = seg(TONS.length, ton);
    var col = op % 3, row = Math.floor(op / 3);
    var pos = this.st('pos', 0);
    var dark = this.st('dark', false), lang = this.st('lang', 'en'), isId = lang === 'id';
    if (!this._rootRef) this._rootRef = function (el) { self._root = el; };
    return {
      rootRef: this._rootRef,
      wlCls: dark ? 'dark' : '', dark: dark,
      modeLabel: dark ? 'Switch to light mode' : 'Switch to night mode',
      toggleDark: function () { prefSet('dark', dark ? '0' : '1'); self.setState({ dark: !dark }); },
      enCls: isId ? '' : 'on', idCls: isId ? 'on' : '', lngCls: isId ? 'r' : '', langEnA: isId ? 'false' : 'true', langIdA: isId ? 'true' : 'false',
      setEn: function () { prefSet('lang', 'en'); self.setState({ lang: 'en' }); }, setId: function () { prefSet('lang', 'id'); self.setState({ lang: 'id' }); },
      f: f,
      on: { name: setF('name'), email: setF('email'), phone: setF('phone'), co: setF('co'), loc: setF('loc'), website: setF('website'), consent: setF('consent') },
      err: { name: shown('name'), email: shown('email'), co: shown('co'), op: shown('op'), consent: shown('consent') },
      bad: { name: shown('name') ? 'bad' : '', email: shown('email') ? 'bad' : '', co: shown('co') ? 'bad' : '', consent: shown('consent') ? 'bad' : '' },
      s1: !done && step === 1, s2: !done && step === 2, done: done, notDone: !done,
      stepsNav: ['About you', 'Your operation'].map(function (n, i) { return { n: (i + 1) + '', name: n, fill: (i + 1 < step || (i + 1 === step)) ? 'on' : '', cur: i + 1 === step ? 'cur' : '', aria: i + 1 === step ? 'step' : 'false' }; }),
      stepTxt: 'Step ' + step + ' of 2',
      canBack: step > 1, notLast: step < 2, isLast: step === 2, busy: busy, idle: !busy,
      back: function () { self.setState({ step: Math.max(1, step - 1) }); },
      next: function () { var t = Object.assign({}, tried); need[step].forEach(function (k) { t[k] = true; }); if (ok(step)) self.setState({ step: step + 1, tried: t }); else self.setState({ tried: t }); },
      submit: function () {
        var t = Object.assign({}, tried); need[2].forEach(function (k) { t[k] = true; });
        if (!ok(2)) { self.setState({ tried: t }); return; }
        self.setState({ tried: t, phase: 'busy', sendErr: '' });
        var cur = self.st('f', f);
        joinWaitlist({
          name: cur.name.trim(), email: cur.email.trim(), phone: cur.phone.trim(), company: cur.co.trim(), location: cur.loc.trim(),
          role: ROLES[role], operation: OPS[op][0], tonnage: TONS[ton], consent: !!cur.consent, lang: lang, website: cur.website || ''
        }).then(function (r) { self.setState({ phase: 'done', pos: r.position }); })
          .catch(function () { self.setState({ phase: 'form', sendErr: translator('waitlist', lang)('errors.send_failed') }); });
      },
      roles: ROLES.map(function (r, i) { return { label: r, cls: i === role ? 'on' : '', aria: i === role ? 'true' : 'false', pick: function () { self.setState({ role: i }); } }; }),
      segW: sr.w, segX: sr.x,
      ops: OPS.map(function (o, i) { return { label: o[0], note: o[1], aria: i === op ? 'true' : 'false', pick: function () { self.setState({ op: i }); } }; }),
      ringW: 'calc((100% - 20px) / 3)', ringH: '84px', ringT: 'translate(calc(' + Math.max(col, 0) + ' * (100% + 10px)), calc(' + Math.max(row, 0) + ' * (100% + 10px)))', ringO: op < 0 ? '0' : '1',
      tons: TONS.map(function (r, i) { return { label: r, cls: i === ton ? 'on' : '', aria: i === ton ? 'true' : 'false', pick: function () { self.setState({ ton: i }); } }; }),
      tW: stn.w, tX: stn.x,
      passName: f.name.trim() || 'Your name', nmCls: f.name.trim() ? '' : 'empty',
      passCo: f.co.trim() ? f.co.trim() + ' · ' + ROLES[role] : 'Your company', coCls: f.co.trim() ? '' : 'empty',
      passOp: op >= 0 ? OPS[op][0] : '—', passT: TONS[ton], passLoc: f.loc.trim() || '—',
      passNo: done ? 'Confirmed' : 'Pending',
      passCls: done ? 'done' : '', stampNo: '#' + pos,
      sendErr: this.st('sendErr', ''),
      firstName: (f.name.trim().split(/\s+/)[0] || 'friend')
    };
  }

  render() {
    const v = this.renderVals();
    const lang = this.st('lang', 'en'), t = translator('waitlist', lang);
    return (
      <div className={`wl ${v.wlCls}`} ref={v.rootRef}>
        <header className="in top">
          <a className="brand" href="/" aria-label={t('header.arolyzer_home')}>
            <img className="ic" src="/assets/icon.webp" alt="" width="201" height="325" />
            <img className="wm wm-l" src="/assets/wordmark-light.webp" alt={t('header.arolyzer')} width="980" height="169" />
            <img className="wm wm-d" src="/assets/wordmark-dark.webp" alt={t('header.arolyzer')} width="980" height="169" />
          </a>
          <div className="top-r">
            <div className="lng" role="group" aria-label={t('header.language')}>
              <span className={`lng-t ${v.lngCls}`} aria-hidden="true"></span>
              <button type="button" className={v.enCls} onClick={v.setEn} aria-pressed={v.langEnA} lang="en" data-nt="" aria-label="English">EN</button>
              <button type="button" className={v.idCls} onClick={v.setId} aria-pressed={v.langIdA} lang="id" data-nt="" aria-label="Bahasa Indonesia">ID</button>
            </div>
            <label className="switch" title={v.modeLabel}>
              <input type="checkbox" checked={v.dark} onChange={v.toggleDark} aria-label={t('header.night_mode')} />
              <span className="slider" aria-hidden="true">
                <span className="star star_1"></span>
                <span className="star star_2"></span>
                <span className="star star_3"></span>
                <svg viewBox="0 0 16 16" className="cloud" aria-hidden="true">
                  <path transform="matrix(.77976 0 0 .78395-299.99-418.63)" fill="#fff" d="m391.84 540.91c-.421-.329-.949-.524-1.523-.524-1.351 0-2.451 1.084-2.485 2.435-1.395.526-2.388 1.88-2.388 3.466 0 1.874 1.385 3.423 3.182 3.667v.034h12.73v-.006c1.775-.104 3.182-1.584 3.182-3.395 0-1.747-1.309-3.186-2.994-3.379.007-.106.011-.214.011-.322 0-2.707-2.271-4.901-5.072-4.901-2.073 0-3.856 1.202-4.643 2.925"></path>
                </svg>
              </span>
            </label>
            <a className="back" href="/">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5"></path>
                <path d="M11 18l-6-6 6-6"></path>
              </svg>
              <span>{t('header.back_to_the_machine')}</span>
            </a>
          </div>
        </header>
        <main className="in grid">
          <section className="left" aria-label={t('pass.your_place_on_the_list')}>
            <h1>{t('pass.get_a_first_unit_before')}</h1>
            <p className="lede">{t('pass.pilot_units_go_to_mills')}</p>
            <div className={`pass ${v.passCls}`} aria-hidden="true">
              <div className="ph">
                <b>{t('pass.arolyzer_pilot_list')}</b>
                <span>{v.passNo}</span>
              </div>
              <div className={`nm ${v.nmCls}`}>{v.passName}</div>
              <div className={`co ${v.coCls}`}>{v.passCo}</div>
              <dl>
                <div>
                  <dt>{t('pass.operation')}</dt>
                  <dd>{v.passOp}</dd>
                </div>
                <div>
                  <dt>{t('pass.waste_a_month')}</dt>
                  <dd>{v.passT}</dd>
                </div>
                <div>
                  <dt>{t('pass.location')}</dt>
                  <dd>{v.passLoc}</dd>
                </div>
              </dl>
              {v.done && (
                <>
                  <div className="stamp">
                    <span>{t('pass.on_the_list')}</span>
                    <b>{v.stampNo}</b>
                    <span>2026</span>
                  </div>
                </>
              )}
            </div>
            <p className="fine">{rich(t('pass.your_pass_fills_in_as'))}</p>
          </section>
          <section className="card" aria-labelledby="wl-h">
            {v.notDone && (
              <>
                <ol className="steps" aria-label={t('form.progress')}>
                  {(v.stepsNav || []).map((s, sIdx) => (
                    <React.Fragment key={sIdx}>
                      <li aria-current={s.aria}>
                        <span className="bar" aria-hidden="true"><i className={s.fill}></i></span>
                        <span className="sr">{s.name}</span>
                      </li>
                    </React.Fragment>
                  ))}
                </ol>
              </>
            )}
            {v.s1 && (
              <>
                <div className="face">
                  <h2 id="wl-h">{t('form.about_you')}</h2>
                  <p className="sub">{t('form.so_we_know_who_to')}</p>
                  <div className="row2">
                    <div className="fld">
                      <label htmlFor="wl-name">{t('form.full_name')}</label>
                      <input id="wl-name" type="text" autoComplete="name" value={v.f.name} onChange={v.on.name} className={v.bad.name} />
                      <span className="err">{v.err.name}</span>
                    </div>
                    <div className="fld">
                      <label htmlFor="wl-email">{t('form.work_email')}</label>
                      <input id="wl-email" type="email" autoComplete="email" value={v.f.email} onChange={v.on.email} className={v.bad.email} />
                      <span className="err">{v.err.email}</span>
                    </div>
                  </div>
                  <div className="fld">
                    <label htmlFor="wl-phone">
                      {t('form.whatsapp_number')}{" "}
                      <span className="opt">{t('form.optional')}</span>
                    </label>
                    <input id="wl-phone" type="tel" autoComplete="tel" value={v.f.phone} onChange={v.on.phone} />
                  </div>
                  <div className="fld">
                    <span className="lab" id="wl-role">{t('form.your_role')}</span>
                    <div className="seg" role="radiogroup" aria-labelledby="wl-role">
                      <span className="thumb" style={{ width: v.segW, transform: v.segX }} aria-hidden="true"></span>
                      {(v.roles || []).map((o, oIdx) => (
                        <React.Fragment key={oIdx}>
                          <button type="button" role="radio" aria-checked={o.aria} className={o.cls} onClick={o.pick}>{o.label}</button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            {v.s2 && (
              <>
                <div className="face">
                  <h2 id="wl-h">{t('form.your_operation')}</h2>
                  <p className="sub">{t('form.helps_us_plan_which_mills')}</p>
                  <div className="row2">
                    <div className="fld">
                      <label htmlFor="wl-co">{t('form.company_or_mill_name')}</label>
                      <input id="wl-co" type="text" autoComplete="organization" value={v.f.co} onChange={v.on.co} className={v.bad.co} />
                      <span className="err">{v.err.co}</span>
                    </div>
                    <div className="fld">
                      <label htmlFor="wl-loc">{t('form.city_and_country')}</label>
                      <input id="wl-loc" type="text" autoComplete="address-level2" value={v.f.loc} onChange={v.on.loc} />
                    </div>
                  </div>
                  <div className="fld">
                    <span className="lab" id="wl-op">{t('form.what_do_you_run')}</span>
                    <div className="rc" role="radiogroup" aria-labelledby="wl-op">
                      <span className="ring" style={{ width: v.ringW, height: v.ringH, transform: v.ringT, opacity: v.ringO }} aria-hidden="true"></span>
                      {(v.ops || []).map((o, oIdx) => (
                        <React.Fragment key={oIdx}>
                          <button type="button" role="radio" aria-checked={o.aria} onClick={o.pick}>
                            <b>{o.label}</b>
                            <span>{o.note}</span>
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                    <span className="err">{v.err.op}</span>
                  </div>
                  <div className="fld">
                    <span className="lab" id="wl-t">{t('form.waste_a_month')}</span>
                    <div className="seg" role="radiogroup" aria-labelledby="wl-t">
                      <span className="thumb" style={{ width: v.tW, transform: v.tX }} aria-hidden="true"></span>
                      {(v.tons || []).map((o, oIdx) => (
                        <React.Fragment key={oIdx}>
                          <button type="button" role="radio" aria-checked={o.aria} className={o.cls} onClick={o.pick}>{o.label}</button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  {/* Bots fill this hidden field; people never see it */}
                  <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={v.f.website} onChange={v.on.website} />
                  <label className={`consent ${v.bad.consent}`}>
                    <input type="checkbox" checked={v.f.consent} onChange={v.on.consent} />
                    <span>{t('form.send_me_arolyzer_news_and')}</span>
                  </label>
                  <span className="err">{v.err.consent}</span>
                </div>
              </>
            )}
            {v.notDone && (
              <>
                {v.sendErr && <p className="send-err" role="alert">{v.sendErr}</p>}
                <div className="nav">
                  <span className="count">{v.stepTxt}</span>
                  <div className="acts">
                    {v.canBack && (
                      <>
                        <button type="button" className="btn btn-line" onClick={v.back}>{t('form.back')}</button>
                      </>
                    )}
                    {v.notLast && (
                      <>
                        <button type="button" className="btn btn-act" onClick={v.next}>
                          {t('form.continue')}{" "}
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14"></path>
                            <path d="M13 6l6 6-6 6"></path>
                          </svg>
                        </button>
                      </>
                    )}
                    {v.isLast && (
                      <>
                        <button type="button" className="btn btn-act btn-sub" onClick={v.submit} aria-busy={v.busy}>
                          {v.busy && (
                            <>
                              <span className="spin" aria-hidden="true"></span>
                              {t('form.joining')}
                            </>
                          )}
                          {v.idle && (
                            <>
                              {t('form.join_the_waitlist')}
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
            {v.done && (
              <>
                <div className="face done-face" role="status">
                  <span className="tick">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
                  </span>
                  <h2 id="wl-h">{t('form.you_re_on_the_list', { firstName: v.firstName })}</h2>
                  <p>{rich(t('form.we_sent_a_confirmation_to'), { email: v.f.email })}</p>
                  <ul>
                    <li>{t('form.build_news_and_demo_days')}</li>
                    <li>{t('form.pilot_pricing_before_it_goes')}</li>
                    <li>{t('form.unsubscribe_from_any_email_in')}</li>
                  </ul>
                  <a className="btn btn-line" href="/">{t('form.back_to_the_machine')}</a>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    );
  }
}
