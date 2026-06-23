interface Props { children: React.ReactNode; href?: string }

export function SectionTitle({ children, href }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-white border-l-4 border-accent pl-3">{children}</h2>
      {href && (
        <a href={href} className="text-sm text-accent hover:underline">Lihat Semua →</a>
      )}
    </div>
  );
}
