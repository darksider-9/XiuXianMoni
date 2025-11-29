
import React, { useState, useEffect, useRef } from 'react';
import { initializeGame, sendPlayerAction } from './services/geminiService';
import { saveGame, loadGame, loadSettings, saveSettings, clearSave } from './services/storageService';
import { CharacterState, GameResponse, ChatMessage, CharacterAttribute, StartLocation, SaveData, AISettings } from './types';
import StatBar from './components/StatBar';
import GameVisuals from './components/GameVisuals';
import TutorialOverlay from './components/TutorialOverlay';
import SettingsModal from './components/SettingsModal';

// Initial Character State
const INITIAL_STATE: CharacterState = {
  name: "修仙者",
  realm: "凡人",
  cultivation: 0,
  maxCultivation: 100,
  health: 100,
  maxHealth: 100,
  spiritStones: 0,
  attributes: {
    [CharacterAttribute.STRENGTH]: 10,
    [CharacterAttribute.WISDOM]: 10,
    [CharacterAttribute.AGILITY]: 10,
    [CharacterAttribute.LUCK]: 10,
  },
  inventory: [],
  equipment: {
    weapon: "无",
    armor: "布衣",
    relic: "无",
  },
  techniques: [],
  statusEffects: [],
};

// 重新设计的出生地，支持不同流派
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

