import * as cheerio from "cheerio";
import got from "got";

// Realistic browser headers to reduce Cloudflare bot-detection friction.
// got-scraping's TLS fingerprinting can't run on Vercel (data files not bundled),
// so we use got directly with explicit headers instead.
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
};

export async function fetchPage(url: string, referer?: string) {
  const res = await got(url, {
    headers: {
      ...HEADERS,
      ...(referer ? { Referer: referer, "Sec-Fetch-Site": "same-origin" } : {}),
    },
    followRedirect: true,
    timeout: { request: 15000 },
    retry: { limit: 1 },
  });
  return cheerio.load(res.body);
}

export async function postAjax(url: string, data: Record<string, string>, referer: string) {
  const res = await got.post(url, {
    form: data,
    headers: {
      ...HEADERS,
      Referer: referer,
      "Content-Type": "application/x-www-form-urlencoded",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "X-Requested-With": "XMLHttpRequest",
    },
    timeout: { request: 15000 },
    retry: { limit: 1 },
  });
  // Return an object compatible with AxiosResponse shape — callers use .data
  return { data: JSON.parse(res.body) };
}
