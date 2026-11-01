import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Badge, Button, Card, Empty, Notice, when, n } from './ui.jsx';

export default function Newsletters({ go }) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api.get('/api/admin/newsletters').then(setD).catch(e => setErr(e.message)); }, []);
  const create = async () => { const nl = await api.post('/api/admin/newsletters', {}); go('#/newsletters/' + nl.id); };
  const total = d ? d.audience.reduce((a, x) => a + x.n, 0) : 0;
  return (
    <div className="adm-in flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-2">{d ? `${n(total)} confirmed ${total === 1 ? 'subscriber' : 'subscribers'} will get the next one.` : ''}</p>
        <Button variant="act" onClick={create}>New newsletter</Button>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
      <Card>
        {!d ? <p className="text-ink-2">Loading…</p> : d.rows.length === 0 ? <Empty>No newsletters yet. Write the first one and send yourself a test before it goes out.</Empty> : (
          <ul className="divide-y divide-[color:var(--line)]">
            {d.rows.map(r => (
              <li key={r.id}>
                <a href={'#/newsletters/' + r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[10px] px-2 py-3 text-ink no-underline transition-colors duration-200 hover:bg-bg">
                  <span className="min-w-0">
                    <b className="font-semibold">{r.subject_en || 'Untitled draft'}</b>
                    {r.subject_id && <span className="block text-[15px] text-ink-2">ID: {r.subject_id}</span>}
                  </span>
                  <span className="flex items-center gap-3 text-small text-ink-2">
                    {r.status !== 'draft' && <span>{n(r.stats.sent)} of {n(r.total)} sent{r.stats.failed ? `, ${r.stats.failed} failed` : ''}</span>}
                    <span>{when(r.sent_at || r.updated_at)}</span>
                    <Badge status={r.status} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
