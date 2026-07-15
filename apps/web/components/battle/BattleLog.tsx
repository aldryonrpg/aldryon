import type { AttackResultDto } from "@aldryon/dtos";

interface BattleLogProps {
  messages: string[];
  playerAttack: AttackResultDto | null;
  monsterAttack: AttackResultDto | null;
}

function describeAttack(label: string, result: AttackResultDto): string {
  const outcome = result.hit ? `${result.damage} damage` : "missed";
  const effect = result.effectApplied ? ` (${result.effectApplied})` : "";
  return `${label} used ${result.attackName}: ${outcome}${effect}`;
}

/** The battle log / narration surface — the primary read of every action
 * response, including gatekeeper-defeat/boss-reveal/Growl narration during
 * a dungeon run (plan3 §2d/§2e). */
export function BattleLog({ messages, playerAttack, monsterAttack }: BattleLogProps) {
  const lines: string[] = [];
  if (playerAttack) lines.push(describeAttack("You", playerAttack));
  if (monsterAttack) lines.push(describeAttack("The monster", monsterAttack));
  lines.push(...messages);

  return (
    <div className="min-h-32 border border-white bg-black p-3 text-sm">
      <p className="mb-2 font-bold">Caixa de texto informativa: Dano, defesa e drops</p>
      {lines.length === 0 ? (
        <p className="text-stone-400">The battle begins...</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the log is replaced wholesale every turn, never reordered
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
