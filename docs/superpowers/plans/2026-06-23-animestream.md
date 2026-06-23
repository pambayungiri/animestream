# AnimeStream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-themed anime streaming site that scrapes otakudesu.blog for metadata and video embeds, deployed to Vercel.

**Architecture:** Next.js 15 App Router with ISR-cached API routes for scraping, client-side embed fetching (never cached — IP-sensitive), and a provider pattern so the source site is swappable via one env var.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Cheerio, Axios, pnpm, Vercel

## Global Constraints

- Package manager: pnpm only — never npm or yarn
- Node: >= 20
- Next.js: 15 (App Router only — no Pages Router)
- All scraping server-side only — never import Cheerio/Axios in client components
- Embed URLs fetched client-side at runtime — never cached (IP-locked)
- ISR revalidate values: list pages = 7200, episode/anime detail = 7200, schedule = 3600, search = no cache
- User-Agent for all scraper requests: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
- All env vars loaded from `lib/config.ts` — never call `process.env` directly in other files
- Working directory for all commands: `/Users/marshpotao/Projects/animestream`

---

### Task 1: Scaffold Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `.env.local`
- Create: `app/layout.tsx`, `app/globals.css`

**Interfaces:**
- Produces: runnable `pnpm dev` at `localhost:3000`

- [ ] **Step 1: Create Next.js app**

```bash
cd /Users/marshpotao/Projects
pnpm create next-app@latest animestream \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --skip-install
cd animestream
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm add cheerio axios
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-slot
pnpm add next-themes
```

- [ ] **Step 3: Install shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
```
When prompted: style=Default, base color=Slate, CSS variables=yes.

Then add components:
```bash
pnpm dlx shadcn@latest add badge button card dialog select skeleton tabs
```

- [ ] **Step 4: Create `.env.local`**

```env
ANIME_PROVIDER=otakudesu
OTAKUDESU_BASE_URL=https://otakudesu.blog
OTAKUDESU_NONCE_ACTION=aa1208d27f29ca340c92c66d1926f13f
OTAKUDESU_EMBED_ACTION=2a3505c93b0035d3f455df82bf976b84
```

- [ ] **Step 5: Update `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f0f13",
        surface: "#16161f",
        "surface-2": "#1e1e2a",
        accent: "#e85d04",
        "accent-hover": "#f97316",
        muted: "#6b7280",
        border: "#2a2a38",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

```bash
pnpm add tailwindcss-animate
```

- [ ] **Step 6: Update `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: #0f0f13;
    --foreground: #f1f5f9;
    --radius: 0.5rem;
  }

  body {
    @apply bg-background text-foreground antialiased;
  }

  * {
    @apply border-border;
  }
}

@layer utilities {
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
```

- [ ] **Step 7: Update `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.otakudesu.blog" },
      { protocol: "https", hostname: "**.otakudesu.info" },
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "i1.wp.com" },
      { protocol: "https", hostname: "i2.wp.com" },
      { protocol: "https", hostname: "i3.wp.com" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 8: Update `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AnimeStream — Nonton Anime Sub Indo",
  description: "Streaming anime subtitle Indonesia terlengkap dan tercepat",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Verify dev server starts**

```bash
pnpm dev
```
Expected: `✓ Ready in Xs` — open `http://localhost:3000` and see Next.js default page. Stop with Ctrl+C.

- [ ] **Step 10: Initial commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js 15 project with Tailwind and shadcn/ui"
```

---

### Task 2: Config + Provider Types

**Files:**
- Create: `lib/config.ts`
- Create: `lib/providers/types.ts`

**Interfaces:**
- Produces: `getConfig()`, `AnimeProvider`, `AnimeCard`, `AnimeDetail`, `EpisodeDetail`, `Mirror`, `WeeklySchedule`, `Genre`

- [ ] **Step 1: Create `lib/config.ts`**

```typescript
export function getConfig() {
  const baseUrl = process.env.OTAKUDESU_BASE_URL;
  const nonceAction = process.env.OTAKUDESU_NONCE_ACTION;
  const embedAction = process.env.OTAKUDESU_EMBED_ACTION;
  const provider = process.env.ANIME_PROVIDER ?? "otakudesu";

  if (!baseUrl || !nonceAction || !embedAction) {
    throw new Error("Missing required env vars: OTAKUDESU_BASE_URL, OTAKUDESU_NONCE_ACTION, OTAKUDESU_EMBED_ACTION");
  }

  return { baseUrl, nonceAction, embedAction, provider };
}
```

- [ ] **Step 2: Create `lib/providers/types.ts`**

```typescript
export interface AnimeCard {
  title: string;
  slug: string;
  thumbnail: string;
  score?: string;
  status: "ongoing" | "completed";
  latestEpisode?: string;
  genres?: string[];
}

export interface EpisodeMeta {
  title: string;
  slug: string;
  date: string;
}

export interface AnimeDetail {
  title: string;
  titleJp?: string;
  slug: string;
  thumbnail: string;
  score?: string;
  status: "ongoing" | "completed";
  synopsis: string;
  studio?: string;
  type?: string;
  totalEpisodes?: string;
  duration?: string;
  releaseDate?: string;
  genres: string[];
  episodes: EpisodeMeta[];
}

export interface Mirror {
  quality: string;
  index: number;
  label: string;
  id: number;
}

export interface EpisodeDetail {
  title: string;
  animeTitle: string;
  animeSlug: string;
  mirrors: Mirror[];
  prevSlug?: string;
  nextSlug?: string;
}

export interface ScheduleEntry {
  title: string;
  slug: string;
}

export interface WeeklySchedule {
  [day: string]: ScheduleEntry[];
}

export interface Genre {
  name: string;
  slug: string;
  count?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  totalPages: number;
  currentPage: number;
}

