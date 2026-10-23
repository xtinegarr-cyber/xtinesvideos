# XTINE’S VIDEOS

A creator site with free and VIP creators. Built with Next.js and
PostgreSQL. Videos and photos are stored on Cloudflare R2, and VIP
memberships are sold with Stripe for $4.99/month.

## What's in it

**Homepage**
- Discord and Telegram buttons top-left, the site name in the middle, and
  creator search plus Log in top-right.
- A "Get VIP" bar at the top for anyone without VIP.
- Free creators first, then a separate VIP section. VIP profile pictures are
  blurred with a lock for anyone without VIP. The blur is baked into a
  separate image, so the sharp picture never reaches them.
- Each card shows the creator's name and view count at the bottom-left.
  New creators get a "New" badge for their first 72 hours.
- Visitors without VIP get a VIP popup once per visit, after 60 seconds on
  the site.

**Creator pages** (`/creator_name`, e.g. a creator named "gamercool 123" is at
`/gamercool_123`)
- Separate **Videos** and **Photos** tabs, with Videos open by default
  (`/creator_name?tab=photos` opens Photos). Phone videos show upright.
- VIP cards on the homepage lead visitors without VIP to Get VIP instead of
  the profile. If they type a VIP creator's link, they see only the
  creator's name and a "Get VIP" prompt, not the uploads.
- Page titles read "gamercool 123 - Videos | XTINE’S VIDEOS" for search engines.
- Each profile visit counts as a view, once per visitor per creator per day.
  Refreshing doesn't add views. Bots and admins aren't counted.

**Admin panel** (`/admin`, for `xtinegar`)
- Stats: creators, total views, views this week, uploads, and active VIP members.
- Uploads: pick a creator, drag in videos and photos, then pick another
  creator and drag in more. Everything goes into one line and uploads in
  order, so a big batch can be left running. Big files are sent in 25 MB
  pieces, so they get past Cloudflare's 100 MB limit. Dropped connections,
  redeploys and a briefly full server disk are waited out, not failed.
  Once every file is sent, the tab can be closed: the server finishes
  processing on its own. Each saved file remembers the upload it came
  from, so a file can never be added twice.
- Creators: add a creator with a profile picture and free or VIP, switch
  them between free and VIP, change their picture, or delete them. Each
  creator shows total views and views this week.
- VIP members (at the bottom): add members yourself, with or without an
  end date. Buyers appear here automatically with their payment status.
  Anyone whose payment stopped (canceled or failing) but who still has VIP
  is marked **Review** and listed first. Removing a member deletes their
  account and cancels their Stripe subscription if it's still running.
- "Paid, but haven't created their login yet": anyone who paid and closed
  the page before making an account, with a link you can send them.

**VIP**
- Every "Get VIP" button goes straight to Stripe's checkout ($4.99/month).
- After paying, buyers create their login with their **email and a
  password**. That account has VIP with no end date.
- VIP never switches off by itself. Cancellations and failed payments show
  up in the admin panel for your monthly review, and you remove VIP by hand.
- Members log in with their email; admin-made accounts use a username.
- `/account`: members see their status. "Manage or cancel VIP" opens
  Stripe's page for changing their card or canceling.

**Video pages and free VIP from Reddit**
- Every video and photo has its own page: `/creator_name/v/123`. Open one
  from the creator's grid with **Share** (free creators) or **Open on its
  own page** (VIP creators, who stay locked for everyone without VIP).
- Free creators' video pages have a **Share** box with a personal link
  (`?r=code`, unique to that browser) and a **Post on Reddit** button.
- At `/vip/reddit`, visitors paste their Reddit post. The site checks that
  the post exists, is still up, is less than 24 hours old, and links to a
  free creator's video with *their* code. If so, they get 30 minutes of VIP
  in that browser, no account needed, with a countdown at the bottom of the
  screen. Each post works once; each browser and Reddit account once a day.
- Reddit only lets approved apps read posts reliably. Add `REDDIT_CLIENT_ID`
  and `REDDIT_CLIENT_SECRET` once Reddit approves your app. Until then the
  site tries Reddit's public data, and anything Reddit won't show goes to
  **Free VIP from Reddit** in the admin panel. Approve it there and the
  visitor's 30 minutes start on their next visit.
- Rewarding posts can be treated as spam by Reddit and subreddit rules.

### How uploads become fast-loading videos

1. The file is sent to your server in 25 MB pieces.
2. ffmpeg moves the video's index to the start of the file ("faststart"),
   so playback begins before the download finishes.
3. Videos that would load slowly are converted to 1080p H.264 with a
   bitrate cap. That covers iPhone HEVC, 4K, very high bitrates (over
   20 Mbps), WebM and AVI. Normal H.264 files are only repackaged, which
   takes a second or two. Two files are processed at a time on a 6-core
   server (`PROCESSING_CONCURRENCY` changes this).
