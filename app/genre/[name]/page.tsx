import { AnimeCard } from "@/components/AnimeCard";
import { Pagination } from "@/components/Pagination";
import { SectionTitle } from "@/components/SectionTitle";
import { getProvider } from "@/lib/providers";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { name } = await params;
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const { data, totalPages, currentPage } = await getProvider().getByGenre(name, page);
  const label = name.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>Genre: {label}</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {data?.map((anime: AnimeCardType) => (
          <AnimeCard key={anime.slug} anime={anime} />
        ))}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} basePath={`/genre/${name}`} />
    </div>
  );
}
