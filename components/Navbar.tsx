"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function Navbar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <nav className="sticky top-0 z-50 bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-bold text-accent shrink-0">
          AnimeStream
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/ongoing" className="hover:text-accent transition-colors">Ongoing</Link>
          <Link href="/complete" className="hover:text-accent transition-colors">Complete</Link>
          <Link href="/schedule" className="hover:text-accent transition-colors">Jadwal</Link>
          <Link href="/genre" className="hover:text-accent transition-colors">Genre</Link>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-xs">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari anime..."
            className="w-full rounded-md bg-surface-2 border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
          <button type="submit" className="text-muted hover:text-accent">
            <Search size={18} />
          </button>
        </form>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-surface px-4 py-3 flex flex-col gap-3 text-sm">
          <Link href="/ongoing" onClick={() => setOpen(false)}>Ongoing</Link>
          <Link href="/complete" onClick={() => setOpen(false)}>Complete</Link>
          <Link href="/schedule" onClick={() => setOpen(false)}>Jadwal</Link>
          <Link href="/genre" onClick={() => setOpen(false)}>Genre</Link>
        </div>
      )}
    </nav>
  );
}
