import { AnimeCard } from "@/components/AnimeCard";
import { Pagination } from "@/components/Pagination";
import { SectionTitle } from "@/components/SectionTitle";
import { getProvider } from "@/lib/providers";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const revalidate = 7200;

export default async function OngoingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const { data, totalPages, currentPage } = await getProvider().getOngoing(page);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>Anime Ongoing</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {data?.map((anime: AnimeCardType) => (
          <AnimeCard key={anime.slug} anime={anime} />
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/ongoing" />
    </div>
  );
}
