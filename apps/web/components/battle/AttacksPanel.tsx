import type { AvailableAttackDto } from "@aldryon/dtos";

interface AttacksPanelProps {
  attacks: AvailableAttackDto[];
  onSelect: (attackName: string) => void;
  disabled: boolean;
}

function byStaminaCostAscending(a: AvailableAttackDto, b: AvailableAttackDto): number {
  return a.staminaCost - b.staminaCost;
}

function AttackRow({
  atk,
  disabled,
  onSelect,
}: {
  atk: AvailableAttackDto;
  disabled: boolean;
  onSelect: (attackName: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || !atk.meetsRequirements}
      onClick={() => onSelect(atk.name)}
      className="block w-full border-b border-white px-2 py-2 text-left last:border-b-0 hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {atk.name} ({atk.multiplier}x) {atk.staminaCost}
      <span aria-hidden="true">⚡</span>
      <span className="sr-only"> Stamina</span>
      {atk.revealsRandomMonsterAttribute && " - Reveals Monster Attribute"}
    </button>
  );
}

/**
 * Grouped by scalingAttribute — Strength-scaled attacks first under a red
 * "Attacks:" label, Intelligence-scaled ones (spells) after under a blue
 * "Spells:" label — then sorted by Stamina cost ascending within each group
 * so the cheapest options are easiest to spot (plans/plan4.md §10). The
 * backend only ever sends the flat list of attacks available to the player;
 * all grouping, ordering, and row formatting happens here.
 */
export function AttacksPanel({ attacks, onSelect, disabled }: AttacksPanelProps) {
  const strengthAttacks = attacks
    .filter((a) => a.scalingAttribute === "strength")
    .sort(byStaminaCostAscending);
  const intelligenceAttacks = attacks
    .filter((a) => a.scalingAttribute === "intelligence")
    .sort(byStaminaCostAscending);

  return (
    <div className="w-60 border border-white bg-black">
      {strengthAttacks.length > 0 && (
        <>
          <div className="border-b border-white px-2 py-1 text-center font-bold text-red-500">
            Attacks:
          </div>
          {strengthAttacks.map((atk) => (
            <AttackRow key={atk.name} atk={atk} disabled={disabled} onSelect={onSelect} />
          ))}
        </>
      )}
      {intelligenceAttacks.length > 0 && (
        <>
          <div className="border-b border-white px-2 py-1 text-center font-bold text-blue-500">
            Spells:
          </div>
          {intelligenceAttacks.map((atk) => (
            <AttackRow key={atk.name} atk={atk} disabled={disabled} onSelect={onSelect} />
          ))}
        </>
      )}
    </div>
  );
}
