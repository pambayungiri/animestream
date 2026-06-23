# Anime Streaming Site Clone — Master Playbook

> Built from real experience cloning otakudesu.blog and migrating to samehadaku.me in June 2026.
> Use this before writing a single line of code.

---

## Table of Contents

1. [Pre-Build Investigation](#1-pre-build-investigation)
2. [Reverse Engineering the Video API (From Zero)](#2-reverse-engineering-the-video-api-from-zero)
3. [Architecture](#3-architecture)
4. [Tech Stack Gotchas](#4-tech-stack-gotchas)
5. [Cloudflare & Scraping Problems](#5-cloudflare--scraping-problems)
6. [Schedule Page Strategy](#6-schedule-page-strategy)
7. [Embed Mechanisms by Site Type](#7-embed-mechanisms-by-site-type)
8. [UI Guidelines](#8-ui-guidelines)
9. [Vercel Deployment Checklist](#9-vercel-deployment-checklist)
10. [Problems & Resolutions Reference](#10-problems--resolutions-reference)
11. [Copy-Paste Prompt Template](#11-copy-paste-prompt-template)
12. [Provider Implementation Checklist](#12-provider-implementation-checklist)

---

## 1. Pre-Build Investigation

**Do this before writing any code. It saves days.**

---

## 2. Reverse Engineering the Video API (From Zero)

This is the most important skill. When you open a new anime site, you don't know how it serves video. This section is the exact detective process to figure it out — no prior knowledge required.

### Step 1: Open the site and go to an episode page

Pick any popular ongoing anime (One Piece, Naruto, etc.) and click to an episode. You need a page that has a working video player.

### Step 2: Open Browser DevTools → Network tab

1. Press `F12` or right-click → Inspect
2. Click the **Network** tab
3. Filter to **XHR/Fetch** only (click the XHR button)
4. **Clear the log** so it starts fresh
5. Now click one of the mirror/server buttons on the page to load the video

Watch what requests appear. You're looking for:
- A POST request to `admin-ajax.php` → **WordPress AJAX pattern**
- Nothing at all (video was already in the page) → **base64 in HTML pattern**
- A request to `/proxy.php` or `/btube.php` → **Encrypted proxy pattern**

### Step 3A: If you see admin-ajax.php requests (WordPress AJAX)

Click the request in DevTools. Check:
- **Request Payload** tab → shows what was POSTed
- **Response** tab → shows what came back

You'll see something like:
```
POST admin-ajax.php
Payload: action=aa1208d27f29ca340c92c66d1926f13f
Response: {"status":"success","data":"nonce_value_here"}
```

Then a second request:
```
POST admin-ajax.php
Payload: id=12345&i=0&q=720p&nonce=abc123&action=2a3505c93b0035d3f455df82bf976b84
Response: {"status":"success","data":"PGlmcmFtZSBzcmM9Imh0dHBzOi8v..."}  ← base64
```

Decode that base64 response:
```bash
echo "PGlmcmFtZSBzcmM9Imh0dHBzOi8v..." | base64 -d
# → <iframe src="https://vidhide.com/embed/abc123" width="100%" ...></iframe>
```

The `src` attribute is your embed URL. Now you know the full chain.

**To find the two action hashes without clicking in the browser:**
```bash
# Grep the episode page source for 32-character hex strings (action hashes)
curl -s "https://[site]/episode/[any-slug]/" \
  | grep -oP "[a-f0-9]{32}" | sort -u

# Also look for where they're used:
curl -s "https://[site]/episode/[any-slug]/" \
  | grep -oP "action['\"]?\s*:\s*['\"]?[a-zA-Z0-9_]{20,}" | head -10
```

**To find the `data-content` (the {id, i, q} payload):**
```bash
# Mirror buttons have a data-content attribute with base64-encoded JSON
curl -s "https://[site]/episode/[any-slug]/" \
  | grep -oP 'data-content="[^"]+"' | head -5

# Decode one of them:
curl -s "https://[site]/episode/[any-slug]/" \
  | grep -oP 'data-content="[^"]+"' | head -1 \
  | grep -oP '"[A-Za-z0-9+/=]+"' | tr -d '"' | base64 -d
# → {"id": 12345, "i": 0, "q": "720p"}
```

**Now reproduce the full chain with curl (no browser needed):**
```bash
SITE="https://[site]"
NONCE_ACTION="[32-char hash from above]"
EMBED_ACTION="[other 32-char hash]"

# Step 1: Get nonce
NONCE=$(curl -s -X POST "$SITE/wp-admin/admin-ajax.php" \
  -H "Referer: $SITE" \
  -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -d "action=$NONCE_ACTION" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data'])")
echo "Nonce: $NONCE"

# Step 2: Get embed URL (use id/i/q from the data-content you decoded)
curl -s -X POST "$SITE/wp-admin/admin-ajax.php" \
  -H "Referer: $SITE" \
  -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -d "id=12345&i=0&q=720p&nonce=$NONCE&action=$EMBED_ACTION" \
  | python3 -c "
import sys, json, base64
d = json.load(sys.stdin)
html = base64.b64decode(d['data']).decode()
print(html)
"
# → <iframe src="https://vidhide.com/embed/xyz">
```

If this curl works, your scraping implementation will work.

### Step 3B: If you see NO network requests (video was already in page)

The embed URLs are baked directly into the HTML. Look for a `<select>` or radio buttons with suspiciously long encoded values:

```bash
# Look for base64-encoded option values (long strings of A-Z, a-z, 0-9, +, /)
curl -s "https://[site]/episode/[slug]/" \
  | grep -oP '<option[^>]+value="[A-Za-z0-9+/=]{30,}"' | head -5

# Decode one:
curl -s "https://[site]/episode/[slug]/" \
  | python3 -c "
import sys, re, base64
html = sys.stdin.read()
# Find all long base64 values in option tags
vals = re.findall(r'<option[^>]+value=\"([A-Za-z0-9+/=]{30,})\"', html)
for v in vals[:3]:
    try:
        print(base64.b64decode(v + '==').decode())
    except:
        pass
"
# → <iframe src="https://blogger.com/video.g?token=AD6v5d...">
```

If this gives you iframe HTML, it's Pattern B — no AJAX needed.

### Step 3C: If you see a proxy script request

```bash
# Check what the proxy returns:
curl -s "https://[site]/proxy.php?url=[encrypted_param]" -L -v 2>&1 | grep "Location\|https"
```

If it redirects to a `googlevideo.com` URL, it's Pattern C. These URLs are **IP-locked** — they'll only work for the IP that fetched them. This means you cannot proxy them through your server. The user's browser must fetch and resolve the URL directly.

### Step 4: Verify the embed URL actually plays

Take whatever embed URL you extracted and:
1. Open it directly in your browser: `https://vidhide.com/embed/xyz`
2. Or embed it in a test HTML file: `<iframe src="https://vidhide.com/embed/xyz" width="800" height="450"></iframe>`

If you see a video player → ✅ you've found the real API, implementation will work.
If you see a blank page or error → the URL may be expired, IP-locked, or require Referer headers.

### Step 5: Document what you found

Before writing code, write down:
```
Site: [name]
Base URL: https://[domain]
Embed pattern: A / B / C
Ongoing page: /[path]/?page=N  (or /page/N/)
Episode page: /[pattern]/
Card selector: article.[class] or div.[class]
Thumbnail selector: img.[class]
Title selector: h2.[class] or .title
Mirror selector: [if Pattern B] select.[class] option[value]
Nonce action hash: [if Pattern A] [hash]
Embed action hash: [if Pattern A] [hash]
Cloudflare: yes/no (tested with curl)
Schedule in static HTML: yes/no (curl | grep -c "anime")
```

This document becomes the spec for your provider implementation.

---

### 1.1 Pick Your Source Site Wisely

Test these things on any candidate site **before** committing:

```bash
# Test 1: Does it block cloud IPs?
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  "https://[site]/ongoing-anime/" -o /dev/null -w "%{http_code}"
# 200 = good. 403 = Cloudflare IP block. Don't use this site if you're deploying to Vercel/cloud.

# Test 2: Does the schedule render in static HTML?
curl -s "https://[site]/jadwal-rilis/" | grep -c "anime\|episode"
# 0 = JS-rendered (need Jikan workaround). >0 = scrapeable.

# Test 3: Does search work without JS?
curl -s "https://[site]/?s=one+piece" | grep -c "article\|anime-card"
# >0 = search is scrapeable.
```

**Ranking of Sub Indo sites (as of 2026):**

| Site | CF Block | Schedule | Embed Type | Recommended |
|---|---|---|---|---|
| samehadaku.me | ❌ None | JS-rendered | Base64 in HTML | ✅ Best for Vercel |
| otakudesu.blog | ✅ Blocks cloud IPs | Static HTML | WordPress AJAX | ⚠️ VPS only |
| kusonime.com | Test first | Test first | Test first | Unknown |
| animeindo.lol | ✅ Blocks | Static | Encrypted proxy | ❌ Avoid |

### 1.2 Map the URL Structure

```bash
# Fetch these pages and note the actual URL patterns
curl -s "https://[site]/" | grep -oP 'href="[^"]+anime[^"]*"' | sort -u | head -20
curl -s "https://[site]/" | grep -oP 'href="[^"]+episode[^"]*"' | sort -u | head -10
```

Key pages to find:
- Homepage
- Ongoing list (with pagination pattern: `?page=2` or `/page/2/`)
- Complete list
- Schedule
- Genre list + genre detail
- Anime detail
- Episode player

### 1.3 Find the Embed Mechanism (Most Important Step)

**Three patterns exist — identify which one your target site uses:**

#### Pattern A — WordPress AJAX (otakudesu style)

```bash
# Look for these signals in episode page HTML:
curl -s "https://[site]/episode/[any-slug]/" | grep -oP "(nonce|admin-ajax|action)['\"]?[^;]{0,80}"

# If you see admin-ajax.php + action hashes, it's Pattern A
# Extract the two action hashes (they look like 32-char hex strings):
curl -s "https://[site]/episode/[slug]/" | grep -oP "[a-f0-9]{32}" | sort -u
```

Two-step process:
```bash
# Step 1: Get nonce
NONCE=$(curl -s -X POST "https://[site]/wp-admin/admin-ajax.php" \
  -d "action=[NONCE_ACTION_HASH]" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'])")

# Step 2: Decode mirror button data
DATA=$(curl -s "https://[site]/episode/[slug]/" \
  | grep -oP 'data-content="[^"]+"' | head -1 \
  | grep -oP '"[A-Za-z0-9+/=]+"' | tr -d '"' | base64 -d)
# DATA = {"id": 12345, "i": 0, "q": "720p"}

# Step 3: Get embed URL
curl -s -X POST "https://[site]/wp-admin/admin-ajax.php" \
  -d "id=12345&i=0&q=720p&nonce=$NONCE&action=[EMBED_ACTION_HASH]" \
  | python3 -c "import sys,json,base64; d=json.load(sys.stdin); print(base64.b64decode(d['data']).decode())"
# → <iframe src="https://vidhide.com/embed/[id]">
```

#### Pattern B — Base64 in HTML (samehadaku style)

```bash
# Look for <select class="mirror"> with base64 option values:
curl -s "https://[site]/episode/[slug]/" | grep -oP '<option value="[A-Za-z0-9+/=]{30,}"' | head -3

# Decode any option value:
curl -s "https://[site]/episode/[slug]/" \
  | python3 -c "
import sys, re, base64
html = sys.stdin.read()
vals = re.findall(r'<option value=\"([A-Za-z0-9+/=]{30,})\"', html)
for v in vals[:3]:
    print(base64.b64decode(v).decode())
"
# → <iframe src="https://blogger.com/video.g?token=...">
```

No AJAX needed — all embed URLs are in the page HTML. Pre-decode in `getEpisode()` and store in `mirror.src`.

#### Pattern C — Encrypted Proxy (animeindo style)

```bash
# Look for proxy script src:
curl -s "https://[site]/episode/[slug]/" | grep -oP '/[a-z]+\.php\?[^"]+' | head -5
```

⚠️ URLs resolved by this proxy are Google Video CDN links — **IP-locked and short-lived**. They MUST be fetched from the user's browser at click time, never server-side.

### 1.4 Verify End-to-End Before Building

```bash
# Pick a popular anime (One Piece, Naruto, etc.) and verify a working embed URL:
# 1. Get embed URL using the pattern above
# 2. Open it in your browser
# 3. Confirm video plays

# Test on 2-3 backup sites too — proves provider pattern is viable
```

### 1.5 Check Selector Patterns

```bash
# Anime card selectors — adjust to match the site:
curl -s "https://[site]/ongoing-anime/" | python3 -c "
from html.parser import HTMLParser
import sys
# Look for repeating article/div patterns that wrap anime cards
" 

# Easier: open in browser, right-click a card, Inspect Element
```

---

## 2. Architecture

### 2.1 Folder Structure

```
app/
  page.tsx                      → homepage (ISR or force-dynamic)
  ongoing/page.tsx              → paginated ongoing grid
  complete/page.tsx             → paginated complete grid
  schedule/page.tsx             → weekly release schedule
  genre/page.tsx                → genre tag cloud
  genre/[name]/page.tsx         → anime by genre
  anime/[slug]/page.tsx         → anime detail + episode list
  episode/[slug]/page.tsx       → episode player
  search/page.tsx               → search results (force-dynamic)

app/api/                        → keep these for any client-side calls
  embed/route.ts                → ALWAYS force-dynamic, never cached

lib/
  providers/
    types.ts                    → AnimeProvider interface + all types
    [sitename].ts               → one file per source site
    index.ts                    → factory, reads ANIME_PROVIDER env var
  scraper.ts                    → shared HTTP + Cheerio helpers
  config.ts                     → all env vars in one place, throws if missing
```

### 2.2 Provider Interface

```typescript
interface AnimeProvider {
  getOngoing(page?: number): Promise<PaginatedResult<AnimeCard>>
  getComplete(page?: number): Promise<PaginatedResult<AnimeCard>>
  getSchedule(): Promise<WeeklySchedule>
  getGenres(): Promise<Genre[]>
  getByGenre(genre: string, page?: number): Promise<PaginatedResult<AnimeCard>>
  getAnimeDetail(slug: string): Promise<AnimeDetail>
  getEpisode(slug: string): Promise<EpisodeDetail>
  getEmbedUrl(id: number, mirror: number, quality: string): Promise<string>
  search(query: string): Promise<AnimeCard[]>
}

interface Mirror {
  quality: string   // "720p", "480p", etc.
  index: number     // mirror index
  label: string     // "Player 1", "vidhide", etc.
  id: number        // post_id (for AJAX providers); 0 for others
  src?: string      // pre-decoded embed URL (Pattern B providers — skip /api/embed)
}
```

### 2.3 Data Flow

```
Pages call getProvider() directly — NEVER self-fetch their own API routes:

  page.tsx → getProvider().getOngoing() → Cheerio scrapes source site

The /api/embed route exists only for client-side calls:

  User clicks mirror → VideoPlayer POSTs to /api/embed (if mirror.src absent)
  → server fetches nonce + embed URL → returns {src: "..."} → iframe renders
```

### 2.4 Switching Providers

One env var change migrates the entire site:

```env
ANIME_PROVIDER=samehadaku   # currently samehadaku.me
ANIME_PROVIDER=otakudesu    # switch back to otakudesu
```

Factory in `lib/providers/index.ts`:
```typescript
let instance: AnimeProvider | null = null;
export function getProvider(): AnimeProvider {
  if (instance) return instance;
  switch (process.env.ANIME_PROVIDER) {
    case 'samehadaku': instance = new SamehadakuProvider(); break;
    case 'otakudesu':  instance = new OtakudesuProvider();  break;
    default:           instance = new SamehadakuProvider();
  }
  return instance;
}
```

---

## 3. Tech Stack Gotchas

### 3.1 Tailwind v4 — Config File Is Ignored

`pnpm create next-app@latest` installs **Tailwind v4**, not v3. In v4:
- `tailwind.config.ts` is **NOT read at runtime** — it's dead code
- All theme configuration must live in `app/globals.css`

```css
/* app/globals.css — this is the only config that works in v4 */
@import "tailwindcss";

@theme {
  --color-background: #0f0f13;
  --color-surface: #16161f;
  --color-surface-2: #1e1e2a;
  --color-accent: #e85d04;
  --color-muted: #6b7280;
  --color-border: #2a2a38;
  --color-foreground: #f1f5f9;
}
```

### 3.2 Next.js 16 — `params` Is a Promise

`pnpm create next-app@latest` installs Next.js **16**, not 15. In Next.js 16:

```typescript
// ❌ WRONG — Next.js 15 style:
export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params; // undefined

// ✅ CORRECT — Next.js 16:
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
```

This applies to **both** `params` and `searchParams` on every dynamic route.

### 3.3 Never Self-Fetch Your Own API Routes From Pages

Pages that call `fetch(${NEXT_PUBLIC_BASE_URL}/api/...)` **fail at build time** — no server is running during `next build`.

```typescript
// ❌ WRONG — self-fetch pattern:
const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ongoing`);
const data = await res.json();

// ✅ CORRECT — call provider directly:
import { getProvider } from "@/lib/providers";
const provider = getProvider();
const data = await provider.getOngoing(page);
```

The `/api/*` routes still exist — client-side code (VideoPlayer) uses them. Pages don't.

### 3.4 ISR + External Scraping = Build Failure

Using `export const revalidate = 7200` causes Next.js to pre-render pages at build time, which requires fetching from the source site. If Cloudflare blocks the build server's IP, every page fails to build.

```typescript
// ❌ ISR — breaks if source site blocks build server IP:
export const revalidate = 7200;

// ✅ force-dynamic — renders on-demand, no build-time fetch:
export const dynamic = "force-dynamic";
```

Trade-off: no caching means every page load hits the source site. For personal use this is fine. For high traffic, add `unstable_cache` at the provider layer.

### 3.5 `got-scraping` Doesn't Work on Vercel/Turbopack

`got-scraping` uses `header-generator` which reads `.zip` data files via `__dirname` at runtime. Turbopack rewrites `__dirname` and doesn't bundle those binary files — causing `ADM-ZIP: Invalid filename` at runtime.

**Use plain `got` or `axios` instead.** If Cloudflare is blocking, it's doing so by IP ASN — TLS fingerprinting won't help.

---

## 4. Cloudflare & Scraping Problems

### 4.1 How to Tell If You're Blocked

```bash
# From your local machine (residential IP):
curl -s "https://[site]/ongoing-anime/" -o /dev/null -w "%{http_code}"
# 200 = fine locally

# Simulate a cloud/datacenter IP (use a VPS or check Vercel logs):
# If Vercel returns: {"error": "Request failed with status code 403"}
# → Cloudflare is blocking by IP ASN
```

The error message from Cloudflare is: **"Sorry, you have been blocked"**

### 4.2 What Works vs What Doesn't

| Approach | Bypasses CF? | Why |
|---|---|---|
| Better User-Agent headers | ❌ | IP is still datacenter |
| `got-scraping` TLS fingerprint | ❌ | IP is still datacenter + crashes on Vercel |
| Switch to non-CF-protected site | ✅ | Different site, no block |
| Residential proxy service (Webshare, Brightdata) | ✅ | Non-datacenter IPs |
| Cloudflare Worker proxy | ✅ | CF Workers aren't blocked by CF WAF |
| Self-hosted VPS (Hetzner, etc.) | ✅ | Residential-range IPs |

### 4.3 The Right Fix: Choose a Non-Blocked Source Site

Before building, test your target site from a cloud IP. The fastest fix is picking a source site that doesn't block cloud IPs:

```bash
# Quick test — pretend to be a Vercel function:
curl -s -A "vercel-internal" "https://[site]/ongoing-anime/" -w "\n%{http_code}\n"
```

If it returns 403, choose a different site or plan to use a proxy.

### 4.4 If You Must Use a CF-Protected Site

**Option A — Residential Proxy (easiest paid option):**
```typescript
// In lib/scraper.ts, add proxy to got:
import { gotScraping } from 'got'; // plain got, not got-scraping
const res = await got(url, {
  agent: { https: new HttpsProxyAgent(process.env.PROXY_URL!) }
});
```

**Option B — Cloudflare Worker Proxy (free, 100k req/day):**
```javascript
// workers/proxy.js — deploy to Cloudflare Workers
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    return fetch(target, { headers: request.headers });
  }
}
```
Then set `BASE_URL=https://your-worker.workers.dev?url=https://[site]` in your env.

**Option C — VPS (€4/month, most reliable):**
Deploy a simple Express scraping API on Hetzner CX11. Vercel calls the VPS, VPS calls the source site. Non-datacenter IPs aren't blocked.

---

## 5. Schedule Page Strategy

### 5.1 The Problem

Most Sub Indo sites render their schedule via JavaScript (hidden via inline `<script>` tags). Cheerio can't run JS — so scraping the schedule page returns empty results.

### 5.2 The Solution: Jikan API + Fuse.js Cross-Reference

Use **Jikan** (free unofficial MyAnimeList API, no auth, no rate-limit key) for schedule data, then cross-reference against the source site's ongoing list to filter to only available anime.

```typescript
import Fuse from 'fuse.js';

async function getSchedule(): Promise<WeeklySchedule> {
  // 1. Build title pool from source site's ongoing list
  const pool: string[] = [];
  const first = await this.getOngoing(1);
  pool.push(...first.data.map(a => a.title));
  for (let p = 2; p <= first.totalPages; p++) {
    const page = await this.getOngoing(p);
    pool.push(...page.data.map(a => a.title));
  }

  // 2. Normalize titles for fuzzy matching
  const norm = (s: string) => s
    .toLowerCase()
    .replace(/\b(\d+)(st|nd|rd|th)\s+season\b/g, (_, n) => `s${n.replace(/\D/g,'')}`)
    .replace(/\bseason\s*(\d+)\b/g, 's$1')
    .replace(/\bpart\s*(\d+)\b/g, 'p$1')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // 3. Build Fuse.js index
  const fuse = new Fuse(pool.map(norm), {
    includeScore: true,
    threshold: 0.35,   // 0=exact, 1=anything. 0.35 = tight but handles typos
    distance: 120,
    minMatchCharLength: 3,
  });

  // 4. Fetch Jikan schedule and filter
  const dayMap = [
    ['monday','Senin'], ['tuesday','Selasa'], ['wednesday','Rabu'],
    ['thursday','Kamis'], ['friday','Jumat'], ['saturday','Sabtu'], ['sunday','Minggu'],
  ];

  const schedule: WeeklySchedule = {};
  for (const [eng, indo] of dayMap) {
    const res = await fetch(`https://api.jikan.moe/v4/schedules?filter=${eng}&limit=25`);
    const { data } = await res.json();
    const seen = new Set<number>();
    const entries = [];

    for (const anime of (data ?? [])) {
      if (seen.has(anime.mal_id)) continue;
      // Check all title variants against source site pool
      const variants = [anime.title, anime.title_english,
        ...(anime.titles ?? []).map((t: {title:string}) => t.title)]
        .filter((t): t is string => !!t && /[a-zA-Z]/.test(t))
        .map(norm);
      if (!variants.some(v => fuse.search(v).length > 0)) continue;
      seen.add(anime.mal_id);
      entries.push({
        title: anime.title,
        slug: norm(anime.title).replace(/\s+/g, '-'),
        thumbnail: anime.images?.jpg?.image_url ?? '',
        score: anime.score ? String(anime.score) : undefined,
      });
    }
    if (entries.length > 0) schedule[indo] = entries;
    await new Promise(r => setTimeout(r, 400)); // Jikan: 3 req/sec limit
  }
  return schedule;
}
```

**Result:** Schedule only shows anime actually available on your source site, with MAL thumbnails and scores. Days with no matching Sub Indo content show empty.

### 5.3 Jikan API Reference

```
GET https://api.jikan.moe/v4/schedules?filter=monday&limit=25
Rate limit: 3 requests/second, 60/minute
Auth: none required
Key fields: title, title_english, titles[], images.jpg.image_url, score, mal_id
```

---

## 6. Embed Mechanisms by Site Type

### Pattern A — WordPress AJAX (otakudesu)

```typescript
// lib/providers/otakudesu.ts
async getEmbedUrl(id: number, mirror: number, quality: string): Promise<string> {
  const base = "https://otakudesu.blog";
  const ajaxUrl = `${base}/wp-admin/admin-ajax.php`;

  // Step 1: Get nonce
  const nonceRes = await postAjax(ajaxUrl,
    { action: process.env.OTAKUDESU_NONCE_ACTION! },
    base
  );
  const nonce = nonceRes.data?.data;

  // Step 2: Get embed HTML
  const embedRes = await postAjax(ajaxUrl,
    { id: String(id), i: String(mirror), q: quality,
      nonce, action: process.env.OTAKUDESU_EMBED_ACTION! },
    base
  );
  const html = Buffer.from(embedRes.data?.data ?? '', 'base64').toString();
  const $ = cheerio.load(html);
  return $('iframe').attr('src') ?? '';
}
```

Env vars needed:
```env
OTAKUDESU_NONCE_ACTION=aa1208d27f29ca340c92c66d1926f13f
OTAKUDESU_EMBED_ACTION=2a3505c93b0035d3f455df82bf976b84
```

⚠️ These hashes **change when the site updates**. If embeds break, re-scrape the episode page and grep for new hashes.

### Pattern B — Base64 in HTML (samehadaku)

```typescript
// In getEpisode() — pre-decode all mirrors, store in mirror.src
$('select.mirror option[value]').each((_, el) => {
  const b64 = $(el).attr('value') ?? '';
  if (!b64) return;
  const html = Buffer.from(b64, 'base64').toString();
  const src = cheerio.load(html)('iframe').attr('src') ?? '';
  mirrors.push({
    quality: '720p',
    index: parseInt($(el).attr('data-index') ?? '0', 10) - 1,
    label: $(el).text().trim(),
    id: 0,      // unused for this pattern
    src,        // pre-decoded — VideoPlayer uses this directly
  });
});

// getEmbedUrl() is never called for this pattern
```

In VideoPlayer:
```typescript
async function loadMirror(mirror: Mirror) {
  if (mirror.src) {
    setEmbedSrc(mirror.src);   // Pattern B — use directly
  } else {
    // Pattern A — fetch from /api/embed
    const res = await fetch('/api/embed', { method: 'POST', ... });
    const { src } = await res.json();
    setEmbedSrc(src);
  }
}
```

### Pattern C — Encrypted Proxy (animeindo)

The resolved URL is a Google Video CDN link — **IP-locked to the browser that fetched it**. Must fetch from user's browser, never from your server. Each URL expires in ~6 hours.

---

## 7. UI Guidelines

Dark theme that looks better than typical Sub Indo sites:

```css
/* Color palette */
--bg: #0f0f13         /* page background */
--surface: #16161f    /* card background */
--surface-2: #1e1e2a  /* hover/active state */
--accent: #e85d04     /* orange — links, borders, badges */
--muted: #6b7280      /* secondary text */
--border: #2a2a38     /* subtle borders */
```

Key UI improvements over typical Sub Indo sites:
- **Score badges**: green ≥8.0, yellow ≥6.0, red <6.0
- **Cards**: `scale-105` hover + `border-accent` highlight
- **Episode list**: scrollable sidebar, not a new page
- **Mirror selector**: pill buttons grouped by quality, not a raw `<select>`
- **Schedule**: thumbnail grid, not a text list
- **No popups, no ad overlays**

---

## 8. Vercel Deployment Checklist

```
Pre-deploy:
[ ] pnpm tsc --noEmit passes with 0 errors
[ ] All pages use `force-dynamic` (not `revalidate`) if source site may block build IPs
[ ] Pages call getProvider() directly — NOT self-fetching own API routes
[ ] .env.local is in .gitignore (never committed)
[ ] All env vars set in Vercel dashboard

Env vars required:
[ ] ANIME_PROVIDER=samehadaku
[ ] SAMEHADAKU_BASE_URL=https://samehadaku.me
[ ] NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
[ ] (if using otakudesu) OTAKUDESU_BASE_URL, OTAKUDESU_NONCE_ACTION, OTAKUDESU_EMBED_ACTION

Post-deploy smoke tests:
[ ] /api/ongoing returns { data: [...], totalPages: N }
[ ] /api/genres returns array with >0 items
[ ] /api/schedule returns object with day keys
[ ] /api/search?q=naruto returns results
[ ] /api/anime/[slug] returns title + episodes
[ ] /api/episode/[slug] returns mirrors with src populated
[ ] Homepage loads with anime cards
[ ] Episode player page renders iframe after clicking a mirror
```

---

## 9. Problems & Resolutions Reference

| Problem | Root Cause | Fix |
|---|---|---|
| Custom Tailwind colors don't work | Tailwind v4 ignores `tailwind.config.ts` | Move all tokens to `globals.css` `@theme {}` |
| `params.slug` is undefined | Next.js 16 — params is a Promise | `await params` before destructuring |
| Pages fail at build time | Self-fetch pattern (`fetch('/api/...')`) | Call `getProvider()` directly in pages |
| ISR causes build 403 | Build server fetches source site at build time | Use `force-dynamic` instead of `revalidate` |
| All API routes return 403 in prod | Cloudflare blocks Vercel datacenter IPs | Switch to non-CF-protected source site or use proxy |
| `got-scraping` crashes on Vercel | Turbopack can't bundle `header-generator` data files | Use plain `got` or `axios` instead |
| Schedule page is empty | Source site renders schedule via JavaScript | Use Jikan API + Fuse.js cross-reference |
| Schedule shows wrong/unavailable anime | Jikan returns all global anime, not just Sub Indo | Cross-reference with source site's ongoing list |
| Schedule shows duplicates | Jikan may list same anime twice | Deduplicate by `mal_id` before returning |
| Genres API returns `[]` | Selector changed (`name="genre"` → `name="genre[]"`) | Re-inspect source site HTML, fix selector |
| `totalPages` always 1 | Pagination selector doesn't match current HTML | Re-inspect pagination HTML, fix selector |
| Embed URL undefined | `postAjax` double-dereference bug | Return full response, not `.data`; callers access `.data` once |
| Mirror iframe is blank | `mirror.src` not populated for Pattern B | Decode base64 in `getEpisode()`, store in `mirror.src` |
| Embed URL expired | Google Video CDN — IP-locked, short-lived | Always fetch client-side, never server-side |
| Site changes domain | Source URL hardcoded | Use `BASE_URL` env var, never hardcode |
| AJAX hashes changed | Source site updated | Re-scrape episode page, grep for new 32-char hashes |

---

## 10. Copy-Paste Prompt Template

Use this as your starting prompt when building a new anime streaming site clone:

```
Build an anime streaming website sourced from [TARGET_SITE].
Language: Sub Indo
Stack: Next.js (latest) App Router, Tailwind CSS, TypeScript
Deploy: Vercel + GitHub

Before writing code, investigate the target site:
1. Test if the site blocks cloud/datacenter IPs:
   curl -s "https://[TARGET_SITE]/[ongoing-path]/" -o /dev/null -w "%{http_code}"
   If result is 403, either pick a different site or plan to use a proxy.

2. Identify the embed mechanism (check episode page HTML):
   - Pattern A (WordPress AJAX): look for admin-ajax.php + 32-char action hashes
   - Pattern B (base64 in HTML): look for <select class="mirror"> with base64 option values
   - Pattern C (encrypted proxy): look for /proxy.php or /btube.php iframe src

3. Extract a working embed URL for [POPULAR_ANIME] latest episode and verify it plays.

4. Test if schedule page renders in static HTML:
   curl -s "https://[TARGET_SITE]/jadwal/" | grep -c "anime"
   If 0, use Jikan API + Fuse.js for schedule (see playbook).

Architecture requirements:
- Provider pattern: AnimeProvider interface so any source site can be swapped via ANIME_PROVIDER env var
- Pages call getProvider() directly — never self-fetch own API routes
- All pages use force-dynamic (not ISR) unless source site is confirmed cloud-IP-friendly
- For Pattern B sites: pre-decode embed URLs in getEpisode(), store in mirror.src
- For Pattern A sites: VideoPlayer POSTs to /api/embed at click time (client-side only)
- Schedule: use Jikan API filtered by Fuse.js cross-reference with source site's ongoing list
- Mirror type must include optional src?: string for pre-decoded embed URLs

UI: Dark theme (#0f0f13 bg, #e85d04 accent), card grid, thumbnail schedule, pill mirror buttons.

Known Next.js/Tailwind gotchas to apply from the start:
- Tailwind v4: put theme tokens in globals.css @theme {}, not tailwind.config.ts
- Next.js 16: params and searchParams are Promises — always await them
- Never self-fetch own API routes from page components
```

---

## 11. Provider Implementation Checklist

When building a new `[Site]Provider`:

```
[ ] fetchPage(url) returns Cheerio-loaded HTML
[ ] getOngoing(page) — anime cards with title, slug, thumbnail, status
[ ] getComplete(page) — same structure
[ ] getSchedule() — use Jikan + Fuse.js if site is JS-rendered
[ ] getGenres() — inspect actual HTML for selector (it changes)
[ ] getByGenre(genre, page) — check if genre slugs use hyphens or underscores
[ ] getAnimeDetail(slug) — title, synopsis, genres[], episodes[], score, studio, type
[ ] getEpisode(slug) — mirrors[], prevSlug, nextSlug, animeSlug, animeTitle
[ ] Pattern A: getEmbedUrl(id, mirror, quality) — 2-step AJAX
[ ] Pattern B: populate mirror.src in getEpisode(), stub getEmbedUrl() with ""
[ ] Pagination: verify parseTotalPages() selector matches actual HTML
[ ] Test genres, pagination, and at least one full episode embed before shipping
[ ] Verify from a cloud IP (Vercel function log) before declaring done
```
