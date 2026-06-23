import * as cheerio from "cheerio";
import { gotScraping } from "got-scraping";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

export async function fetchPage(url: string, referer?: string) {
  const res = await gotScraping(url, {
    headers: {
      ...HEADERS,
      ...(referer ? { Referer: referer } : {}),
    },
    followRedirect: true,
  });
  return cheerio.load(res.body);
}

export async function postAjax(url: string, data: Record<string, string>, referer: string) {
  const res = await gotScraping.post(url, {
    form: data,
    headers: {
      ...HEADERS,
      Referer: referer,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  // Return an object compatible with AxiosResponse shape — callers use .data
  return { data: JSON.parse(res.body) };
}
