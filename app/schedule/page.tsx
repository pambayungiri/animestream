import Link from "next/link";
import { SectionTitle } from "@/components/SectionTitle";
import type { WeeklySchedule } from "@/lib/providers/types";

export const revalidate = 3600;

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu", "Random"];

async function getData(): Promise<WeeklySchedule> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/schedule`, { next: { revalidate: 3600 } });
  return res.json();
}

export default async function SchedulePage() {
  const schedule = await getData();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SectionTitle>Jadwal Rilis Anime</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {DAYS.map(day => (
          <div key={day} className="bg-surface rounded-xl p-4 border border-border">
            <h3 className="font-bold text-accent mb-3 text-sm uppercase tracking-wide">{day}</h3>
            <ul className="space-y-2">
              {schedule[day]?.map(entry => (
                <li key={entry.slug}>
                  <Link
                    href={`/anime/${entry.slug}`}
                    className="text-sm text-gray-300 hover:text-accent transition-colors line-clamp-1"
                  >
                    {entry.title}
                  </Link>
                </li>
              )) ?? <li className="text-xs text-muted">Tidak ada</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
