import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { cx } from './ui.jsx';
import Login from './Login.jsx';
import Overview from './Overview.jsx';
import Signups from './Signups.jsx';
import Subscribers from './Subscribers.jsx';
import Newsletters from './Newsletters.jsx';
import Editor from './Editor.jsx';

const TABS = [['#/', 'Overview'], ['#/waitlist', 'Waitlist'], ['#/subscribers', 'Subscribers'], ['#/newsletters', 'Newsletters']];
const useHash = () => {
  const [h, setH] = useState(window.location.hash || '#/');
  useEffect(() => { const f = () => setH(window.location.hash || '#/'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return h;
};

export default function App() {
  const [me, setMe] = useState(null);
  const hash = useHash(), go = h => { window.location.hash = h; };
  const check = () => api.get('/api/admin/me').then(setMe).catch(() => setMe({ signedIn: false, enabled: true, offline: true }));
  useEffect(() => { check(); }, []);
  if (!me) return <div className="adm" />;
  if (!me.signedIn) return <div className="adm"><Login enabled={me.enabled} onDone={check} /></div>;

  const nlMatch = hash.match(/^#\/newsletters\/(\d+)/);
  const page = nlMatch ? <Editor key={nlMatch[1]} id={nlMatch[1]} go={go} />
    : hash.startsWith('#/waitlist') ? <Signups /> : hash.startsWith('#/subscribers') ? <Subscribers />
    : hash.startsWith('#/newsletters') ? <Newsletters go={go} /> : <Overview />;
  const current = nlMatch ? '#/newsletters' : (TABS.find(t => t[0] !== '#/' && hash.startsWith(t[0])) || TABS[0])[0];
  const title = TABS.find(t => t[0] === current)[1];
  const logout = async () => { await api.post('/api/admin/logout'); check(); };

  return (
    <div className="adm">
      <header className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-7">
          <a href="/" className="flex items-center gap-2 no-underline" aria-label="Open the website">
            <img src="/assets/wordmark-light.webp" alt="AROLYZER" width="128" height="22" className="block h-auto w-32" />
          </a>
          <nav aria-label="Admin" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {TABS.map(([h, l]) => (
              <a key={h} href={h} aria-current={current === h ? 'page' : undefined}
                className={cx('whitespace-nowrap rounded-[10px] px-3 py-2 no-underline transition-colors duration-200', current === h ? 'bg-card font-semibold text-ink' : 'text-ink-2 hover:bg-surf hover:text-ink')}>{l}</a>
            ))}
          </nav>
          <button type="button" onClick={logout} className="ml-auto min-h-11 rounded-[10px] border-0 bg-transparent px-3 text-ink-2 transition-colors duration-200 hover:bg-surf hover:text-ink">Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-page px-4 pb-16 pt-8 sm:px-7">
        <h1 className="mb-6 font-display text-[56px] font-normal leading-none">{nlMatch ? 'Newsletter' : title}</h1>
        {page}
      </main>
    </div>
  );
}
