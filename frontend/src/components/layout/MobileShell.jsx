import React from 'react';

export function MobileShell({ children, variant = 'mesh', className = '' }) {
  const bgClass = variant === 'app' ? 'samba-app-bg' : 'samba-mesh-bg';

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-slate-100 flex items-center justify-center sm:py-4">
      <main
        className={`relative w-full sm:max-w-[430px] min-h-screen min-h-[100dvh] sm:min-h-[860px] sm:h-[880px] sm:max-h-[94vh] sm:rounded-[44px] shadow-2xl overflow-hidden ${bgClass} flex flex-col justify-between ${className}`}
      >
        <div
          aria-hidden="true"
          className="absolute -top-24 -left-20 w-72 h-72 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none"
        />
        {children}
      </main>
    </div>
  );
}
