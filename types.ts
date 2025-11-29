
export enum CharacterAttribute {
  STRENGTH = '根骨',
  WISDOM = '悟性',
  AGILITY = '身法',
  LUCK = '机缘',
}

export interface EquipmentState {
  weapon: string; // 武器
  armor: string;  // 防具
  relic: string;  // 法宝 (主动使用的宝物)
}

export interface CharacterState {
  name: string;
  realm: string; // 境界
  cultivation: number; // 当前修为
  maxCultivation: number; // 突破所需修为
  health: number; // 气血
  maxHealth: number; // 最大气血
  spiritStones: number; // 灵石
  attributes: Record<CharacterAttribute, number>;
  inventory: string[]; // 背包：材料、丹药、杂物
  equipment: EquipmentState; // 当前装备
  techniques: string[]; // 修炼的功法/法诀/神通
  statusEffects: string[]; // 状态：中毒、顿悟、丹毒、阵法庇护等
}

export interface GameResponse {
  narrative: string;
  characterUpdate: Partial<CharacterState>;
  choices: string[];
  gameOver: boolean;
  eventArtKeyword: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'; // Standard OpenAI roles
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
  timestamp: number;
  settings?: AISettings; // Saved API configuration
}
