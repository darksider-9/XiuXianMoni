
import React, { useState, useEffect, useRef } from 'react';
import { initializeGame, sendPlayerAction, compressStory } from './services/geminiService';
import { saveGame, loadGame, loadSettings, saveSettings, clearSave } from './services/storageService';
import { CharacterState, GameResponse, ChatMessage, CharacterAttribute, StartLocation, SaveData, AISettings, ItemDetails } from './types';
import StatBar from './components/StatBar';
import GameVisuals from './components/GameVisuals';
import TutorialOverlay from './components/TutorialOverlay';
import SettingsModal from './components/SettingsModal';
import ItemDetailModal from './components/ItemDetailModal';

// Initial Character State
const INITIAL_STATE: CharacterState = {
  name: "修仙者",
  
  // Progress
  realm: "凡人",
  cultivation: 0,
  maxCultivation: 100,
  bodyRealm: "凡胎",
  bodyPractice: 0,
  maxBodyPractice: 100,

  // Resources
  health: 100,
  maxHealth: 100,
  mana: 50,
  maxMana: 50,
  soul: 20,
  maxSoul: 20,
  
  spiritStones: 0,
  attributes: {
    [CharacterAttribute.STRENGTH]: 10,
    [CharacterAttribute.WISDOM]: 10,
    [CharacterAttribute.AGILITY]: 10,
    [CharacterAttribute.LUCK]: 10,
    [CharacterAttribute.CHARISMA]: 5,
    [CharacterAttribute.WILLPOWER]: 10,
  },
  inventory: [],
  itemKnowledge: {},
  equipment: {
    weapon: "无",
    armor: "布衣",
    relic: "无",
  },
  techniques: [],
  statusEffects: [],
};

const START_LOCATIONS: StartLocation[] = [
  {
    id: "sect",
    name: "青云宗 · 外门",
    type: 'balanced',
    description: "正道第一大宗。虽规矩森严，但胜在安稳。适合按部就班修行的正统修士。",
    bonus: "获《引气诀》、制式铁剑、身份腰牌。每月可领低保灵石。"
  },
  {
    id: "valley",
    name: "神农百草谷",
    type: 'alchemy',
    description: "隐世医仙的隐居地，遍地灵草，土质肥沃。适合种田、炼丹流派。",
    bonus: "获《神农本草经》残卷、破旧丹炉、灵谷种子*5、不知名灵药种子*1。"
  },
  {
    id: "tomb",
    name: "上古剑冢",
    type: 'combat',
    description: "杀伐之气极重，遍地残剑。由于煞气入体，修炼极快但容易走火入魔。适合炼器、剑修。",
    bonus: "根骨+5，获【断裂的玄铁剑】（可重铸）、洗剑池水。初始气血略低。"
  },
  {
    id: "city",
    name: "大晋皇都 · 坊市",
    type: 'social',
    description: "红尘滚滚，鱼龙混杂。只要有钱，什么都能买到。适合经商、符箓、阵法流派。",
    bonus: "灵石+200，悟性+5，获基础《符箓大全》、制符笔。"
  },
  {
    id: "custom",
    name: "随机 / 自定义",
    type: 'custom',
    description: "天机难测，转世之地全凭道友一念之间。可随机生成，亦可自行构想。",
    bonus: "完全随机，充满未知与无限可能。"
  }
];

const COMPRESSION_THRESHOLD = 20;

// Whitelist for attributes to prevent AI hallucinations
const ALLOWED_ATTRIBUTES = Object.values(CharacterAttribute);

