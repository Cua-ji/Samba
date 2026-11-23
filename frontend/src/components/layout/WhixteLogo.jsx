import React from 'react';

export function WhixteLogo({ size = 'md', showBrand = true }) {
  const iconClass = size === 'lg' ? 'w-7 h-7' : 'w-6 h-6';
  const textClass =
    size === 'lg' ? 'text-base font-bold tracking-tight text-brand-heading' : 'text-[14px] font-bold tracking-tight text-brand-heading';

  return (
    <div className="flex items-center gap-2" data-purpose="brand-logo">
      <div
        aria-hidden="true"
        className={`relative ${iconClass} flex items-center justify-center text-[#00B87C]`}
      >
        <svg
          className={`${iconClass} animate-[spin_30s_linear_infinite]`}
          fill="none"
          viewBox="0 0 28 28"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="14" cy="14" fill="currentColor" r="2.5" />
          <g stroke="currentColor" strokeLinecap="round" strokeWidth="2.2">
            <line x1="14" x2="14" y1="2" y2="6" />
            <line x1="14" x2="14" y1="22" y2="26" />
            <line x1="2" x2="6" y1="14" y2="14" />
            <line x1="22" x2="26" y1="14" y2="14" />
            <line x1="5.5" x2="8.3" y1="5.5" y2="8.3" />
            <line x1="19.7" x2="22.5" y1="19.7" y2="22.5" />
            <line x1="5.5" x2="8.3" y1="22.5" y2="19.7" />
            <line x1="19.7" x2="22.5" y1="8.3" y2="5.5" />
            <line x1="9.4" x2="10.8" y1="3.2" y2="6.8" />
            <line x1="17.2" x2="18.6" y1="21.2" y2="24.8" />
            <line x1="3.2" x2="6.8" y1="9.4" y2="10.8" />
            <line x1="21.2" x2="24.8" y1="17.2" y2="18.6" />
            <line x1="18.6" x2="17.2" y1="3.2" y2="6.8" />
            <line x1="10.8" x2="9.4" y1="21.2" y2="24.8" />
            <line x1="24.8" x2="21.2" y1="9.4" y2="10.8" />
            <line x1="6.8" x2="3.2" y1="17.2" y2="18.6" />
          </g>
        </svg>
      </div>
      {showBrand && <span className={textClass}>Whixte &amp; Co.</span>}
    </div>
  );
}