4. A thumbnail is taken from 15 seconds in (or the middle of shorter
   clips), along with a blurred copy for locked VIP previews.
5. Everything goes to R2, and the server deletes its temporary copy.

The R2 bucket stays **private**. Pages hand out signed links that expire
after a few hours. VIP files are only signed for VIP members, so nobody
can share or guess a working link to locked content.

## Put it online (Hetzner + Coolify)

1. **Server:** create a Hetzner Cloud server (CX33 or similar, Ubuntu)
   and install Coolify on it with the one-line command from coolify.io.
2. **Database:** in Coolify, add a new PostgreSQL resource. Copy its
   internal connection URL.
3. **Site:** add a new resource from your GitHub repository. Choose the
   **Dockerfile** build pack, because the Dockerfile installs ffmpeg.
   Set the port to `3000`.
4. **Environment variables:** copy everything from `.env.example` into
   Coolify's Environment Variables tab and fill it in. `DATABASE_URL` is
   the URL from step 2.
5. **Domain:** add your domain in Coolify. Coolify sets up HTTPS for you.
   **Upload folder:** under Persistent Storage, add a volume mounted at
   `/data/uploads` and set `UPLOAD_TMP_DIR=/data/uploads`, so files waiting
   to be processed survive a redeploy.
6. **Deploy.** On first start the site creates its database tables and the
   `xtinegar` admin account using `ADMIN_PASSWORD`. Log in at `/login`.
   To change the admin password later, change `ADMIN_PASSWORD` and restart.
   If you can't log in, the site's **Logs** in Coolify say whether the admin
   account was created (for example, if the password was too short).

Optional: run `npm run seed:demo` once to add placeholder creators and see
the layout, then delete them from the admin panel.

### Cloudflare R2

1. In Cloudflare, go to R2 and create a bucket. Choose a North America
   location hint if most viewers are in the US. Leave public access **off**.
2. Create an API token under R2 → Manage API tokens with **Object Read &
   Write** for that bucket.
3. Put the account ID, access key ID, secret and bucket name into the
   `R2_*` variables.

### Stripe ($4.99/month VIP)

1. In Stripe, create a product called "VIP" with a **recurring monthly
   price** of $4.99. Copy the price ID (`price_...`) into `STRIPE_VIP_PRICE_ID`.
2. Put your secret key (`sk_live_...`) into `STRIPE_SECRET_KEY`. Use
   freshly rotated keys if the old ones were stored on Railway.
3. Under Developers → Webhooks, add the endpoint
   `https://YOUR-DOMAIN/api/stripe/webhook` with these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copy its signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
4. Under Settings → Billing → Customer portal, turn on **cancel
   subscriptions** and **update payment methods**. That's the page members
   reach from "Manage or cancel VIP".

### If you put the domain behind Cloudflare's proxy

This works out of the box. Uploads already stay under Cloudflare's 100 MB
request limit, and video processing happens in the background, so
Cloudflare's 100-second timeout never cuts it off.

## Run it on your own computer

You need Node.js 20.9+, PostgreSQL and ffmpeg installed.

```bash
cp .env.example .env   # then fill in DATABASE_URL, ADMIN_PASSWORD, APP_SECRET
npm install
npm run dev            # http://localhost:3000
```

Without the R2 variables, the site runs and shows initials instead of
pictures, and uploads stay switched off. Without the Stripe variables,
the VIP page explains that checkout isn't switched on yet.

## Where things are

| Path | What it is |
| --- | --- |
| `src/app/page.js` | Homepage |
| `src/app/[slug]/page.js` | Creator page |
| `src/app/admin/` | Admin panel and its actions |
| `src/app/vip/`, `src/app/account/` | Buying and managing VIP |
| `src/app/api/` | Uploads, view counting and the Stripe webhook |
| `src/components/` | Everything you see (header, cards, popup, admin sections) |
| `src/lib/media-processing.js` | ffmpeg: fast-start videos, thumbnails, blur |
| `src/lib/storage.js` | Cloudflare R2 |
| `src/lib/stripe.js` | Stripe checkout, billing page, syncing subscriptions |
| `db/schema.sql` | Database tables |
| `src/app/globals.css` | Colors and fonts |

## Views and creator pay

Every counted view is stored per creator per day in the `creator_views`
table. To total views for a payout period, run this:

```sql
SELECT c.name, count(*) AS views
FROM creator_views v JOIN creators c ON c.id = v.creator_id
WHERE v.view_date BETWEEN '2026-11-01' AND '2026-11-30'
GROUP BY c.name ORDER BY views DESC;
```

## Not built yet

- A payouts page in the admin panel (the data above is already being collected)
- Counting views per video, in addition to per profile
- Admin accounts for the rest of your team (only `xtinegar` for now)
- Password reset for members