const App: React.FC = () => {
  const [character, setCharacter] = useState<CharacterState>(INITIAL_STATE);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  
  // Memory
  const [summary, setSummary] = useState<string>("");
  const [summarizedCount, setSummarizedCount] = useState<number>(0);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  // Settings
  const [aiSettings, setAiSettings] = useState<AISettings>({
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      model: 'gemini-2.0-flash'
  });

  const [gamePhase, setGamePhase] = useState<'welcome' | 'selection' | 'playing'>('welcome');
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // Custom Origin
  const [showCustomOriginInput, setShowCustomOriginInput] = useState<boolean>(false);
  const [customOriginText, setCustomOriginText] = useState<string>('');

  // Item Modal
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const [currentVisual, setCurrentVisual] = useState<string>("Chinese misty mountains");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedSettings = loadSettings();
    if (storedSettings) {
        setAiSettings(storedSettings);
    } else if (process.env.API_KEY) {
        setAiSettings(prev => ({ ...prev, apiKey: process.env.API_KEY || '' }));
    }
  }, []);

  useEffect(() => {
    if (gamePhase === 'playing' && !loading && !gameOver) {
        saveGame(character, history, aiSettings, summary, summarizedCount);
    }
  }, [character, history, gamePhase, loading, gameOver, aiSettings, summary, summarizedCount]);

  useEffect(() => {
    const runCompression = async () => {
        if (history.length - summarizedCount >= COMPRESSION_THRESHOLD && !isCompressing && !loading && !gameOver && aiSettings.apiKey) {
            setIsCompressing(true);
            try {
                const safetyBuffer = 5;
                const endIndex = history.length - safetyBuffer;
                if (endIndex > summarizedCount) {
                    const segmentToCompress = history.slice(summarizedCount, endIndex);
                    const newSummary = await compressStory(segmentToCompress, summary, aiSettings);
                    setSummary(newSummary);
                    setSummarizedCount(endIndex);
                }
            } catch (err) {
                console.error("Memory compression failed:", err);
            } finally {
                setIsCompressing(false);
            }
        }
    };
    runCompression();
  }, [history, summarizedCount, isCompressing, loading, gameOver, aiSettings, summary]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  const handleUpdateSettings = (newSettings: AISettings) => {
    setAiSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleImportSuccess = (data: SaveData) => {
    setCharacter({ ...INITIAL_STATE, ...data.character });
    setHistory(data.history);
    setSummary(data.summary || "");
    setSummarizedCount(data.summarizedCount || 0);
    if (data.settings) {
        setAiSettings(data.settings);
        saveSettings(data.settings);
    }
    setGamePhase('playing');
  };

  const handleContinueGame = () => {
    const savedData = loadGame();
    if (savedData) {
        setCharacter({ 
            ...INITIAL_STATE, 
            ...savedData.character,
            attributes: { ...INITIAL_STATE.attributes, ...savedData.character.attributes },
            itemKnowledge: { ...INITIAL_STATE.itemKnowledge, ...(savedData.character.itemKnowledge || {}) }
        });
        setHistory(savedData.history);
        setSummary(savedData.summary || "");
        setSummarizedCount(savedData.summarizedCount || 0);
        if (savedData.settings) setAiSettings(savedData.settings);
        setGamePhase('playing');
    }
  };

  const handleQuitGame = () => {
      if (confirm("确定要返回主界面吗？当前进度已自动保存。")) {
          setGamePhase('welcome');
      }
  };

  const handleStartGame = async (location: StartLocation) => {
    if (location.type === 'custom') {
        setShowCustomOriginInput(true);
        return;
    }
    await startGameLogic(location.name, location.bonus);
  };

  const handleCustomStart = async () => {
      const prompt = customOriginText.trim() || "随机生成一个充满奇遇的神秘出生地";
      setShowCustomOriginInput(false);
      await startGameLogic("Custom", "", prompt);
  };

  const startGameLogic = async (locName: string, locBonus: string, customPrompt?: string) => {
    if (!aiSettings.apiKey) {
        setIsSettingsOpen(true);
        alert("请先设置 API Key");
        return;
    }
    setLoading(true);
    setGamePhase('playing');
    setHistory([{ role: 'system', content: `正在降临... 开启你的修仙命途...` }]);
    setSummary("");
    setSummarizedCount(0);
    setShowTutorial(true); 
    setCharacter(INITIAL_STATE); 

    try {
      const response = await initializeGame(locName, locBonus, aiSettings, customPrompt);
      processResponse(response);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "未知错误";
      setHistory(prev => [...prev, { role: 'system', content: `天道连接中断: ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, isHint: boolean = false) => {
    if (loading || gameOver || !aiSettings.apiKey) return;
    
    if (isHint) setHistory(prev => [...prev, { role: 'system', content: '正在窥探天机...' }]);
    else setHistory(prev => [...prev, { role: 'user', content: action }]);
    
    setInput('');
    setChoices([]); 
    setLoading(true);

    try {
      const response = await sendPlayerAction(action, character, history, aiSettings, isHint, summary);
      processResponse(response);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "未知错误";
      setHistory(prev => [...prev, { role: 'system', content: `天机混乱: ${errMsg}` }]);
      setLoading(false);
    }
  };

  const handleIdentifyItem = async (itemName: string) => {
      if (loading) return;
      setLoading(true);
      setHistory(prev => [...prev, { role: 'system', content: `正在消耗神识鉴定【${itemName}】...` }]);
      try {
          const response = await sendPlayerAction(itemName, character, history, aiSettings, false, summary, true);
          processResponse(response);
      } catch (error) {
          console.error(error);
          setLoading(false);
      }
  };

  const sanitizeStringArray = (arr: any[] | undefined): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) return item.name || JSON.stringify(item);
          return String(item);
      });
  };

  const processResponse = (response: GameResponse) => {
    if (response.eventArtKeyword) setCurrentVisual(response.eventArtKeyword);
    setHistory(prev => [...prev, { role: 'assistant', content: response.narrative, isNarrative: true }]);

    if (response.characterUpdate) {
      setCharacter(prev => {
        const update = response.characterUpdate;
        
        // Deep merge objects
        const updatedEquipment = update.equipment ? { ...prev.equipment, ...update.equipment } : prev.equipment;
        const updatedKnowledge = update.itemKnowledge ? { ...prev.itemKnowledge, ...update.itemKnowledge } : prev.itemKnowledge;
        
        // Clean & Filter Attributes
        const currentAttributes = { ...prev.attributes };
        if (update.attributes) {
            Object.entries(update.attributes).forEach(([key, val]) => {
                // Strict whitelist check using Chinese enum values
                if (ALLOWED_ATTRIBUTES.includes(key as CharacterAttribute)) {
                    currentAttributes[key as CharacterAttribute] = val as number;
                }
            });
        }
        
        const sanitizedUpdate = { ...update };
        if (sanitizedUpdate.inventory) sanitizedUpdate.inventory = sanitizeStringArray(sanitizedUpdate.inventory);
        if (sanitizedUpdate.techniques) sanitizedUpdate.techniques = sanitizeStringArray(sanitizedUpdate.techniques);
        if (sanitizedUpdate.statusEffects) sanitizedUpdate.statusEffects = sanitizeStringArray(sanitizedUpdate.statusEffects);

        const nextState = {
          ...prev,
          ...sanitizedUpdate,
          equipment: updatedEquipment,
          attributes: currentAttributes,
          itemKnowledge: updatedKnowledge,
        };

        // Self-healing / Bound Checks
        if (nextState.maxHealth < nextState.health) nextState.maxHealth = nextState.health;
        if (nextState.maxMana < nextState.mana) nextState.maxMana = nextState.mana;
        if (nextState.maxSoul < nextState.soul) nextState.maxSoul = nextState.soul;
        if (nextState.maxCultivation < nextState.cultivation) nextState.maxCultivation = nextState.cultivation;
        if (nextState.maxBodyPractice < nextState.bodyPractice) nextState.maxBodyPractice = nextState.bodyPractice;
        
        return nextState;
      });
    }

    const validChoices = Array.isArray(response.choices) ? sanitizeStringArray(response.choices) : [];
    setChoices(validChoices);

    if (response.gameOver) {
        setGameOver(true);
        clearSave(); 
    }
    setLoading(false);
  };

  // --- RENDER ---
  if (gamePhase === 'welcome' || gamePhase === 'selection') {
      return (
        <div className="min-h-screen bg-ink-black flex flex-col items-center justify-center text-stone-300 relative overflow-hidden font-serif">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
            
            <button onClick={() => setIsSettingsOpen(true)} className="absolute top-4 right-4 p-2 text-stone-500 hover:text-jade z-50">
                {aiSettings.apiKey ? "已配置" : "设置API"}
            </button>
            
            <SettingsModal 
                isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} 
                settings={aiSettings} onSaveSettings={handleUpdateSettings}
                character={character} history={history} onImportSuccess={handleImportSuccess}
                summary={summary} summarizedCount={summarizedCount}
            />

            {gamePhase === 'welcome' && (
                <div className="z-10 text-center max-w-lg px-4 animate-fade-in">
                    <h1 className="text-6xl font-bold mb-4 text-jade-light">问道长生</h1>
                    <div className="flex flex-col gap-4 mt-8">
                        <button onClick={() => setGamePhase('selection')} className="px-10 py-4 bg-stone-900 border border-jade text-jade-light hover:bg-jade hover:text-white transition-all text-lg font-bold tracking-widest">
                            {loadGame() ? "重入轮回" : "踏入仙途"}
                        </button>
                        {loadGame() && (
                            <button onClick={handleContinueGame} className="px-10 py-3 border border-stone-600 hover:text-stone-200">再续前缘</button>
                        )}
                    </div>
                </div>
            )}

            {gamePhase === 'selection' && (
                <div className="flex flex-col items-center w-full max-w-6xl p-4 z-10">
                     {showCustomOriginInput && (
                         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
                             <div className="w-full max-w-lg bg-stone-900 border border-jade p-6 rounded">
                                 <textarea className="w-full h-32 bg-black border border-stone-700 p-3 mb-4 text-stone-200" value={customOriginText} onChange={e => setCustomOriginText(e.target.value)} placeholder="描述你的出身..." />
                                 <div className="flex justify-end gap-3">
                                     <button onClick={() => setShowCustomOriginInput(false)} className="text-stone-500">取消</button>
                                     <button onClick={handleCustomStart} className="text-jade">开始</button>
                                 </div>
                             </div>
                         </div>
                     )}
                     <div className="flex w-full justify-between mb-6">
                        <button onClick={() => setGamePhase('welcome')}>返回</button>
                        <h2 className="text-2xl text-jade">选择出身</h2>
                        <div className="w-10"></div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full overflow-y-auto max-h-[80vh]">
                        {START_LOCATIONS.map(loc => (
                            <button key={loc.id} onClick={() => handleStartGame(loc)} className="text-left p-6 border border-stone-800 bg-stone-900/50 hover:border-jade hover:bg-stone-800 transition-all rounded">
                                <h3 className="text-lg font-bold text-jade-light mb-2">{loc.name}</h3>
                                <p className="text-sm text-stone-400 mb-2">{loc.description}</p>
                                <div className="text-xs text-jade/70">加成: {loc.bonus}</div>
                            </button>
                        ))}
                     </div>
                </div>
            )}
        </div>
      );
  }

  // --- PLAYING UI ---
  return (
    <div className="min-h-screen bg-[#0c0c0c] text-stone-300 font-sans flex flex-col md:flex-row overflow-hidden">
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
      
      <SettingsModal 
        isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} 
        settings={aiSettings} onSaveSettings={handleUpdateSettings}
        character={character} history={history} onImportSuccess={handleImportSuccess}
        summary={summary} summarizedCount={summarizedCount}
      />

      <ItemDetailModal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        itemName={selectedItem || ""}
        details={selectedItem ? character.itemKnowledge[selectedItem] : undefined}
        onIdentify={handleIdentifyItem}
        isIdentifying={loading}
      />

      {/* Sidebar */}
      <aside className="w-full md:w-80 flex-shrink-0 bg-[#111111] border-b md:border-r border-stone-800 p-6 overflow-y-auto z-20 shadow-xl custom-scrollbar h-[35vh] md:h-screen flex flex-col gap-6">
        
        {/* Identity */}
        <div className="text-center pb-4 border-b border-stone-800/50">
          <h2 className="text-xl font-serif text-stone-100 tracking-wide mb-1">{character.name}</h2>
          <div className="text-xs text-stone-500">道号：无名</div>
        </div>

        {/* Resources (Battle) */}
        <div>
            <h3 className="text-[10px] uppercase text-stone-500 tracking-widest mb-3 font-bold flex items-center gap-2">
                <span>✦</span> 状态 (Resources)
            </h3>
            <StatBar label="精 (HP)" value={character.health} max={character.maxHealth} colorClass="bg-red-700" icon={<span className="text-red-500">♥</span>} />
            <StatBar label="气 (MP)" value={character.mana} max={character.maxMana} colorClass="bg-blue-600" icon={<span className="text-blue-500">💧</span>} />
            <StatBar label="神 (SP)" value={character.soul} max={character.maxSoul} colorClass="bg-purple-600" icon={<span className="text-purple-500">◎</span>} />
        </div>

        {/* Progress (Realm) */}
        <div>
            <h3 className="text-[10px] uppercase text-stone-500 tracking-widest mb-3 font-bold flex items-center gap-2">
                <span>☯</span> 境界 (Cultivation)
            </h3>
            <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-jade-light">{character.realm}</span>
                    <span className="text-stone-500">{character.cultivation}/{character.maxCultivation}</span>
                </div>
                <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-jade" style={{width: `${Math.min((character.cultivation/character.maxCultivation)*100, 100)}%`}}></div>
                </div>
            </div>
            <div>
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-amber-500">{character.bodyRealm}</span>
                    <span className="text-stone-500">{character.bodyPractice}/{character.maxBodyPractice}</span>
                </div>
                <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-600" style={{width: `${Math.min((character.bodyPractice/character.maxBodyPractice)*100, 100)}%`}}></div>
                </div>
            </div>
        </div>

        {/* Attributes Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-stone-900/50 p-2 rounded border border-stone-800/50">
             {Object.entries(character.attributes).map(([key, val]) => (
                <div key={key} className="flex justify-between text-stone-400 px-1">
                   <span>{key}</span><span className="text-stone-200">{val}</span>
                </div>
             ))}
             <div className="flex justify-between text-stone-400 px-1 col-span-2 border-t border-stone-800 mt-1 pt-1">
                 <span>灵石</span><span className="text-gold-dim">{character.spiritStones}</span>
             </div>
        </div>

        {/* Equipment Panel (New) */}
        <div className="border-t border-stone-800/50 pt-4">
             <h3 className="text-[10px] uppercase text-stone-500 tracking-widest mb-2 font-bold">装备 (Equipment)</h3>
             <div className="space-y-2 text-xs">
                 <div className="flex justify-between items-center bg-stone-900/50 p-2 rounded border border-stone-800">
                     <span className="text-stone-500">兵</span>
                     <span className="text-stone-300 font-serif">{character.equipment.weapon}</span>
                 </div>
                 <div className="flex justify-between items-center bg-stone-900/50 p-2 rounded border border-stone-800">
                     <span className="text-stone-500">甲</span>
                     <span className="text-stone-300 font-serif">{character.equipment.armor}</span>
                 </div>
                 <div className="flex justify-between items-center bg-stone-900/50 p-2 rounded border border-stone-800">
                     <span className="text-stone-500">宝</span>
                     <span className="text-stone-300 font-serif">{character.equipment.relic}</span>
                 </div>
             </div>
        </div>

        {/* Techniques Panel (New) */}
        <div className="border-t border-stone-800/50 pt-4">
             <h3 className="text-[10px] uppercase text-stone-500 tracking-widest mb-2 font-bold">功法 (Techniques)</h3>
             <div className="flex flex-wrap gap-1">
                 {character.techniques.length === 0 ? <span className="text-xs text-stone-600 italic px-1">暂无感悟</span> : character.techniques.map((t, i) => (
                     <span key={i} className="px-2 py-1 bg-stone-900 border border-stone-800 text-stone-300 text-[10px] rounded hover:border-jade cursor-default">{t}</span>
                 ))}
             </div>
        </div>

        {/* Inventory */}
        <div className="flex-1 min-h-[100px] flex flex-col border-t border-stone-800/50 pt-4">
            <h3 className="text-[10px] uppercase text-stone-500 tracking-widest mb-2 font-bold">储物袋 (Inventory)</h3>
            <div className="flex flex-wrap gap-2 overflow-y-auto custom-scrollbar content-start">
                {character.inventory.length === 0 ? <span className="text-xs text-stone-600 italic px-1">空</span> : character.inventory.map((item, idx) => (
                    <button 
                        key={idx} 
                        onClick={() => setSelectedItem(item)}
                        className="px-2 py-1 bg-stone-800 border border-stone-700 hover:border-jade text-[10px] text-stone-300 rounded transition-colors"
                    >
                        {item}
                    </button>
                ))}
            </div>
        </div>

        {/* Quit Button (Moved to bottom) */}
        <div className="mt-auto border-t border-stone-800 pt-4">
             <button onClick={handleQuitGame} className="w-full flex items-center justify-center gap-2 py-2 border border-stone-700 hover:border-red-900 hover:bg-red-900/10 text-stone-500 hover:text-red-500 rounded transition-colors text-xs">
                <span>🚪</span> 退出当前游戏
             </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col h-[65vh] md:h-screen relative">
        <div className="absolute top-4 right-4 z-40 flex gap-2">
             <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-black/50 backdrop-blur rounded-full text-stone-500 hover:text-jade border border-stone-700" title="设置">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
             <div className="max-w-3xl mx-auto"><GameVisuals keyword={currentVisual} /></div>
             {history.map((msg, idx) => (
                <div key={idx} className={`max-w-3xl mx-auto animate-fade-in ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
                  <div className={`p-4 md:p-6 rounded shadow-lg ${msg.role === 'user' ? 'bg-stone-800 text-stone-200 border border-stone-700' : msg.role === 'system' ? 'bg-jade/10 text-jade-light text-center w-full italic text-sm' : 'bg-[#161616]/90 text-stone-300 border border-stone-800 font-serif text-lg tracking-wide'}`}>
                     <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<span class="text-jade-light font-bold">$1</span>') }}></div>
                  </div>
                </div>
             ))}
             {loading && <div className="text-center text-jade animate-pulse mt-4">☯ 天机衍算中...</div>}
             <div className="h-32"></div>
        </div>

        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black to-transparent pt-12 pb-6 px-4 md:px-8 z-30">
          <div className="max-w-3xl mx-auto">
             {!loading && !gameOver && choices.length > 0 && (
                 <div className="flex flex-wrap gap-2 mb-4 justify-center md:justify-start">
                    {choices.map((c, i) => (
                        <button key={i} onClick={() => handleAction(c)} className="px-3 py-1.5 bg-stone-800 border border-stone-600 hover:border-jade text-sm hover:text-jade-light transition-all rounded">{c}</button>
                    ))}
                 </div>
             )}
             <div className="relative group flex gap-2">
                <div className="relative flex-1">
                    <input 
                        type="text" value={input} onChange={e => setInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && input.trim() && handleAction(input)}
                        disabled={loading || gameOver}
                        placeholder="道友意欲何为？" 
                        className="w-full bg-[#111] border border-stone-700 text-stone-200 p-4 pr-12 rounded focus:border-jade focus:ring-1 focus:ring-jade transition-all shadow-2xl font-serif"
                    />
                    <button onClick={() => input.trim() && handleAction(input)} disabled={loading || !input.trim() || gameOver} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-stone-500 hover:text-jade">➤</button>
                </div>
                <button 
                    onClick={() => handleAction("", true)}
                    disabled={loading || gameOver}
                    className="px-4 bg-[#111] border border-stone-700 hover:border-purple-500 text-purple-500 rounded transition-all shadow-2xl font-serif whitespace-nowrap flex items-center gap-1"
                    title="窥探天机 (获取提示)"
                >
                    <span className="text-lg">🔮</span> <span className="hidden sm:inline">天机</span>
                </button>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
