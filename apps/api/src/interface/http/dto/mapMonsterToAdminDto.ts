import type { MonsterAdminDto } from "@aldryon/dtos";
import type { Monster } from "@/domain/monster/Monster";

export function mapMonsterToAdminDto(monster: Monster): MonsterAdminDto {
  const props = monster.toProps();
  return {
    id: props.id,
    name: props.name,
    description: props.description,
    region: props.region,
    monsterImage: props.monsterImage,
    hp: props.hp,
    xpGain: props.xpGain,
    level: props.level,
    maxStamina: props.maxStamina,
    attributes: props.attributes,
    monsterType: props.monsterType,
    drops: props.drops,
    exclusiveDrops: props.exclusiveDrops,
    legendaryDrops: props.legendaryDrops,
    ambushChance: props.ambushChance,
  };
}
