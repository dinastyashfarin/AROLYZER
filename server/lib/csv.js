// CSV with a BOM so Excel opens accents and Indonesian characters correctly.
// Cells starting with = + - @ are prefixed so spreadsheets don't run them as formulas.
const cell = v => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export const toCsv = (cols, rows) => '﻿' + [cols.map(c => cell(c.label)), ...rows.map(r => cols.map(c => cell(r[c.key])))].map(r => r.join(',')).join('\r\n') + '\r\n';
