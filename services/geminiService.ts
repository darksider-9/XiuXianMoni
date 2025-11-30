
import { GameResponse, CharacterState, ChatMessage, AISettings } from "../types";

// 通用的 OpenAI 兼容接口调用逻辑
const SYSTEM_INSTRUCTION = `
你是一个硬核、开放式修仙文字冒险游戏的【天道】（Game Master）。

**【核心机制：叙事流与决策点】**
1.  **拒绝琐碎交互**：玩家一次指令代表一段持续时间的行动。描述时间流逝和环境变化。
2.  **长文本叙事**：每次回复建议 500-1000 字，营造沉浸感。
3.  **关键停顿**：只在真正的命运分歧点（如发现秘境、生死关头）才生成选项。

**【性命双修与数值体系】 (GAME RULES)**
必须严格区分【战斗资源】与【境界进度】：

1.  **资源 (Resources - 消耗品)**:
    *   **精 (HP/Health)**: 生命值。受伤扣除，归零死亡。
    *   **气 (MP/Mana)**: 施法蓝条。释放法术、催动法宝消耗。打坐可恢复。
    *   **神 (SP/Soul)**: 神识精力。探查、炼丹、炼器消耗。耗尽昏迷。
    *   **灵石 (Spirit Stones)**: 通用货币。**必须**存储在 \`spiritStones\` 数值字段中。**严禁**将灵石放入 \`inventory\` 数组（例如禁止 \`['灵石*100']\`）。
    
2.  **进度 (Progress - 经验条)**:
    *   **灵道 (Cultivation)**: \`cultivation\` / \`maxCultivation\`。满值可尝试突破灵道境界 (\`realm\`)。
    *   **肉身 (Body)**: \`bodyPractice\` / \`maxBodyPractice\`。满值可尝试突破肉身境界 (\`bodyRealm\`)。

3.  **突破与制衡**:
    *   灵道突破受限于**神**（控制力）和**肉身**（容器）。
    *   肉身突破受限于**资源**（气血/灵石）和**根骨**。
    *   **联动**: 灵道突破成功，应给予少量肉身经验；肉身突破成功，应大幅增加气血上限(\`maxHealth\`)。

**【物品与鉴定系统】 (NEW)**
当玩家获得新物品（法宝、功法、奇物）时，如果它是**非凡品**，你必须在 \`characterUpdate.itemKnowledge\` 中生成其元数据：
*   **rank**: 品阶 (e.g. "黄阶上品", "玄阶中品")
*   **effects**: 具体数值效果 (e.g. "灵力回复速度+10%", "造成火属性伤害")
*   **requirements**: 使用限制 (e.g. "需筑基期", "需火灵根")
*   **description**: 物品的背景故事或外观描述。

**【状态更新检查清单】**
每次回复必须遍历并计算：
1.  **资源变动**: 战斗是否扣了气血(\`health\`)？施法是否扣了灵力(\`mana\`)？探索是否扣了神识(\`soul\`)？
2.  **进度积累**: 修炼/战斗是否增加了修为(\`cultivation\`)或肉身经验(\`bodyPractice\`)？
3.  **属性判定**: 根骨/悟性/机缘/魅力/道心 是否因事件变化？
4.  **外物**: **灵石必须归入数值栏**。背包、装备、功法变动。

**【输出格式要求】 (JSON ONLY)**
*   NO Markdown. NO Preamble.
*   转义换行符 (\\n)。
*   **attributes**: 仅允许更新以下字段: 根骨, 悟性, 身法, 机缘, 魅力, 道心. 不要创造新的属性名。

JSON 结构示例：
{
  "narrative": "剧情...",
  "characterUpdate": { 
     "health": 90, "mana": 40, "soul": 45,
     "cultivation": 1200, "bodyPractice": 300,
     "spiritStones": 250, 
     "attributes": { "根骨": 12, "道心": 15 },
     "equipment": { "weapon": "青云剑", "armor": "玄铁甲", "relic": "摄魂铃" },
     "techniques": ["引气诀", "烈火掌"],
     "inventory": ["凝气丹", "妖兽皮"], // 注意：这里不要放灵石
     "itemKnowledge": {
        "青干剑": { 
            "name": "青干剑", "type": "weapon", "rank": "黄阶上品", 
            "effects": ["锋利度+10", "御剑消耗减少"], "requirements": ["练气三层"], 
            "description": "采五金之精打造..." 
        }
     }
  },
  "choices": ["选项..."],
  "gameOver": false,
  "eventArtKeyword": "keyword"
}
`;

