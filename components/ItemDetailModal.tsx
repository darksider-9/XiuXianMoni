
import React from 'react';
import { ItemDetails } from '../types';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  details?: ItemDetails;
  onIdentify: (itemName: string) => void;
  isIdentifying: boolean;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ 
  isOpen, onClose, itemName, details, onIdentify, isIdentifying 
}) => {
  if (!isOpen) return null;

  // 根据品阶决定边框颜色
  const getRankColor = (rank: string = "") => {
    if (rank.includes("天")) return "border-purple-500 text-purple-400";
    if (rank.includes("地")) return "border-amber-600 text-amber-500";
    if (rank.includes("玄")) return "border-blue-500 text-blue-400";
    if (rank.includes("黄")) return "border-stone-500 text-stone-400";
    return "border-stone-700 text-stone-500";
  };

  const rankColorClass = details ? getRankColor(details.rank) : "border-stone-700";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className={`bg-[#1a1a1a] border-2 ${rankColorClass} rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-md relative overflow-hidden flex flex-col`}>
        
        {/* Header */}
        <div className="p-4 bg-stone-900 border-b border-stone-800 flex justify-between items-start">
           <div>
               <h3 className="text-xl font-serif font-bold text-stone-200 tracking-wider">{itemName}</h3>
               {details && <span className={`text-xs border px-1.5 py-0.5 rounded mt-1 inline-block ${getRankColor(details.rank)}`}>{details.rank}</span>}
           </div>
           <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-2xl leading-none">&times;</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-stone-300">
           {!details ? (
               <div className="text-center py-8">
                   <p className="text-stone-500 italic mb-4">此物神光内敛，尚未知晓其具体功效...</p>
                   <button 
                      onClick={() => onIdentify(itemName)}
                      disabled={isIdentifying}
                      className="px-6 py-2 bg-stone-800 hover:bg-jade/20 border border-stone-600 hover:border-jade text-jade-light rounded transition-all disabled:opacity-50"
                   >
                       {isIdentifying ? "鉴定中..." : "消耗神识鉴定"}
                   </button>
               </div>
           ) : (
               <>
                   {/* Description */}
                   <p className="text-sm italic text-stone-400 leading-relaxed border-l-2 border-stone-700 pl-3">
                       {details.description}
                   </p>

                   {/* Effects */}
                   {details.effects && details.effects.length > 0 && (
                       <div>
                           <h4 className="text-xs uppercase text-jade tracking-widest font-bold mb-2">功效 (Effects)</h4>
                           <ul className="space-y-1">
                               {details.effects.map((effect, idx) => (
                                   <li key={idx} className="text-sm flex items-center gap-2">
                                       <span className="text-jade/50">✦</span> {effect}
                                   </li>
                               ))}
                           </ul>
                       </div>
                   )}

                   {/* Requirements */}
                   {details.requirements && details.requirements.length > 0 && (
                       <div>
                           <h4 className="text-xs uppercase text-red-400 tracking-widest font-bold mb-2">限制 (Requires)</h4>
                           <ul className="space-y-1">
                               {details.requirements.map((req, idx) => (
                                   <li key={idx} className="text-sm text-stone-500 flex items-center gap-2">
                                       <span className="text-red-900">✕</span> {req}
                                   </li>
                               ))}
                           </ul>
                       </div>
                   )}
               </>
           )}
        </div>
      </div>
    </div>
  );
};

export default ItemDetailModal;
