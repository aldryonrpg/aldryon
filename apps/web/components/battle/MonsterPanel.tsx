import type { AttributeKeyDto, AttributeValuesDto } from "@aldryon/dtos";
import { Bar } from "@/components/battle/Bar";
import { formatDisplayName } from "@/lib/formatDisplayName";

const ROWS: { label: string; key: AttributeKeyDto }[] = [
  { label: "Agi", key: "agility" },
  { label: "Str", key: "strength" },
  { label: "Int", key: "intelligence" },
  { label: "Dex", key: "dexterity" },
  { label: "Sor", key: "luck" },
  { label: "Vit", key: "vitality" },
];

interface MonsterPanelProps {
  name: string;
  monsterImage: string;
  currentHp: number;
  maxHp: number;
  /** Only revealed keys are present — REVEAL SPELL/Knowledge Potion grow
   * this over a battle; everything else renders as "??". The server never
   * sends a hidden attribute's value at all, so there's nothing to hide
   * client-side — an absent key just means "not yet known". */
  attributes: Partial<AttributeValuesDto>;
}

export function MonsterPanel({
  name,
  monsterImage,
  currentHp,
  maxHp,
  attributes,
}: MonsterPanelProps) {
  const percent = maxHp > 0 ? Math.round((currentHp / maxHp) * 100) : 0;
  const displayName = formatDisplayName(name);

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="border border-white bg-black px-2 py-1 text-center text-sm">
        Monster HP ({currentHp}/{maxHp}) {percent}%
      </div>
      <Bar percent={percent} colorClass="bg-red-700" />
      <div className="border border-white bg-black px-2 py-1 text-center font-bold">
        {displayName}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white bg-black">
          {/* biome-ignore lint/performance/noImgElement: tolerant of a missing/broken src (no real CDN yet), unlike next/image */}
          <img
            src={monsterImage}
            alt={displayName}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-1">
          {ROWS.map((row) => (
            <div
              key={row.key}
              className="flex h-8 w-10 flex-col items-center justify-center border border-white bg-black text-xs leading-none"
              title={row.label}
            >
              <span>{attributes[row.key] ?? "??"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
