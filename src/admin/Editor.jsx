import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Badge, Button, Card, Field, Modal, Notice, inputCls, when, n, cx } from './ui.jsx';

const STARTER = `# A short headline

One or two sentences on what's new. Keep paragraphs short; most people read on their phone.

## What happened

- First point
- Second point

[Visit the site](${window.location.origin})
`;

export default function Editor({ id, go }) {
  const [nl, setNl] = useState(null), [err, setErr] = useState(''), [tab, setTab] = useState('en');
  const [draft, setDraft] = useState({ subject_en: '', body_en: '', subject_id: '', body_id: '' });
  const [saved, setSaved] = useState(true), [saving, setSaving] = useState(false), [note, setNote] = useState('');
  const [preview, setPreview] = useState(''), [testTo, setTestTo] = useState(''), [ask, setAsk] = useState(false), [busy, setBusy] = useState(false);
  const draftRef = useRef(draft); draftRef.current = draft;

  const load = () => api.get('/api/admin/newsletters/' + id).then(x => {
    setNl(x);
    if (x.status === 'draft' && !x.body_en && !x.subject_en) setDraft({ subject_en: '', body_en: STARTER, subject_id: '', body_id: '' });
    else setDraft({ subject_en: x.subject_en, body_en: x.body_en, subject_id: x.subject_id, body_id: x.body_id });
  }).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [id]);

  // poll while it's sending
  useEffect(() => {
    if (!nl || nl.status !== 'sending') return;
    const t = setInterval(() => api.get('/api/admin/newsletters/' + id).then(setNl).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [nl && nl.status, id]);

  // live preview, a moment after typing stops
  useEffect(() => {
    const t = setTimeout(() => api.post('/api/admin/preview', { ...draft, lang: tab }).then(p => setPreview(p.html)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [draft, tab]);

  const editable = nl && nl.status === 'draft';
  const set = k => e => { setDraft({ ...draft, [k]: e.target.value }); setSaved(false); };
  const save = async () => {
    setSaving(true); setErr('');
    try { const x = await api.put('/api/admin/newsletters/' + id, draftRef.current); setNl(p => ({ ...p, ...x })); setSaved(true); setNote('Saved.'); }
    catch (e) { setErr(e.message); }
    setSaving(false);
  };
  useEffect(() => {
    const k = e => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (editable) save(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [editable]);

  const test = async () => {
    setBusy(true); setErr(''); setNote('');
    try {
      if (!saved) await save();
      const r = await api.post(`/api/admin/newsletters/${id}/test`, { email: testTo, lang: draft.subject_id && draft.body_id ? 'both' : 'en' });
      setNote(r.mode === 'outbox' ? `Test saved to the server’s outbox (${r.sent} email${r.sent > 1 ? 's' : ''}). SMTP isn’t set up yet.` : `Test sent to ${testTo}${r.sent > 1 ? ' in English and Indonesian' : ''}.`);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const send = async () => {
    setBusy(true); setErr('');
    try { if (!saved) await save(); const x = await api.post(`/api/admin/newsletters/${id}/send`, { confirm: true }); setAsk(false); setNl(p => ({ ...p, ...x })); }
    catch (e) { setErr(e.message); setAsk(false); }
    setBusy(false);
  };
  const act = async (path, after) => { setErr(''); try { const x = await api.post(`/api/admin/newsletters/${id}/${path}`); after && after(x); } catch (e) { setErr(e.message); } };
  const remove = async () => { if (!window.confirm('Delete this newsletter?')) return; await api.del('/api/admin/newsletters/' + id); go('#/newsletters'); };

  if (!nl) return err ? <Notice tone="error">{err}</Notice> : <p className="text-ink-2">Loading…</p>;
  const aud = Object.fromEntries((nl.audience || []).map(x => [x.lang, x.n]));
  const audTotal = (aud.en || 0) + (aud.id || 0), hasId = draft.subject_id.trim() && draft.body_id.trim();
  const st = nl.stats || {}, done = (st.sent || 0) + (st.failed || 0) + (st.skipped || 0);
  const subjKey = tab === 'en' ? 'subject_en' : 'subject_id', bodyKey = tab === 'en' ? 'body_en' : 'body_id';

  return (
    <div className="adm-in flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <a href="#/newsletters" className="text-small">← All newsletters</a>
        <Badge status={nl.status} />
        {editable && <span className="text-small text-ink-2">{saving ? 'Saving…' : saved ? note || 'All changes saved' : 'Unsaved changes'}</span>}
        <div className="ml-auto flex gap-2">
          {nl.status === 'sent' && <Button onClick={() => act('duplicate', x => go('#/newsletters/' + x.id))}>Duplicate</Button>}
          {nl.status !== 'sending' && <Button variant="ghost" onClick={remove}>Delete</Button>}
        </div>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
      {nl.status !== 'draft' && (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[28px] font-normal leading-none">{nl.status === 'sending' ? 'Sending…' : 'Sent'}</h2>
            <span className="text-small text-ink-2">{nl.status === 'sent' ? 'Finished ' + when(nl.sent_at) : 'Started ' + when(nl.started_at)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surf" role="progressbar" aria-valuemin={0} aria-valuemax={nl.total} aria-valuenow={done}>
            <div className="h-full rounded-full bg-[#1DA97A] transition-[width] duration-500 ease-out" style={{ width: (nl.total ? (done / nl.total) * 100 : 100) + '%' }} />
          </div>
          <p className="text-ink-2">{n(st.sent)} sent of {n(nl.total)}{st.failed ? ` · ${n(st.failed)} failed` : ''}{st.skipped ? ` · ${n(st.skipped)} skipped (left the list)` : ''}</p>
          {st.failed > 0 && nl.status === 'sent' && (
            <div className="flex flex-col gap-2">
              <ul className="text-[15px] text-ink-2">{(nl.failures || []).map(f => <li key={f.email}>{f.email}: {f.error}</li>)}</ul>
              <Button className="self-start" onClick={() => act('retry', load)}>Try the failed ones again</Button>
            </div>
          )}
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <div className="flex rounded-[10px] bg-bg p-1 self-start" role="tablist" aria-label="Language">
            {[['en', 'English'], ['id', 'Bahasa Indonesia']].map(([v, l]) => (
              <button key={v} role="tab" type="button" aria-selected={tab === v} onClick={() => setTab(v)}
                className={cx('min-h-9 rounded-[8px] border-0 px-3 text-[15px] transition-colors duration-200', tab === v ? 'bg-card font-semibold' : 'bg-transparent text-ink-2 hover:text-ink')}>{l}</button>
            ))}
          </div>
          {tab === 'id' && <p className="text-[15px] text-ink-2">Optional. Indonesian subscribers get this version when both the subject and text are filled in; otherwise they get the English one.</p>}
          <Field label="Subject">
            <input className={inputCls} value={draft[subjKey]} onChange={set(subjKey)} disabled={!editable} maxLength={200} placeholder={tab === 'en' ? 'What’s new at AROLYZER' : 'Kabar terbaru AROLYZER'} />
          </Field>
          <Field label="Text" hint={<span className="md-help"><code># Headline</code> <code>## Section</code> <code>**bold**</code> <code>- list</code> <code>[link](https://…)</code> <code>![photo](https://…/photo.jpg)</code></span>}>
            <textarea className={inputCls + ' min-h-[360px] resize-y'} value={draft[bodyKey]} onChange={set(bodyKey)} disabled={!editable} spellCheck />
          </Field>
          {editable && <div className="flex flex-wrap gap-3"><Button variant="act" onClick={save} disabled={saving || saved}>Save</Button></div>}
        </Card>
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-[28px] font-normal leading-none">Preview</h2>
            <span className="text-small text-ink-2">{tab === 'en' ? 'English' : hasId ? 'Indonesian' : 'Indonesian (English shown until both fields are filled)'}</span>
          </div>
          <iframe title="Email preview" srcDoc={preview} sandbox="" className="h-[560px] w-full rounded-[10px] border-0 bg-bg" />
        </Card>
      </div>
      {editable && (
        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-[28px] font-normal leading-none">Send</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Send a test to" className="min-w-[260px] flex-1 sm:max-w-[360px]">
              <input className={inputCls} type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@company.com" />
            </Field>
            <Button onClick={test} disabled={busy || !testTo}>Send test</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--line)] pt-4">
            <Button variant="act" onClick={() => setAsk(true)} disabled={busy || !audTotal || !draft.subject_en.trim() || !draft.body_en.trim()}>
              Send to {n(audTotal)} {audTotal === 1 ? 'subscriber' : 'subscribers'}
            </Button>
            <span className="text-small text-ink-2">{!audTotal ? 'No confirmed subscribers yet.' : `${n(aud.en)} in English, ${n(aud.id)} in ${hasId ? 'Indonesian' : 'English (no Indonesian version)'}`}</span>
          </div>
        </Card>
      )}
      <Modal open={ask} title="Send this newsletter?" onClose={() => setAsk(false)}
        actions={<><Button onClick={() => setAsk(false)}>Not yet</Button><Button variant="act" onClick={send} disabled={busy}>{busy ? 'Starting…' : 'Send now'}</Button></>}>
        <p>“{draft.subject_en}” goes to {n(audTotal)} confirmed {audTotal === 1 ? 'subscriber' : 'subscribers'}. You can’t edit or stop it once it starts.</p>
      </Modal>
    </div>
  );
}
