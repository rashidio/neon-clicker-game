import React from 'react';
import ProducerItem from './ProducerItem';

interface QuickAccessProducersProps {
  producers: any[];
  score: number;
  onBuy: (producer: any) => void;
  formatTime: (seconds: number) => string;
}

const QuickAccessProducers: React.FC<QuickAccessProducersProps> = ({ producers, score, onBuy, formatTime }) => {
  return (
    <div className="space-y-4">
      <div className="text-xs font-light tracking-widest text-gray-500 mb-4">QUICK ACCESS</div>
      {producers.slice(0, 3).map((producer) => (
        <ProducerItem
          key={producer.id}
          producer={producer}
          score={score}
          onBuy={onBuy}
          formatTime={formatTime}
          compact
        />
      ))}
    </div>
  );
};

export default QuickAccessProducers;
