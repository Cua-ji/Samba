import React from 'react';

const IMPACT_STYLES = {
  bajo: { gradient: 'from-[#d9f3e7] via-[#cbeee0] to-[#b5e4d0]', icon: 'self_improvement' },
  medio: { gradient: 'from-[#ceeee0] via-[#b4e4cf] to-[#98d8bd]', icon: 'fitness_center' },
  alto: { gradient: 'from-[#bfe7d7] via-[#a7dcc7] to-[#8dceb4]', icon: 'bolt' },
};

export function WorkoutVisual({ impactLevel = 'bajo', recommended = false }) {
  const style = IMPACT_STYLES[impactLevel] || IMPACT_STYLES.bajo;
  const icon = recommended ? 'fitness_center' : style.icon;

  return (
    <div
      className={`relative w-full h-28 rounded-2xl overflow-hidden bg-gradient-to-br ${style.gradient} border border-emerald-900/10 mb-3 flex items-center justify-center`}
    >
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/30 pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-emerald-500/10 pointer-events-none" />

      <div className="w-12 h-12 rounded-2xl bg-white/85 shadow-sm flex items-center justify-center text-[#006c49]">
        <span className="material-symbols-outlined text-[26px]">{icon}</span>
      </div>
    </div>
  );
}
