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

