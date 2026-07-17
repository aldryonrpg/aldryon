import type { AttributeValuesDto } from "@aldryon/dtos";
import { Bar } from "@/components/battle/Bar";
import { ATTRIBUTE_FULL_NAMES, ATTRIBUTE_ORDER, ATTRIBUTE_TRIGRAMS } from "@/lib/attributeLabels";
import { formatDisplayName } from "@/lib/formatDisplayName";

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
      <div className="border border-white bg-black/80 px-2 py-1 text-center text-sm">
        Monster HP ({currentHp}/{maxHp}) {percent}%
      </div>
      <Bar percent={percent} colorClass="bg-red-700" />
      <div className="border border-white bg-black/80 px-2 py-1 text-center font-bold">
        {displayName}
      </div>
      <div className="flex h-[40vh] items-center justify-center py-2 sm:h-[48vh]">
        {/* biome-ignore lint/performance/noImgElement: tolerant of a missing/broken src (no real CDN yet), unlike next/image */}
        <img
          src={monsterImage}
          alt={displayName}
          className="h-[90%] w-[90%] object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.7)]"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
      <div className="flex justify-center gap-1">
        {ATTRIBUTE_ORDER.map((key) => (
          <div
            key={key}
            className="flex h-10 w-10 flex-col items-center justify-center gap-0.5 border border-white bg-black/80 leading-none"
            title={ATTRIBUTE_FULL_NAMES[key]}
          >
            <span className="text-xs">{attributes[key] ?? "??"}</span>
            <span className="text-[9px] text-stone-400">{ATTRIBUTE_TRIGRAMS[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
