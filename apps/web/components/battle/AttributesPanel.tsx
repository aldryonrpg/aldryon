import type { AttributeKeyDto, AttributeValuesDto } from "@aldryon/dtos";

const ROWS: { label: string; key: AttributeKeyDto }[] = [
  { label: "Agi", key: "agility" },
  { label: "For", key: "force" },
  { label: "Int", key: "intelligence" },
  { label: "Dex", key: "dexterity" },
  { label: "Sor", key: "luck" },
  { label: "Vit", key: "vitality" },
];

interface AttributesPanelProps {
  attributes: AttributeValuesDto;
  attributePoints: number;
  onAllocate: (key: AttributeKeyDto) => void;
  disabled: boolean;
}

export function AttributesPanel({
  attributes,
  attributePoints,
  onAllocate,
  disabled,
}: AttributesPanelProps) {
  return (
    <div className="w-48 border border-white bg-black">
      <div className="grid grid-cols-3 border-b border-white text-xs text-stone-400">
        <div className="border-r border-white px-2 py-1">Attr</div>
        <div className="border-r border-white px-2 py-1">Val</div>
        <div className="px-2 py-1">{attributePoints} pts</div>
      </div>
      {ROWS.map((row) => (
        <div key={row.key} className="grid grid-cols-3 border-b border-white last:border-b-0">
          <div className="border-r border-white px-2 py-1">{row.label}</div>
          <div className="border-r border-white px-2 py-1">{attributes[row.key]}</div>
          <button
            type="button"
            disabled={disabled || attributePoints <= 0}
            onClick={() => onAllocate(row.key)}
            className="px-2 py-1 text-center hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            +1
          </button>
        </div>
      ))}
    </div>
  );
}
