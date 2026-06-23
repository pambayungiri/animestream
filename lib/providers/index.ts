import { getConfig } from "@/lib/config";
import { OtakudesuProvider } from "./otakudesu";
import { SamehadakuProvider } from "./samehadaku";
import type { AnimeProvider } from "./types";

let _provider: AnimeProvider | null = null;

export function getProvider(): AnimeProvider {
  if (_provider) return _provider;
  const { provider } = getConfig();
  switch (provider) {
    case "samehadaku":
      _provider = new SamehadakuProvider();
      break;
    case "otakudesu":
    default:
      _provider = new OtakudesuProvider();
      break;
  }
  return _provider;
}
