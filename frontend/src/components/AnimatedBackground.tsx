import React from 'react';

const AnimatedBackground: React.FC = () => {
  return (
    <>
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"
          style={{ animation: 'pulse-slow 8s ease-in-out infinite' }}
        ></div>
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
          style={{ animation: 'pulse-slow 8s ease-in-out infinite', animationDelay: '2s' }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"
          style={{ animation: 'pulse-slow 8s ease-in-out infinite', animationDelay: '4s' }}
        ></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      ></div>
    </>
  );
};

export default AnimatedBackground;
