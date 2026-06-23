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
