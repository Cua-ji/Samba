import React, { useState } from 'react';
import { MobileShell } from '../../components/layout/MobileShell';
import { BrandHeader } from '../../components/layout/BrandHeader';
import { useSamba } from '../../context/SambaContext';

export function Step1Name() {
  const { onboarding, updateOnboarding, setScreen } = useSamba();
  const [error, setError] = useState('');

  function handleContinue() {
    if (onboarding.name.trim().length < 2) {
      setError('Por favor ingresa tu nombre (mínimo 2 caracteres).');
      return;
    }
    setError('');
    setScreen('onboarding-2');
  }

  return (
    <MobileShell variant="mesh">
      <BrandHeader onBack={() => setScreen('welcome')} />

      <section className="relative z-10 px-5 sm:px-7 pt-3 pb-4 flex flex-col flex-1 min-h-0 justify-start text-left overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-2.5 mb-5">
          <div className="flex items-center justify-between text-[12px] font-bold tracking-wider">
            <span className="text-[#00B87C] uppercase tracking-widest font-extrabold">
              Paso 1 de 5
            </span>
            <span className="text-brand-subtle font-medium">20% completado</span>
          </div>
          <div className="w-full h-1.5 bg-emerald-900/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#00B87C] rounded-full w-[20%] transition-all duration-300" />
          </div>
        </div>

        <div className="mb-5">
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-brand-heading tracking-tight leading-tight mb-2">
            ¿Cómo te llamas?
          </h1>
          <p className="text-[14px] leading-snug font-normal text-brand-secondary">
            Queremos personalizar tu plan de nutrición y entrenamiento desde el primer día.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-white/80 flex flex-col gap-3.5 mb-4">
          <label className="text-[13px] font-bold text-brand-heading" htmlFor="onboarding-name">
            Tu nombre de pila
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-4 text-brand-subtle pointer-events-none flex items-center">
              <span className="material-symbols-outlined text-[20px] text-[#4A7265]">person</span>
            </div>
            <input
              id="onboarding-name"
              type="text"
              autoFocus
              value={onboarding.name}
              onChange={(e) => {
                updateOnboarding({ name: e.target.value });
                if (error) setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
              placeholder="Ej. Alejandro"
              className="w-full py-3.5 pl-12 pr-4 bg-[#F8FAF9] focus:bg-white rounded-2xl border border-slate-200/80 focus:border-[#00B87C] focus:outline-none focus:ring-2 focus:ring-emerald-400/20 text-brand-heading font-medium text-[15px] placeholder:text-slate-400 transition-all"
            />
          </div>
          {error && <p className="text-[12px] font-semibold text-error">{error}</p>}
          <div className="flex items-start gap-2 pt-1">
            <span className="material-symbols-outlined text-[17px] text-[#00B87C] shrink-0 mt-0.5">
              verified_user
            </span>
            <p className="text-[12px] text-brand-subtle leading-tight">
              Usaremos tu nombre para saludar y personalizar tus recetas y rutinas diarias.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-2">
          <div className="bg-white/80 rounded-2xl p-3 border border-white/60 flex items-center gap-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-emerald-100/70 text-[#00B87C] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-brand-heading leading-tight">
                100% Personalizado
              </p>
              <p className="text-[10.5px] text-brand-subtle leading-tight">
                Recetas y rutinas para ti
              </p>
            </div>
          </div>
          <div className="bg-white/80 rounded-2xl p-3 border border-white/60 flex items-center gap-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-emerald-100/70 text-[#00B87C] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">shield</span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-brand-heading leading-tight">
                Datos protegidos
              </p>
              <p className="text-[10.5px] text-brand-subtle leading-tight">
                Privacidad garantizada
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-5 sm:px-7 pt-2 pb-4 safe-bottom bg-gradient-to-t from-[#c6ecdc] via-[#d5f7e8]/95 to-transparent shrink-0">
        <button
          type="button"
          onClick={handleContinue}
          className="w-full h-14 bg-[#181A20] hover:bg-[#232332] active:scale-[0.98] transition-all duration-150 rounded-full flex items-center justify-center gap-2 text-white text-[16px] font-bold tracking-wide shadow-md shadow-[#181A20]/20"
        >
          <span>Continuar</span>
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
      </footer>
    </MobileShell>
  );
}
