-- Waitlist sign-ups: everything the form collects
CREATE TABLE signups (
  id          INTEGER PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT NOT NULL,
  phone       TEXT,
  company     TEXT,
  location    TEXT,
  role        TEXT,
  operation   TEXT,
  tonnage     TEXT,
  lang        TEXT NOT NULL DEFAULT 'en',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Newsletter list. Double opt-in: pending -> confirmed; anyone can leave with their token.
CREATE TABLE subscribers (
  id               INTEGER PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name             TEXT,
  lang             TEXT NOT NULL DEFAULT 'en',
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','unsubscribed')),
  token            TEXT NOT NULL UNIQUE,          -- permanent, used in unsubscribe links
  confirm_token    TEXT UNIQUE,                   -- cleared once confirmed
  source           TEXT NOT NULL DEFAULT 'waitlist',
  consent_at       TEXT,
  confirm_sent_at  TEXT,
  confirmed_at     TEXT,
  unsubscribed_at  TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX subscribers_status ON subscribers(status);

CREATE TABLE newsletters (
  id          INTEGER PRIMARY KEY,
  subject_en  TEXT NOT NULL DEFAULT '',
  body_en     TEXT NOT NULL DEFAULT '',
  subject_id  TEXT NOT NULL DEFAULT '',          -- optional Indonesian version
  body_id     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sending','sent')),
  total       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  started_at  TEXT,
  sent_at     TEXT
);

-- One row per newsletter per recipient, so a send survives restarts and can be retried
CREATE TABLE deliveries (
  id             INTEGER PRIMARY KEY,
  newsletter_id  INTEGER NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  subscriber_id  INTEGER REFERENCES subscribers(id) ON DELETE SET NULL,
  email          TEXT NOT NULL,
  lang           TEXT NOT NULL DEFAULT 'en',
  status         TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  error          TEXT,
  sent_at        TEXT,
  UNIQUE (newsletter_id, email)
);
CREATE INDEX deliveries_queue ON deliveries(status, newsletter_id);
