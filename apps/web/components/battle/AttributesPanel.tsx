import type { AttributeKeyDto, AttributeValuesDto } from "@aldryon/dtos";

const ROWS: { label: string; key: AttributeKeyDto }[] = [
  { label: "Agi", key: "agility" },
  { label: "Str", key: "strength" },
  { label: "Int", key: "intelligence" },
  { label: "Dex", key: "dexterity" },
  { label: "Sor", key: "luck" },
  { label: "Vit", key: "vitality" },
];

interface AttributesPanelProps {
  attributes: AttributeValuesDto;
  /** Combined equipped-item + full-set-completion bonus per attribute. */
  attributeBonuses: AttributeValuesDto;
}

export function AttributesPanel({ attributes, attributeBonuses }: AttributesPanelProps) {
  return (
    <div className="w-56 border border-white bg-black">
      <div className="grid grid-cols-3 border-b border-white text-xs text-stone-400">
        <div className="border-r border-white px-2 py-1">Attr</div>
        <div className="border-r border-white px-2 py-1">Items Bonus</div>
        <div className="px-2 py-1">Total</div>
      </div>
      {ROWS.map((row) => {
        const base = attributes[row.key];
        const bonus = attributeBonuses[row.key];
        return (
          <div key={row.key} className="grid grid-cols-3 border-b border-white last:border-b-0">
            <div className="border-r border-white px-2 py-1">{row.label}</div>
            <div className="border-r border-white px-2 py-1">
              {base}
              {bonus > 0 && <span className="text-green-500"> (+{bonus})</span>}
            </div>
            <div className="px-2 py-1">{base + bonus}</div>
          </div>
        );
      })}
    </div>
  );
}
