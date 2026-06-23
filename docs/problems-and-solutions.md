# AnimeStream — Problems & Solutions Log

A reference for developers maintaining or extending this project. Every non-obvious problem hit during the initial build is documented here with its root cause and fix.

---

## 1. Tailwind v4 Installed Instead of v3

**Symptom:** Custom colors (`bg-accent`, `bg-surface`, `text-muted`, etc.) had no effect. The page rendered with default Tailwind colors.

**Root cause:** `pnpm create next-app@latest` resolved to Tailwind CSS **v4** (not v3). In v4, `tailwind.config.ts` is ignored at runtime. All theme configuration must live in `app/globals.css` using the `@theme {}` block.

**Fix:**
```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-background: #0f0f13;
  --color-surface: #16161f;
  --color-surface-2: #1e1e2a;
  --color-accent: #e85d04;
  --color-accent-hover: #f97316;
  --color-muted: #6b7280;
  --color-border: #2a2a38;
  --color-foreground: #f1f5f9;
}
```

**Future note:** `tailwind.config.ts` still exists in the repo but is documentation only — Tailwind v4 never reads it. Add new color tokens to `globals.css`, not the config file.

---

## 2. Next.js 16 Installed — `params` Is a Promise

**Symptom:** `params.slug` was `undefined` on all dynamic routes.

**Root cause:** `pnpm create next-app@latest` resolved to **Next.js 16** (not 15). In Next.js 16, both `params` and `searchParams` in page components are `Promise<{...}>` and must be awaited.

**Fix:**
```tsx
// WRONG (Next.js 15 style):
export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;

// CORRECT (Next.js 16):
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
```

**Future note:** This applies to every dynamic route (`[slug]`, `[name]`, etc.) and to `searchParams` for query strings. The `AGENTS.md` file in the repo root has a reminder about this.

---

## 3. `postAjax` Double-Dereference Bug

**Symptom:** Embed URLs were `undefined`. The nonce fetch returned `undefined` silently.

**Root cause:** `lib/scraper.ts` had `return res.data` inside `postAjax`. Callers then did `const nonce = (await postAjax(...)).data` — accessing `.data` on what was already `.data`, giving `undefined`. TypeScript didn't catch this because everything was typed `any`.

**Fix:** Changed `postAjax` to return the full `AxiosResponse` (now `got` response wrapped as `{ data: JSON.parse(res.body) }`). Callers access `.data` once, correctly.

**Future note:** If you change the HTTP client again, verify the return shape matches what `getEmbedUrl` in `otakudesu.ts` expects.

---

## 4. Self-Fetch Anti-Pattern (Build Failure)

**Symptom:** Vercel build failed with network errors. Pages that called `fetch(${NEXT_PUBLIC_BASE_URL}/api/...)` threw "connection refused" during SSG.

**Root cause:** During `next build`, no server is running. Pages that fetch their own API routes via HTTP have no server to connect to. The self-fetch pattern only works at request-time (SSR), not at build-time (SSG/ISR).

**Fix:** All page components were refactored to call `getProvider()` directly instead of going through HTTP:

```typescript
// WRONG — self-fetch pattern:
const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ongoing`);
const data = await res.json();

