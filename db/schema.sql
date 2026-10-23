-- Safe to run on every start: everything uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  -- Admin-made accounts log in with a username; people who buy VIP log in
  -- with their email. Every account has at least one of the two.
  username      TEXT UNIQUE,
  email         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  -- A member is VIP forever when vip_lifetime is true (everyone who buys
  -- VIP, reviewed by hand each month), or until vip_until for members an
  -- admin added with an end date.
  vip_until     TIMESTAMPTZ,
  vip_lifetime  BOOLEAN NOT NULL DEFAULT false,
  -- Filled in when someone buys VIP through Stripe. Shown in the admin
  -- panel for the monthly review; it never switches VIP off by itself.
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_status          TEXT,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (username IS NOT NULL OR email IS NOT NULL)
);
-- For databases created before email logins existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));

-- Paid Stripe checkouts, so a buyer's account can be created after paying
-- (and the admin can see anyone who paid but hasn't set up their login).
CREATE TABLE IF NOT EXISTS vip_checkouts (
  session_id      TEXT PRIMARY KEY,
  customer_id     TEXT,
  subscription_id TEXT,
  email           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  claimed_at      TIMESTAMPTZ
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
-- Which upload made each file, so a finished upload is still recognized
-- after the server restarts, and the same upload can never be saved twice.
ALTER TABLE media ADD COLUMN IF NOT EXISTS upload_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS media_upload_idx ON media (upload_id);
-- A title for search engines and visitors (from the file name, editable).
ALTER TABLE media ADD COLUMN IF NOT EXISTS title TEXT;

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

-- "Post on Reddit, get 30 minutes of VIP". One row per Reddit post. The
-- reward belongs to a browser (ref_code, the code in its share links), so
-- visitors don't need an account. pass_until is set when the 30 minutes
-- start: right away for posts checked automatically, or on the visitor's
-- next page view after an admin approves a post by hand.
CREATE TABLE IF NOT EXISTS reddit_claims (
  id            BIGSERIAL PRIMARY KEY,
  ref_code      TEXT NOT NULL,
  post_id       TEXT,
  post_url      TEXT NOT NULL,
  reddit_author TEXT,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at   TIMESTAMPTZ,
  pass_until    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS reddit_claims_post_idx ON reddit_claims (post_id);
CREATE UNIQUE INDEX IF NOT EXISTS reddit_claims_url_idx ON reddit_claims (lower(post_url));
CREATE INDEX IF NOT EXISTS reddit_claims_ref_idx ON reddit_claims (ref_code, created_at DESC);
CREATE INDEX IF NOT EXISTS reddit_claims_author_idx ON reddit_claims (lower(reddit_author), created_at DESC);

-- Small site settings, e.g. one-time jobs that have already run.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
