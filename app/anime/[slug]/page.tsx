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
