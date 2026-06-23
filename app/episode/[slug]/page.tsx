import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VideoPlayer } from "@/components/VideoPlayer";
import type { EpisodeDetail } from "@/lib/providers/types";

export const revalidate = 7200;

async function getData(slug: string): Promise<EpisodeDetail> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/episode/${slug}`, { next: { revalidate: 7200 } });
  return res.json();
}

export default async function EpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episode = await getData(slug);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link href={`/anime/${episode.animeSlug}`} className="text-sm text-muted hover:text-accent transition-colors">
          ← {episode.animeTitle}
        </Link>
        <h1 className="text-xl font-bold text-white mt-1">{episode.title}</h1>
      </div>

      <VideoPlayer mirrors={episode.mirrors} />

      <div className="flex justify-between mt-6">
        {episode.prevSlug ? (
          <Link
            href={`/episode/${episode.prevSlug}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border hover:border-accent text-sm transition-all"
          >
            <ChevronLeft size={16} /> Episode Sebelumnya
          </Link>
        ) : <div />}

        {episode.nextSlug ? (
          <Link
            href={`/episode/${episode.nextSlug}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border hover:border-accent text-sm transition-all"
          >
            Episode Selanjutnya <ChevronRight size={16} />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
