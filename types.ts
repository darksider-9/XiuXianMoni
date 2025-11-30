
export enum CharacterAttribute {
  STRENGTH = '根骨',
  WISDOM = '悟性',
  AGILITY = '身法',
  LUCK = '机缘',
  CHARISMA = '魅力',
  WILLPOWER = '道心',
}

export interface EquipmentState {
  weapon: string; // 武器
  armor: string;  // 防具
  relic: string;  // 法宝 (主动使用的宝物)
}

export interface ItemDetails {
  name: string;
  type: 'weapon' | 'armor' | 'relic' | 'consumable' | 'material' | 'technique' | 'other';
  rank: string; // 品阶 (e.g., "凡品", "黄阶下品")
  description: string; // 详细描述 (Lore)
  effects: string[]; // 具体效果 (e.g., "攻击力+50", "回复气血200")
  requirements: string[]; // 使用要求 (e.g., "根骨>20", "筑基期")
}

export interface CharacterState {
  name: string;
  
  // 境界相关 (Progress)
  realm: string; // 灵道境界 (练气、筑基...)
  cultivation: number; // 灵道经验/修为 (Progress)
  maxCultivation: number; // 灵道突破阈值
  
  bodyRealm: string; // 肉身境界 (铜皮、铁骨...)
  bodyPractice: number; // 肉身经验 (Progress)
  maxBodyPractice: number; // 肉身突破阈值

  // 战斗资源 (Resources)
  health: number; // 精 (HP)
  maxHealth: number;
  mana: number; // 气 (MP/灵力值) - 施法消耗
  maxMana: number;
  soul: number; // 神 (SP/神识) - 操控消耗
  maxSoul: number;

  spiritStones: number; // 灵石
  attributes: Record<CharacterAttribute, number>;
  inventory: string[]; // 背包 (仅存名称)
  itemKnowledge: Record<string, ItemDetails>; // 物品详情缓存 (Metadata)
  equipment: EquipmentState; // 当前装备
  techniques: string[]; // 功法
  statusEffects: string[]; // 状态
}

export interface GameResponse {
  narrative: string;
  characterUpdate: Partial<CharacterState>;
  choices: string[];
  gameOver: boolean;
  eventArtKeyword: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'; 
  content: string;
  isNarrative?: boolean;
}

export interface StartLocation {
  id: string;
  name: string;
  description: string;
  bonus: string;
  type: 'combat' | 'alchemy' | 'social' | 'balanced' | 'custom';
}

export interface AISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface SaveData {
  character: CharacterState;
  history: ChatMessage[];
  summary: string;
  summarizedCount: number;
  timestamp: number;
  settings?: AISettings;
}
