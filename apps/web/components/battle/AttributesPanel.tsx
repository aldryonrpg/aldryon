import type { AttributeValuesDto } from "@aldryon/dtos";
import { ATTRIBUTE_ORDER, ATTRIBUTE_TRIGRAMS } from "@/lib/attributeLabels";

interface AttributesPanelProps {
  attributes: AttributeValuesDto;
  /** Combined equipped-item + full-set-completion bonus per attribute. */
  attributeBonuses: AttributeValuesDto;
  /** Post-Fear/Magic-Aura-Blast values, only present during a battle. Equal
   * to attributes+attributeBonuses on any stat with no active debuff. */
  attributesAfterDebuff?: AttributeValuesDto;
}

export function AttributesPanel({
  attributes,
  attributeBonuses,
  attributesAfterDebuff,
}: AttributesPanelProps) {
  return (
    <div className="w-56 border border-white bg-black">
      <div className="grid grid-cols-3 border-b border-white text-xs text-stone-400">
        <div className="border-r border-white px-2 py-1">Attr</div>
        <div className="border-r border-white px-2 py-1">Items Bonus</div>
        <div className="px-2 py-1">Total</div>
      </div>
      {ATTRIBUTE_ORDER.map((key) => {
        const base = attributes[key];
        const bonus = attributeBonuses[key];
        const total = base + bonus;
        const debuffed = attributesAfterDebuff?.[key];
        const isDebuffed = debuffed !== undefined && debuffed < total;
        return (
          <div key={key} className="grid grid-cols-3 border-b border-white last:border-b-0">
            <div className="border-r border-white px-2 py-1">{ATTRIBUTE_TRIGRAMS[key]}</div>
            <div className="border-r border-white px-2 py-1">
              {base}
              {bonus > 0 && <span className="text-green-500"> (+{bonus})</span>}
            </div>
            <div className="px-2 py-1">
              {isDebuffed ? (
                <>
                  <span className="text-stone-500 line-through">{total}</span>{" "}
                  <span className="text-yellow-400">{debuffed}</span>
                </>
              ) : (
                total
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
