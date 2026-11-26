import React from 'react';
import { useSamba } from '../../context/SambaContext';

export function AppTopBar({ title }) {
  const { user, setProfileOpen } = useSamba();

  return (
    <header className="sticky top-0 w-full z-30 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] shrink-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="h-14 sm:h-16 px-4 sm:px-margin flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-headline-md text-[18px] sm:text-[20px] uppercase font-extrabold tracking-wider text-on-surface leading-tight whitespace-nowrap truncate">
            {title}
          </h1>
          {user?.status === 'inactiva' && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0">
              Inactiva
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-2xl bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-semibold transition-colors active:scale-95 shadow-sm shrink-0"
        >
          <span className="text-body-md font-medium text-on-surface">Perfil</span>
          <span className="material-symbols-outlined text-primary text-[20px]">account_circle</span>
        </button>
      </div>
    </header>
  );
}
