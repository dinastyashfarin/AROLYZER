import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Badge, Button, Card, Empty, LinkButton, Modal, Notice, Pager, inputCls, when, n, cx } from './ui.jsx';
import Table from './Table.jsx';

const FILTERS = [['', 'All'], ['confirmed', 'Confirmed'], ['pending', 'Waiting'], ['unsubscribed', 'Unsubscribed']];

export default function Subscribers() {
  const [q, setQ] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [d, setD] = useState(null), [err, setErr] = useState(''), [act, setAct] = useState(null);
  const params = new URLSearchParams({ q, status, page: String(page) }).toString();
  const load = useCallback(() => api.get('/api/admin/subscribers?' + params).then(setD).catch(e => setErr(e.message)), [params]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  const run = async () => {
    if (act.kind === 'unsub') await api.post(`/api/admin/subscribers/${act.row.id}/unsubscribe`); else await api.del(`/api/admin/subscribers/${act.row.id}`);
    setAct(null); load();
  };
  const cols = [
    { key: 'email', label: 'Email', render: r => <><b className="font-semibold">{r.email}</b><br /><span className="text-[15px] text-ink-2">{r.name || ''}</span></> },
    { key: 'status', label: 'Status', render: r => <Badge status={r.status} /> },
    { key: 'lang', label: 'Language', render: r => (r.lang === 'id' ? 'Indonesian' : 'English') },
    { key: 'consent_at', label: 'Consent given', render: r => <span className="whitespace-nowrap text-ink-2">{when(r.consent_at)}</span> },
    { key: 'confirmed_at', label: 'Confirmed', render: r => <span className="whitespace-nowrap text-ink-2">{when(r.confirmed_at)}</span> },
    { key: 'x', label: <span className="sr-only">Actions</span>, render: r => (
      <div className="flex justify-end gap-1">
        {r.status !== 'unsubscribed' && <Button variant="ghost" className="min-h-9 px-2 text-[15px]" onClick={() => setAct({ kind: 'unsub', row: r })}>Unsubscribe</Button>}
        <Button variant="ghost" className="min-h-9 px-2 text-[15px]" onClick={() => setAct({ kind: 'delete', row: r })}>Delete</Button>
      </div>) },
  ];
  return (
    <div className="adm-in flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <input className={inputCls + ' max-w-[320px]'} type="search" placeholder="Search email or name" aria-label="Search" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <div className="flex rounded-[10px] bg-card p-1" role="group" aria-label="Status">
          {FILTERS.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={status === v} onClick={() => { setStatus(v); setPage(1); }}
              className={cx('min-h-9 rounded-[8px] border-0 px-3 text-[15px] transition-colors duration-200', status === v ? 'bg-surf font-semibold' : 'bg-transparent text-ink-2 hover:text-ink')}>{l}</button>
          ))}
        </div>
        <LinkButton className="ml-auto" href={'/api/admin/subscribers.csv?' + new URLSearchParams({ q, status })} download>Download CSV</LinkButton>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
      <Card>
        <p className="mb-3 text-small text-ink-2">{d ? `${n(d.total)} ${d.total === 1 ? 'address' : 'addresses'}` : 'Loading…'}</p>
        {d && (d.rows.length ? <Table cols={cols} rows={d.rows} /> : <Empty>{q || status ? 'Nobody matches that.' : 'No subscribers yet. People join when they tick the email box on the waitlist form.'}</Empty>)}
        {d && <Pager page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />}
      </Card>
      <Modal open={!!act} title={act && act.kind === 'unsub' ? 'Unsubscribe this address?' : 'Delete this subscriber?'} onClose={() => setAct(null)}
        actions={<><Button onClick={() => setAct(null)}>Cancel</Button><Button variant="danger" onClick={run}>{act && act.kind === 'unsub' ? 'Unsubscribe' : 'Delete'}</Button></>}>
        {act && (act.kind === 'unsub'
          ? <p>{act.row.email} won’t get newsletters any more. They can join again from the waitlist.</p>
          : <p>{act.row.email} and their consent record will be erased. Use this when someone asks for their data to be removed. It can’t be undone.</p>)}
      </Modal>
    </div>
  );
}
