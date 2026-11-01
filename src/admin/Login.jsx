import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Button, Card, Field, Notice, inputCls } from './ui.jsx';

export default function Login({ enabled, onDone }) {
  const [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.post('/api/admin/login', { password: pw }); onDone(); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <main className="grid min-h-[100svh] place-items-center px-4">
      <Card className="adm-in w-full max-w-[420px] p-8">
        <img src="/assets/wordmark-light.webp" alt="AROLYZER" width="160" height="28" className="mb-6 block h-auto w-40" />
        <h1 className="mb-1 font-display text-[44px] font-normal leading-none">Admin</h1>
        <p className="mb-6 text-ink-2">Waitlist, subscribers and newsletters.</p>
        {!enabled ? (
          <Notice tone="warn">The admin panel is off. Set <b>ADMIN_PASSWORD</b> in the server’s .env file and restart it.</Notice>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Password" error={err}>
              <input className={inputCls} type="password" autoComplete="current-password" autoFocus value={pw} onChange={e => setPw(e.target.value)} />
            </Field>
            <Button variant="act" type="submit" disabled={busy || !pw}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>
        )}
      </Card>
    </main>
  );
}
