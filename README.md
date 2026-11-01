# AROLYZER website

Landing page, waitlist, newsletter and admin panel in one project.

- **Front end:** React + Tailwind, built with Vite. Pages: `/` (landing), `/waitlist.html`, `/admin`.
- **Back end:** one Node.js server (Express + SQLite). It stores waitlist sign-ups, runs the newsletter (double opt-in, one-click unsubscribe), serves the admin panel and the built site.
- **Email:** any SMTP provider (Brevo, Resend, Mailgun, Google Workspace…). Switch provider by changing `.env`, not code.
- **Content:** all page text, prices, specs, logos and translations live in `content/*.json`. See [docs/EDITING-CONTENT.md](docs/EDITING-CONTENT.md).

## Quick start

Needs Node 20.10 or newer.

```bash
npm install
cp .env.example .env        # for local work you can leave most of it empty
npm run dev                 # site on http://localhost:5173, API on :3000
```

Set `ADMIN_PASSWORD` in `.env` to open the admin panel at http://localhost:5173/admin.html (or http://localhost:3000/admin after a build).

Without `SMTP_HOST`, emails aren't sent: each one is saved to `data/outbox/` as an `.html` file you can open in a browser. That includes the confirmation links, so you can test the whole sign-up flow locally.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Site with live reload plus the API server |
| `npm run build` | Builds the site into `dist/` |
| `npm start` | Runs the server: API, admin and the built site on `PORT` |
| `npm test` | API tests (sign-up, confirm, unsubscribe, admin, newsletter sending) |
| `npm run check:content` | Checks the content files for mistakes and missing translations |
| `npm run backup` | Copies the database to `data/backups/` |

## How the newsletter works

1. Someone joins the waitlist and ticks the email box. They're saved as a sign-up and as a **pending** subscriber, and get a confirmation email in their language.
2. Clicking the link makes them **confirmed**. Only confirmed people get newsletters.
3. In the admin panel, **Newsletters → New newsletter**: write a subject and text (Markdown) in English and, optionally, Indonesian. The preview updates as you type. Send yourself a test, then **Send to N subscribers**.
4. Emails go out at `SEND_PER_SECOND`. The send survives a restart and picks up where it stopped. Failed addresses can be retried.
5. Every newsletter has an unsubscribe link and the `List-Unsubscribe` headers, so Gmail and Apple Mail show their own one-click unsubscribe button. People who leave are never emailed again unless they sign up again and confirm.

The admin panel also lists the waitlist and subscribers with search and CSV export, and can unsubscribe or permanently delete a person (for data-removal requests).

## Project layout

```
content/              all text, translations, price, calculator numbers, logos  ← edit these
public/               images, partner logos, 3D model (copied as-is)
src/
  landing/            landing page (Landing.jsx, landing.css, 3D viewer, data)
  waitlist/           waitlist form
  admin/              admin panel (Tailwind)
  content.jsx         reads content/*.json for the pages
  lib/                API client, three.js setup
server/
  index.js            starts everything
  app.js              routes, security headers, static files
  routes/             public.js (waitlist, confirm, unsubscribe) and admin.js
  lib/                email templates, mailer, newsletter queue, auth, CSV
  migrations/         database schema (numbered .sql files, run once each)
test/                 API tests
scripts/              content checker, backup
docs/                 editing and deployment guides
```

## Styling

- `tailwind.config.js` holds the brand tokens (colours, fonts, type sizes, radius, easing). Surface and text colours point at CSS variables, so they follow night mode.
- The landing and waitlist look lives in `landing.css` and `waitlist.css` (3D stage, stacking panels, rolling numbers, charts, animations). The admin panel is built with Tailwind classes, so new UI can follow that pattern.
- Tailwind's reset is off so the original pages render exactly as designed.

## Going live

See [docs/DEPLOY.md](docs/DEPLOY.md). In short: set the production values in `.env` (`PUBLIC_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, SMTP), run `docker compose up -d --build` or `npm ci && npm run build && npm start` behind HTTPS, and set up SPF/DKIM for your sending domain.

## Changing things later

- **Text, prices, logos, translations:** `content/`, no code ([guide](docs/EDITING-CONTENT.md)).
- **Database changes:** add `server/migrations/002_something.sql`. It runs once on the next start.
- **Email provider:** change the SMTP lines in `.env` and restart.
- **New page:** add an HTML file and an entry in `vite.config.js`, like `waitlist.html`.
- Run `npm test` and `npm run check:content` before you deploy. GitHub Actions runs both on every push (`.github/workflows/ci.yml`).