// 辅助函数：标准化 Base URL
const normalizeBaseUrl = (url: string) => {
    let normalized = url.trim();
    if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
};

// 脏数据清洗与解析函数
const cleanAndParseJSON = (rawContent: string): GameResponse => {
    let content = rawContent.trim();
    
    content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        content = content.substring(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(content);
    } catch (e) {
        // Fallback handled below
    }

    console.warn("Attempting regex extraction for malformed JSON");

    const fallbackResponse: GameResponse = {
        narrative: "",
        characterUpdate: { attributes: {} as any },
        choices: [],
        gameOver: false,
        eventArtKeyword: "mystery"
    };

    // 提取 narrative
    const narrativeMatch = content.match(/"narrative"\s*:\s*"([^]*?)(?<!\\)"/);
    if (narrativeMatch && narrativeMatch[1]) {
        fallbackResponse.narrative = narrativeMatch[1]
            .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); 
    } else {
        fallbackResponse.narrative = rawContent.replace(/"\w+"\s*:/g, '').slice(0, 1000) + "...";
    }

    // 提取 choices
    const choicesMatch = content.match(/"choices"\s*:\s*\[([^\]]*)\]/);
    if (choicesMatch && choicesMatch[1]) {
        try {
            fallbackResponse.choices = JSON.parse(`[${choicesMatch[1]}]`);
        } catch {
            fallbackResponse.choices = choicesMatch[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(s => s);
        }
    } else {
        fallbackResponse.choices = ["继续"];
    }

    // 提取 Game Over
    if (content.includes('"gameOver": true') || content.includes('"gameOver":true')) {
        fallbackResponse.gameOver = true;
    }

    // 提取数值
    const extractInt = (key: string) => {
        const match = content.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
        if (match) return parseInt(match[1]);
        return undefined;
    };

    const cu = fallbackResponse.characterUpdate;
    cu.health = extractInt("health");
    cu.maxHealth = extractInt("maxHealth");
    cu.mana = extractInt("mana");
    cu.maxMana = extractInt("maxMana");
    cu.soul = extractInt("soul");
    cu.maxSoul = extractInt("maxSoul");
    
    cu.cultivation = extractInt("cultivation");
    cu.maxCultivation = extractInt("maxCultivation");
    cu.bodyPractice = extractInt("bodyPractice");
    cu.maxBodyPractice = extractInt("maxBodyPractice");
    
    cu.spiritStones = extractInt("spiritStones");

    // 提取属性
    const attrKeys = ["根骨", "悟性", "身法", "机缘", "魅力", "道心"];
    attrKeys.forEach(key => {
        const match = content.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
        if (match && cu.attributes) {
            (cu.attributes as any)[key] = parseInt(match[1]);
        }
    });

    if (!fallbackResponse.narrative && firstBrace === -1) {
        fallbackResponse.narrative = rawContent;
    }

    return fallbackResponse;
};

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
                max_tokens: 4000
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
            return cleanAndParseJSON(content);
        } else {
            return content;
        }

    } catch (error) {
        console.error("AI Request Failed:", error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
             throw new Error("网络请求失败 (Failed to fetch)。可能是跨域(CORS)限制或 API 地址无效。");
        }
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
        userContent = `初始化游戏。自定义出生设定：${customPrompt}。请生成开局剧情并初始化属性。注意：灵石加成必须写入 spiritStones 字段，不可放入 inventory。`;
    } else {
        userContent = `初始化游戏。出生地：${locationName}。加成：${locationBonus}。请生成开局剧情并初始化属性。注意：灵石加成必须写入 spiritStones 字段，不可放入 inventory。`;
    }

    const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: userContent }
    ];

    return callAI(messages, settings);
};

