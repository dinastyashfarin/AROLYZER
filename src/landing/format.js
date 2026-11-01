// isolate mode: distance that fits the part's bounding sphere inside the free side of the stage, for any screen shape
// rolling digits: sets the text of an .odo element, rolling each digit wheel to its new value
export function odoSet(el, str, fromZero) {
  if (!el) return;
  str = String(str == null ? '' : str);
  var shape = str.replace(/[0-9]/g, '0');
  if (!/[0-9]/.test(str)) { el.textContent = str; el._shape = null; return; }
  if (el._shape !== shape) {
    el.textContent = ''; el._cols = [];
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (/[0-9]/.test(ch)) {
        var c = document.createElement('span'); c.className = 'odo-c';
        var st = document.createElement('span'); st.className = 'odo-s';
        for (var d = 0; d < 10; d++) { var n = document.createElement('span'); n.textContent = d; st.appendChild(n); }
        c.appendChild(st); el.appendChild(c); el._cols.push(st);
        if (!fromZero && el._last) { var old = el._last.replace(/[^0-9]/g, '')[el._cols.length - 1]; st.style.transform = 'translateY(' + (-(+old || 0) * 10) + '%)'; }
      } else { var x = document.createElement('span'); x.className = 'odo-x'; x.textContent = ch; el.appendChild(x); }
    }
    el._shape = shape; void el.offsetWidth;
  }
  var digits = str.replace(/[^0-9]/g, '');
  for (var k = 0; k < el._cols.length; k++) el._cols[k].style.transform = 'translateY(' + (-(+digits[k]) * 10) + '%)';
  el._last = str;
}

export function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

export function fmt1(n) { return (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 }); }

export function capStr(v, max) { var s = String(v == null ? '' : v); return s.trim() !== '' && Number(s) > max ? String(max) : s; }
