# CBF Church Website

## Overview

Website for Christian Believers Fellowship (CBF), a church at 32 Chapel Lane, Somersworth, NH. The project is split into two deployments:

- **Frontend (GitHub Pages):** Static HTML/CSS/JS site at `www.cbfchurch.com` (repo: chrisgorham999.github.io or similar)
- **Backend API (Render.com free tier):** Node.js/Express API at `cbfchurch.onrender.com`
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
| Blog Editor | Quill.js (CDN) |
| Photo Gallery | CSS Grid + vanilla JS lightbox |
| PWA | Service worker + manifest.json |

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
├── CNAME                          # GitHub Pages custom domain
├── admin/
│   ├── login.html
│   ├── dashboard.html
│   ├── editor.html
│   └── users.html                 # Superadmin only
├── css/
│   └── style.css                  # Single stylesheet, includes dark mode
├── js/
│   ├── common.js                  # Shared: API_BASE, nav toggle, theme toggle, formatDate
│   ├── blog.js                    # Fetch/render blog posts on home page
│   ├── post.js                    # Fetch/render single post
│   ├── archives.js                # Fetch/render archive listing
│   ├── gallery.js                 # Lightbox functionality
│   └── admin.js                   # Auth, dashboard, editor, gallery, user management
├── images/
│   ├── logo.svg
│   ├── wordmark.svg
│   ├── pwa-icon.svg
│   └── gallery/                   # ~60 static gallery photos
├── api/                           # Backend (deployed separately to Render)
│   ├── server.js                  # Express entry point
│   ├── package.json
│   ├── .env                       # Local env (gitignored)
│   ├── .env.example
│   ├── database/
│   │   ├── init.js                # CREATE TABLE + migrations
│   │   └── seed.js                # Create initial superadmin account
│   ├── routes/
│   │   ├── auth.js                # Login, logout, register, /me
│   │   ├── posts.js               # Public blog endpoints (GET)
│   │   ├── admin.js               # Protected blog CRUD, gallery CRUD, user management
│   │   └── gallery.js             # Public gallery endpoints
│   ├── utils/
│   │   ├── db.js                  # PostgreSQL connection pool + helpers (run, get, all, exec)
│   │   └── auth.js                # JWT + bcrypt helpers, requireAuth, requireSuperAdmin
│   └── uploads/
│       └── gallery/               # Uploaded gallery photos (on Render filesystem)
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
    position INTEGER DEFAULT 0,
    alt TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Public (no auth)
- `GET /api/posts?page=1&limit=5` — Paginated blog posts
- `GET /api/posts/:slug` — Single post by slug
- `GET /api/posts/archives` — Posts grouped by year/month
- `GET /api/gallery` — All gallery photos ordered by position
- `GET /api/health` — Health check

### Auth
- `POST /api/auth/login` — Returns JWT in response body + httpOnly cookie
- `POST /api/auth/logout` — Clears cookie
- `POST /api/auth/register` — Create admin account (superadmin only)
- `GET /api/auth/me` — Check auth status, returns username/role

