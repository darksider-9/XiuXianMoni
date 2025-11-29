
import { CharacterState, ChatMessage, SaveData, AISettings } from '../types';

const SAVE_KEY = 'xiuxian_save_v1';
const SETTINGS_KEY = 'xiuxian_settings_v1';

// Default settings
const DEFAULT_SETTINGS: AISettings = {
  apiKey: '',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', // Default to Google's OpenAI compat endpoint
  model: 'gemini-2.0-flash',
};

export const saveGame = (character: CharacterState, history: ChatMessage[], settings?: AISettings) => {
  try {
    const data: SaveData = {
      character,
      history,
      timestamp: Date.now(),
      settings
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Auto-save failed:", error);
  }
};

export const loadGame = (): SaveData | null => {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return null;
    return JSON.parse(json) as SaveData;
  } catch (error) {
    console.error("Load game failed:", error);
    return null;
  }
};

export const clearSave = () => {
  localStorage.removeItem(SAVE_KEY);
};

export const saveSettings = (settings: AISettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const loadSettings = (): AISettings => {
  try {
    const json = localStorage.getItem(SETTINGS_KEY);
    if (json) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
    }
  } catch (e) {
    console.error("Failed to load settings", e);
  }
  
  // Backwards compatibility: check for old API key storage
  const oldKey = localStorage.getItem('xiuxian_api_key');
  if (oldKey) {
      return { ...DEFAULT_SETTINGS, apiKey: oldKey };
  }

  return DEFAULT_SETTINGS;
};

// 导出存档为 JSON 文件
export const exportSaveToFile = (character: CharacterState, history: ChatMessage[], settings: AISettings) => {
  const data: SaveData = { character, history, timestamp: Date.now(), settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `xiuxian_save_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 从文件导入存档
export const importSaveFromFile = (file: File): Promise<SaveData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json) as SaveData;
        // Basic validation
        if (!data.character || !data.history) {
            throw new Error("Invalid save file format");
        }
        // Save immediately to local storage
        saveGame(data.character, data.history, data.settings);
        if (data.settings) {
            saveSettings(data.settings);
        }
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsText(file);
  });
};
