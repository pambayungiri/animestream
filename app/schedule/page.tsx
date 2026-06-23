import Image from "next/image";
import Link from "next/link";
import { getProvider } from "@/lib/providers";
import { SectionTitle } from "@/components/SectionTitle";

export const dynamic = "force-dynamic";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default async function SchedulePage() {
  const provider = getProvider();
  const schedule = await provider.getSchedule();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-8 border-l-4 border-accent pl-3">
        Jadwal Rilis Mingguan
      </h1>

      <div className="space-y-10">
        {DAYS.map((day) => {
          const entries = schedule[day] ?? [];
          return (
            <section key={day}>
              <h2 className="text-lg font-semibold text-accent mb-4">{day}</h2>
              {entries.length === 0 ? (
                <p className="text-muted text-sm">Tidak ada anime hari ini.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {entries.map((entry) => (
                    <Link
                      key={entry.slug}
                      href={`/search?q=${encodeURIComponent(entry.title)}`}
                      className="group flex flex-col gap-2"
                    >
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-surface border border-border group-hover:border-accent transition-colors">
                        {entry.thumbnail ? (
                          <Image
                            src={entry.thumbnail}
                            alt={entry.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            unoptimized
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted text-xs text-center p-2">
                            {entry.title}
                          </div>
                        )}
                        {entry.score && (
                          <div className="absolute top-1.5 right-1.5 bg-black/70 text-xs font-bold px-1.5 py-0.5 rounded text-yellow-400">
                            ★ {entry.score}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 line-clamp-2 group-hover:text-accent transition-colors leading-snug">
                        {entry.title}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
