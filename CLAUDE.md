# CBF Church Website

## Overview

Website for Christian Believers Fellowship (CBF), a church at 32 Chapel Lane, Somersworth, NH 03878. The project is split into two deployments:

- **Frontend (GitHub Pages):** Static HTML/CSS/JS site at `https://www.cbfchurch.com` (repo: 99redder/cbfchurch)
- **Backend API (Render.com free tier):** Node.js/Express API at `https://cbfchurch.onrender.com`
- **Database (Neon.tech):** PostgreSQL — the `DATABASE_URL` env var points here

The admin panel is part of the static site but communicates with the API for authentication, blog CRUD, gallery management, and user management.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | HTML, CSS, vanilla JS (no build step) |
| Styling | Custom CSS with CSS custom properties, Grid + Flexbox |
| Backend API | Node.js + Express |
| Database | PostgreSQL on Neon.tech (`pg` library) |
| Auth | bcryptjs + JWT (localStorage + Bearer token) |
| Blog Editor | Quill.js (CDN `cdn.quilljs.com/1.3.7`) |
| Photo Gallery | CSS Grid + vanilla JS lightbox |
| PWA | Service worker + manifest.json |
| Gallery Storage | AWS S3 (via `aws-sdk`) or Render filesystem fallback |
| Fonts | Google Fonts — Inter |
| Icons | Font Awesome 6.5.1 (CDN) |

## Project Structure

```
cbfchurch/
├── index.html                     # Home page (blog listing)
├── our-beliefs.html
├── mission-statement.html
├── cbf-history.html
├── contact.html
├── photo-gallery.html
├── service-times.html
├── recent-videos.html
├── article-archives.html
├── video-archive.html
├── learn-the-truth.html
├── post.html                      # Single blog post view
├── manifest.json                  # PWA manifest
├── sw.js                          # Service worker
├── sitemap.xml                    # SEO sitemap
├── robots.txt                     # Search crawler rules
├── CNAME                          # GitHub Pages custom domain (www.cbfchurch.com)
├── admin/
│   ├── login.html                 # Admin login (has inline theme + auth JS)
│   ├── dashboard.html             # Post list + gallery upload
│   ├── editor.html                # Quill.js post editor (create/edit)
│   └── users.html                 # Superadmin only: manage admin accounts
├── css/
│   └── style.css                  # Single stylesheet: public + admin + dark mode
├── js/
│   ├── common.js                  # Shared: API_BASE, nav toggle, theme toggle,
│   │                              #   formatDate, apiFetch, legal modals (privacy/terms),
│   │                              #   AND all mobile app chrome injection (tab bar,
│   │                              #   "More" sheet, mobile wordmark, sidebar accordion)
│   ├── blog.js                    # Fetch/render blog posts on home page
│   ├── post.js                    # Fetch/render single post
│   ├── archives.js                # Fetch/render archive listing
│   ├── gallery.js                 # Lightbox functionality
│   └── admin.js                   # Auth check, authFetch, theme toggle, dashboard,
│                                  #   gallery CRUD, user management
├── images/
│   ├── logo.svg
│   ├── wordmark.svg                # Wide single-line wordmark (desktop header)
│   ├── wordmark-mobile.svg         # Stacked two-line wordmark (mobile header, bigger text)
│   ├── church-logo-photo.jpg       # Round church-building accent (desktop header only)
│   ├── pwa-icon.svg
│   └── gallery/                   # ~60 static gallery photos (committed to git)
├── api/                           # Backend (deployed separately to Render)
│   ├── server.js                  # Express entry point, CORS config, route mounting
│   ├── package.json               # Dependencies: express, pg, bcryptjs, cors,
│   │                              #   cookie-parser, dotenv, jsonwebtoken, aws-sdk
│   ├── .env                       # Local env (gitignored)
│   ├── .env.example
│   ├── database/
│   │   ├── init.js                # CREATE TABLE + all migrations (runs on server start)
│   │   └── seed.js                # Create initial superadmin: node seed.js <user> <pass>
│   ├── routes/
│   │   ├── auth.js                # POST /login (returns JWT), /logout, /register, GET /me
│   │   ├── posts.js               # Public GET endpoints for blog
│   │   ├── admin.js               # Protected CRUD: posts, gallery, users
│   │   └── gallery.js             # Public GET endpoint for gallery
│   ├── utils/
│   │   ├── db.js                  # PostgreSQL pool + run/get/all/exec helpers
│   │   ├── auth.js                # JWT helpers, requireAuth, requireSuperAdmin
│   │   └── storage.js             # saveGalleryImage, deleteGalleryImage, attachPublicUrl
│   └── uploads/
│       └── gallery/               # Gallery photos if not using S3
└── scripts/
    ├── import-blogger.js          # One-time: import Blogger XML export
    └── download-gallery.js        # One-time: pull gallery photos
```