export interface AnimeProvider {
  getOngoing(page?: number): Promise<PaginatedResult<AnimeCard>>;
  getComplete(page?: number): Promise<PaginatedResult<AnimeCard>>;
  getSchedule(): Promise<WeeklySchedule>;
  getGenres(): Promise<Genre[]>;
  getByGenre(genre: string, page?: number): Promise<PaginatedResult<AnimeCard>>;
  getAnimeDetail(slug: string): Promise<AnimeDetail>;
  getEpisode(slug: string): Promise<EpisodeDetail>;
  getEmbedUrl(id: number, mirror: number, quality: string): Promise<string>;
  search(query: string): Promise<AnimeCard[]>;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/
git commit -m "feat: add config loader and provider type definitions"
```

---

### Task 3: OtakudesuProvider

**Files:**
- Create: `lib/providers/otakudesu.ts`
- Create: `lib/providers/index.ts`
- Create: `lib/scraper.ts`

**Interfaces:**
- Consumes: `getConfig()` from `lib/config.ts`, all types from `lib/providers/types.ts`
- Produces: `OtakudesuProvider` implementing `AnimeProvider`, `getProvider()` factory

- [ ] **Step 1: Create `lib/scraper.ts`**

```typescript
import axios from "axios";
import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchPage(url: string, referer?: string) {
  const res = await axios.get(url, {
    headers: {
      "User-Agent": UA,
      Referer: referer ?? url,
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 10000,
  });
  return cheerio.load(res.data);
}

export async function postAjax(url: string, data: Record<string, string>, referer: string) {
  const params = new URLSearchParams(data);
  const res = await axios.post(url, params.toString(), {
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: referer,
    },
    timeout: 10000,
  });
  return res.data;
}
```

- [ ] **Step 2: Create `lib/providers/otakudesu.ts`**

```typescript
import { getConfig } from "@/lib/config";
import { fetchPage, postAjax } from "@/lib/scraper";
import type {
  AnimeCard,
  AnimeDetail,
  AnimeProvider,
  EpisodeDetail,
  Genre,
  Mirror,
  PaginatedResult,
  WeeklySchedule,
} from "./types";

function slugFromUrl(url: string, prefix: string): string {
  const match = url.match(new RegExp(`/${prefix}/([^/]+)/?`));
  return match?.[1] ?? "";
}

function extractAnimeCards($: cheerio.CheerioAPI, selector: string, baseUrl: string): AnimeCard[] {
  const cards: AnimeCard[] = [];
  $(selector).each((_, el) => {
    const $el = $(el);
    const title = $el.find(".thumb a").attr("title") ?? $el.find("h2.widgettitle, .data h3 a, .thumb img").attr("alt") ?? "";
    const href = $el.find("a").first().attr("href") ?? "";
    const slug = slugFromUrl(href, "anime");
    const thumbnail = $el.find("img").attr("src") ?? $el.find("img").attr("data-src") ?? "";
    const score = $el.find(".score").text().trim() || undefined;
    const latestEpisode = $el.find(".epx, .epl-num").text().trim() || undefined;
    const status = href.includes("complete") ? "completed" : "ongoing";
    if (title && slug) cards.push({ title, slug, thumbnail, score, status, latestEpisode });
  });
  return cards;
}

export class OtakudesuProvider implements AnimeProvider {
  private cfg = getConfig();
  private ajaxUrl = `${this.cfg.baseUrl}/wp-admin/admin-ajax.php`;

  async getOngoing(page = 1): Promise<PaginatedResult<AnimeCard>> {
    const url = page === 1
      ? `${this.cfg.baseUrl}/ongoing-anime/`
      : `${this.cfg.baseUrl}/ongoing-anime/page/${page}/`;
    const $ = await fetchPage(url);

    const data: AnimeCard[] = [];
    $(".venz ul li").each((_, el) => {
      const $el = $(el);
      const titleEl = $el.find("h2.jdlflm");
      const title = titleEl.text().trim();
      const href = $el.find("a").first().attr("href") ?? "";
      const slug = slugFromUrl(href, "anime");
      const thumbnail = $el.find("img").attr("src") ?? "";
      const eps = $el.find(".epz").text().trim();
      if (title && slug) {
        data.push({ title, slug, thumbnail, status: "ongoing", latestEpisode: eps });
      }
    });

    const lastPage = $(".pagination .page-numbers:not(.next)").last().text().trim();
    const totalPages = parseInt(lastPage) || 1;
    return { data, totalPages, currentPage: page };
  }

  async getComplete(page = 1): Promise<PaginatedResult<AnimeCard>> {
    const url = page === 1
      ? `${this.cfg.baseUrl}/complete-anime/`
      : `${this.cfg.baseUrl}/complete-anime/page/${page}/`;
    const $ = await fetchPage(url);

    const data: AnimeCard[] = [];
    $(".venz ul li").each((_, el) => {
      const $el = $(el);
      const title = $el.find("h2.jdlflm").text().trim();
      const href = $el.find("a").first().attr("href") ?? "";
      const slug = slugFromUrl(href, "anime");
      const thumbnail = $el.find("img").attr("src") ?? "";
      const score = $el.find(".scorez").text().trim() || undefined;
      if (title && slug) {
        data.push({ title, slug, thumbnail, score, status: "completed" });
      }
    });

    const lastPage = $(".pagination .page-numbers:not(.next)").last().text().trim();
    const totalPages = parseInt(lastPage) || 1;
    return { data, totalPages, currentPage: page };
  }

