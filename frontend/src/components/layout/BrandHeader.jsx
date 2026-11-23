import React from 'react';
import { WhixteLogo } from './WhixteLogo';

export function BrandHeader({ onBack }) {
  return (
    <header className="relative z-10 w-full px-7 pt-5 safe-top flex items-center justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Regresar"
          className="w-10 h-10 rounded-full bg-white/90 hover:bg-white text-brand-heading flex items-center justify-center shadow-sm hover:shadow transition-all duration-150 active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
      ) : (
        <WhixteLogo size="lg" />
      )}
      {onBack && <WhixteLogo size="md" />}
    </header>
  );
}
