import type { MonsterAttackAdminDto } from "@aldryon/dtos";
import type { MonsterAttack } from "@/domain/monster/MonsterAttack";

export function mapMonsterAttackToAdminDto(monsterAttack: MonsterAttack): MonsterAttackAdminDto {
  const props = monsterAttack.toProps();
  return {
    id: props.id,
    name: props.name,
    staminaCost: props.staminaCost,
    multiplier: props.multiplier,
    scalingAttribute: props.scalingAttribute,
    appliesEffect: props.appliesEffect,
    isSpecial: props.isSpecial,
    chargeTurns: props.chargeTurns,
  };
}
