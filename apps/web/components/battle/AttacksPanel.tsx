import type { AvailableAttackDto } from "@aldryon/dtos";

interface AttacksPanelProps {
  attacks: AvailableAttackDto[];
  onSelect: (attackName: string) => void;
  disabled: boolean;
}

export function AttacksPanel({ attacks, onSelect, disabled }: AttacksPanelProps) {
  return (
    <div className="w-60 border border-white bg-black">
      <div className="border-b border-white px-2 py-1 text-center font-bold">Attacks</div>
      {attacks.map((atk) => (
        <button
          key={atk.name}
          type="button"
          disabled={disabled || !atk.meetsRequirements}
          onClick={() => onSelect(atk.name)}
          className="block w-full border-b border-white px-2 py-2 text-left last:border-b-0 hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {atk.name} ({atk.staminaCost} Stamina) (
          {atk.scalingAttribute === "force" ? "Force" : "Int"})
        </button>
      ))}
    </div>
  );
}
