
import { GameResponse, CharacterState, ChatMessage, AISettings } from "../types";

// 通用的 OpenAI 兼容接口调用逻辑
// 适用于: OpenAI, DeepSeek, Google Gemini (OpenAI Compat), Moonshot, Local LLMs (Ollama) 等

const SYSTEM_INSTRUCTION = `
你是一个硬核、开放式修仙文字冒险游戏的【天道】（Game Master）。你的职责是根据玩家的意图生成合理、有趣且充满变数的结果。

**输出格式要求**：
你必须 **始终** 返回符合 JSON 格式的响应。不要返回 Markdown 代码块（如 \`\`\`json），直接返回纯 JSON 字符串。
JSON 结构如下：
{
  "narrative": "剧情描述（中文）",
  "characterUpdate": { ...仅包含变化的属性... },
  "choices": ["建议1", "建议2", "建议3"],
  "gameOver": boolean,
  "eventArtKeyword": "英文关键词，用于生成意境图"
}

**核心原则（必须严格遵守）：**

1.  **数值成长体系（CRITICAL）**：
    *   **修炼**：单次打坐通常增加 10-50 点修为。
    *   **突破机制 (Breakthrough)**：
        *   当 \`cultivation\` >= \`maxCultivation\` 且玩家尝试突破时，判定是否成功。
        *   **如果突破成功**：你必须在 \`characterUpdate\` 中返回以下所有字段：
            *   \`realm\`: 新的境界名称（如 练气 -> 筑基）。
            *   \`cultivation\`: 重置为 0 (或保留溢出值)。
            *   \`maxCultivation\`: **必须增加** (例如 x2)。
            *   \`maxHealth\`: **必须增加**。
            *   \`health\`: 恢复至满值。
        *   **绝对禁止**：突破后 \`maxCultivation\` 保持不变。这会导致游戏逻辑卡死。

2.  **意图判定与反作弊**：
    *   玩家的输入仅仅是**意图**。如果玩家输入“直接成仙”，必须驳回并惩罚（如走火入魔）。
    *   判定成功率取决于境界、属性、装备。

3.  **变数与惩罚**：
    *   连续重复行为（如一直打坐）应触发意外（心魔、仇家）。
    *   战斗需根据境界判定胜负。胜利得战利品，失败扣气血。

**物品与状态管理：**
*   Inventory: 材料、丹药。
*   Equipment: 武器、防具、法宝。
*   Techniques: 功法。
`;

// 辅助函数：标准化 Base URL
const normalizeBaseUrl = (url: string) => {
    let normalized = url.trim();
    if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    // 如果用户只输入了域名（如 https://api.deepseek.com），有些 SDK 需要 /v1，有些不需要。
    // 为了通用，我们假设用户输入的是到版本号之前的路径，或者我们手动拼接 /chat/completions
    // 大多数 OpenAI 兼容接口是 BaseURL + /chat/completions
    // 例如 Google: https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
    // 例如 DeepSeek: https://api.deepseek.com/chat/completions (通常 deepseek 的 base 是 https://api.deepseek.com)
    return normalized;
};

// 核心调用函数
const callAI = async (
    messages: ChatMessage[], 
    settings: AISettings
): Promise<GameResponse> => {
    const { apiKey, baseUrl, model } = settings;
    
    // 构建请求地址
    // 简单的启发式处理：如果 URL 包含 'chat/completions'，直接用；否则拼接
    const endpoint = baseUrl.includes('chat/completions') 
        ? baseUrl 
        : `${normalizeBaseUrl(baseUrl)}/chat/completions`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.8,
                // 尝试启用 JSON 模式，大多数现代模型支持
                response_format: { type: "json_object" },
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API Error (${response.status}): ${errorData}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) throw new Error("Empty response from AI");

        // 解析 JSON (有时模型会包裹 markdown，需清理)
        const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanedContent) as GameResponse;

    } catch (error) {
        console.error("AI Request Failed:", error);
        throw error;
    }
};

