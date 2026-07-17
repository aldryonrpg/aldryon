export function Bar({ percent, colorClass }: { percent: number; colorClass: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-3 w-full overflow-hidden border border-white bg-stone-900">
      <div className={`h-full ${colorClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
