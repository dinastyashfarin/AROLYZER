// Small client for the AROLYZER backend (server/). Same origin in production;
// in development Vite forwards /api to the Node server (see vite.config.js).

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Arolyzer': '1', ...(options.headers || {}) },
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Request failed');
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

/** Adds someone to the waitlist and sends the confirmation email. Resolves to { position }. */
export function joinWaitlist(details) {
  return request('/api/waitlist', { method: 'POST', body: JSON.stringify(details) });
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body || {}) }),
  put: (p, body) => request(p, { method: 'PUT', body: JSON.stringify(body || {}) }),
  del: (p) => request(p, { method: 'DELETE' }),
};