  async getSchedule(): Promise<WeeklySchedule> {
    const $ = await fetchPage(`${this.cfg.baseUrl}/jadwal-rilis/`);
    const schedule: WeeklySchedule = {};

    $(".kglist321").each((_, dayEl) => {
      const $day = $(dayEl);
      const day = $day.find("h2").text().trim();
      const entries: { title: string; slug: string }[] = [];
      $day.find("li a").each((_, a) => {
        const title = $(a).text().trim();
        const href = $(a).attr("href") ?? "";
        const slug = slugFromUrl(href, "anime");
        if (title && slug) entries.push({ title, slug });
      });
      if (day) schedule[day] = entries;
    });

    return schedule;
  }

  async getGenres(): Promise<Genre[]> {
    const $ = await fetchPage(`${this.cfg.baseUrl}/genre-list/`);
    const genres: Genre[] = [];

    $(".genres .genre-list li a, .genrelist li a").each((_, el) => {
      const $el = $(el);
      const name = $el.text().trim();
      const href = $el.attr("href") ?? "";
      const slug = href.match(/\/genres\/([^/]+)/)?.[1] ?? "";
      if (name && slug) genres.push({ name, slug });
    });

    return genres;
  }

  async getByGenre(genre: string, page = 1): Promise<PaginatedResult<AnimeCard>> {
    const url = page === 1
      ? `${this.cfg.baseUrl}/genres/${genre}/`
      : `${this.cfg.baseUrl}/genres/${genre}/page/${page}/`;
    const $ = await fetchPage(url);

    const data: AnimeCard[] = [];
    $(".venz ul li, .chivsrc li").each((_, el) => {
      const $el = $(el);
      const title = $el.find("h2, h3").text().trim();
      const href = $el.find("a").first().attr("href") ?? "";
      const slug = slugFromUrl(href, "anime");
      const thumbnail = $el.find("img").attr("src") ?? "";
      const score = $el.find(".score, .scorez").text().trim() || undefined;
      if (title && slug) data.push({ title, slug, thumbnail, score, status: "ongoing" });
    });

    const lastPage = $(".pagination .page-numbers:not(.next)").last().text().trim();
    const totalPages = parseInt(lastPage) || 1;
    return { data, totalPages, currentPage: page };
  }

  async getAnimeDetail(slug: string): Promise<AnimeDetail> {
    const url = `${this.cfg.baseUrl}/anime/${slug}/`;
    const $ = await fetchPage(url);

    const title = $(".entry-title, h1.entry-title").first().text().trim();
    const titleJp = $(".infozingle p:contains('Japanese')").find("b").next().text().trim() || undefined;
    const thumbnail = $(".fotoanime img").attr("src") ?? "";
    const synopsis = $(".sinopc, .desc").text().trim();
    const score = $(".infozingle p:contains('Skor'), .infozingle p:contains('Score')").find("b").next().text().trim() || undefined;
    const studio = $(".infozingle p:contains('Studio')").find("b").next().text().trim() || undefined;
    const type = $(".infozingle p:contains('Tipe')").find("b").next().text().trim() || undefined;
    const totalEpisodes = $(".infozingle p:contains('Total Episode')").find("b").next().text().trim() || undefined;
    const duration = $(".infozingle p:contains('Durasi')").find("b").next().text().trim() || undefined;
    const releaseDate = $(".infozingle p:contains('Tanggal Rilis')").find("b").next().text().trim() || undefined;
    const statusText = $(".infozingle p:contains('Status')").find("b").next().text().trim().toLowerCase();
    const status: "ongoing" | "completed" = statusText.includes("complet") || statusText.includes("selesai") ? "completed" : "ongoing";

    const genres: string[] = [];
    $(".infozingle p:contains('Genre') a, .genre-info a").each((_, el) => {
      genres.push($(el).text().trim());
    });

    const episodes: { title: string; slug: string; date: string }[] = [];
    $(".episodelist ul li").each((_, el) => {
      const $el = $(el);
      const epTitle = $el.find("a").text().trim();
      const href = $el.find("a").attr("href") ?? "";
      const epSlug = slugFromUrl(href, "episode");
      const date = $el.find(".zeebr").text().trim();
      if (epTitle && epSlug) episodes.push({ title: epTitle, slug: epSlug, date });
    });

    return { title, titleJp, slug, thumbnail, score, status, synopsis, studio, type, totalEpisodes, duration, releaseDate, genres, episodes };
  }

  async getEpisode(slug: string): Promise<EpisodeDetail> {
    const url = `${this.cfg.baseUrl}/episode/${slug}/`;
    const $ = await fetchPage(url);

    const title = $(".entry-title, h1.entry-title").first().text().trim();
    const animeHref = $(".keteradata p a, .episodelist a").first().attr("href") ?? "";
    const animeSlug = slugFromUrl(animeHref, "anime");
    const animeTitle = $(".keteradata p a").first().text().trim();

    const mirrors: Mirror[] = [];
    $(".mirrorstream .smokeurl a[data-content], a[data-content]").each((_, el) => {
      const $el = $(el);
      const raw = $el.attr("data-content") ?? "";
      try {
        const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
        const label = $el.text().trim().toLowerCase();
        mirrors.push({ quality: decoded.q, index: decoded.i, label, id: decoded.id });
      } catch {}
    });

    const prevHref = $(".navepsingle a.backeps, a:contains('Prev')").attr("href") ?? "";
    const nextHref = $(".navepsingle a.nexteps, a:contains('Next')").attr("href") ?? "";
    const prevSlug = slugFromUrl(prevHref, "episode") || undefined;
    const nextSlug = slugFromUrl(nextHref, "episode") || undefined;

    return { title, animeTitle, animeSlug, mirrors, prevSlug, nextSlug };
  }

