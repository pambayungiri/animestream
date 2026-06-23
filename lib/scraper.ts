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
