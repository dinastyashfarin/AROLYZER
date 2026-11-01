import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card, Notice, Stat, Empty, when, n } from './ui.jsx';

export default function Overview() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api.get('/api/admin/overview').then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!d) return <p className="text-ink-2">Loading…</p>;
  const lang = Object.fromEntries(d.byLang.map(x => [x.lang, x.n]));
  return (
    <div className="adm-in flex flex-col gap-6">
      {d.mail.mode !== 'smtp' && (
        <Notice tone="warn">
          <b>Emails aren’t going out yet.</b> No SMTP server is set, so confirmation emails and newsletters are saved to the server’s <code>data/outbox</code> folder instead. Add the SMTP settings to .env and restart to send for real.
        </Notice>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Waitlist sign-ups" value={n(d.signups)} note={`${n(d.signupsWeek)} in the last 7 days`} />
        <Stat label="Newsletter subscribers" value={n(d.subscribers.confirmed)} note={`${n(lang.en)} English · ${n(lang.id)} Indonesian`} />
        <Stat label="Waiting to confirm" value={n(d.subscribers.pending)} note="Haven’t clicked the email link yet" />
        <Stat label="Unsubscribed" value={n(d.subscribers.unsubscribed)} />
      </div>
      <Card>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[28px] font-normal leading-none">Latest sign-ups</h2>
          <a href="#/waitlist" className="text-small">See all</a>
        </div>
        {d.recent.length === 0 ? <Empty>No sign-ups yet. They’ll show up here as soon as someone joins.</Empty> : (
          <ul className="divide-y divide-[color:var(--line)]">
            {d.recent.map(r => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-3">
                <span><b className="font-semibold">{r.name}</b> <span className="text-ink-2">· {r.company} · {r.operation}</span></span>
                <span className="text-small text-ink-2">#{r.id} · {when(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-small text-ink-2">Sending from {d.mail.from}. Links in emails point to {d.publicUrl}.</p>
    </div>
  );
}
