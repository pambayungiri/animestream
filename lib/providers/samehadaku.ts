import * as cheerio from "cheerio";
import { fetchPage } from "../scraper";
import { getConfig } from "../config";
import type {
  AnimeProvider,
  AnimeCard,
  AnimeDetail,
  EpisodeDetail,
  EpisodeMeta,
  Mirror,
  WeeklySchedule,
  Genre,
  PaginatedResult,
} from "./types";

function getBase(): string {
  return getConfig().samehadakuBaseUrl;
}

function extractSlugFromHref(href: string): string {
  // href: https://samehadaku.me/anime/{slug}/ → slug
  return href.replace(getBase(), "").replace(/^\/anime\//, "").replace(/\/$/, "");
}

function extractEpisodeSlugFromHref(href: string): string {
  return href.replace(getBase(), "").replace(/^\//, "").replace(/\/$/, "");
}

function extractIframeSrc(base64: string): string | null {
  try {
    const html = Buffer.from(base64, "base64").toString("utf-8");
    const $ = cheerio.load(html);
    return $("iframe").attr("src") ?? null;
  } catch {
    return null;
  }
}

function parseCards($: cheerio.CheerioAPI): AnimeCard[] {
  const cards: AnimeCard[] = [];
  $("article.bs").each((_, el) => {
    const a = $(el).find(".bsx a").first();
    const href = a.attr("href") ?? "";
    const slug = extractSlugFromHref(href);
    const thumbnail = a.find("img.ts-post-image").attr("src") ?? "";
    const title =
      $(el).find(".bsx .tt h2").text().trim() ||
      $(el).find(".bsx .tt").text().trim();
    const latestEpisode = $(el).find(".bsx .limit .epx").text().trim();
    const statusText = $(el)
      .find(".bsx .limit .status")
      .text()
      .trim()
      .toLowerCase();
    const status: "ongoing" | "completed" =
      statusText === "completed" ? "completed" : "ongoing";
    if (slug && title) {
      cards.push({ title, slug, thumbnail, latestEpisode, status });
    }
  });
  return cards;
}

function parseTotalPages($: cheerio.CheerioAPI, currentPage = 1): number {
  // samehadaku uses .hpage with a next-page link — no numbered pagination
  if ($(".hpage a.r").length > 0) return currentPage + 1;
  // fallback: try numbered .page-numbers if ever present
  let max = currentPage;
  $("a.page-numbers, .page-numbers").each((_, el) => {
    const n = parseInt($(el).text().trim(), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max;
}

export class SamehadakuProvider implements AnimeProvider {
  async getOngoing(page = 1): Promise<PaginatedResult<AnimeCard>> {
    const url = `${getBase()}/anime/?status=ongoing&type=&order=update${
      page > 1 ? `&page=${page}` : ""
    }`;
    const $ = await fetchPage(url);
    return { data: parseCards($), totalPages: parseTotalPages($, page), currentPage: page };
  }

  async getComplete(page = 1): Promise<PaginatedResult<AnimeCard>> {
    const url = `${getBase()}/anime/?status=completed&sub=&order=update${
      page > 1 ? `&page=${page}` : ""
    }`;
    const $ = await fetchPage(url);
    return { data: parseCards($), totalPages: parseTotalPages($, page), currentPage: page };
  }

  async getSchedule(): Promise<WeeklySchedule> {
    // Schedule is JS-rendered on samehadaku — return empty
    return {};
  }

  async getGenres(): Promise<Genre[]> {
    const $ = await fetchPage(`${getBase()}/anime/?status=ongoing`);
    const genres: Genre[] = [];
    const seen = new Set<string>();
    $("input[name='genre[]']").each((_, el) => {
      const slug = $(el).attr("value") ?? "";
      // skip purely numeric IDs and single-character junk entries
      if (!slug || /^\d+$/.test(slug) || slug.length <= 1) return;
      if (seen.has(slug)) return;
      seen.add(slug);
      const id = $(el).attr("id") ?? "";
      const label = id ? $(`label[for="${id}"]`).text().trim() : slug;
      genres.push({ name: label || slug, slug });
    });
    return genres;
  }

  async getByGenre(genre: string, page = 1): Promise<PaginatedResult<AnimeCard>> {
    const url = `${getBase()}/genres/${genre}/${page > 1 ? `page/${page}/` : ""}`;
    const $ = await fetchPage(url);
    return { data: parseCards($), totalPages: parseTotalPages($, page), currentPage: page };
  }

  async getAnimeDetail(slug: string): Promise<AnimeDetail> {
    const $ = await fetchPage(`${getBase()}/anime/${slug}/`);

    const title =
      $(".bigcontent .infox h1.entry-title").text().trim() ||
      $(".entry-title").first().text().trim();
    const thumbnail =
      $(".bigcontent .thumb img").attr("src") ??
      $(".thumb img").first().attr("src") ??
      "";
    const score = $(".numscore").first().text().trim();
    const genres: string[] = [];
    $(".genxed a").each((_, el) => { genres.push($(el).text().trim()); });

    let status: "ongoing" | "completed" = "ongoing";
    let studio = "";
    let type = "";
    let totalEpisodes = "";
    let releaseDate = "";
    let synopsis = "";

    $(".infox .spe span").each((_, el) => {
      const label = $(el).find("b").text().trim().toLowerCase();
      const value = $(el)
        .text()
        .replace($(el).find("b").text(), "")
        .replace(":", "")
        .trim();
      if (label.includes("status"))
        status = value.toLowerCase().includes("complet") ? "completed" : "ongoing";
      if (label.includes("studio")) studio = value;
      if (label.includes("tipe") || label.includes("type")) type = value;
      if (label.includes("episode")) totalEpisodes = value;
      if (label.includes("dirilis") || label.includes("tanggal")) releaseDate = value;
    });

    $('[itemprop="description"] p, .entry-content p').each((_, el) => {
      if (!synopsis) synopsis = $(el).text().trim();
    });

    const episodes: EpisodeMeta[] = [];
    $(".eplister ul li").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href") ?? "";
      const epSlug = extractEpisodeSlugFromHref(href);
      const epTitle =
        $(el).find(".epl-title").text().trim() ||
        $(el).find(".epl-num").text().trim();
      const epDate = $(el).find(".epl-date").text().trim();
      if (epSlug) episodes.push({ title: epTitle, slug: epSlug, date: epDate });
    });

    return {
      title,
      slug,
      thumbnail,
      score: score || undefined,
      status,
      genres,
      synopsis,
      studio: studio || undefined,
      type: type || undefined,
      totalEpisodes: totalEpisodes || undefined,
      releaseDate: releaseDate || undefined,
      episodes,
    };
  }

  async getEpisode(slug: string): Promise<EpisodeDetail> {
    const url = `${getBase()}/${slug}/`;
    const $ = await fetchPage(url);

    const title = $("h1.entry-title").first().text().trim();
    const animeLink = $(".naveps a[rel='up']").attr("href") ?? "";
    const animeSlug = extractSlugFromHref(animeLink);
    const animeTitle = $(".naveps a[rel='up']").text().trim();

    const mirrors: Mirror[] = [];
    $("select.mirror option[value]").each((_, el) => {
      const b64 = $(el).attr("value") ?? "";
      if (!b64) return;
      const rawIndex = parseInt($(el).attr("data-index") ?? "1", 10);
      const index = Math.max(0, rawIndex - 1);
      const label = $(el).text().trim();
      const src = extractIframeSrc(b64) ?? undefined;
      mirrors.push({ quality: "720p", index, label, id: 0, src });
    });

    const prevHref = $(".naveps a[rel=prev]").attr("href") ?? "";
    const nextHref = $(".naveps a[rel=next]").attr("href") ?? "";
    const prevSlug = prevHref ? extractEpisodeSlugFromHref(prevHref) : undefined;
    const nextSlug = nextHref ? extractEpisodeSlugFromHref(nextHref) : undefined;

    return { title, animeSlug, animeTitle, mirrors, prevSlug, nextSlug };
  }

  async getEmbedUrl(_id: number, _mirror: number, _quality: string): Promise<string> {
    // samehadaku pre-decodes embed URLs in getEpisode — this method won't be called
    // if mirror.src is set. Return empty string as fallback.
    return "";
  }

  async search(query: string): Promise<AnimeCard[]> {
    const $ = await fetchPage(`${getBase()}/?s=${encodeURIComponent(query)}`);
    return parseCards($);
  }
}
