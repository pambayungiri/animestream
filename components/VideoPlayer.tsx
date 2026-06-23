"use client";
import { useState } from "react";
import { MirrorSelector } from "./MirrorSelector";
import { Loader2 } from "lucide-react";
import type { Mirror } from "@/lib/providers/types";

interface Props { mirrors: Mirror[] }

export function VideoPlayer({ mirrors }: Props) {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ quality: string; index: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMirror(mirror: Mirror) {
    setLoading(true);
    setError(null);
    setSelected({ quality: mirror.quality, index: mirror.index });
    try {
      if (mirror.src) {
        // pre-decoded embed URL (samehadaku and similar providers)
        setEmbedSrc(mirror.src);
      } else {
        const res = await fetch("/api/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: mirror.id, mirror: mirror.index, quality: mirror.quality }),
        });
        const data = await res.json();
        if (data.src) setEmbedSrc(data.src);
        else setError("Gagal memuat video. Coba mirror lain.");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <Loader2 className="animate-spin text-accent" size={40} />
          </div>
        )}
        {embedSrc ? (
          <iframe
            src={embedSrc}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted gap-3">
            <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Pilih server di bawah untuk mulai menonton</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <div className="bg-surface rounded-xl p-4 border border-border">
        <p className="text-sm font-semibold text-white mb-3">Pilih Server & Kualitas</p>
        <MirrorSelector
          mirrors={mirrors}
          selected={selected}
          onSelect={loadMirror}
          loading={loading}
        />
      </div>
    </div>
  );
}
