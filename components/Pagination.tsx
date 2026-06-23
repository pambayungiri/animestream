"use client";
import { useRouter } from "next/navigation";

interface Props {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export function Pagination({ currentPage, totalPages, basePath }: Props) {
  const router = useRouter();
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (i === 0) return 1;
    if (i === 6) return totalPages;
    return Math.max(2, Math.min(totalPages - 1, currentPage - 2 + i));
  });

  return (
    <div className="flex gap-2 justify-center mt-8 flex-wrap">
      {currentPage > 1 && (
        <button
          onClick={() => router.push(`${basePath}?page=${currentPage - 1}`)}
          className="px-3 py-1 rounded bg-surface-2 text-sm hover:bg-accent transition-colors"
        >
          ‹ Prev
        </button>
      )}
      {pages.map((p, i) => (
        <button
          key={i}
          onClick={() => p !== currentPage && router.push(`${basePath}?page=${p}`)}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            p === currentPage
              ? "bg-accent text-white font-bold"
              : "bg-surface-2 hover:bg-accent/60"
          }`}
        >
          {p}
        </button>
      ))}
      {currentPage < totalPages && (
        <button
          onClick={() => router.push(`${basePath}?page=${currentPage + 1}`)}
          className="px-3 py-1 rounded bg-surface-2 text-sm hover:bg-accent transition-colors"
        >
          Next ›
        </button>
      )}
    </div>
  );
}
