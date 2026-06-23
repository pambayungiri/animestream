import { AnimeCard } from "@/components/AnimeCard";
import { SectionTitle } from "@/components/SectionTitle";
import { getProvider } from "@/lib/providers";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q ?? "";
  const results = query ? await getProvider().search(query) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>
        {query ? `Hasil: "${query}" (${results.length} anime)` : "Cari Anime"}
      </SectionTitle>
      {results.length === 0 && query && (
        <p className="text-muted text-sm">Tidak ada hasil untuk &quot;{query}&quot;</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {results.map((anime: AnimeCardType) => (
          <AnimeCard key={anime.slug} anime={anime} />
        ))}
      </div>
    </div>
  );
}
