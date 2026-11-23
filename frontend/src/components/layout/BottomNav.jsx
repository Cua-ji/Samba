import React from 'react';
import { useSamba } from '../../context/SambaContext';

const TABS = [
  { id: 'platillo', label: 'Platillo', icon: 'restaurant' },
  { id: 'inicio', label: 'Inicio', icon: 'home' },
  { id: 'entreno', label: 'Entreno', icon: 'fitness_center' },
];

export function BottomNav() {
  const { activeTab, setActiveTab } = useSamba();

  return (
    <nav className="sticky bottom-0 w-full z-30 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.05)] border-t border-white/60 shrink-0">
      <div className="h-16 px-space-xs flex items-center justify-around">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] py-1 transition-colors ${
                isActive
                  ? 'text-[#00B87C] font-bold'
                  : 'text-on-surface-variant hover:text-on-surface font-medium'
              }`}
            >
              <span
                className="material-symbols-outlined text-[23px]"
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1, 'wght' 600" }
                    : undefined
                }
              >
                {tab.icon}
              </span>
              <span className="font-label-sm text-label-sm mt-0.5 tracking-wide">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
