import React from 'react';

/** Simple data table: scrolls sideways on small screens instead of squashing columns. */
export default function Table({ cols, rows, rowKey = r => r.id }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      <table className="min-w-[720px] text-[16px]">
        <thead>
          <tr className="border-b border-[color:var(--line)] text-small text-ink-2">
            {cols.map(c => <th key={c.key} scope="col" className={'px-2 py-2 first:pl-0 ' + (c.className || '')}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)} className="border-b border-[color:var(--line)] align-top last:border-0">
              {cols.map(c => <td key={c.key} className={'px-2 py-2.5 first:pl-0 ' + (c.className || '')}>{c.render ? c.render(r) : r[c.key] || '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
