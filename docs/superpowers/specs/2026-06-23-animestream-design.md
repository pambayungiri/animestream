# AnimeStream — Design Spec
**Date:** 2026-06-23  
**Stack:** Next.js 15 App Router (API routes only, no separate backend)  
**Deploy:** Vercel + GitHub  
**Source:** otakudesu.blog (scrape via Cheerio + Axios)

---

## 1. Overview

A prettier, faster clone of otakudesu.blog. Serves Sub Indo anime streaming by scraping otakudesu's episode pages and re-embedding their video mirrors (vidhide, filedon, mega, desustream). No video files are stored — the site is a metadata + embed aggregator.

---

## 2. Architecture

### Provider Pattern
All scraping is behind an `AnimeProvider` interface. Switching sources = one env var change.

```
ANIME_PROVIDER=otakudesu   (default)
OTAKUDESU_BASE_URL=https://otakudesu.blog
OTAKUDESU_NONCE_ACTION=aa1208d27f29ca340c92c66d1926f13f
OTAKUDESU_EMBED_ACTION=2a3505c93b0035d3f455df82bf976b84
```

### Folder Structure
```
app/
  (home)/page.tsx               → homepage
  ongoing/page.tsx
  complete/page.tsx
  schedule/page.tsx
  genre/
    page.tsx                    → genre list
    [name]/page.tsx             → anime by genre
  anime/[slug]/page.tsx         → anime detail + episode list
  episode/[slug]/page.tsx       → episode player
  search/page.tsx

app/api/
  ongoing/route.ts
  complete/route.ts
  schedule/route.ts
  genres/route.ts
  genres/[name]/route.ts
  anime/[slug]/route.ts
  episode/[slug]/route.ts
  embed/route.ts                → nonce + embed URL proxy (NOT cached)
  search/route.ts

lib/
  providers/
    types.ts                    → AnimeProvider interface
    otakudesu.ts                → OtakudesuProvider (scrapes otakudesu.blog)
    index.ts                    → factory reads ANIME_PROVIDER env var
  scraper.ts                    → shared Cheerio/Axios helpers
  config.ts                     → all env vars

components/
  ui/                           → shadcn/ui base components
  AnimeCard.tsx
  EpisodeList.tsx
  VideoPlayer.tsx
  MirrorSelector.tsx
  ScheduleGrid.tsx
  SearchBar.tsx
  Navbar.tsx
  Footer.tsx
```

### Data Flow
```
Static pages (lists, detail, schedule):
  Next.js page → ISR (revalidate: 7200) → API route → Cheerio scrapes otakudesu

Episode player embed (must be fresh — IP-sensitive):
  User clicks mirror → browser POSTs to /api/embed
  → server fetches nonce from otakudesu admin-ajax.php
  → server fetches embed URL using nonce + post_id + quality
  → returns iframe src to browser
  → browser renders iframe → video streams from third-party host
```

---

## 3. Pages

| Page | Route | ISR | Description |
|---|---|---|---|
| Homepage | `/` | 1hr | Hero banner + ongoing grid + recently updated |
| Ongoing | `/ongoing` | 2hr | Paginated ongoing anime grid |
| Complete | `/complete` | 6hr | Paginated completed anime grid |
| Schedule | `/schedule` | 1hr | Weekly release calendar (Mon–Sun) |
| Genre List | `/genre` | 12hr | All 40 genres as cards |
| Genre Page | `/genre/[name]` | 2hr | Anime filtered by genre |
| Anime Detail | `/anime/[slug]` | 2hr | Metadata + full episode list |
| Episode Player | `/episode/[slug]` | 2hr | Video player + mirror/quality selector |
| Search | `/search?q=` | no cache | Live search results |

---

## 4. Embed Flow Detail

```typescript
// /api/embed/route.ts — called client-side, never cached
POST /api/embed
Body: { id: number, mirror: number, quality: string }

1. POST otakudesu admin-ajax.php → action=NONCE_ACTION → get nonce
2. POST otakudesu admin-ajax.php → id + mirror + quality + nonce + action=EMBED_ACTION
3. base64 decode response → extract iframe src
4. Return { src: "https://odvidhide.com/embed/..." }
```

---

## 5. UI Design

- **Theme:** Dark. `bg: #0f0f13`, card bg: `#16161f`, accent: `#e85d04` (orange)
- **Typography:** Inter (UI) + no decorative fonts
- **Layout:** Card grid — 4 cols desktop, 2 cols tablet, 1 col mobile
- **Cards:** Poster thumbnail + title + episode badge + score colored (green ≥8, yellow ≥6, red <6)
- **Player page:** Full-width player top, mirror buttons as pill tabs below, episode list as sidebar
- **Animations:** Subtle hover scale on cards (scale-105), fade-in on page load
- **No ads, no popups** — clean reading experience

---

## 6. AnimeProvider Interface

```typescript
interface AnimeProvider {
  getOngoing(page?: number): Promise<{ data: AnimeCard[]; totalPages: number }>
  getComplete(page?: number): Promise<{ data: AnimeCard[]; totalPages: number }>
  getSchedule(): Promise<WeeklySchedule>
  getGenres(): Promise<Genre[]>
  getByGenre(genre: string, page?: number): Promise<{ data: AnimeCard[]; totalPages: number }>
  getAnimeDetail(slug: string): Promise<AnimeDetail>
  getEpisode(slug: string): Promise<EpisodeDetail>
  getEmbedUrl(id: number, mirror: number, quality: string): Promise<string>
  search(query: string): Promise<AnimeCard[]>
}
```

---

## 7. Key Types

```typescript
interface AnimeCard {
  title: string
  slug: string
  thumbnail: string
  score?: string
  status: 'ongoing' | 'completed'
  latestEpisode?: string
  genres?: string[]
}

interface AnimeDetail extends AnimeCard {
  titleJp?: string
  synopsis: string
  studio?: string
  type?: string
  totalEpisodes?: string
  duration?: string
  releaseDate?: string
  episodes: EpisodeMeta[]
}

interface EpisodeMeta {
  title: string
  slug: string
  date: string
}

interface EpisodeDetail {
  title: string
  animeSlug: string
  animeTitle: string
  mirrors: Mirror[]
  prevSlug?: string
  nextSlug?: string
}

interface Mirror {
  quality: string   // "360p" | "480p" | "720p" | "1080p"
  index: number     // mirror index (0,1,2,3...)
  label: string     // "vidhide" | "filedon" | "mega" | "ondesu"
  id: number        // post_id from otakudesu
}

interface WeeklySchedule {
  [day: string]: ScheduleEntry[]  // "Senin" | "Selasa" | etc.
}
```

---

## 8. Deployment

- **Repo:** `github.com/pambayungiri/animestream` (new public repo)
- **Platform:** Vercel (auto-deploy on push to main)
- **Env vars on Vercel:**
  - `ANIME_PROVIDER`
  - `OTAKUDESU_BASE_URL`
  - `OTAKUDESU_NONCE_ACTION`
  - `OTAKUDESU_EMBED_ACTION`

---

## 9. Agents

- **App Developer agent** — scaffolds project, implements API routes, provider, scraper logic
- **UI agent** — implements all page components and styling
- **QA agent** — verifies pages load, embed URLs return valid iframes, mirrors work
