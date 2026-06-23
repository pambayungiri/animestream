import Link from "next/link";
import { SectionTitle } from "@/components/SectionTitle";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export default async function GenreListPage() {
  const genres = await getProvider().getGenres();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>Daftar Genre</SectionTitle>
      <div className="flex flex-wrap gap-3">
        {genres.map(genre => (
          <Link
            key={genre.slug}
            href={`/genre/${genre.slug}`}
            className="px-4 py-2 rounded-full bg-surface-2 border border-border text-sm hover:bg-accent hover:border-accent hover:text-white transition-all"
          >
            {genre.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
