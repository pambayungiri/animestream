"use client";

import { Mirror } from "@/lib/providers/types";

interface Props {
  mirrors: Mirror[];
  selected: { quality: string; index: number } | null;
  onSelect: (mirror: Mirror) => void;
  loading: boolean;
}

const QUALITY_ORDER = ["1080p", "720p", "480p", "360p", "240p"];

export function MirrorSelector({ mirrors, selected, onSelect, loading }: Props) {
  const byQuality = QUALITY_ORDER.reduce<Record<string, Mirror[]>>((acc, q) => {
    const group = mirrors.filter(m => m.quality === q);
    if (group.length) acc[q] = group;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(byQuality).map(([quality, group]) => (
        <div key={quality}>
          <p className="text-xs text-muted uppercase tracking-wider mb-1.5">{quality}</p>
          <div className="flex flex-wrap gap-2">
            {group.map(mirror => {
              const isSelected = selected?.quality === mirror.quality && selected?.index === mirror.index;
              return (
                <button
                  key={`${mirror.quality}-${mirror.index}`}
                  onClick={() => onSelect(mirror)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected
                      ? "bg-accent border-accent text-white"
                      : "bg-surface-2 border-border hover:border-accent text-gray-300"
                  } disabled:opacity-50`}
                >
                  {mirror.label || `Mirror ${mirror.index + 1}`}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