export const compressStory = async (
    historySegment: ChatMessage[], 
    existingSummary: string, 
    settings: AISettings
): Promise<string> => {
    const dialogue = historySegment
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `${m.role === 'user' ? '玩家' : '天道'}: ${m.content}`)
        .join('\n');

    const prompt = `
    任务：记忆压缩。
    将【旧记忆】和【新对话】合并为简短的修仙传记摘要。
    
    旧记忆：${existingSummary || "无"}
    新对话：${dialogue}
    
    输出：一段不超过500字的第三人称摘要，保留关键剧情、获得物品和人际关系。
    `;

    const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
    ];

    try {
        const result = await callAI(messages, settings, 'text');
        return result;
    } catch (e) {
        return existingSummary; 
    }
};

export const sendPlayerAction = async (
    action: string, 
    currentState: CharacterState, 
    history: ChatMessage[], 
    settings: AISettings, 
    isHintRequest: boolean = false,
    storySummary: string = "",
    isIdentifyRequest: boolean = false
): Promise<GameResponse> => {
    
    let promptAction = action;
    if (isHintRequest) {
        promptAction = `[SYSTEM: 玩家请求“天机”指引。请分析当前局势，根据主角的境界、状态和性格，推演未来，并给出 1-3 个最优的行动建议。请以“直觉”或“内心独白”的口吻回复，不要直接推进剧情。]`;
    } else if (isIdentifyRequest) {
        promptAction = `[SYSTEM: 请求鉴定物品 "${action}"。请消耗少量神识，并返回该物品的 itemKnowledge 详情（rank, effects, description, requirements）。]`;
    }

    const statusContext = `
    [当前状态]
    灵道: ${currentState.realm} (进度 ${currentState.cultivation}/${currentState.maxCultivation})
    肉身: ${currentState.bodyRealm} (进度 ${currentState.bodyPractice}/${currentState.maxBodyPractice})
    
    [资源]
    精(HP): ${currentState.health}/${currentState.maxHealth}
    气(MP): ${currentState.mana}/${currentState.maxMana}
    神(SP): ${currentState.soul}/${currentState.maxSoul}
    灵石: ${currentState.spiritStones}
    
    [属性]
    根骨:${currentState.attributes["根骨"]}, 悟性:${currentState.attributes["悟性"]}
    机缘:${currentState.attributes["机缘"]}, 身法:${currentState.attributes["身法"]}
    魅力:${currentState.attributes["魅力"]}, 道心:${currentState.attributes["道心"]}
    
    [装备] 兵:${currentState.equipment.weapon}, 甲:${currentState.equipment.armor}, 宝:${currentState.equipment.relic}
    [背包] ${currentState.inventory.join(', ')}
    [功法] ${currentState.techniques.join(', ')}

    [玩家指令]: "${promptAction}"
    `;

    const memoryContext = storySummary ? `【前情提要】\n${storySummary}\n----------------` : "";

    const recentHistory = history.slice(-30).map(h => ({ 
        role: (h.role as string) === 'model' ? 'assistant' : h.role, 
        content: h.content 
    } as ChatMessage));

    const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_INSTRUCTION + memoryContext },
        ...recentHistory,
        { role: 'user', content: statusContext }
    ];

    return callAI(messages, settings);
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

        if (!response.ok) throw new Error(response.statusText);
        return { success: true, message: "连接成功" };
    } catch (error) {
        return { success: false, message: "连接失败" };
    }
};
