import { Bar } from "@/components/battle/Bar";

interface PlayerStatusBarProps {
  currentHp: number;
  maxHp: number;
  currentStamina: number;
  maxStamina: number;
}

export function PlayerStatusBar({
  currentHp,
  maxHp,
  currentStamina,
  maxStamina,
}: PlayerStatusBarProps) {
  const percent = maxHp > 0 ? Math.round((currentHp / maxHp) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 border border-white bg-black px-3 py-2 font-bold">
        <span>{currentStamina}</span>
        <span aria-hidden="true">⚡</span>
        <span className="sr-only">/ {maxStamina} Stamina</span>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="border border-white bg-black px-2 py-1 text-center text-sm">
          Player Health Bar ({percent}%) — {currentHp}/{maxHp}
        </div>
        <Bar percent={percent} colorClass="bg-green-700" />
      </div>
    </div>
  );
}
