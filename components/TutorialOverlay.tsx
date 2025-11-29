
import React, { useState } from 'react';

interface TutorialOverlayProps {
  onClose: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose }) => {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: "道友，欢迎踏入仙途",
      content: "此乃修仙模拟之地。修仙之路逆天而行，你将面临无数抉择。所有的交互皆通过文字进行，你的每一个决定都会影响命运。",
      target: "center"
    },
    {
      title: "观气察运 (左侧面板)",
      content: "左侧为你的**本命面板**。时刻关注你的【气血】与【修为】。气血归零则身死道消；修为圆满需寻找契机【突破】方可晋升下个境界。灵石、丹药、法宝皆在此处查看。",
      target: "sidebar"
    },
    {
      title: "言出法随 (下方输入)",
      content: "在下方输入框中，你可以输入任何意图。例如：“寻找草药”、“闭关修炼”、“前往拍卖行”或“杀人夺宝”。系统会根据你的境界与机缘判定结果。",
      target: "input"
    },
    {
      title: "流派与生存",
      content: "前期切勿好高骛远。若你是【种田流】，多关注灵植生长；若是【剑修】，多去战斗磨砺。若遇瓶颈或不知道做什么，可点击输入框上方的【天机】按钮寻求指引。",
      target: "center"
    }
  ];

  const currentStep = steps[step - 1];
  const isLast = step === steps.length;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300">
      <div className="max-w-lg w-full bg-[#1c1c1c] border border-jade rounded-lg shadow-[0_0_50px_rgba(60,140,109,0.2)] p-6 relative animate-fade-in mx-4">
        
        {/* Decorative Corner */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-jade opacity-50"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-jade opacity-50"></div>

        <div className="flex justify-between items-center mb-4 border-b border-stone-800 pb-2">
            <span className="text-jade text-xs font-serif tracking-widest uppercase">新手引导 • 第 {step} / {steps.length} 步</span>
            <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-xl leading-none">&times;</button>
        </div>

        <h3 className="text-2xl font-serif text-stone-200 mb-4 tracking-wide">{currentStep.title}</h3>
        <p className="text-stone-400 leading-relaxed mb-8 text-sm md:text-base">
            {currentStep.content}
        </p>

        <div className="flex justify-end gap-3">
             <button 
                onClick={onClose}
                className="px-4 py-2 text-stone-500 hover:text-stone-300 text-sm transition-colors"
            >
                跳过
            </button>
            <button 
                onClick={handleNext}
                className="px-6 py-2 bg-jade/20 hover:bg-jade/30 border border-jade text-jade-light hover:text-white rounded transition-all duration-300 flex items-center gap-2"
            >
                {isLast ? "开启仙途" : "下一步"}
                {!isLast && <span>&rarr;</span>}
            </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
