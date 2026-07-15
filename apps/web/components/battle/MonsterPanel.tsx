import { Bar } from "@/components/battle/Bar";

interface MonsterPanelProps {
  name: string;
  monsterImage: string;
  currentHp: number;
  maxHp: number;
}

/** The mockup's "??"x2 mystery-loot grid is always static (a kill drops at
 * most one item per pool, two pools) — the real drop only appears in the
 * win report's lootOffer, resolved by LootClaimModal. */
export function MonsterPanel({ name, monsterImage, currentHp, maxHp }: MonsterPanelProps) {
  const percent = maxHp > 0 ? Math.round((currentHp / maxHp) * 100) : 0;

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="border border-white bg-black px-2 py-1 text-center text-sm">
        Monster HP ({currentHp}/{maxHp}) {percent}%
      </div>
      <Bar percent={percent} colorClass="bg-red-700" />
      <div className="border border-white bg-black px-2 py-1 text-center font-bold">{name}</div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white bg-black">
          {/* biome-ignore lint/performance/noImgElement: tolerant of a missing/broken src (no real CDN yet), unlike next/image */}
          <img
            src={monsterImage}
            alt={name}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <div className="flex h-8 w-10 items-center justify-center border border-white bg-black text-xs">
            ??
          </div>
          <div className="flex h-8 w-10 items-center justify-center border border-white bg-black text-xs">
            ??
          </div>
          <div className="h-8 w-10 border border-white bg-black" />
          <div className="h-8 w-10 border border-white bg-black" />
          <div className="h-8 w-10 border border-white bg-black" />
          <div className="h-8 w-10 border border-white bg-black" />
        </div>
      </div>
    </div>
  );
}
