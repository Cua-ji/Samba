import React from 'react';
import { useSamba } from '../../context/SambaContext';

export function AppTopBar({ title }) {
  const { user, setProfileOpen } = useSamba();

  return (
    <header className="sticky top-0 w-full z-30 pt-safe bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] shrink-0">
      <div className="h-16 px-margin flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-headline-md text-[20px] uppercase font-extrabold tracking-wider text-on-surface leading-tight whitespace-nowrap">
            {title}
          </h1>
          {user?.status === 'inactiva' && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
              Inactiva
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-semibold transition-colors active:scale-95 shadow-sm shrink-0"
        >
          <span className="text-body-md font-medium text-on-surface">Perfil</span>
          <span className="material-symbols-outlined text-primary text-[20px]">account_circle</span>
        </button>
      </div>
    </header>
  );
}