  async getEmbedUrl(id: number, mirror: number, quality: string): Promise<string> {
    const referer = `${this.cfg.baseUrl}/`;

    // Step 1: get nonce
    const nonceRes = await postAjax(
      this.ajaxUrl,
      { action: this.cfg.nonceAction },
      referer
    );
    const nonce: string = nonceRes.data;

    // Step 2: get embed
    const embedRes = await postAjax(
      this.ajaxUrl,
      { id: String(id), i: String(mirror), q: quality, nonce, action: this.cfg.embedAction },
      referer
    );
    const html = Buffer.from(embedRes.data, "base64").toString("utf8");
    const match = html.match(/src="([^"]+)"/);
    if (!match) throw new Error("Could not extract embed src");
    return match[1];
  }

  async search(query: string): Promise<AnimeCard[]> {
    const $ = await fetchPage(`${this.cfg.baseUrl}/?s=${encodeURIComponent(query)}`);
    const results: AnimeCard[] = [];

    $(".chivsrc li").each((_, el) => {
      const $el = $(el);
      const title = $el.find("h2 a").text().trim();
      const href = $el.find("h2 a").attr("href") ?? "";
      const slug = slugFromUrl(href, "anime");
      const thumbnail = $el.find("img").attr("src") ?? "";
      const score = $el.find(".adds b").text().trim() || undefined;
      if (title && slug) results.push({ title, slug, thumbnail, score, status: "ongoing" });
    });

    return results;
  }
}
```

- [ ] **Step 3: Create `lib/providers/index.ts`**

```typescript
import { getConfig } from "@/lib/config";
import { OtakudesuProvider } from "./otakudesu";
import type { AnimeProvider } from "./types";

let _provider: AnimeProvider | null = null;