### Admin (JWT required via Bearer token)
- `GET /api/admin/posts` — All posts for dashboard
- `GET /api/admin/posts/:id` — Single post for editing
- `POST /api/admin/posts` — Create post
- `PUT /api/admin/posts/:id` — Update post
- `DELETE /api/admin/posts/:id` — Delete post
- `GET /api/admin/users` — List users (superadmin only)
- `DELETE /api/admin/users/:id` — Delete user (superadmin only, can't delete self)
- `GET /api/admin/gallery` — List gallery photos
- `POST /api/admin/gallery` — Upload photo (base64 in JSON body)
- `PUT /api/admin/gallery/reorder` — Reorder gallery photos
- `DELETE /api/admin/gallery/:id` — Delete gallery photo

## Authentication Architecture

**Cross-origin setup:** Frontend on `www.cbfchurch.com` (GitHub Pages), API on `cbfchurch.onrender.com` (Render). Modern browsers block third-party cookies between different origins, so auth uses **localStorage + Authorization Bearer header** instead of cookies.

Flow:
1. Login POST returns `{ token, username, message }` — token is also set as httpOnly cookie (fallback)
2. Frontend stores token in `localStorage` as `cbf_token`
3. All subsequent requests use `authFetch()` helper in `js/admin.js` which attaches `Authorization: Bearer <token>` header
4. `requireAuth` middleware in `api/utils/auth.js` checks cookie first, then falls back to Bearer header
5. Logout clears both cookie and `localStorage.removeItem('cbf_token')`

**Role system:**
- `superadmin` — Can manage users, manage posts, manage gallery
- `admin` — Can manage posts and gallery only
- The first seeded user (id=1) is auto-promoted to superadmin by `init.js`

## Environment Variables

### Render (production)
- `DATABASE_URL` — Neon PostgreSQL connection string
- `SESSION_SECRET` — JWT signing secret
- `NODE_ENV` — Must be `production`
- `ALLOWED_ORIGIN` — Comma-separated origins, e.g. `https://www.cbfchurch.com,https://chrisgorham999.github.io`

### Local (`api/.env`, gitignored)
- `PORT=3000`
- `DATABASE_URL=postgresql://...` (Neon connection string)
- `SESSION_SECRET=cbf-dev-secret-change-in-production`
- `ALLOWED_ORIGIN=http://localhost:8080`

## Dark Mode

The site supports dark mode via CSS custom properties on `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark)` for system default.

- Theme preference stored in `localStorage` as `cbf-theme` (`'dark'` or `'light'`)
- Public pages: toggle button in nav bar, logic in `js/common.js`
- Admin pages: toggle button in admin header, logic in `js/admin.js` (and inline in `login.html`)
- Both share the same `cbf-theme` localStorage key so preference syncs

## Common Tasks

### Run API locally
```bash
cd api && npm install && node server.js
```

### Seed initial admin account
```bash
cd api && node database/seed.js <username> <password>
```

### Reset a user's password (run from api/ directory)
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

### Serve frontend locally
```bash
npx serve .
# Then visit http://localhost:3000 (or whatever port serve uses)
# Make sure api/.env has ALLOWED_ORIGIN=http://localhost:3000
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `js/admin.js` | All admin panel logic: auth, theme, dashboard, editor helpers, gallery CRUD, user management. Defines `authFetch()` used by all admin pages. |
| `js/common.js` | Shared across public pages: `API_BASE` constant, nav toggle, theme toggle, `formatDate()`, `apiFetch()` |
| `css/style.css` | Single stylesheet for entire site including dark mode, admin styles, responsive breakpoints at 768px and 1024px |
| `api/utils/auth.js` | JWT creation/verification, `requireAuth` and `requireSuperAdmin` middleware |
| `api/utils/db.js` | PostgreSQL pool + helper functions (`run`, `get`, `all`, `exec`) |
| `api/database/init.js` | Table creation + column migrations (runs on every server start) |
| `api/routes/admin.js` | Protected CRUD for posts, gallery, and users |

## Important Notes

- The `api/.env` file contains database credentials and is gitignored. Never commit it.
- Render free tier does not support shell access. Use local scripts connecting to Neon directly for DB maintenance.
- Gallery photos uploaded via admin are stored on Render's filesystem at `api/uploads/gallery/`. Render's free tier has ephemeral storage — files may be lost on redeploy. The static gallery photos in `images/gallery/` are committed to git and served from GitHub Pages.
- The Quill.js editor is loaded from CDN (`cdn.quilljs.com/1.3.7`).
- Blog posts imported from the old Blogger site using `scripts/import-blogger.js`.
- CORS is configured to accept only origins listed in the `ALLOWED_ORIGIN` env var.
- SQL uses `$1`, `$2` parameterized queries (PostgreSQL style, not `?`).
