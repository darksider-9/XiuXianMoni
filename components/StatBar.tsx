import React from 'react';

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  colorClass: string;
  icon?: React.ReactNode;
}

const StatBar: React.FC<StatBarProps> = ({ label, value, max, colorClass, icon }) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className="mb-3 w-full">
      <div className="flex justify-between items-center mb-1 text-xs font-serif tracking-wider text-gray-400">
        <div className="flex items-center gap-1">
          {icon}
          <span>{label}</span>
        </div>
        <span>{value} / {max}</span>
      </div>
      <div className="h-2 w-full bg-stone-800 border border-stone-700 rounded-full overflow-hidden relative">
        <div
          className={`h-full transition-all duration-700 ease-out ${colorClass}`}
          style={{ width: `${percentage}%` }}
        >
            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default StatBar;
