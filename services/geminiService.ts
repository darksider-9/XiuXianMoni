
import { GameResponse, CharacterState, ChatMessage, AISettings } from "../types";

// 通用的 OpenAI 兼容接口调用逻辑
// 适用于: OpenAI, DeepSeek, Google Gemini (OpenAI Compat), Moonshot, Local LLMs (Ollama) 等

const SYSTEM_INSTRUCTION = `
你是一个硬核、开放式修仙文字冒险游戏的【天道】（Game Master）。
你的职责不是简单回应玩家，而是通过文字构建一个活着的世界。

**【核心机制：叙事流与决策点】 (CRITICAL)**
1.  **拒绝琐碎交互**：不要每做一个小动作（如“抬脚”、“走路”）就停下来询问玩家。
2.  **推进时间线**：玩家的一次指令（如“前往深山”、“闭关修炼”）代表了**一段持续的时间**。
    *   你应该描述这段时间内的经历、环境的变化、昼夜的更替。
    *   例如：玩家选择闭关，你应该描述“春去秋来，山中不知岁月...”，直接推进到出关或被打断的那一刻。
3.  **长文本叙事**：每次回复应当是一段完整的小说片段（建议 500-1000 字）。描述要有画面感、意境和修仙氛围（阴冷、威压、灵气波动）。
4.  **只在关键决策点停止**：
    *   只有当玩家面临**真正的命运分歧**时（如：发现秘境入口、遭遇强敌生死一念、炼丹关键时刻需控制火候），才结束叙事并生成 \`choices\`。

**【境界突破与精气神制衡机制】 (GAME RULES)**
修仙乃是逆天而行，讲究“性命双修，精气神合一”。
1.  **灵道突破 (主等级 - Realm)**:
    *   **触发条件**: 当 \`cultivation\` >= \`maxCultivation\` 时，玩家可尝试突破。
    *   **瓶颈判定 (重要)**: 
        *   **精(Body)**: 肉身是灵气的容器。若肉身境界(\`bodyRealm\`)过低或气血上限(\`maxHealth\`)不足，强行突破将导致**经脉寸断** (突破失败，大量扣除气血，修为倒退)。
        *   **神(Soul)**: 神识是驾驭灵气的缰绳。若神魂强度(\`soul\`/\`maxSoul\`)不足，突破时将遭遇**心魔夺舍** (突破失败，扣除道心/神识，陷入负面状态)。
    *   **成功**: 只有精、神皆达标，且机缘足够时，方可突破。突破后 \`realm\` 提升，\`maxCultivation\` 翻倍，\`cultivation\` 归零（或保留溢出部分）。

2.  **肉身/神魂进阶**:
    *   它们通常**不随**修为自动提升。
    *   **肉身**: 需通过《锻体诀》、天材地宝、或在绝境中淬炼方可提升 \`bodyRealm\`。
    *   **神魂**: 需通过顿悟、炼神功法、或吞噬魂魄方可提升 \`maxSoul\`。

**【状态更新详细判定逻辑】 (EXTREMELY IMPORTANT)**
在生成剧情后，你必须像一个严谨的数值策划一样，遍历以下维度并更新 \`characterUpdate\`：

1.  **精 (Body & Health)**:
    *   **气血 (health)**: 战斗受伤、掉落悬崖、中毒扣除；吞服灵药、休息恢复。
    *   **肉身境界 (bodyRealm)**: 只有专门修炼肉身功法或服用锻体天材地宝时才提升。
    *   **根骨 (STRENGTH)**: 决定肉身成长的潜力。
2.  **气 (Qi & Cultivation)**:
    *   **修为 (cultivation)**: 打坐、吞噬妖丹、奇遇增加；施展禁术、受伤严重可能倒退。
    *   **灵道境界 (realm)**: 仅在满足上述“突破机制”时改变。
3.  **神 (Soul & Mind)**:
    *   **神识 (soul)**: **极其重要**。探索探查、施展法术、操控法宝、炼丹炼器**都会消耗神识**。神识耗尽会昏迷。
    *   **道心 (WILLPOWER)**: 遭遇心魔、幻境、重大挫折时检定。成功则提升，失败可能产生负面状态。
    *   **悟性 (WISDOM)**: 决定领悟功法的速度。
4.  **运 & 势 (Luck & Charisma)**:
    *   **机缘 (LUCK)**: 探索时决定掉落好坏。
    *   **魅力 (CHARISMA)**: 决定NPC的态度（交易价格、是否赠送机缘）。
5.  **外物 (Inventory & Wealth)**:
    *   **灵石 (spiritStones)**: 交易、开启阵法消耗。**务必计算准确**。
    *   **背包/功法**: 获得或消耗物品时，**必须返回更新后的【完整列表】**。

**【状态合并规则】**
*   如果某个属性没有变化，**不要**包含在 JSON 中。
*   如果属性变化（如根骨+1），返回 \`attributes: { "根骨": 11 }\`。
*   **注意**: \`health\`, \`soul\`, \`cultivation\` 是高频变动数值，请在每次行动后根据剧情逻辑进行计算。

**【输出格式要求】 (IMPORTANT: JSON FORMATTING RULES)**
1.  **NO MARKDOWN**: 绝对禁止使用 \`\`\`json 或 \`\`\` 包裹。
2.  **NO PREAMBLE**: 绝对禁止在 JSON 前面写“好的，这是剧情...”之类的废话。
3.  **ESCAPE NEWLINES**: JSON 字符串内的换行符必须转义为 \\n。例如 \`"narrative": "第一行\\n第二行"\`。
4.  **JSON ONLY**: 你的回复必须**从头到尾**只是一个合法的 JSON 字符串。

JSON 结构示例：
{
  "narrative": "长段剧情描述... (注意转义换行符)",
  "characterUpdate": { 
     "health": 90, 
     "soul": 45, 
     "cultivation": 1200,
     "attributes": { "根骨": 12, "道心": 15 },
     "inventory": ["物品A", "物品B"]
  },
  "choices": ["选项1", "选项2"],
  "gameOver": false,
  "eventArtKeyword": "keyword"
}

**【反作弊】**
玩家输入仅为“意图”。如果玩家试图直接修改设定（如“我变成仙帝”），必须驳回并给予惩罚。
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
    
    // 1. 去除 Markdown 代码块标记
    content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    // 2. 尝试提取最外层的 JSON 对象 {...}
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        content = content.substring(firstBrace, lastBrace + 1);
    }

    // 3. 尝试直接解析
    try {
        return JSON.parse(content);
    } catch (e) {
        // console.warn("Strict parse failed, attempting repairs...", e);
    }

    // 4. 正则提取保底策略
    console.warn("Attempting regex extraction for malformed JSON");

    const fallbackResponse: GameResponse = {
        narrative: "",
        characterUpdate: {
            attributes: {} as any
        },
        choices: [],
        gameOver: false,
        eventArtKeyword: "mystery"
    };

    // 提取 narrative (支持跨行)
    const narrativeMatch = content.match(/"narrative"\s*:\s*"([^]*?)(?<!\\)"/);
    if (narrativeMatch && narrativeMatch[1]) {
        fallbackResponse.narrative = narrativeMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\'); 
    } else {
        fallbackResponse.narrative = rawContent.replace(/"\w+"\s*:/g, '').slice(0, 1000) + "...";
    }

    // 提取 choices
    const choicesMatch = content.match(/"choices"\s*:\s*\[([^\]]*)\]/);
    if (choicesMatch && choicesMatch[1]) {
        try {
            const choicesArr = JSON.parse(`[${choicesMatch[1]}]`);
            fallbackResponse.choices = choicesArr;
        } catch {
            fallbackResponse.choices = choicesMatch[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(s => s);
        }
    } else {
        fallbackResponse.choices = ["继续"];
    }

    // 提取 gameOver
    if (content.includes('"gameOver": true') || content.includes('"gameOver":true')) {
        fallbackResponse.gameOver = true;
    }

    // 提取主要状态
    const extractInt = (key: string) => {
        const match = content.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
        if (match) return parseInt(match[1]);
        return undefined;
    };

    const cu = fallbackResponse.characterUpdate;
    cu.health = extractInt("health");
    cu.maxHealth = extractInt("maxHealth");
    cu.soul = extractInt("soul");
    cu.maxSoul = extractInt("maxSoul");
    cu.cultivation = extractInt("cultivation");
    cu.maxCultivation = extractInt("maxCultivation");
    cu.spiritStones = extractInt("spiritStones");

    // 提取属性 (Attributes)
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
             throw new Error("网络请求失败 (Failed to fetch)。可能是跨域(CORS)限制、网络中断或 API 地址无效。如果使用的是 OpenAI 官方接口，请检查是否需要代理。");
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
        userContent = `
        初始化游戏。
        玩家选择了一个自定义/随机的出生设定：**${customPrompt}**。
        请根据这个设定，自动生成一个合理的修仙界地点名称、环境描述、以及初始的加成（物品或属性）。
        请生成一段引人入胜的开局剧情（500字左右），交代身世背景和周围环境危机，并在最后引出第一个关键决策点。
        `;
    } else {
        userContent = `
        初始化游戏。
        出生地：**${locationName}**。
        出生地加成：${locationBonus}。
        
        请生成一段引人入胜的开局剧情（500字左右），交代身世背景和周围环境危机，并在最后引出第一个关键决策点。
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

    // 构建全量状态上下文
    const statusContext = `
    [当前完整状态 (请检查是否有变动)]
    灵道境界: ${currentState.realm}
    肉身境界: ${currentState.bodyRealm}
    气血(Health): ${currentState.health}/${currentState.maxHealth}
    灵力(Cultivation): ${currentState.cultivation}/${currentState.maxCultivation}
    神识(Soul): ${currentState.soul}/${currentState.maxSoul}
    灵石: ${currentState.spiritStones}
    
    [核心属性]
    根骨:${currentState.attributes["根骨"]}, 悟性:${currentState.attributes["悟性"]}
    机缘:${currentState.attributes["机缘"]}, 身法:${currentState.attributes["身法"]}
    魅力:${currentState.attributes["魅力"]}, 道心:${currentState.attributes["道心"]}
    
    [装备] 武器:${currentState.equipment.weapon}, 防具:${currentState.equipment.armor}, 法宝:${currentState.equipment.relic}
    [背包] ${currentState.inventory.join(', ')}
    [功法] ${currentState.techniques.join(', ')}

    [玩家指令]: "${promptAction}"
    (任务：1. 描述剧情发展(叙事流); 2. 检查上述属性是否因剧情而变化; 3. 生成 JSON)
    `;

    // 注入长期记忆
    const memoryContext = storySummary ? `
    【长期记忆/前情提要】
    ${storySummary}
    ----------------
    ` : "";

    // 组合历史记录
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
        let msg = error instanceof Error ? error.message : "网络连接失败";
        if (error instanceof TypeError && error.message.includes('fetch')) {
             msg = "连接失败 (Failed to fetch)。请检查跨域配置(CORS)或代理。";
        }
        return { success: false, message: msg };
    }
};
