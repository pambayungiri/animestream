export function getConfig() {
  const provider = process.env.ANIME_PROVIDER ?? "samehadaku";

  // Otakudesu-specific vars — only required when provider is "otakudesu"
  const baseUrl = process.env.OTAKUDESU_BASE_URL ?? "";
  const nonceAction = process.env.OTAKUDESU_NONCE_ACTION ?? "";
  const embedAction = process.env.OTAKUDESU_EMBED_ACTION ?? "";

  if (provider === "otakudesu" && (!baseUrl || !nonceAction || !embedAction)) {
    throw new Error("Missing required env vars for otakudesu provider: OTAKUDESU_BASE_URL, OTAKUDESU_NONCE_ACTION, OTAKUDESU_EMBED_ACTION");
  }

  // Samehadaku-specific vars
  const samehadakuBaseUrl = process.env.SAMEHADAKU_BASE_URL ?? "https://samehadaku.me";

  return { baseUrl, nonceAction, embedAction, provider, samehadakuBaseUrl };
}
