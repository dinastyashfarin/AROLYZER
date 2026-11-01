# Deploying

The whole site runs as one Node.js process on one port. Put it behind HTTPS (Caddy, Nginx or a platform that does it for you) and keep the `data/` folder on persistent storage, since it holds the database.

## 1. Settings

Copy `.env.example` to `.env` on the server and fill in:

- `PUBLIC_URL`: the address people visit, such as `https://www.yourdomain.com`. Email links use it.
- `ADMIN_PASSWORD`: a long password for `/admin`.
- `SESSION_SECRET`: 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
- `SMTP_*` and `MAIL_FROM`: your email provider's SMTP details. `MAIL_FROM` must use a domain you've verified with the provider.
- `TRUST_PROXY=1` when running behind Caddy, Nginx or Cloudflare.

The server refuses to start in production without `PUBLIC_URL`, `ADMIN_PASSWORD` and `SESSION_SECRET`.

## 2a. With Docker (recommended)

```bash
mkdir -p data && sudo chown 1000:1000 data   # the container runs as user 1000
docker compose up -d --build
```

Update after changing code or content: `git pull && docker compose up -d --build`.

## 2b. Without Docker

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

Keep it running with systemd or pm2 (`pm2 start server/index.js --name arolyzer`).

## 3. HTTPS

Caddy gets certificates automatically. `/etc/caddy/Caddyfile`:

```
www.yourdomain.com {
  reverse_proxy 127.0.0.1:3000
}
yourdomain.com {
  redir https://www.yourdomain.com{uri}
}
```

## 4. Email deliverability

In your DNS, add the SPF and DKIM records your provider gives you, plus a DMARC record (`v=DMARC1; p=none; rua=mailto:you@yourdomain.com` to start). Without them, Gmail and Outlook will put mail in spam or reject it. Send a test from the admin panel to a Gmail address and check "Show original" for `SPF: PASS` and `DKIM: PASS`.

Check your provider’s sending limits (free plans usually cap emails per day) and set `SEND_PER_SECOND` under them.

## 5. Backups

`npm run backup` (or `docker compose exec web npm run backup`) writes a consistent copy of the database to `data/backups/`. Run it daily from cron and copy the folder off the server.

## Health check

`GET /healthz` returns `{"ok":true}` when the server and database are up.
