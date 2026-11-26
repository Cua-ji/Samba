import React from 'react';

export function MobileShell({ children, variant = 'mesh', className = '' }) {
  const bgClass = variant === 'app' ? 'samba-app-bg' : 'samba-mesh-bg';

  return (
    <div className="h-[100dvh] w-full bg-slate-100 flex items-center justify-center sm:p-4 overflow-hidden">
      <main
        className={`relative w-full h-full sm:max-w-[460px] md:max-w-[500px] sm:h-[min(880px,94dvh)] sm:rounded-[36px] sm:shadow-2xl overflow-hidden ${bgClass} flex flex-col ${className}`}
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