export const initializeGame = async (
    locationName: string, 
    locationBonus: string, 
    settings: AISettings, 
    customPrompt?: string
): Promise<GameResponse> => {
    
    let userContent = "";
    if (locationName === "Custom") {
        userContent = `
        初始化游戏。
        玩家选择了一个自定义/随机的出生设定：**${customPrompt}**。
        请根据这个设定，自动生成一个合理的修仙界地点名称、环境描述、以及初始的加成（物品或属性）。
        
        生成开局剧情。
        初始化符合该设定的属性、背包物品和装备。
        `;
    } else {
        userContent = `
        初始化游戏。
        出生地：**${locationName}**。
        出生地加成：${locationBonus}。
        
        请根据地点生成开局剧情。
        初始化属性（根据地点微调）。
        给予符合地点的初始物品。
        `;
    }

    const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: userContent }
    ];

    return callAI(messages, settings);
};

export const sendPlayerAction = async (
    action: string, 
    currentState: CharacterState, 
    history: ChatMessage[], 
    settings: AISettings,
    isHintRequest: boolean = false
): Promise<GameResponse> => {
    
    let promptAction = action;
    if (isHintRequest) {
        promptAction = `[SYSTEM: 玩家请求提示。请根据当前境界（${currentState.realm}）给予指引。如果是前期，教导基本操作；如果是后期，给出剧情线索。]`;
    }

    // 构建状态上下文
    const statusContext = `
    [当前状态]
    境界: ${currentState.realm}
    气血: ${currentState.health}/${currentState.maxHealth}
    修为: ${currentState.cultivation}/${currentState.maxCultivation}
    灵石: ${currentState.spiritStones}
    属性: 根骨${currentState.attributes["根骨"]}, 悟性${currentState.attributes["悟性"]}, 机缘${currentState.attributes["机缘"]}
    
    [装备] 武器:${currentState.equipment.weapon}, 防具:${currentState.equipment.armor}, 法宝:${currentState.equipment.relic}
    [背包] ${currentState.inventory.join(', ')}
    [功法] ${currentState.techniques.join(', ')}

    [玩家输入]: "${promptAction}"
    
    请判定玩家意图。
    **重要检查**：
    1. 如果玩家试图【突破】且 cultivation >= maxCultivation，请允许突破，并必须大幅提升 maxCultivation 和 maxHealth，重置 cultivation。
    2. 如果玩家进行【修炼】，增加 cultivation。
    3. 如果玩家试图越级挑战，请视为失败。
    `;

    // 组合历史记录 (限制最近 10-20 条以节省 Token，视模型上下文窗口而定)
    // 注意：我们需要过滤掉前端生成的 UI 相关的 message 属性，只保留 role 和 content
    const contextMessages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...history.slice(-10).map(h => ({ role: (h.role as string) === 'model' ? 'assistant' : h.role, content: h.content } as ChatMessage)),
        { role: 'user', content: statusContext }
    ];

    return callAI(contextMessages, settings);
};

// 新增：测试连接函数
export const testConnection = async (settings: AISettings): Promise<{ success: boolean; message: string }> => {
    const { apiKey, baseUrl, model } = settings;
    
    if (!apiKey) return { success: false, message: "API Key 不能为空" };

    const endpoint = baseUrl.includes('chat/completions') 
        ? baseUrl 
        : `${normalizeBaseUrl(baseUrl)}/chat/completions`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: 'Say "OK"' }],
                max_tokens: 5
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Error ${response.status}`;
            try {
                // 尝试解析错误 JSON
                const errJson = JSON.parse(errorText);
                if (errJson.error && errJson.error.message) {
                    errorMessage += `: ${errJson.error.message}`;
                } else {
                    errorMessage += `: ${errorText.slice(0, 100)}`;
                }
            } catch {
                errorMessage += `: ${errorText.slice(0, 100)}`;
            }
            return { success: false, message: errorMessage };
        }

        return { success: true, message: "连接成功！接口工作正常。" };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "网络连接失败" };
    }
};
