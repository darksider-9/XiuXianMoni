
import React, { useState, useEffect } from 'react';
import { exportSaveToFile, importSaveFromFile, clearSave } from '../services/storageService';
import { testConnection } from '../services/geminiService';
import { CharacterState, ChatMessage, AISettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSaveSettings: (settings: AISettings) => void;
  character: CharacterState;
  history: ChatMessage[];
  onImportSuccess: (data: any) => void;
  summary: string;
  summarizedCount: number;
}

const PRESETS = [
    {
        name: "Google Gemini (OpenAI Compat)",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
        model: "gemini-2.0-flash"
    },
    {
        name: "DeepSeek (深度求索)",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat"
    },
    {
        name: "Moonshot (Kimi)",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "moonshot-v1-8k"
    },
    {
        name: "OpenAI Official",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o"
    }
];

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, settings, onSaveSettings, character, history, onImportSuccess, summary, summarizedCount 
}) => {
  const [formData, setFormData] = useState<AISettings>(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'data'>('general');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  useEffect(() => {
    setFormData(settings);
    setTestStatus('idle');
    setTestMessage('');
  }, [settings, isOpen]);

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
      setFormData(prev => ({
          ...prev,
          baseUrl: preset.baseUrl,
          model: preset.model
      }));
      setTestStatus('idle');
  };

  const handleTestConnection = async () => {
      setTestStatus('testing');
      setTestMessage('正在连接...');
      const result = await testConnection(formData);
      if (result.success) {
          setTestStatus('success');
      } else {
          setTestStatus('error');
      }
      setTestMessage(result.message);
  };

  if (!isOpen) return null;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const data = await importSaveFromFile(e.target.files[0]);
        onImportSuccess(data);
        onClose();
        alert("存档读取成功！");
      } catch (err) {
        alert("存档读取失败，文件可能已损坏。");
      }
    }
  };

  const handleClearData = () => {
    if (confirm("确定要删除所有存档数据吗？此操作无法撤销。")) {
        clearSave();
        window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-stone-700 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-stone-800 bg-stone-900">
          <h3 className="text-lg font-serif text-jade-light">设置 (Settings)</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300">&times;</button>
        </div>

        <div className="flex border-b border-stone-800 flex-shrink-0">
             <button 
                onClick={() => setActiveTab('general')}
                className={`flex-1 py-3 text-sm font-serif transition-colors ${activeTab === 'general' ? 'bg-stone-800 text-jade' : 'text-stone-500 hover:bg-stone-800/50'}`}
             >
                AI 接口配置
             </button>
             <button 
                onClick={() => setActiveTab('data')}
                className={`flex-1 py-3 text-sm font-serif transition-colors ${activeTab === 'data' ? 'bg-stone-800 text-jade' : 'text-stone-500 hover:bg-stone-800/50'}`}
             >
                存档管理
             </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {activeTab === 'general' && (
              <div className="space-y-4">
                {/* Presets */}
                <div className="mb-4">
                    <label className="block text-stone-500 text-xs mb-2 uppercase tracking-widest">快速预设 (Presets)</label>
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map(p => (
                            <button 
                                key={p.name}
                                onClick={() => handleApplyPreset(p)}
                                className="px-3 py-1 bg-stone-800 border border-stone-700 rounded text-xs text-stone-300 hover:border-jade hover:text-jade transition-all"
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                     <div>
                        <label className="block text-stone-400 text-sm mb-1">Base URL (接口地址)</label>
                        <input
                            type="text"
                            value={formData.baseUrl}
                            onChange={(e) => { setFormData({...formData, baseUrl: e.target.value}); setTestStatus('idle'); }}
                            placeholder="例如: https://api.deepseek.com"
                            className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-stone-200 text-sm focus:border-jade focus:outline-none"
                        />
                     </div>
                     
                     <div>
                        <label className="block text-stone-400 text-sm mb-1">API Key</label>
                        <input
                            type="password"
                            value={formData.apiKey}
                            onChange={(e) => { setFormData({...formData, apiKey: e.target.value}); setTestStatus('idle'); }}
                            placeholder="sk-..."
                            className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-stone-200 text-sm focus:border-jade focus:outline-none"
                        />
                     </div>

                     <div>
                        <label className="block text-stone-400 text-sm mb-1">Model Name (模型名称)</label>
                        <input
                            type="text"
                            value={formData.model}
                            onChange={(e) => { setFormData({...formData, model: e.target.value}); setTestStatus('idle'); }}
                            placeholder="例如: deepseek-chat, gpt-4o, gemini-2.0-flash"
                            className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-stone-200 text-sm focus:border-jade focus:outline-none"
                        />
                     </div>
                </div>
                
                {/* Test Connection Button */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleTestConnection}
                        disabled={!formData.apiKey || testStatus === 'testing'}
                        className="px-4 py-2 bg-stone-800 border border-stone-600 hover:border-jade text-stone-300 text-xs rounded transition-colors disabled:opacity-50"
                    >
                        {testStatus === 'testing' ? '连接中...' : '测试连接'}
                    </button>
                    {testStatus !== 'idle' && (
                        <span className={`text-xs ${testStatus === 'success' ? 'text-green-500' : 'text-red-400'}`}>
                            {testMessage}
                        </span>
                    )}
                </div>

                <div className="pt-4 mt-4 border-t border-stone-800">
                    <button 
                        onClick={() => { onSaveSettings(formData); onClose(); }}
                        className="w-full py-3 bg-jade hover:bg-jade-light text-stone-900 font-bold rounded transition-colors"
                    >
                        保存配置
                    </button>
                    <p className="text-center text-xs text-stone-600 mt-2">配置仅保存在本地浏览器的 LocalStorage 中。</p>
                </div>
              </div>
          )}

          {activeTab === 'data' && (
              <div className="space-y-4">
                 <div className="p-3 bg-stone-900/80 border border-stone-700 rounded text-xs text-stone-400 leading-relaxed">
                    <strong className="text-jade-light block mb-1">⚠️ 数据保存说明</strong>
                    本游戏为纯前端运行，所有游戏进度、存档和 API 配置仅保存在您<strong>当前浏览器的本地缓存 (LocalStorage)</strong> 中。
                    <br/><br/>
                    更换设备、更换浏览器或清理缓存会导致存档丢失。请务必定期使用下方的<strong>“下载存档”</strong>功能进行备份。
                 </div>

                 <div className="p-4 bg-stone-900 rounded border border-stone-800">
                    <h4 className="text-stone-300 text-sm font-bold mb-2">导出存档</h4>
                    <p className="text-xs text-stone-500 mb-3">下载当前的修仙进度到本地文件（包含当前 API 设置）。</p>
                    <button 
                        onClick={() => exportSaveToFile(character, history, settings, summary, summarizedCount)}
                        className="w-full py-2 bg-stone-800 border border-stone-600 hover:border-jade text-stone-300 rounded text-sm transition-colors"
                    >
                        下载存档 (.json)
                    </button>
                 </div>

                 <div className="p-4 bg-stone-900 rounded border border-stone-800">
                    <h4 className="text-stone-300 text-sm font-bold mb-2">导入存档</h4>
                    <p className="text-xs text-stone-500 mb-3">从本地文件读取进度 (覆盖当前状态和设置)。</p>
                    <label className="block w-full py-2 bg-stone-800 border border-stone-600 hover:border-jade text-stone-300 rounded text-center text-sm cursor-pointer transition-colors">
                        选择文件...
                        <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                 </div>

                 <div className="pt-4 border-t border-stone-800">
                    <button 
                        onClick={handleClearData}
                        className="w-full py-2 text-red-500 hover:bg-red-900/20 rounded text-sm transition-colors"
                    >
                        清除所有本地数据
                    </button>
                 </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
