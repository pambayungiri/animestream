import { AnimeCard } from "@/components/AnimeCard";
import { SectionTitle } from "@/components/SectionTitle";
import { getProvider } from "@/lib/providers";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const provider = getProvider();
  const [ongoing, complete] = await Promise.all([
    provider.getOngoing(1),
    provider.getComplete(1),
  ]);

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
