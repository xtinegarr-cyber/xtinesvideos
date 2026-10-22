-- Safe to run on every start: everything uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  -- A member is VIP while vip_until is in the future, or forever when an
  -- admin grants VIP with no end date (vip_lifetime).
  vip_until     TIMESTAMPTZ,
  vip_lifetime  BOOLEAN NOT NULL DEFAULT false,
  -- Filled in when someone buys VIP through Stripe.
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_status          TEXT,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  -- SHA-256 of the token in the visitor's cookie, so a database leak
  -- does not hand out working logins.
  id         TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS creators (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'vip')),
  avatar_key      TEXT,
  avatar_blur_key TEXT,
  view_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creators_name_idx ON creators (lower(name));

CREATE TABLE IF NOT EXISTS media (
  id               BIGSERIAL PRIMARY KEY,
  creator_id       BIGINT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('video', 'image')),
  file_key         TEXT NOT NULL,
  content_type     TEXT NOT NULL,
  thumb_key        TEXT NOT NULL,
  thumb_blur_key   TEXT NOT NULL,
  width            INTEGER,
  height           INTEGER,
  duration_seconds REAL,
  size_bytes       BIGINT,
  original_name    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_creator_idx ON media (creator_id, created_at DESC);

-- One row per visitor per creator per day. This is what stops refreshes
-- from inflating view counts, and it keeps a daily history for payouts.
CREATE TABLE IF NOT EXISTS creator_views (
  creator_id   BIGINT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  view_date    DATE NOT NULL DEFAULT current_date,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (creator_id, visitor_hash, view_date)
);
CREATE INDEX IF NOT EXISTS creator_views_date_idx ON creator_views (view_date);
