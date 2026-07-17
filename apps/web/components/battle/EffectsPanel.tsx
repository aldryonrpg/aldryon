import type { BattleEffectDto } from "@aldryon/dtos";
import { ATTRIBUTE_FULL_NAMES } from "@/lib/attributeLabels";

type DotKind = "bleed" | "poison" | "burn";
type DebuffKind = "fear" | "magic_aura_blast";

const DOT_LABELS: Record<DotKind, string> = {
  bleed: "Bleed",
  poison: "Poison",
  burn: "Burn",
};

const DOT_STYLES: Record<DotKind, string> = {
  bleed: "border-red-700 text-red-400",
  poison: "border-green-700 text-green-400",
  burn: "border-orange-700 text-orange-400",
};

/** How each DoT is removed — Bag cures only ever land on the player (bleed/
 * poison, from a monster's hit); the player's own burn on a monster has no
 * cure at all, monsters carry no bag (BattleEffect.ts). */
const DOT_CURES: Record<DotKind, string> = {
  bleed: "Cure: use a Bandage from your Bag",
  poison: "Cure: use an Antidote from your Bag",
  burn: "No cure — lasts until the battle ends",
};

const DEBUFF_LABELS: Record<DebuffKind, string> = {
  fear: "Fear",
  magic_aura_blast: "Magic Aura Blast",
};

const DEBUFF_STYLES: Record<DebuffKind, string> = {
  fear: "border-purple-700 text-purple-400",
  magic_aura_blast: "border-blue-700 text-blue-400",
};

const DEBUFF_STAT: Record<DebuffKind, "strength" | "intelligence"> = {
  fear: "strength",
  magic_aura_blast: "intelligence",
};

const STUN_STYLE = "border-yellow-600 text-yellow-400";

/** Bleed/poison/burn stack unlimited (see BattleEffect.ts) — grouped into
 * one badge per kind, with the stack count and a hover tooltip totaling the
 * round damage every stacked instance of that kind is dealing. Fear/Magic
 * Aura Blast never stack (addBattleEffect refreshes instead), so each shows
 * as its own badge. Stun shows as a single badge whenever any is active.
 * Used for both the player's own afflictions and whatever the player has
 * inflicted on the monster. */
export function EffectsPanel({ label, effects }: { label: string; effects: BattleEffectDto[] }) {
  const dotTotals = new Map<DotKind, { count: number; damagePerRound: number }>();
  const debuffs: { kind: DebuffKind; percent: number }[] = [];
  let stunRoundsLeft: number | null = null;

  for (const effect of effects) {
    if (effect.type === "dot") {
      const existing = dotTotals.get(effect.kind) ?? { count: 0, damagePerRound: 0 };
      dotTotals.set(effect.kind, {
        count: existing.count + 1,
        damagePerRound: existing.damagePerRound + effect.damagePerRound,
      });
    } else if (effect.type === "debuff") {
      debuffs.push({ kind: effect.kind, percent: effect.percent });
    } else if (effect.type === "stun" && effect.roundsLeft > 0) {
      stunRoundsLeft = Math.max(stunRoundsLeft ?? 0, effect.roundsLeft);
    }
  }

  const hasAny = dotTotals.size > 0 || debuffs.length > 0 || stunRoundsLeft !== null;

  return (
    <div className="flex min-h-9 flex-1 flex-wrap items-center gap-2 border border-white bg-black/80 px-2 py-1">
      <span className="text-xs text-stone-400">{label}:</span>
      {!hasAny ? (
        <span className="text-xs text-stone-500">No active effects</span>
      ) : (
        <>
          {stunRoundsLeft !== null && (
            <div
              title={`Voids Attack/Bag/Rest/Run for ${stunRoundsLeft} more turn${stunRoundsLeft > 1 ? "s" : ""}\nNo cure — wears off over time`}
              className={`border bg-black px-2 py-0.5 text-xs ${STUN_STYLE}`}
            >
              Stunned
            </div>
          )}
          {debuffs.map(({ kind, percent }) => (
            <div
              key={kind}
              title={`-${percent}% ${ATTRIBUTE_FULL_NAMES[DEBUFF_STAT[kind]]}\nNo cure — recovers on its own over time`}
              className={`border bg-black px-2 py-0.5 text-xs ${DEBUFF_STYLES[kind]}`}
            >
              {DEBUFF_LABELS[kind]}
            </div>
          ))}
          {[...dotTotals.entries()].map(([kind, { count, damagePerRound }]) => (
            <div
              key={kind}
              title={`${damagePerRound} damage/round\n${DOT_CURES[kind]}`}
              className={`border bg-black px-2 py-0.5 text-xs ${DOT_STYLES[kind]}`}
            >
              {DOT_LABELS[kind]}
              {count > 1 && ` x${count}`}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