// CORRECT — call provider directly:
import { getProvider } from "@/lib/providers";
const provider = getProvider();
const data = await provider.getOngoing(page);
```

The API routes (`app/api/*/route.ts`) still exist for client-side use (the embed endpoint needs them), but pages don't use them.

---

## 5. ISR + Cloudflare = Build-Time 403

**Symptom:** `export const revalidate = 7200` caused build failures because Next.js tries to pre-render pages at build time, which requires fetching from `otakudesu.blog` — whose Cloudflare WAF blocks Vercel's build server IPs.

**Fix:** Replaced `export const revalidate = N` with `export const dynamic = "force-dynamic"` on all pages that call the provider. This disables ISR and makes every request render on-demand (SSR).

**Trade-off:** No caching means every page load hits the upstream site. For low-traffic personal use this is fine. If you need caching, look into `unstable_cache` at the provider layer or a Redis/KV cache.

---

## 6. Cloudflare Blocks Vercel Datacenter IPs (The Main Problem)

**Symptom:** All scraping endpoints returned `{"error":"Failed to fetch"}` in production. Locally everything worked fine.

**Root cause:** `otakudesu.blog` uses Cloudflare WAF with rules that block requests from known cloud datacenter IP ranges (AWS, GCP, Vercel/AWS IAD, etc.). The error from Cloudflare was "Sorry, you have been blocked" — HTTP 403.

**What was tried and failed:**
- Better `User-Agent` / browser-like headers → still 403 (headers don't matter when IP is blocked)
- `got-scraping` (TLS fingerprinting) → works locally, but Vercel's IP is blocked regardless of fingerprint. Also: `got-scraping`'s `header-generator` reads `.zip` data files at runtime that Turbopack doesn't bundle, causing its own build errors.

**Fix:** Switched to `samehadaku.me` as the default provider. Samehadaku has no Cloudflare IP blocking — returns 200 from Vercel's IPs. The provider pattern made this a one-file change.

**How to switch providers:** Change one env var in Vercel:
```
ANIME_PROVIDER=samehadaku   # current default
ANIME_PROVIDER=otakudesu    # use if otakudesu removes Cloudflare
```

**Future-proofing:** If samehadaku adds Cloudflare protection too, your options are:
1. Implement another provider (kusonime, animeindo, etc.) — follow the `AnimeProvider` interface
2. Route requests through a residential proxy (Webshare free tier = 10GB/mo, or Brightdata)
3. Set up a Cloudflare Worker proxy (free 100k req/day) — Workers aren't blocked by CF WAF on external sites
4. Self-host the scraper on a VPS (Hetzner CX11 ~€4/mo) with non-datacenter IPs

---

## 7. `got-scraping` Incompatible with Vercel/Turbopack

**Symptom:** Build error: `Cannot find module '.../headers-order.json'`. Runtime error: `ADM-ZIP: Invalid filename`.

**Root cause:** `got-scraping` uses `header-generator` which reads `__dirname + '/data_files/headers-order.json'` and `.zip` network definition files at construction time. Turbopack rewrites `__dirname` and doesn't include these binary assets in the Vercel function bundle.

**Fix:** Downgraded to plain `got` (same HTTP client, no TLS fingerprinting). Since the Cloudflare block is IP-based (not fingerprint-based), `got-scraping` wouldn't have helped on Vercel anyway.

---

## 8. Samehadaku Schedule Is JavaScript-Rendered

**Symptom:** `getSchedule()` returns `{}` (empty).

**Root cause:** Samehadaku's `/jadwal-update/` page hides all schedule content via inline JS (`$('.sch_monday').hide()`) and renders it client-side. Cheerio can only parse the static HTML — which has no anime items in the schedule sections.

**Current behavior:** The `/schedule` page shows an empty state. This is intentional.

**Fix (if needed later):**
- Use Playwright/Puppeteer to render the JS — can't run on Vercel serverless, but works on a VPS
- Scrape the schedule from a different source (e.g., MyAnimeList seasonal page) and merge
- Check if samehadaku has a REST API or sitemap that exposes schedule data

---

## 9. Embed Mechanism Differences Between Providers

Different anime sites embed video differently. Documented here for implementing future providers.

### OtakudesuProvider (2-step WordPress AJAX)
1. Episode page has mirror buttons with `data-content="base64({id, i, q})"`
2. POST to `admin-ajax.php` with `action=NONCE_ACTION` → get nonce
3. POST to `admin-ajax.php` with `{id, i, q, nonce, action=EMBED_ACTION}` → get base64-encoded iframe HTML
4. Decode base64 → extract iframe `src`

Env vars needed: `OTAKUDESU_NONCE_ACTION`, `OTAKUDESU_EMBED_ACTION`

### SamehadakuProvider (base64 in HTML)
1. Episode page has `<select class="mirror">` with `<option value="BASE64_ENCODED_IFRAME_HTML">`
2. Decode `Buffer.from(value, 'base64').toString()` → parse iframe `src` from the HTML string
3. No AJAX call needed — all embed URLs are pre-baked in the page HTML

For samehadaku, `getEpisode()` pre-decodes all mirrors and stores the URL in `mirror.src`. The `VideoPlayer` checks `mirror.src` first and skips the `/api/embed` call entirely.

---

## 10. `Mirror.src` Extension for Non-AJAX Providers

**Why:** The `AnimeProvider` interface has `getEmbedUrl(id, mirror, quality)` which assumes a server-side AJAX fetch (like otakudesu). Samehadaku doesn't need this — embed URLs are decoded directly from the episode page.

**Solution:** Added optional `src?: string` to the `Mirror` type:
```typescript
interface Mirror {
  quality: string
  index: number
  label: string
  id: number       // used by AJAX providers (otakudesu)
  src?: string     // pre-decoded embed URL (samehadaku and similar)
}
```

`VideoPlayer.tsx` checks `mirror.src` first:
```typescript
if (mirror.src) {
  setEmbedSrc(mirror.src);          // samehadaku path
} else {
  // POST to /api/embed (otakudesu path)
}
```

**Future note:** When implementing a new provider, populate `src` in `getEpisode()` if the embed URL is available without a separate AJAX call. Leave `id` as `0` in that case.

---

## Quick Reference: Adding a New Provider

1. Create `lib/providers/{name}.ts` implementing all 9 methods of `AnimeProvider`
2. Add a `case "{name}":` in `lib/providers/index.ts`
3. Add `{NAME}_BASE_URL` to `.env.local` and Vercel env vars
4. Set `ANIME_PROVIDER={name}` in Vercel env vars
5. Test locally with `pnpm dev` before deploying

The 9 methods to implement:
- `getOngoing(page?)` — paginated ongoing anime
- `getComplete(page?)` — paginated completed anime
- `getSchedule()` — weekly schedule (return `{}` if JS-rendered)
- `getGenres()` — list of all genres
- `getByGenre(genre, page?)` — anime filtered by genre
- `getAnimeDetail(slug)` — full anime metadata + episode list
- `getEpisode(slug)` — episode metadata + mirror list
- `getEmbedUrl(id, mirror, quality)` — fetch embed URL server-side (skip if using `mirror.src`)
- `search(query)` — search results

---

## Deployment Checklist

```
[ ] ANIME_PROVIDER=samehadaku (or other)
[ ] SAMEHADAKU_BASE_URL=https://samehadaku.me
[ ] OTAKUDESU_BASE_URL=https://otakudesu.blog (keep for fallback)
[ ] OTAKUDESU_NONCE_ACTION=aa1208d27f29ca340c92c66d1926f13f
[ ] OTAKUDESU_EMBED_ACTION=2a3505c93b0035d3f455df82bf976b84
[ ] NEXT_PUBLIC_BASE_URL=https://animestream-amber.vercel.app
```

All pages use `force-dynamic` — no ISR. Every request hits the upstream site live.
