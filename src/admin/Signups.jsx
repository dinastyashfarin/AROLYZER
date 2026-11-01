import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Badge, Button, Card, Empty, LinkButton, Modal, Notice, Pager, inputCls, when, n } from './ui.jsx';
import Table from './Table.jsx';

export default function Signups() {
  const [q, setQ] = useState(''), [op, setOp] = useState(''), [page, setPage] = useState(1);
  const [d, setD] = useState(null), [err, setErr] = useState(''), [del, setDel] = useState(null), [alsoSub, setAlsoSub] = useState(true);
  const params = new URLSearchParams({ q, operation: op, page: String(page) }).toString();
  const load = useCallback(() => api.get('/api/admin/signups?' + params).then(setD).catch(e => setErr(e.message)), [params]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  const remove = async () => { await api.del(`/api/admin/signups/${del.id}${alsoSub ? '?subscriber=1' : ''}`); setDel(null); load(); };

  const cols = [
    { key: 'id', label: '#', className: 'w-12 text-ink-2' },
    { key: 'name', label: 'Name', render: r => <><b className="font-semibold">{r.name}</b><br /><a href={'mailto:' + r.email} className="text-[15px]">{r.email}</a></> },
    { key: 'company', label: 'Company', render: r => <>{r.company}{r.role && <span className="text-ink-2"> · {r.role}</span>}<br /><span className="text-[15px] text-ink-2">{r.location || ''}</span></> },
    { key: 'operation', label: 'Operation', render: r => <>{r.operation}<br /><span className="text-[15px] text-ink-2">{r.tonnage}</span></> },
    { key: 'phone', label: 'WhatsApp', render: r => r.phone ? <a href={'https://wa.me/' + r.phone.replace(/\D/g, '')} target="_blank" rel="noreferrer">{r.phone}</a> : '—' },
    { key: 'newsletter', label: 'Newsletter', render: r => <Badge status={r.newsletter} /> },
    { key: 'created_at', label: 'Joined', render: r => <span className="whitespace-nowrap text-ink-2">{when(r.created_at)}</span> },
    { key: 'x', label: <span className="sr-only">Actions</span>, render: r => <Button variant="ghost" className="min-h-9 px-2 text-[15px]" onClick={() => { setAlsoSub(true); setDel(r); }} aria-label={'Delete ' + r.name}>Delete</Button> },
  ];
  return (
    <div className="adm-in flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <input className={inputCls + ' max-w-[320px]'} type="search" placeholder="Search name, email, company, place" aria-label="Search" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select className={inputCls + ' max-w-[240px]'} aria-label="Operation" value={op} onChange={e => { setOp(e.target.value); setPage(1); }}>
          <option value="">All operations</option>
          {(d ? d.operations : []).map(o => <option key={o.operation} value={o.operation}>{o.operation} ({o.n})</option>)}
        </select>
        <LinkButton className="ml-auto" href={'/api/admin/signups.csv?' + new URLSearchParams({ q, operation: op })} download>Download CSV</LinkButton>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
      <Card>
        <p className="mb-3 text-small text-ink-2">{d ? `${n(d.total)} ${d.total === 1 ? 'person' : 'people'}` : 'Loading…'}</p>
        {d && (d.rows.length ? <Table cols={cols} rows={d.rows} /> : <Empty>{q || op ? 'Nobody matches that search.' : 'No sign-ups yet.'}</Empty>)}
        {d && <Pager page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />}
      </Card>
      <Modal open={!!del} title="Delete this sign-up?" onClose={() => setDel(null)}
        actions={<><Button onClick={() => setDel(null)}>Keep it</Button><Button variant="danger" onClick={remove}>Delete</Button></>}>
        {del && <>
          <p className="mb-4">{del.name} ({del.email}) will be removed from the waitlist. This can’t be undone.</p>
          <label className="flex items-center gap-2 text-ink"><input type="checkbox" className="size-5 accent-[#1DA97A]" checked={alsoSub} onChange={e => setAlsoSub(e.target.checked)} /> Also remove them from the newsletter list</label>
        </>}
      </Modal>
    </div>
  );
}
