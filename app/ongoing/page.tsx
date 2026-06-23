import { AnimeCard } from "@/components/AnimeCard";
import { Pagination } from "@/components/Pagination";
import { SectionTitle } from "@/components/SectionTitle";
import type { AnimeCard as AnimeCardType } from "@/lib/providers/types";

export const revalidate = 7200;

async function getData(page: number) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/ongoing?page=${page}`, { next: { revalidate: 7200 } });
  return res.json();
}

export default async function OngoingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const { data, totalPages, currentPage } = await getData(page);

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
