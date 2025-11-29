import React from 'react';

interface GameVisualsProps {
  keyword: string;
}

const GameVisuals: React.FC<GameVisualsProps> = ({ keyword }) => {
  // Using picsum with blur/grayscale to make it more abstract and fitting for a text adventure
  // Seed ensures the image stays consistent for the same keyword until it changes
  const imageUrl = `https://picsum.photos/seed/${keyword}/800/400?grayscale&blur=2`;

  return (
    <div className="w-full h-48 md:h-64 overflow-hidden rounded-lg border border-stone-700 relative mb-6 group">
      <div className="absolute inset-0 bg-gradient-to-t from-stone-900 to-transparent z-10 opacity-80" />
      <img 
        src={imageUrl} 
        alt="Atmospheric Scene" 
        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-60"
      />
      <div className="absolute bottom-4 left-4 z-20">
         <span className="inline-block px-3 py-1 bg-black/50 backdrop-blur-sm border border-stone-600 text-stone-300 text-xs uppercase tracking-[0.2em]">
            Visio: {keyword}
         </span>
      </div>
    </div>
  );
};

export default GameVisuals;
