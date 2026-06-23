import { AnimeCard } from "@/components/AnimeCard";
import { SectionTitle } from "@/components/SectionTitle";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const revalidate = 3600;

async function getOngoing() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/ongoing?page=1`, { next: { revalidate: 3600 } });
  return res.json();
}

async function getComplete() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/complete?page=1`, { next: { revalidate: 7200 } });
  return res.json();
}

export default async function HomePage() {
  const [ongoing, complete] = await Promise.all([getOngoing(), getComplete()]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <section className="mb-12">
        <SectionTitle href="/ongoing">Anime Ongoing</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {ongoing.data?.slice(0, 12).map((anime: AnimeCardType) => (
            <AnimeCard key={anime.slug} anime={anime} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle href="/complete">Anime Complete</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {complete.data?.slice(0, 12).map((anime: AnimeCardType) => (
            <AnimeCard key={anime.slug} anime={anime} />
          ))}
        </div>
      </section>
    </div>
  );
}
