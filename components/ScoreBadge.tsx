interface Props { score?: string }

export function ScoreBadge({ score }: Props) {
  if (!score) return null;
  const num = parseFloat(score);
  const color = num >= 8 ? "text-green-400" : num >= 6 ? "text-yellow-400" : "text-red-400";
  return (
    <span className={`text-xs font-bold ${color}`}>★ {score}</span>
  );
}
