
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

export interface CharacterState {
  name: string;
  realm: string; // 灵道境界 (练气、筑基...)
  bodyRealm: string; // 肉身境界 (铜皮、铁骨...)
  cultivation: number; // 当前灵力/修为
  maxCultivation: number; // 突破所需修为
  health: number; // 气血
  maxHealth: number; // 最大气血
  soul: number; // 神魂/神识强度
  maxSoul: number; // 神魂上限
  spiritStones: number; // 灵石
  attributes: Record<CharacterAttribute, number>;
  inventory: string[]; // 背包
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
