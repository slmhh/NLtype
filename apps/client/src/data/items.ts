import type { ItemType } from "../types/multiplayer";

export interface ItemDef {
  id: ItemType;
  name: string;
  icon: string;
  description: string;
  duration: number;
  effectType: string;
  effectValue: number;
}

export type EffectType = "speed_boost" | "slow" | "shield" | "teleport";

const itemRegistry: Record<ItemType, ItemDef> = {
  speed_boost: {
    id: "speed_boost",
    name: "Speed Boost",
    icon: "🚀",
    description: "Double your movement speed",
    duration: 5,
    effectType: "speed_boost",
    effectValue: 2,
  },
  slow_trap: {
    id: "slow_trap",
    name: "Slow Trap",
    icon: "🧲",
    description: "Slow the opponent for a few seconds",
    duration: 4,
    effectType: "slow",
    effectValue: 1,
  },
  shield: {
    id: "shield",
    name: "Shield",
    icon: "🛡️",
    description: "Block the next debuff against you",
    duration: 0,
    effectType: "shield",
    effectValue: 0,
  },
  teleport: {
    id: "teleport",
    name: "Teleport",
    icon: "⚡",
    description: "Instantly jump forward",
    duration: 0,
    effectType: "teleport",
    effectValue: 8,
  },
};

export function getItemDef(id: ItemType): ItemDef | undefined {
  return itemRegistry[id];
}

export function getAllItemDefs(): ItemDef[] {
  return Object.values(itemRegistry);
}

export function registerItem(def: ItemDef) {
  itemRegistry[def.id] = def;
}
