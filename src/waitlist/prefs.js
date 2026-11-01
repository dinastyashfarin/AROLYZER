export function prefGet(k) { try { return window.localStorage.getItem('arolyzer:' + k); } catch (e) { return null; } }

export function prefSet(k, v) { try { window.localStorage.setItem('arolyzer:' + k, v); } catch (e) {} }
