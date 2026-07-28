import type { DungeonBossAdminDto } from "@aldryon/dtos";
import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";

export function mapDungeonBossToAdminDto(dungeonBoss: DungeonBoss): DungeonBossAdminDto {
  const props = dungeonBoss.toProps();
  return {
    id: props.id,
    name: props.name,
    description: props.description,
    monsterImage: props.monsterImage,
    monsterType: props.monsterType,
    baseHp: props.baseHp,
    baseXpGain: props.baseXpGain,
    baseMaxStamina: props.baseMaxStamina,
    baseAttributes: props.baseAttributes,
    drops: props.drops,
    exclusiveDrops: props.exclusiveDrops,
    legendaryDrops: props.legendaryDrops,
  };
}