const App: React.FC = () => {
  const [character, setCharacter] = useState<CharacterState>(INITIAL_STATE);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  
  // Settings State
  const [aiSettings, setAiSettings] = useState<AISettings>({
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      model: 'gemini-2.0-flash'
  });

  const [gamePhase, setGamePhase] = useState<'welcome' | 'selection' | 'playing'>('welcome');
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // Custom Origin Input
  const [showCustomOriginInput, setShowCustomOriginInput] = useState<boolean>(false);
  const [customOriginText, setCustomOriginText] = useState<string>('');

  const [currentVisual, setCurrentVisual] = useState<string>("Chinese misty mountains");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize: Load Settings and Save Data
  useEffect(() => {
    // Load Settings
    const storedSettings = loadSettings();
    if (storedSettings) {
        setAiSettings(storedSettings);
    } else if (process.env.API_KEY) {
        // Fallback for environment variable if no local settings
        setAiSettings(prev => ({ ...prev, apiKey: process.env.API_KEY || '' }));
    }

    // Check for saved game
    // We don't auto-load the game state into view, but we check if it exists to show "Continue"
  }, []);

  // Auto-save when state changes
  useEffect(() => {
    if (gamePhase === 'playing' && !loading && !gameOver) {
        saveGame(character, history, aiSettings);
    }
  }, [character, history, gamePhase, loading, gameOver, aiSettings]);

  // Auto-scroll to bottom of chat
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
    setCharacter(data.character);
    setHistory(data.history);
    if (data.settings) {
        setAiSettings(data.settings);
        saveSettings(data.settings);
    }
    setGamePhase('playing');
  };

  const handleContinueGame = () => {
    const savedData = loadGame();
    if (savedData) {
        setCharacter(savedData.character);
        setHistory(savedData.history);
        if (savedData.settings) {
            setAiSettings(savedData.settings);
        }
        setGamePhase('playing');
    }
  };

  const handleQuitGame = () => {
      if (confirm("确定要返回主界面吗？当前进度已自动保存。")) {
          setGamePhase('welcome');
      }
  };

  const enterSelection = () => {
    setGamePhase('selection');
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
    setShowTutorial(true); 
    setCharacter(INITIAL_STATE); // Reset char for new game

    try {
      const response = await initializeGame(locName, locBonus, aiSettings, customPrompt);
      processResponse(response);
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : "未知错误";
      setHistory(prev => [...prev, { role: 'system', content: `天道连接中断: ${errMsg}。请检查 API 设置。` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, isHint: boolean = false) => {
    if (loading || gameOver) return;
    if (!aiSettings.apiKey) { setIsSettingsOpen(true); return; }
    
    if (isHint) {
       setHistory(prev => [...prev, { role: 'system', content: '正在窥探天机...' }]);
    } else {
       setHistory(prev => [...prev, { role: 'user', content: action }]);
    }
    
    setInput('');
    setChoices([]); 
    setLoading(true);

    try {
      // Pass full history to service
      const response = await sendPlayerAction(action, character, history, aiSettings, isHint);
      processResponse(response);
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : "未知错误";
      setHistory(prev => [...prev, { role: 'system', content: `天机混乱: ${errMsg}。请重试。` }]);
      setLoading(false);
    }
  };

  const processResponse = (response: GameResponse) => {
    if (response.eventArtKeyword) {
      setCurrentVisual(response.eventArtKeyword);
    }

    // Role mapping for display: 'assistant' -> 'model' internal type logic for consistency
    // But our types now use 'assistant'. Let's keep UI consistent with types.
    // The GameResponse doesn't return role, we add it.
    // NOTE: services now return 'narrative' string, which we display as assistant message.
    
    setHistory(prev => [...prev, { role: 'assistant', content: response.narrative, isNarrative: true }]);

    if (response.characterUpdate) {
      setCharacter(prev => {
        // Deep merge equipment
        const updatedEquipment = response.characterUpdate.equipment 
            ? { ...prev.equipment, ...response.characterUpdate.equipment }
            : prev.equipment;
        
        // Merge Logic
        return {
          ...prev,
          ...response.characterUpdate,
          equipment: updatedEquipment,
        };
      });
    }

    setChoices(response.choices || []);
    if (response.gameOver) {
        setGameOver(true);
        clearSave(); // Clear save on death
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      handleAction(input);
    }
  };

  // --- RENDER HELPERS ---

  if (gamePhase === 'welcome') {
    const hasSave = !!loadGame();
    return (
      <div className="min-h-screen bg-ink-black flex flex-col items-center justify-center text-stone-300 relative overflow-hidden font-serif">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-transparent to-stone-900"></div>

        <button 
            onClick={() => setIsSettingsOpen(true)}
            className="absolute top-4 right-4 p-2 text-stone-500 hover:text-jade z-50 flex items-center gap-2"
            title="设置"
        >
            <span className="text-xs uppercase tracking-widest hidden md:inline">{aiSettings.apiKey ? "配置已就绪" : "配置API"}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        </button>

        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            settings={aiSettings}
            onSaveSettings={handleUpdateSettings}
            character={character}
            history={history}
            onImportSuccess={handleImportSuccess}
        />

        <div className="z-10 text-center max-w-lg px-4 animate-fade-in">
          <div className="w-24 h-24 mx-auto mb-8 rounded-full border-2 border-jade flex items-center justify-center shadow-[0_0_30px_rgba(60,140,109,0.3)] bg-stone-900">
            <span className="text-5xl font-bold text-stone-200">道</span>
          </div>
          <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-jade-light to-stone-200 tracking-wider">
            问道长生
          </h1>
          <p className="text-stone-500 mb-10 italic text-xl tracking-widest">
            "仙路尽头谁为峰，一见无始道成空"
          </p>
          
          <div className="flex flex-col gap-4">
            <button
                onClick={enterSelection}
                className="group relative px-10 py-4 bg-stone-900 border border-jade text-jade-light hover:bg-jade hover:text-white transition-all duration-300 rounded-sm tracking-[0.3em] uppercase text-lg font-semibold"
            >
                {hasSave ? "重入轮回 (新游戏)" : "踏入仙途"}
                <div className="absolute inset-0 border border-jade opacity-0 group-hover:scale-105 group-hover:opacity-50 transition-all duration-500"></div>
            </button>
            
            {hasSave && (
                <button
                    onClick={handleContinueGame}
                    className="px-10 py-3 bg-transparent border border-stone-600 text-stone-400 hover:text-stone-200 hover:border-stone-400 transition-all rounded-sm tracking-[0.2em] uppercase text-sm"
                >
                    再续前缘 (继续)
                </button>
            )}
          </div>
          
          {!aiSettings.apiKey && (
             <p className="mt-8 text-xs text-red-400 bg-red-900/10 border border-red-900/30 p-2 rounded cursor-pointer" onClick={() => setIsSettingsOpen(true)}>
                检测到未配置 API Key。点击此处或右上角进行配置。
             </p>
          )}
        </div>
      </div>
    );
  }

  if (gamePhase === 'selection') {
    return (
      <div className="min-h-screen bg-ink-black flex flex-col items-center justify-center text-stone-300 p-4 font-serif">
         {/* Custom Origin Modal */}
         {showCustomOriginInput && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
                 <div className="w-full max-w-lg bg-stone-900 border border-jade p-6 rounded">
                     <h3 className="text-xl text-jade mb-4">构想你的出身</h3>
                     <textarea
                        className="w-full h-32 bg-black border border-stone-700 text-stone-300 p-3 mb-4 focus:border-jade focus:outline-none resize-none"
                        placeholder="例如：我出生在终年积雪的极北之地，体内流淌着上古冰龙的血脉..."
                        value={customOriginText}
                        onChange={(e) => setCustomOriginText(e.target.value)}
                     />
                     <div className="flex justify-end gap-3">
                         <button onClick={() => setShowCustomOriginInput(false)} className="px-4 py-2 text-stone-500 hover:text-stone-300">取消</button>
                         <button onClick={handleCustomStart} className="px-6 py-2 bg-jade text-black font-bold hover:bg-jade-light">开始生成</button>
                     </div>
                 </div>
             </div>
         )}

         <div className="flex w-full max-w-5xl justify-between items-center mb-6">
            <button onClick={() => setGamePhase('welcome')} className="text-stone-500 hover:text-stone-300">&larr; 返回</button>
            <h2 className="text-3xl text-jade-light tracking-widest text-center">选择出身</h2>
            <div className="w-10"></div>
         </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full overflow-y-auto max-h-[80vh] p-2 custom-scrollbar">
          {START_LOCATIONS.map((loc) => (
             <button
                key={loc.id}
                onClick={() => handleStartGame(loc)}
                className={`text-left p-6 border transition-all duration-300 rounded group relative overflow-hidden flex flex-col h-full
                    ${loc.type === 'custom' ? 'bg-stone-900/30 border-dashed border-stone-600 hover:border-jade hover:bg-stone-800' : 'bg-stone-900/50 border-stone-800 hover:border-jade hover:bg-stone-800'}
                `}
             >
               <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20">
                  <span className="text-6xl font-serif text-jade">{loc.type === 'custom' ? '?' : loc.name.charAt(0)}</span>
               </div>
               <div className="flex justify-between items-center mb-2 relative z-10 w-full">
                 <h3 className="text-xl font-bold text-stone-200 group-hover:text-jade-light transition-colors">{loc.name}</h3>
                 <span className={`text-xs border px-2 py-1 rounded uppercase ${loc.type === 'custom' ? 'border-jade text-jade' : 'border-stone-700 text-stone-500'}`}>{loc.type}</span>
               </div>
               <p className="text-sm text-stone-400 mb-4 leading-relaxed relative z-10 min-h-[40px] flex-grow">{loc.description}</p>
               <div className="text-xs text-jade/80 bg-jade/10 p-3 rounded border border-jade/20 relative z-10 w-full">
                 <span className="font-bold">初始机缘：</span> {loc.bonus}
               </div>
             </button>
          ))}
        </div>
      </div>
    );
  }

  // --- PLAYING STATE ---

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-stone-300 font-sans flex flex-col md:flex-row overflow-hidden">
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
      
      <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            settings={aiSettings}
            onSaveSettings={handleUpdateSettings}
            character={character}
            history={history}
            onImportSuccess={handleImportSuccess}
      />

      {/* Sidebar */}
      <aside className="w-full md:w-80 flex-shrink-0 bg-[#111111] border-b md:border-b-0 md:border-r border-stone-800 p-6 overflow-y-auto z-20 shadow-xl custom-scrollbar h-[30vh] md:h-screen">
        <div className="mb-6 text-center">
            <div className="inline-block p-1 border border-stone-700 rounded-full mb-2">
                 <div className="w-14 h-14 rounded-full bg-gradient-to-br from-stone-800 to-stone-900 flex items-center justify-center text-xl text-jade-light font-serif font-bold">
                    {character.name.charAt(0)}
                 </div>
            </div>
          <h2 className="text-xl font-serif text-stone-100 tracking-wide">{character.name}</h2>
          <div className="text-xs text-jade-light font-medium tracking-widest mt-1 border border-jade/30 inline-block px-2 py-0.5 rounded bg-jade/5">
            {character.realm}
          </div>
        </div>

        <div className="space-y-6">
          {/* Attributes */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-4 p-2 bg-stone-900 rounded border border-stone-800">
             {Object.entries(character.attributes).map(([key, val]) => (
                <div key={key} className="flex justify-between text-stone-400 px-1">
                   <span>{key}</span>
                   <span className="text-stone-200">{val}</span>
                </div>
             ))}
          </div>

          {/* Vitals */}
          <div>
            <StatBar 
                label="气血" 
                value={character.health} 
                max={character.maxHealth} 
                colorClass="bg-red-900/80" 
                icon={<span className="text-red-500 mr-1">♥</span>}
            />
             <StatBar 
                label="修为" 
                value={character.cultivation} 
                max={character.maxCultivation} 
                colorClass="bg-jade/80"
                icon={<span className="text-jade mr-1">✦</span>}
            />
             <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-xs text-stone-500">灵石</span>
                <span className="text-gold-dim font-serif font-bold text-sm">{character.spiritStones}</span>
             </div>
          </div>

          {/* Equipment */}
          <div>
            <h3 className="text-[10px] uppercase text-stone-500 tracking-widest mb-2 font-bold border-b border-stone-800 pb-1">法宝装备 (Equipment)</h3>
            <div className="space-y-1">
                {[
                    { label: '兵器', val: character.equipment.weapon },
                    { label: '宝甲', val: character.equipment.armor },
                    { label: '本命', val: character.equipment.relic }
                ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center text-xs p-1.5 bg-stone-900/30 rounded hover:bg-stone-800 transition-colors">
                        <span className="text-stone-500">{item.label}</span>
                        <span className={`${item.val === '无' ? 'text-stone-600' : 'text-jade-light'} truncate max-w-[120px]`}>
                            {item.val}
                        </span>
                    </div>
                ))}
            </div>
          </div>

           {/* Techniques */}
           <div>
            <h3 className="text-[10px] uppercase text-stone-500 tracking-widest mb-2 font-bold border-b border-stone-800 pb-1">功法神通 (Techniques)</h3>
            <div className="flex flex-wrap gap-1.5">
                {character.techniques.length === 0 ? (
                    <span className="text-xs text-stone-600 italic px-1">暂无功法</span>
                ) : (
                    character.techniques.map((item, idx) => (
                    <span key={idx} className="px-2 py-1 bg-blue-900/20 border border-blue-900/40 rounded text-[10px] text-blue-300">
                        {item}
                    </span>
                    ))
                )}
            </div>
          </div>

          {/* Inventory */}
          <div>
            <h3 className="text-[10px] uppercase text-stone-500 tracking-widest mb-2 font-bold border-b border-stone-800 pb-1">储物袋 (Inventory)</h3>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                {character.inventory.length === 0 ? (
                    <span className="text-xs text-stone-600 italic px-1">空空如也</span>
                ) : (
                    character.inventory.map((item, idx) => (
                    <span key={idx} className="px-2 py-1 bg-stone-800 border border-stone-700 rounded text-[10px] text-stone-300 hover:text-white transition-colors cursor-help" title={item}>
                        {item}
                    </span>
                    ))
                )}
            </div>
          </div>

           {/* Status Effects */}
           {character.statusEffects.length > 0 && (
               <div>
                <h3 className="text-[10px] uppercase text-stone-500 tracking-widest mb-2 font-bold border-b border-stone-800 pb-1">当前状态 (Effects)</h3>
                <div className="flex flex-wrap gap-1.5">
                    {character.statusEffects.map((effect, idx) => (
                        <span key={idx} className="px-2 py-1 bg-purple-900/20 border border-purple-900/40 rounded text-[10px] text-purple-300">
                            {effect}
                        </span>
                    ))}
                </div>
              </div>
           )}
        </div>
      </aside>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col h-[70vh] md:h-screen relative">
        
        {/* Top Bar Controls */}
        <div className="absolute top-4 right-4 z-40 flex gap-2">
             <button 
                onClick={handleQuitGame}
                className="p-2 bg-black/50 backdrop-blur rounded-full text-stone-500 hover:text-red-400 border border-stone-700 hover:border-red-400 transition-all"
                title="返回主页"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
             </button>
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-black/50 backdrop-blur rounded-full text-stone-500 hover:text-jade border border-stone-700 hover:border-jade transition-all"
                title="系统设置"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </button>
        </div>

        {/* Chat Log */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth"
        >
             <div className="max-w-3xl mx-auto">
                 <GameVisuals keyword={currentVisual} />
             </div>

          {history.map((msg, index) => (
            <div 
              key={index} 
              className={`max-w-3xl mx-auto animate-fade-in ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
            >
              <div 
                className={`
                  p-4 md:p-6 rounded-sm leading-relaxed shadow-lg
                  ${msg.role === 'user' 
                    ? 'bg-stone-800/80 text-stone-200 border border-stone-700 ml-12 backdrop-blur-sm' 
                    : msg.role === 'system'
                        ? 'bg-jade/10 border border-jade/30 text-jade-light text-sm text-center w-full italic'
                        : 'bg-[#161616]/90 text-stone-300 border border-stone-800 mr-4 md:mr-12 font-serif text-lg tracking-wide'}
                `}
              >
                 {msg.role === 'assistant' && (
                     <div className="mb-3 text-jade text-[10px] uppercase tracking-widest opacity-60 flex items-center gap-1 border-b border-stone-800 pb-1">
                        <span>✦</span> 天道推演
                     </div>
                 )}
                 <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<span class="text-jade-light font-bold">$1</span>') }}></div>
              </div>
            </div>
          ))}

            {loading && (
                <div className="max-w-3xl mx-auto flex items-center gap-3 text-stone-500 animate-pulse mt-4 justify-center">
                     <span className="text-2xl animate-spin text-jade opacity-50">☯</span>
                     <span className="text-xs font-serif italic tracking-widest">天机衍算中...</span>
                </div>
            )}

            {gameOver && (
                <div className="max-w-3xl mx-auto text-center p-8 border border-stone-700 bg-stone-900/80 rounded-lg mt-8">
                    <h2 className="text-3xl font-serif text-jade-light mb-4">大道终焉</h2>
                    <p className="text-stone-400 mb-6">这一世的修行已至尽头，请道友重入轮回。</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-8 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded text-stone-200 transition-colors uppercase tracking-widest"
                    >
                        转世重修
                    </button>
                </div>
            )}

            <div className="h-32"></div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-12 pb-6 px-4 md:px-8 z-30">
          <div className="max-w-3xl mx-auto">
            {/* Suggested Choices */}
            {!loading && !gameOver && choices.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center md:justify-start">
                {choices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAction(choice)}
                    className="px-3 py-1.5 bg-stone-800/80 hover:bg-jade/20 border border-stone-600 hover:border-jade text-xs text-stone-300 hover:text-jade-light transition-all rounded-sm backdrop-blur-sm"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Action Helpers */}
            {!loading && !gameOver && (
                 <div className="flex justify-between items-end mb-3">
                     <div className="flex gap-4 text-xs text-stone-500 font-serif tracking-wider">
                        <button onClick={() => setInput("闭关修炼")} className="hover:text-jade transition-colors">闭关</button>
                        <button onClick={() => setInput("探索周围")} className="hover:text-jade transition-colors">探索</button>
                        <button onClick={() => setInput("开炉炼丹")} className="hover:text-jade transition-colors">炼丹</button>
                        <button onClick={() => setInput("铸造法宝")} className="hover:text-jade transition-colors">炼器</button>
                     </div>
                     <button 
                        onClick={() => handleAction("", true)} 
                        className="text-xs bg-stone-800 border border-stone-600 px-3 py-1 rounded-full text-stone-400 hover:text-jade hover:border-jade transition-colors flex items-center gap-1"
                        title="不知道做什么？询问天机"
                     >
                        <span>🔮</span> 天机
                     </button>
                 </div>
            )}

            {/* Text Input */}
            <div className="relative group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || gameOver}
                placeholder="道友意欲何为？(例如：在此开辟洞府，种植灵草)"
                className="w-full bg-[#111] border border-stone-700 text-stone-200 p-4 pr-12 rounded-sm focus:outline-none focus:border-jade focus:ring-1 focus:ring-jade transition-all shadow-2xl font-serif placeholder:text-stone-700 disabled:opacity-50 text-sm md:text-base"
              />
              <button
                onClick={() => input.trim() && handleAction(input)}
                disabled={loading || !input.trim() || gameOver}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-stone-500 hover:text-jade transition-colors disabled:opacity-30"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