export function getProvider(): AnimeProvider {
  if (_provider) return _provider;
  const { provider } = getConfig();
  switch (provider) {
    case "otakudesu":
    default:
      _provider = new OtakudesuProvider();
      return _provider;
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/
git commit -m "feat: implement OtakudesuProvider with Cheerio scraper"
```

---

### Task 4: API Routes

**Files:**
- Create: `app/api/ongoing/route.ts`
- Create: `app/api/complete/route.ts`
- Create: `app/api/schedule/route.ts`
- Create: `app/api/genres/route.ts`
- Create: `app/api/genres/[name]/route.ts`
- Create: `app/api/anime/[slug]/route.ts`
- Create: `app/api/episode/[slug]/route.ts`
- Create: `app/api/embed/route.ts`
- Create: `app/api/search/route.ts`

**Interfaces:**
- Consumes: `getProvider()` from `lib/providers/index.ts`
- Produces: JSON REST endpoints at `/api/*`

- [ ] **Step 1: Create `app/api/ongoing/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 7200;

export async function GET(req: NextRequest) {
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  try {
    const data = await getProvider().getOngoing(page);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/complete/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 7200;

export async function GET(req: NextRequest) {
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  try {
    const data = await getProvider().getComplete(page);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/schedule/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 3600;

export async function GET() {
  try {
    const data = await getProvider().getSchedule();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `app/api/genres/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 43200;

export async function GET() {
  try {
    const data = await getProvider().getGenres();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create `app/api/genres/[name]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 7200;

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  try {
    const data = await getProvider().getByGenre(name, page);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Create `app/api/anime/[slug]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 7200;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const data = await getProvider().getAnimeDetail(slug);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
```

- [ ] **Step 7: Create `app/api/episode/[slug]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 7200;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const data = await getProvider().getEpisode(slug);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
```

- [ ] **Step 8: Create `app/api/embed/route.ts` (NOT cached — IP-sensitive)**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { id, mirror, quality } = await req.json();
    if (!id || mirror === undefined || !quality) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }
    const src = await getProvider().getEmbedUrl(Number(id), Number(mirror), quality);
    return NextResponse.json({ src });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch embed" }, { status: 500 });
  }
}
```

- [ ] **Step 9: Create `app/api/search/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json([]);
  try {
    const data = await getProvider().search(q);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
```

- [ ] **Step 10: Verify API routes work**

Start dev server in background: `pnpm dev &`

```bash
curl http://localhost:3000/api/ongoing | python3 -m json.tool | head -30
```
Expected: JSON with `data` array of anime cards and `totalPages`.

```bash
curl http://localhost:3000/api/schedule | python3 -m json.tool | head -30
```
Expected: JSON object with day keys (Senin, Selasa, etc.).

Stop dev server: `kill %1`

- [ ] **Step 11: Commit**

```bash
git add app/api/
git commit -m "feat: add ISR-cached API routes for all scraping endpoints"
```

---

### Task 5: Shared Components

**Files:**
- Create: `components/Navbar.tsx`
- Create: `components/Footer.tsx`
- Create: `components/AnimeCard.tsx`
- Create: `components/Pagination.tsx`
- Create: `components/ScoreBadge.tsx`
- Create: `components/SectionTitle.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `AnimeCard` type from `lib/providers/types.ts`
- Produces: reusable UI components used by all pages

- [ ] **Step 1: Create `components/ScoreBadge.tsx`**

```tsx
interface Props { score?: string }

export function ScoreBadge({ score }: Props) {
  if (!score) return null;
  const num = parseFloat(score);
  const color = num >= 8 ? "text-green-400" : num >= 6 ? "text-yellow-400" : "text-red-400";
  return (
    <span className={`text-xs font-bold ${color}`}>★ {score}</span>
  );
}
```

- [ ] **Step 2: Create `components/AnimeCard.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import { ScoreBadge } from "./ScoreBadge";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

interface Props { anime: AnimeCardType }

export function AnimeCard({ anime }: Props) {
  return (
    <Link href={`/anime/${anime.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-lg bg-surface transition-transform duration-200 group-hover:scale-105">
        <div className="relative aspect-[2/3] w-full">
          <Image
            src={anime.thumbnail || "/placeholder.png"}
            alt={anime.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          {anime.latestEpisode && (
            <span className="absolute bottom-2 left-2 rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white">
              {anime.latestEpisode}
            </span>
          )}
        </div>
        <div className="p-2">
          <p className="line-clamp-2 text-sm font-medium text-white">{anime.title}</p>
          <ScoreBadge score={anime.score} />
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create `components/Pagination.tsx`**

```tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export function Pagination({ currentPage, totalPages, basePath }: Props) {
  const router = useRouter();
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (i === 0) return 1;
    if (i === 6) return totalPages;
    return Math.max(2, Math.min(totalPages - 1, currentPage - 2 + i));
  });

  return (
    <div className="flex gap-2 justify-center mt-8 flex-wrap">
      {currentPage > 1 && (
        <button
          onClick={() => router.push(`${basePath}?page=${currentPage - 1}`)}
          className="px-3 py-1 rounded bg-surface-2 text-sm hover:bg-accent transition-colors"
        >
          ‹ Prev
        </button>
      )}
      {pages.map((p, i) => (
        <button
          key={i}
          onClick={() => p !== currentPage && router.push(`${basePath}?page=${p}`)}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            p === currentPage
              ? "bg-accent text-white font-bold"
              : "bg-surface-2 hover:bg-accent/60"
          }`}
        >
          {p}
        </button>
      ))}
      {currentPage < totalPages && (
        <button
          onClick={() => router.push(`${basePath}?page=${currentPage + 1}`)}
          className="px-3 py-1 rounded bg-surface-2 text-sm hover:bg-accent transition-colors"
        >
          Next ›
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `components/SectionTitle.tsx`**

```tsx
interface Props { children: React.ReactNode; href?: string }

export function SectionTitle({ children, href }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-white border-l-4 border-accent pl-3">{children}</h2>
      {href && (
        <a href={href} className="text-sm text-accent hover:underline">Lihat Semua →</a>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `components/Navbar.tsx`**

```tsx
"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function Navbar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <nav className="sticky top-0 z-50 bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-bold text-accent shrink-0">
          AnimeStream
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/ongoing" className="hover:text-accent transition-colors">Ongoing</Link>
          <Link href="/complete" className="hover:text-accent transition-colors">Complete</Link>
          <Link href="/schedule" className="hover:text-accent transition-colors">Jadwal</Link>
          <Link href="/genre" className="hover:text-accent transition-colors">Genre</Link>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-xs">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari anime..."
            className="w-full rounded-md bg-surface-2 border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
          <button type="submit" className="text-muted hover:text-accent">
            <Search size={18} />
          </button>
        </form>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-surface px-4 py-3 flex flex-col gap-3 text-sm">
          <Link href="/ongoing" onClick={() => setOpen(false)}>Ongoing</Link>
          <Link href="/complete" onClick={() => setOpen(false)}>Complete</Link>
          <Link href="/schedule" onClick={() => setOpen(false)}>Jadwal</Link>
          <Link href="/genre" onClick={() => setOpen(false)}>Genre</Link>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 6: Create `components/Footer.tsx`**

```tsx
export function Footer() {
  return (
    <footer className="border-t border-border mt-16 py-8 text-center text-sm text-muted">
      <p>AnimeStream — Nonton Anime Sub Indo Gratis</p>
      <p className="mt-1 text-xs opacity-50">
        Semua konten adalah milik pemiliknya masing-masing.
      </p>
    </footer>
  );
}
```

- [ ] **Step 7: Update `app/layout.tsx` to include Navbar + Footer**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AnimeStream — Nonton Anime Sub Indo",
  description: "Streaming anime subtitle Indonesia terlengkap dan tercepat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className={inter.className}>
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Add placeholder image**

```bash
curl -o public/placeholder.png "https://via.placeholder.com/400x600/16161f/6b7280?text=No+Image" 2>/dev/null || \
  convert -size 400x600 xc:#16161f -fill "#6b7280" -gravity center -annotate 0 "No Image" public/placeholder.png 2>/dev/null || \
  echo "placeholder skipped — add manually if needed"
```

- [ ] **Step 9: Commit**

```bash
git add components/ app/layout.tsx public/
git commit -m "feat: add shared Navbar, Footer, AnimeCard, Pagination components"
```

---

### Task 6: Homepage + List Pages

**Files:**
- Create: `app/page.tsx`
- Create: `app/ongoing/page.tsx`
- Create: `app/complete/page.tsx`
- Create: `app/schedule/page.tsx`
- Create: `app/genre/page.tsx`
- Create: `app/genre/[name]/page.tsx`
- Create: `app/search/page.tsx`

**Interfaces:**
- Consumes: all API routes, `AnimeCard`, `Pagination`, `SectionTitle` components

- [ ] **Step 1: Create `app/page.tsx` (homepage)**

```tsx
import { AnimeCard } from "@/components/AnimeCard";
import { SectionTitle } from "@/components/SectionTitle";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const revalidate = 3600;

async function getOngoing() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/ongoing?page=1`, { next: { revalidate: 3600 } });
  return res.json();
}

async function getComplete() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/complete?page=1`, { next: { revalidate: 7200 } });
  return res.json();
}

export default async function HomePage() {
  const [ongoing, complete] = await Promise.all([getOngoing(), getComplete()]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <section className="mb-12">
        <SectionTitle href="/ongoing">Anime Ongoing</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {ongoing.data?.slice(0, 12).map((anime: AnimeCardType) => (
            <AnimeCard key={anime.slug} anime={anime} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle href="/complete">Anime Complete</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {complete.data?.slice(0, 12).map((anime: AnimeCardType) => (
            <AnimeCard key={anime.slug} anime={anime} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_BASE_URL` to `.env.local`**

```bash
echo "NEXT_PUBLIC_BASE_URL=http://localhost:3000" >> .env.local
```

- [ ] **Step 3: Create `app/ongoing/page.tsx`**

```tsx
import { AnimeCard } from "@/components/AnimeCard";
import { Pagination } from "@/components/Pagination";
import { SectionTitle } from "@/components/SectionTitle";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const revalidate = 7200;

async function getData(page: number) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/ongoing?page=${page}`, { next: { revalidate: 7200 } });
  return res.json();
}

export default async function OngoingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const { data, totalPages, currentPage } = await getData(page);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>Anime Ongoing</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {data?.map((anime: AnimeCardType) => (
          <AnimeCard key={anime.slug} anime={anime} />
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/ongoing" />
    </div>
  );
}
```

- [ ] **Step 4: Create `app/complete/page.tsx`**

```tsx
import { AnimeCard } from "@/components/AnimeCard";
import { Pagination } from "@/components/Pagination";
import { SectionTitle } from "@/components/SectionTitle";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const revalidate = 7200;

async function getData(page: number) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/complete?page=${page}`, { next: { revalidate: 7200 } });
  return res.json();
}

export default async function CompletePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const { data, totalPages, currentPage } = await getData(page);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>Anime Complete</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {data?.map((anime: AnimeCardType) => (
          <AnimeCard key={anime.slug} anime={anime} />
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/complete" />
    </div>
  );
}
```

- [ ] **Step 5: Create `app/schedule/page.tsx`**

```tsx
import Link from "next/link";
import { SectionTitle } from "@/components/SectionTitle";
import type { WeeklySchedule } from "@/lib/providers/types";

export const revalidate = 3600;

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu", "Random"];

async function getData(): Promise<WeeklySchedule> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/schedule`, { next: { revalidate: 3600 } });
  return res.json();
}

export default async function SchedulePage() {
  const schedule = await getData();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>Jadwal Rilis Anime</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {DAYS.map(day => (
          <div key={day} className="bg-surface rounded-xl p-4 border border-border">
            <h3 className="font-bold text-accent mb-3 text-sm uppercase tracking-wide">{day}</h3>
            <ul className="space-y-2">
              {schedule[day]?.map(entry => (
                <li key={entry.slug}>
                  <Link
                    href={`/anime/${entry.slug}`}
                    className="text-sm text-gray-300 hover:text-accent transition-colors line-clamp-1"
                  >
                    {entry.title}
                  </Link>
                </li>
              )) ?? <li className="text-xs text-muted">Tidak ada</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `app/genre/page.tsx`**

```tsx
import Link from "next/link";
import { SectionTitle } from "@/components/SectionTitle";
import type { Genre } from "@/lib/providers/types";

export const revalidate = 43200;

async function getData(): Promise<Genre[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/genres`, { next: { revalidate: 43200 } });
  return res.json();
}

export default async function GenreListPage() {
  const genres = await getData();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>Daftar Genre</SectionTitle>
      <div className="flex flex-wrap gap-3">
        {genres.map(genre => (
          <Link
            key={genre.slug}
            href={`/genre/${genre.slug}`}
            className="px-4 py-2 rounded-full bg-surface-2 border border-border text-sm hover:bg-accent hover:border-accent hover:text-white transition-all"
          >
            {genre.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `app/genre/[name]/page.tsx`**

```tsx
import { AnimeCard } from "@/components/AnimeCard";
import { Pagination } from "@/components/Pagination";
import { SectionTitle } from "@/components/SectionTitle";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const revalidate = 7200;

async function getData(name: string, page: number) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/genres/${name}?page=${page}`, { next: { revalidate: 7200 } });
  return res.json();
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { name } = await params;
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const { data, totalPages, currentPage } = await getData(name, page);
  const label = name.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>Genre: {label}</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {data?.map((anime: AnimeCardType) => (
          <AnimeCard key={anime.slug} anime={anime} />
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} basePath={`/genre/${name}`} />
    </div>
  );
}
```

- [ ] **Step 8: Create `app/search/page.tsx`**

```tsx
import { AnimeCard } from "@/components/AnimeCard";
import { SectionTitle } from "@/components/SectionTitle";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

async function getData(q: string): Promise<AnimeCardType[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  return res.json();
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q ?? "";
  const results = query ? await getData(query) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>
        {query ? `Hasil: "${query}" (${results.length} anime)` : "Cari Anime"}
      </SectionTitle>
      {results.length === 0 && query && (
        <p className="text-muted text-sm">Tidak ada hasil untuk "{query}"</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {results.map((anime: AnimeCardType) => (
          <AnimeCard key={anime.slug} anime={anime} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add app/
git commit -m "feat: add homepage, ongoing, complete, schedule, genre, and search pages"
```

---

### Task 7: Anime Detail + Episode Player Pages

**Files:**
- Create: `app/anime/[slug]/page.tsx`
- Create: `app/episode/[slug]/page.tsx`
- Create: `components/VideoPlayer.tsx`
- Create: `components/MirrorSelector.tsx`
- Create: `components/EpisodeList.tsx`

**Interfaces:**
- Consumes: `/api/anime/[slug]`, `/api/episode/[slug]`, `/api/embed`
- Produces: anime detail view, episode player with quality/mirror switcher

- [ ] **Step 1: Create `app/anime/[slug]/page.tsx`**

```tsx
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ScoreBadge";
import type { AnimeDetail } from "@/lib/providers/types";

export const revalidate = 7200;

async function getData(slug: string): Promise<AnimeDetail> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/anime/${slug}`, { next: { revalidate: 7200 } });
  return res.json();
}

export default async function AnimeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const anime = await getData(slug);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <div className="w-48 shrink-0 mx-auto md:mx-0">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden">
            <Image src={anime.thumbnail || "/placeholder.png"} alt={anime.title} fill className="object-cover" />
          </div>
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white mb-1">{anime.title}</h1>
          {anime.titleJp && <p className="text-muted text-sm mb-3">{anime.titleJp}</p>}

          <div className="flex flex-wrap gap-2 mb-4">
            {anime.genres.map(g => (
              <Link key={g} href={`/genre/${g.toLowerCase().replace(/ /g, "-")}`}>
                <Badge variant="secondary" className="hover:bg-accent cursor-pointer">{g}</Badge>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4">
            {anime.score && <div><span className="text-muted">Score:</span> <ScoreBadge score={anime.score} /></div>}
            {anime.status && <div><span className="text-muted">Status:</span> <span className="capitalize">{anime.status}</span></div>}
            {anime.type && <div><span className="text-muted">Type:</span> {anime.type}</div>}
            {anime.studio && <div><span className="text-muted">Studio:</span> {anime.studio}</div>}
            {anime.totalEpisodes && <div><span className="text-muted">Episodes:</span> {anime.totalEpisodes}</div>}
            {anime.duration && <div><span className="text-muted">Duration:</span> {anime.duration}</div>}
            {anime.releaseDate && <div><span className="text-muted">Release:</span> {anime.releaseDate}</div>}
          </div>

          {anime.synopsis && (
            <p className="text-sm text-gray-300 leading-relaxed line-clamp-4">{anime.synopsis}</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white border-l-4 border-accent pl-3 mb-4">
          Daftar Episode ({anime.episodes.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[500px] overflow-y-auto pr-2">
          {anime.episodes.map(ep => (
            <Link
              key={ep.slug}
              href={`/episode/${ep.slug}`}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-surface border border-border hover:border-accent hover:bg-surface-2 transition-all text-sm group"
            >
              <span className="text-gray-200 group-hover:text-accent truncate">{ep.title}</span>
              <span className="text-muted text-xs shrink-0 ml-2">{ep.date}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/MirrorSelector.tsx`**

```tsx
"use client";

import { Mirror } from "@/lib/providers/types";

interface Props {
  mirrors: Mirror[];
  selected: { quality: string; index: number } | null;
  onSelect: (mirror: Mirror) => void;
  loading: boolean;
}

const QUALITY_ORDER = ["1080p", "720p", "480p", "360p", "240p"];

export function MirrorSelector({ mirrors, selected, onSelect, loading }: Props) {
  const byQuality = QUALITY_ORDER.reduce<Record<string, Mirror[]>>((acc, q) => {
    const group = mirrors.filter(m => m.quality === q);
    if (group.length) acc[q] = group;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(byQuality).map(([quality, group]) => (
        <div key={quality}>
          <p className="text-xs text-muted uppercase tracking-wider mb-1.5">{quality}</p>
          <div className="flex flex-wrap gap-2">
            {group.map(mirror => {
              const isSelected = selected?.quality === mirror.quality && selected?.index === mirror.index;
              return (
                <button
                  key={`${mirror.quality}-${mirror.index}`}
                  onClick={() => onSelect(mirror)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected
                      ? "bg-accent border-accent text-white"
                      : "bg-surface-2 border-border hover:border-accent text-gray-300"
                  } disabled:opacity-50`}
                >
                  {mirror.label || `Mirror ${mirror.index + 1}`}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/VideoPlayer.tsx`**

```tsx
"use client";
import { useState } from "react";
import { MirrorSelector } from "./MirrorSelector";
import { Loader2 } from "lucide-react";
import type { Mirror } from "@/lib/providers/types";

interface Props { mirrors: Mirror[] }

export function VideoPlayer({ mirrors }: Props) {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ quality: string; index: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMirror(mirror: Mirror) {
    setLoading(true);
    setError(null);
    setSelected({ quality: mirror.quality, index: mirror.index });
    try {
      const res = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mirror.id, mirror: mirror.index, quality: mirror.quality }),
      });
      const data = await res.json();
      if (data.src) setEmbedSrc(data.src);
      else setError("Gagal memuat video. Coba mirror lain.");
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <Loader2 className="animate-spin text-accent" size={40} />
          </div>
        )}
        {embedSrc ? (
          <iframe
            src={embedSrc}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted gap-3">
            <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Pilih server di bawah untuk mulai menonton</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <div className="bg-surface rounded-xl p-4 border border-border">
        <p className="text-sm font-semibold text-white mb-3">Pilih Server & Kualitas</p>
        <MirrorSelector
          mirrors={mirrors}
          selected={selected}
          onSelect={loadMirror}
          loading={loading}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `app/episode/[slug]/page.tsx`**

```tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VideoPlayer } from "@/components/VideoPlayer";
import type { EpisodeDetail } from "@/lib/providers/types";

export const revalidate = 7200;

async function getData(slug: string): Promise<EpisodeDetail> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/episode/${slug}`, { next: { revalidate: 7200 } });
  return res.json();
}

export default async function EpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episode = await getData(slug);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link href={`/anime/${episode.animeSlug}`} className="text-sm text-muted hover:text-accent transition-colors">
          ← {episode.animeTitle}
        </Link>
        <h1 className="text-xl font-bold text-white mt-1">{episode.title}</h1>
      </div>

      <VideoPlayer mirrors={episode.mirrors} />

      <div className="flex justify-between mt-6">
        {episode.prevSlug ? (
          <Link
            href={`/episode/${episode.prevSlug}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border hover:border-accent text-sm transition-all"
          >
            <ChevronLeft size={16} /> Episode Sebelumnya
          </Link>
        ) : <div />}

        {episode.nextSlug ? (
          <Link
            href={`/episode/${episode.nextSlug}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border hover:border-accent text-sm transition-all"
          >
            Episode Selanjutnya <ChevronRight size={16} />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/anime/ app/episode/ components/VideoPlayer.tsx components/MirrorSelector.tsx
git commit -m "feat: add anime detail page, episode player with mirror/quality selector"
```

---

### Task 8: GitHub Repo + Vercel Deploy

**Files:**
- Create: `.gitignore` (update)
- Create: `.env.production` (Vercel env vars — configured via CLI)

**Interfaces:**
- Produces: live URL on Vercel at `https://animestream-*.vercel.app`

- [ ] **Step 1: Verify .gitignore has .env.local**

```bash
grep -q ".env.local" .gitignore || echo ".env.local" >> .gitignore
grep -q ".env*.local" .gitignore || echo ".env*.local" >> .gitignore
```

- [ ] **Step 2: Create GitHub repo and push**

```bash
gh repo create animestream \
  --public \
  --description "Anime streaming site with Sub Indo — Next.js 15 clone of otakudesu.blog" \
  --source=. \
  --remote=origin \
  --push
```
Expected: `✓ Created repository pambayungiri/animestream on GitHub`

- [ ] **Step 3: Link to Vercel and set env vars**

```bash
vercel link --project animestream --yes
```

Add env vars to Vercel:
```bash
vercel env add ANIME_PROVIDER production <<< "otakudesu"
vercel env add OTAKUDESU_BASE_URL production <<< "https://otakudesu.blog"
vercel env add OTAKUDESU_NONCE_ACTION production <<< "aa1208d27f29ca340c92c66d1926f13f"
vercel env add OTAKUDESU_EMBED_ACTION production <<< "2a3505c93b0035d3f455df82bf976b84"
```

Then add `NEXT_PUBLIC_BASE_URL` pointing to your Vercel domain (set after first deploy):
```bash
vercel env add NEXT_PUBLIC_BASE_URL production <<< "https://animestream.vercel.app"
```

- [ ] **Step 4: Deploy to production**

```bash
vercel --prod
```
Expected: `✅ Production: https://animestream-*.vercel.app`

- [ ] **Step 5: Update NEXT_PUBLIC_BASE_URL with real domain**

After seeing the production URL from step 4, update it:
```bash
vercel env rm NEXT_PUBLIC_BASE_URL production --yes
vercel env add NEXT_PUBLIC_BASE_URL production <<< "https://[actual-url].vercel.app"
vercel --prod
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: configure Vercel deployment"
git push
```

---

### Task 9: QA Verification

**Goal:** Confirm all pages load, scraping works, and embed URLs are returned correctly in production.

- [ ] **Step 1: Verify homepage loads**

```bash
curl -s https://[your-vercel-url].vercel.app/ | grep -o "AnimeStream" | head -3
```
Expected: `AnimeStream`

- [ ] **Step 2: Verify ongoing API returns data**

```bash
curl -s https://[your-vercel-url].vercel.app/api/ongoing | python3 -m json.tool | head -20
```
Expected: `{ "data": [...], "totalPages": N, "currentPage": 1 }`

- [ ] **Step 3: Verify schedule API returns day data**

```bash
curl -s https://[your-vercel-url].vercel.app/api/schedule | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.keys()))"
```
Expected: `['Senin', 'Selasa', 'Rabu', ...]`

- [ ] **Step 4: Verify anime detail API**

```bash
curl -s "https://[your-vercel-url].vercel.app/api/anime/1piece-sub-indo" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title'), '|', len(d.get('episodes',[])), 'eps')"
```
Expected: `One Piece | [N] eps`

- [ ] **Step 5: Verify episode API returns mirrors**

```bash
curl -s "https://[your-vercel-url].vercel.app/api/episode/wpoiec-episode-1167-sub-indo" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title'), '| mirrors:', len(d.get('mirrors',[])))"
```
Expected: `One Piece ... Episode 1167 | mirrors: N`

- [ ] **Step 6: Verify embed API returns a working src**

```bash
# Get the post ID from the episode mirrors first
MIRROR_DATA=$(curl -s "https://[your-vercel-url].vercel.app/api/episode/wpoiec-episode-1167-sub-indo" | python3 -c "import sys,json; d=json.load(sys.stdin); m=d['mirrors'][0]; print(m['id'], m['index'], m['quality'])")
ID=$(echo $MIRROR_DATA | awk '{print $1}')
IDX=$(echo $MIRROR_DATA | awk '{print $2}')
QUAL=$(echo $MIRROR_DATA | awk '{print $3}')

curl -s -X POST "https://[your-vercel-url].vercel.app/api/embed" \
  -H "Content-Type: application/json" \
  -d "{\"id\":$ID,\"mirror\":$IDX,\"quality\":\"$QUAL\"}" | python3 -m json.tool
```
Expected: `{ "src": "https://odvidhide.com/embed/..." }` or similar mirror URL.

- [ ] **Step 7: Open the site in browser and manually test**

1. Open `https://[your-vercel-url].vercel.app`
2. Click any anime card → anime detail page loads with episodes
3. Click any episode → episode player page loads
4. Click any mirror button → video iframe appears and plays
5. Click Prev/Next episode navigation → works

- [ ] **Step 8: Final push**

```bash
git push
```

---

## Summary

| Task | Owner | Est. |
|---|---|---|
| 1: Scaffold | App Developer | 15 min |
| 2: Types + Config | App Developer | 10 min |
| 3: OtakudesuProvider | App Developer | 20 min |
| 4: API Routes | App Developer | 15 min |
| 5: Shared Components | UI | 20 min |
| 6: List Pages | UI | 20 min |
| 7: Detail + Player | UI | 25 min |
| 8: GitHub + Vercel | App Developer | 10 min |
| 9: QA | QA | 15 min |
