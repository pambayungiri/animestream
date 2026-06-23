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
