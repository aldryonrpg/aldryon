import type { AttackAdminDto } from "@aldryon/dtos";
import type { Attack } from "@/domain/attack/Attack";

export function mapAttackToAdminDto(attack: Attack): AttackAdminDto {
  const props = attack.toProps();
  return {
    id: props.id,
    name: props.name,
    staminaCost: props.staminaCost,
    multiplier: props.multiplier,
    scalingAttribute: props.scalingAttribute,
    appliesEffect: props.appliesEffect,
    minLevel: props.minLevel,
    attributeRequirements: props.attributeRequirements,
    revealsRandomMonsterAttribute: props.revealsRandomMonsterAttribute,
  };
}
