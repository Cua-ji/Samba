import React from 'react';
import { MobileShell } from '../components/layout/MobileShell';
import { BrandHeader } from '../components/layout/BrandHeader';
import { useSamba } from '../context/SambaContext';

export function WelcomePage() {
  const { setScreen } = useSamba();

  return (
    <MobileShell variant="mesh">
      <BrandHeader />

      <section
        className="relative z-10 px-8 py-8 flex flex-col justify-center items-start text-left flex-1"
        data-purpose="hero-copy"
      >
        <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-brand-heading/90 leading-tight mb-1">
          Bienvenido a
        </h2>
        <h1 className="text-5xl sm:text-[56px] font-extrabold text-brand-heading tracking-tight leading-none mb-5">
          Samba
        </h1>
        <p className="text-[17px] sm:text-[18px] leading-snug font-normal text-brand-secondary max-w-[270px]">
          Nutrición personalizada para cada tipo de motivación
        </p>
      </section>

      <footer className="relative z-10 px-8 pb-10 safe-bottom flex flex-col items-center w-full gap-6">
        <button
          type="button"
          onClick={() => setScreen('onboarding-1')}
          className="w-full max-w-[280px] h-14 bg-[#181A20] hover:bg-[#232332] active:scale-[0.98] transition-all duration-150 rounded-full flex items-center justify-center text-white text-[19px] font-semibold tracking-wide shadow-md shadow-[#181A20]/20"
        >
          Iniciar
        </button>

        <div className="flex items-center justify-center gap-2 text-[14px]">
          <span className="text-brand-subtle font-medium">¿Ya tienes una cuenta?</span>
          <button
            type="button"
            onClick={() => setScreen('login')}
            className="bg-white/95 hover:bg-white text-brand-heading font-semibold px-3 py-1.5 rounded-md text-[13.5px] shadow-sm hover:shadow active:scale-95 transition-all duration-150 inline-flex items-center justify-center"
          >
            Iniciar sesión
          </button>
        </div>
      </footer>
    </MobileShell>
  );
}
