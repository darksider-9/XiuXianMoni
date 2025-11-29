
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

2.  **剧情连贯性 (Memory & Continuity)**：
    *   你将收到【长期记忆】（之前的剧情摘要）和【短期上下文】。
    *   请主动引用记忆中的伏笔、人名和事件。
    *   如果记忆中提到玩家得罪了某人，后续必须有报复剧情。

3.  **意图判定与反作弊**：
    *   玩家的输入仅仅是**意图**。如果玩家输入“直接成仙”，必须驳回并惩罚（如走火入魔）。
    *   判定成功率取决于境界、属性、装备。

4.  **变数与惩罚**：
    *   连续重复行为（如一直打坐）应触发意外（心魔、仇家）。
    *   战斗需根据境界判定胜负。胜利得战利品，失败扣气血。
`;

// 辅助函数：标准化 Base URL
const normalizeBaseUrl = (url: string) => {
    let normalized = url.trim();
    if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
};

// 核心调用函数
const callAI = async (
    messages: ChatMessage[], 
    settings: AISettings,
    responseFormat: 'json' | 'text' = 'json'
): Promise<any> => {
    const { apiKey, baseUrl, model } = settings;
    
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

        if (responseFormat === 'json') {
            const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
            try {
                return JSON.parse(cleanedContent);
            } catch (e) {
                console.warn("JSON Parse Failed, returning raw text inside narrative", e);
                // Fallback to avoid crash
                return {
                    narrative: content,
                    characterUpdate: {},
                    choices: ["继续"],
                    gameOver: false,
                    eventArtKeyword: "mystery"
                };
            }
        } else {
            return content;
        }

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

// Memory Compression Agent
export const compressStory = async (
    historySegment: ChatMessage[], 
    existingSummary: string, 
    settings: AISettings
): Promise<string> => {
    // 过滤掉系统消息，只保留对话
    const dialogue = historySegment
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `${m.role === 'user' ? '玩家' : '天道'}: ${m.content}`)
        .join('\n');

    const prompt = `
    你是一个修仙故事的记录者（Memory Agent）。
    你的任务是将【之前的长期记忆】和【最近的一段对话】合并，生成一个新的、精炼的【长期记忆】。

    **原则**：
    1. 保留关键信息：重要人物、获得的法宝/功法、境界变化、结下的仇怨或恩情。
    2. 舍弃无关细节：具体的环境描写、无关紧要的对话。
    3. 尽量保持简洁，限制在 500 字以内。
    4. 使用第三人称叙述（例如：“玩家”或“修仙者”）。

    【之前的长期记忆】：
    ${existingSummary || "暂无"}

    【最近的一段对话】：
    ${dialogue}

    请输出新的长期记忆摘要：
    `;

    const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
    ];

    try {
        const result = await callAI(messages, settings, 'text');
        return result;
    } catch (e) {
        console.error("Memory compression failed", e);
        return existingSummary; // Fallback
    }
};

export const sendPlayerAction = async (
    action: string, 
    currentState: CharacterState, 
    history: ChatMessage[], 
    settings: AISettings, 
    isHintRequest: boolean = false,
    storySummary: string = ""
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
    `;

    // 注入长期记忆
    const memoryContext = storySummary ? `
    【长期记忆/前情提要】
    ${storySummary}
    ----------------
    ` : "";

    // 组合历史记录 
    // 发送最近 30 条 + 长期记忆
    const recentHistory = history.slice(-30).map(h => ({ 
        role: (h.role as string) === 'model' ? 'assistant' : h.role, 
        content: h.content 
    } as ChatMessage));

    const finalSystemInstruction = SYSTEM_INSTRUCTION + memoryContext;

    const contextMessages: ChatMessage[] = [
        { role: 'system', content: finalSystemInstruction },
        ...recentHistory,
        { role: 'user', content: statusContext }
    ];

    return callAI(contextMessages, settings);
};

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