## Database Schema (PostgreSQL on Neon)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',    -- 'admin' or 'superadmin'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE gallery_photos (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    position BIGINT DEFAULT 0,
    storage_key TEXT,              -- S3 key if using AWS, null if filesystem
    url TEXT,                      -- Public URL if using S3, null if filesystem
    alt TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Migrations** are handled automatically in `api/database/init.js` on every server start using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern with try/catch blocks.

## API Endpoints

### Public (no auth)
- `GET /api/posts?page=1&limit=5` — Paginated blog posts
- `GET /api/posts/:slug` — Single post by slug
- `GET /api/posts/archives` — Posts grouped by year/month
- `GET /api/gallery` — All gallery photos ordered by position
- `GET /api/health` — Health check

### Auth
- `POST /api/auth/login` — Returns `{ token, username, message }` + sets httpOnly cookie
- `POST /api/auth/logout` — Clears cookie
- `POST /api/auth/register` — Create admin account (superadmin only)
- `GET /api/auth/me` — Check auth status, returns `{ username, role }`

### Admin (JWT required via Bearer token)
- `GET /api/admin/posts` — All posts for dashboard
- `GET /api/admin/posts/:id` — Single post for editing
- `POST /api/admin/posts` — Create post
- `PUT /api/admin/posts/:id` — Update post
- `DELETE /api/admin/posts/:id` — Delete post
- `GET /api/admin/users` — List users (superadmin only)
- `DELETE /api/admin/users/:id` — Delete user (superadmin only, can't delete self)
- `GET /api/admin/gallery` — List gallery photos
- `POST /api/admin/gallery` — Upload photo (base64 in JSON body, max 4MB)
- `PUT /api/admin/gallery/reorder` — Reorder gallery photos
- `DELETE /api/admin/gallery/:id` — Delete gallery photo

## Authentication Architecture

**Cross-origin setup:** Frontend on `www.cbfchurch.com` (GitHub Pages), API on `cbfchurch.onrender.com` (Render). Modern browsers block third-party cookies between different origins, so auth uses **localStorage + Authorization Bearer header**.

Flow:
1. Login POST returns `{ token, username, message }` — token also set as httpOnly cookie (fallback)
2. Frontend stores token in `localStorage` as `cbf_token`
3. All admin requests use `authFetch()` in `js/admin.js` which attaches `Authorization: Bearer <token>`
4. `requireAuth` middleware checks cookie first, then falls back to Bearer header
5. Logout: `POST /api/auth/logout` + `localStorage.removeItem('cbf_token')`

**Role system:**
- `superadmin` — Can manage users, posts, and gallery
- `admin` — Can manage posts and gallery only
- User with id=1 is auto-promoted to superadmin by `init.js`

**Important:** Do NOT switch back to cookie-only auth. The cross-origin setup requires the Bearer token approach.

## Environment Variables

### Render (production)
- `DATABASE_URL` — Neon PostgreSQL connection string
- `SESSION_SECRET` — JWT signing secret
- `NODE_ENV` — Must be `production`
- `ALLOWED_ORIGIN` — Comma-separated: `https://www.cbfchurch.com,https://99redder.github.io`

### Local (`api/.env`, gitignored)
- `PORT=3000`
- `DATABASE_URL=postgresql://...` (Neon connection string)
- `SESSION_SECRET=cbf-dev-secret-change-in-production`
- `ALLOWED_ORIGIN=http://localhost:8080`

## Dark Mode

- CSS custom properties on `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`
- Theme stored in `localStorage` as `cbf-theme` (`'dark'` or `'light'`)
- Public pages: `.theme-toggle` button in nav, logic in `js/common.js`
- On mobile the nav is hidden, so the theme toggle lives in the "More" bottom sheet
  (`.tab-sheet-theme`); it simply forwards a click to the hidden `.theme-toggle` so
  there is one source of truth for the theme logic
- Admin pages: `#admin-theme-toggle` button in `.admin-header`, logic in `js/admin.js`
- `login.html` has inline theme JS since it doesn't load `admin.js` at parse time
- Both use the same `cbf-theme` key so preference syncs across public and admin pages

## Legal Modals (Privacy Policy & Terms of Use)

- Links are in the footer of all 12 public pages: `id="privacy-link"` and `id="terms-link"`
- `js/common.js` detects these IDs on load, injects a modal into `document.body`, and wires up open/close
- Modal closes on X button, overlay click, or Escape key
- Content is defined inline in `common.js` — edit there to update policy text

## Mobile App Experience (mobile-only, ≤768px)

**Philosophy:** on phones the site should feel like a **native app**, not a shrunk-down
desktop page. The desktop layout is considered "done" and must stay pixel-identical — every
mobile change is scoped to `@media (max-width: 768px)` and, where DOM is transformed, guarded
so desktop is never affected.

**Where it lives:** there is no HTML template — the nav/header/sidebar markup is hand-copied
into all 14 public pages. So rather than edit every file, **all mobile chrome is injected at
runtime by `js/common.js`** (same pattern as the legal modal). Each injector is a self-invoking
function guarded to run once. This means: to change the mobile app, edit `js/common.js` +
`css/style.css` only — never the individual HTML pages.

The mobile pieces (all in `common.js`, all mirrored by CSS sections in `style.css`):

1. **Compact top app bar** — the tall desktop banner (`.site-header`) becomes a slim sticky bar
   on mobile; the whole top nav (`.site-nav`) is hidden. Pure CSS (no injection).
2. **Mobile wordmark** — the wide `images/wordmark.svg` shrinks to unreadable text in the slim
   bar, so `addMobileWordmark()` injects `images/wordmark-mobile.svg` (church name stacked on two
   lines, same colors/fonts). CSS shows `.header-wordmark-mobile` and hides `.header-wordmark`
   only ≤768px (and vice-versa).
3. **Bottom tab bar** (`.tab-bar`) — fixed, thumb-reachable: **Home · Beliefs · Times · Location ·
   More**. Built by `initMobileTabBar()`. Active tab is derived from `currentPage`; any page not
   in the primary tabs marks **More** active. Tabs may be `external: true` (opens in a new tab,
   never marked active). **Location** deep-links to `service-times.html#location` (the map
   section, which has `scroll-margin-top` so it clears the sticky header). `body` gets
   `padding-bottom` to clear the bar.
4. **"More" bottom sheet** (`.tab-sheet-overlay` / `.tab-sheet`) — slide-up sheet with the
   overflow links (Photo Gallery, Mission Statement, CBF History, Learn the Truth, Article
   Archives, Video Archive, Contact, Donate, Admin Login) + the dark-mode toggle. Opens from the
   More tab; closes on backdrop tap / Escape. To add/remove a mobile nav destination or move one
   between the bar and the sheet, edit the `tabs` / `moreLinks` arrays in `initMobileTabBar()`.
5. **Sidebar accordion** — `initSidebarAccordion()` turns the right-hand `.sidebar` (6
   `.sidebar-section` cards: Learn the Truth, Service Times, Location, Archives & Videos, Follow
   Us, Ministries) into collapsible accordion rows. Each `<h3>` becomes the trigger (`role=button`,
   Enter/Space), content moves into a `.sidebar-acc-body`; open state is a `.open` class (no inline
   styles, so it survives resize). It also **appends the footer links as extra dropdowns** after
   Ministries: Contact Us (blurb + link to the contact page), Privacy Policy, and Terms of Use.
   Privacy/Terms (`.sidebar-acc-doc`, larger max-height) expand to their full legal text inline,
   reusing the shared `cbfLegalContent` copy that `initLegalModals` also feeds the desktop modals.

On mobile the `.site-footer` is **unpinned (static)** and keeps only the copyright line — the
Contact / Privacy / Terms links (`.footer-links`) are hidden and live in the accordion instead.
On desktop the footer is `position: fixed` with its links, unchanged.

**Home-page-only mobile cards** — `index.html` has two extra cards in the main column, above the
blog list, that are `display: none` on desktop and shown only ≤768px (plain HTML + CSS, no
injection): `.learn-truth-main` (a copy of the Learn the Truth links) and `.donate-mobile` (a
streamlined giving widget — frequency + amount + custom + Stripe, reusing `js/donate.js`; the
name/email fields and info card from the full `donate.html` are intentionally dropped). `index.html`
loads `js/donate.js` for the widget; on desktop the hidden form is inert. The widget's form carries
`data-source="home"`, which `donate.js` forwards as `source` to the API; when the API sees
`source=home` it points Stripe's **cancel** URL back to `index.html?canceled=1#donate` (the widget)
instead of the full donate page. Success still returns to `donate.html?paid=1` (its thank-you
overlay). `#donate` has `scroll-margin-top` so the return clears the sticky header. On that return
`donate.js` (`drawAttentionToStatus`) scrolls the status message into view and pulses it
(`.attention-pulse`, respects `prefers-reduced-motion`) so the user sees that no charge was made.

**Desktop-safety rules (important for future edits):**
- Every mobile style is under `@media (max-width: 768px)`.
- Injectors that transform the DOM (`initSidebarAccordion`) are **`matchMedia('(max-width:768px)')`
  gated** — they never build on a real desktop.
- The tab bar / sheet / sidebar-accordion each have a `@media (min-width: 769px)` **safety net**
  that force-hides or force-expands them, so even if an injector runs at a transient desktop width
  the desktop render stays correct.
- The mobile nav toggle (`.nav-toggle`) toggles **all** `.nav-links` rows (the markup has a primary
  and a secondary `<ul>`); toggling only the first was a bug that hid Contact/Donate/Admin.

**Testing locally:** `python3 -m http.server 8099` from repo root, then a browser at
`http://localhost:8099`. Resize to ≤768px (e.g. 390px) for the app view; ≥769px for desktop.
Note: `innerWidth` can momentarily read `0` right after navigation in some embedded browsers,
which transiently matches the mobile query — the `min-width:769px` safety nets exist partly for
this.

## Gallery Storage

`api/utils/storage.js` abstracts gallery photo storage:
- If `AWS_ACCESS_KEY_ID` is set in env → stores to S3, saves `storage_key` and `url` in DB
- Otherwise → saves to local filesystem at `api/uploads/gallery/`
- `attachPublicUrl(photo)` normalizes the photo object for API responses

**Warning:** Render free tier has ephemeral filesystem — local uploads will be lost on redeploy. Use S3 for persistent gallery uploads in production.

## Common Tasks

### Run API locally
```bash
cd api && npm install && node server.js
```

### Seed initial admin account
```bash
cd api && node database/seed.js <username> <password>
```

### Reset a user's password
Run from `api/` directory (uses local `.env` to connect to Neon directly):
```bash
node -e "
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await client.connect();
  const hash = bcrypt.hashSync('NEW_PASSWORD', 10);
  await client.query('UPDATE users SET password_hash = \$1 WHERE username = \$2', [hash, 'USERNAME']);
  console.log('Password updated');
  await client.end();
})();
"
```
Note: Render free tier has no shell access. Always run DB maintenance scripts locally against Neon.

### Serve frontend locally
```bash
npx serve .
# Then visit http://localhost:3000 (or whatever port serve uses)
# Make sure api/.env has ALLOWED_ORIGIN=http://localhost:3000
```

### Add a new public page
1. Copy the structure from an existing simple page (e.g. `our-beliefs.html`)
2. Update `<title>`, `<meta name="description">`, and canonical `<link rel="canonical">`
3. Add Open Graph tags (`og:title`, `og:description`, `og:url`)
4. Add the nav link in every page's `<nav>` (all nav bars are hand-coded — no template)
5. Load `js/common.js` at the bottom of `<body>`
6. Add the page to `sitemap.xml`

The **mobile app chrome is automatic** — as long as the page loads `js/common.js` and keeps the
standard markup hooks (`.header-logo-link` in the header, `.site-nav`, and — if it has one — an
`<aside class="sidebar">` of `.sidebar-section` cards), `common.js` injects the compact header,
bottom tab bar, "More" sheet, and sidebar accordion for you. If the new page should appear as a
tab or in the "More" sheet, add it to the `tabs`/`moreLinks` arrays in `initMobileTabBar()`.

## Key Files to Know

| File | Purpose |
|------|---------|
| `js/admin.js` | All admin logic: `authFetch()`, theme toggle, auth check, dashboard, editor, gallery CRUD, user management |
| `js/common.js` | Public pages: `API_BASE`, nav toggle, theme toggle, `formatDate()`, `apiFetch()`, legal modals, **mobile app chrome** (`addMobileWordmark`, `initMobileTabBar`, `initSidebarAccordion`) |
| `css/style.css` | Single stylesheet: public site, admin panel, dark mode, **mobile app bar/sheet/accordion**, responsive (breakpoints: 768px, 1024px) |
| `images/wordmark-mobile.svg` | Stacked two-line wordmark shown only in the mobile header |
| `api/server.js` | Express app: CORS (multi-origin), cookie-parser, route mounting |
| `api/utils/auth.js` | `createToken()`, `verifyToken()`, `requireAuth`, `requireSuperAdmin` |
| `api/utils/db.js` | PostgreSQL pool + `run()`, `get()`, `all()`, `exec()` helpers |
| `api/utils/storage.js` | `saveGalleryImage()`, `deleteGalleryImage()`, `attachPublicUrl()` |
| `api/database/init.js` | Table creation + all column migrations (idempotent, runs on every start) |
| `api/routes/admin.js` | Protected CRUD: posts, gallery, users |
| `sitemap.xml` | All public page URLs for search engines |
| `robots.txt` | Allows all crawlers, points to sitemap, blocks `/admin/` |

## CSS Architecture Notes

`css/style.css` is organized in sections (use comments to navigate):
1. CSS custom properties (`:root`) — colors, fonts, spacing, shadows
2. Dark mode overrides (`[data-theme="dark"]` + `@media prefers-color-scheme`)
3. Reset / base styles
4. Layout (header, nav, main, footer)
5. Components (cards, buttons, forms, alerts, badges)
6. Page-specific (blog, gallery, archives, contact, video)
7. Admin panel (`.admin-header`, `.posts-table`, `.editor-container`, gallery admin)
8. Dark mode overrides for admin elements and Quill editor
9. Responsive breakpoints (768px, 1024px)
10. Mobile app chrome — `.tab-bar`, `.tab-sheet*`, sidebar accordion (`.sidebar-accordion`,
    `.sidebar-acc-*`), compact header, mobile wordmark. All under `@media (max-width: 768px)`
    with `@media (min-width: 769px)` safety nets. See "Mobile App Experience" above.

All colors use CSS custom properties — never use hardcoded hex values in new rules.

## Important Notes

- The `api/.env` file contains database credentials and is gitignored. Never commit it.
- Render free tier has no shell access and ephemeral filesystem — use S3 for gallery storage and local scripts for DB maintenance.
- All public HTML pages share the same hand-coded nav structure — any **desktop** nav change must be made in every file. **Mobile** nav is generated once in `js/common.js`, so mobile changes are made there only.
- Desktop is intentionally frozen: keep all mobile work inside `@media (max-width: 768px)` and never let a mobile-only DOM injection alter the ≥769px render (matchMedia-gate the build and/or add a `min-width: 769px` safety net). See "Mobile App Experience".
- SQL uses `$1`, `$2` parameterized queries (PostgreSQL style, not `?`).
- CORS accepts only origins in `ALLOWED_ORIGIN` env var (comma-separated).
- The Quill.js editor is loaded from CDN — do not try to install it locally.
- `post.html` uses URL query param `?slug=` to fetch a single post dynamically.
- Blog posts were originally imported from Blogger via `scripts/import-blogger.js`.
- Static gallery photos in `images/gallery/` are served from GitHub Pages (git-committed). Admin-uploaded photos are served from Render/S3.
