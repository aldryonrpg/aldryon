import type { EquippedItemsDto } from "@aldryon/dtos";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { computeSetCompletion } from "@/lib/setCompletion";

interface SetBonusStatusProps {
  equipped: EquippedItemsDto;
  setAttributeBonus: number;
}

/** Shown directly below the Equipment grid — always-on green messaging when
 * a 6-piece set is complete, or a lighter-green nudge when exactly one
 * piece away. Silent otherwise (0-4 matching pieces isn't worth a message). */
export function SetBonusStatus({ equipped, setAttributeBonus }: SetBonusStatusProps) {
  const status = computeSetCompletion(equipped);

  if (status.complete) {
    return (
      <p className="text-xs text-green-500">
        {formatDisplayName(status.setName ?? "")} Set complete: +{setAttributeBonus} to every stat!
      </p>
    );
  }

  if (status.almostComplete) {
    return (
      <p className="text-xs text-green-300">
        Almost complete set! You are missing the {status.missingSlotLabel} part to get your SET
        bonus +{setAttributeBonus}.
      </p>
    );
  }

  return null;
}
