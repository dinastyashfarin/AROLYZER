// Small building blocks for the admin panel, styled with Tailwind and the brand tokens.
import React, { useEffect, useRef } from 'react';

const cx = (...c) => c.filter(Boolean).join(' ');

export function Button({ variant = 'line', className, ...p }) {
  const v = {
    act: 'bg-act text-act-ink hover:bg-act-hover',
    line: 'bg-transparent text-ink shadow-[inset_0_0_0_1.5px_var(--line)] hover:bg-surf',
    danger: 'bg-transparent text-[color:var(--err)] shadow-[inset_0_0_0_1.5px_rgba(180,35,24,.35)] hover:bg-[rgba(180,35,24,.06)]',
    ghost: 'bg-transparent text-ink hover:bg-surf',
  }[variant];
  return <button type="button" className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border-0 px-4 font-semibold transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50', v, className)} {...p} />;
}

export function LinkButton({ className, ...p }) {
  return <a className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 font-semibold text-ink no-underline shadow-[inset_0_0_0_1.5px_var(--line)] transition-colors duration-200 ease-out hover:bg-surf', className)} {...p} />;
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-small font-medium">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[15px] text-ink-2">{hint}</span>}
      {error && <span className="mt-1 block text-[15px] text-[color:var(--err)]">{error}</span>}
    </label>
  );
}

export const inputCls = 'block w-full min-h-11 rounded-[10px] border-0 bg-bg px-3 py-2 shadow-[inset_0_0_0_1.5px_var(--line)] transition-shadow duration-200 focus:bg-card focus:shadow-[inset_0_0_0_2px_#1DA97A] focus:outline-none';

export function Card({ className, ...p }) {
  return <section className={cx('rounded-brand bg-card p-5 sm:p-6', className)} {...p} />;
}

export function Stat({ label, value, note }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-small text-ink-2">{label}</span>
      <span className="font-display text-[44px] leading-none">{value}</span>
      {note && <span className="text-[15px] text-ink-2">{note}</span>}
    </Card>
  );
}

const BADGE = {
  confirmed: 'bg-[#C7EFC2] text-[#05391F]', pending: 'bg-[#FFF1C7] text-[#5A4300]', unsubscribed: 'bg-[#ECEFED] text-[#41594D]',
  draft: 'bg-[#ECEFED] text-[#41594D]', sending: 'bg-[#FFF1C7] text-[#5A4300]', sent: 'bg-[#C7EFC2] text-[#05391F]', none: 'bg-transparent text-ink-2',
};
const LABEL = { confirmed: 'Confirmed', pending: 'Waiting to confirm', unsubscribed: 'Unsubscribed', draft: 'Draft', sending: 'Sending', sent: 'Sent', none: 'Not subscribed' };
export function Badge({ status }) {
  return <span className={cx('inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[14px] font-medium', BADGE[status])}>{LABEL[status] || status}</span>;
}

export function Modal({ open, title, children, onClose, actions }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="w-[min(520px,calc(100vw-32px))] rounded-brand border-0 bg-card p-0 text-ink backdrop:bg-[rgba(4,27,18,.45)]">
      {open && (
        <div className="p-6">
          <h2 className="mb-3 font-display text-[32px] font-normal leading-none">{title}</h2>
          <div className="text-ink-2">{children}</div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
        </div>
      )}
    </dialog>
  );
}

export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages < 2) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-small text-ink-2">
      <span>Page {page} of {pages}</span>
      <div className="flex gap-2">
        <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return <p className="py-10 text-center text-ink-2">{children}</p>;
}

export function Notice({ tone = 'info', children }) {
  const t = tone === 'warn' ? 'bg-[#FFF1C7] text-[#4A3700]' : tone === 'error' ? 'bg-[rgba(180,35,24,.08)] text-[color:var(--err)]' : 'bg-surf text-ink';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-[10px] px-4 py-3', t)}>{children}</div>;
}

const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
export const when = iso => (iso ? fmt.format(new Date(iso)) : '—');
export const n = x => Number(x || 0).toLocaleString('en-US');
export { cx };
