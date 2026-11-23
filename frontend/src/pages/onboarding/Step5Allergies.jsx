import React from 'react';
import { MobileShell } from '../../components/layout/MobileShell';
import { BrandHeader } from '../../components/layout/BrandHeader';
import { useSamba } from '../../context/SambaContext';

const ALLERGIES = [
  {
    id: 'gluten',
    title: 'Sin gluten / Celíaco',
    desc: 'Trigo, cebada, centeno y derivados',
    icon: 'bakery_dining',
  },
  {
    id: 'lactosa',
    title: 'Lactosa / Lácteos',
    desc: 'Leche, quesos maduros y derivados lácteos',
    icon: 'water_drop',
  },
  {
    id: 'frutos_secos',
    title: 'Frutos secos / Cacahuates',
    desc: 'Nueces, almendras, avellanas y maní',
    icon: 'nutrition',
  },
  {
    id: 'pescados_mariscos',
    title: 'Pescados y mariscos',
    desc: 'Pescados azules, crustáceos y moluscos',
    icon: 'set_meal',
  },
  {
    id: 'huevo',
    title: 'Huevo',
    desc: 'Clara, yema y trazas presentes en preparaciones',
    icon: 'egg',
  },
];

const INJURIES = [
  { id: 'rodilla', label: 'Rodilla' },
  { id: 'lumbar', label: 'Zona lumbar' },
  { id: 'hombro', label: 'Hombro' },
  { id: 'tobillo', label: 'Tobillo' },
];

export function Step5Allergies() {
  const { onboarding, updateOnboarding, setScreen } = useSamba();

  function toggleAllergy(id) {
    const exists = onboarding.allergies.includes(id);
    const next = exists
      ? onboarding.allergies.filter((item) => item !== id)
      : [...onboarding.allergies, id];
    updateOnboarding({ allergies: next });
  }

  function toggleInjury(id) {
    const exists = onboarding.injuries.includes(id);
    const next = exists
      ? onboarding.injuries.filter((item) => item !== id)
      : [...onboarding.injuries, id];
    updateOnboarding({ injuries: next });
  }

  return (
    <MobileShell variant="mesh">
      <BrandHeader onBack={() => setScreen('onboarding-4')} />

      <section className="relative z-10 px-7 pt-4 pb-6 flex flex-col flex-1 justify-start text-left overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-2.5 mb-5">
          <div className="flex items-center justify-between text-[12px] font-bold tracking-wider">
            <span className="text-[#00B87C] uppercase tracking-widest font-extrabold">
              Paso 5 de 5
            </span>
            <span className="text-brand-subtle font-medium">100% completado</span>
          </div>
          <div className="w-full h-1.5 bg-emerald-900/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#00B87C] rounded-full w-full transition-all duration-300" />
          </div>
        </div>

        <div className="mb-4">
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-[#141b2b] tracking-tight leading-tight mb-2">
            ¿Tienes alguna alergia o intolerancia?
          </h1>
          <p className="text-[14px] leading-snug font-normal text-brand-secondary">
            Filtraremos tus recetas y planes nutricionales para que cada comida sea 100% segura para ti.
          </p>
        </div>

        <div className="flex flex-col gap-2 mb-3.5">
          {ALLERGIES.map((item) => {
            const selected = onboarding.allergies.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleAllergy(item.id)}
                className={`text-left rounded-2xl p-3 shadow-sm flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] ${
                  selected
                    ? 'bg-white border-2 border-[#00B87C]'
                    : 'bg-white/90 hover:bg-white border border-white/80'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      selected
                        ? 'bg-emerald-100/80 text-[#00B87C]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[14px] font-bold text-brand-heading leading-tight">
                        {item.title}
                      </h3>
                      {selected && (
                        <span className="text-[10px] font-bold text-[#006c49] bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          SELECCIONADO
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-brand-subtle mt-0.5 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                </div>
                <div className="ml-2 shrink-0">
                  {selected ? (
                    <div className="w-5 h-5 rounded-full bg-[#00B87C] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[14px] text-white font-bold">
                        check
                      </span>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selector compacto de lesiones para motor simbolico de Entreno */}
        <div className="bg-white/85 rounded-2xl p-3 border border-white/70 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-brand-heading">
              Protección articular / Lesiones (opcional)
            </span>
            <span className="text-[10.5px] text-brand-subtle font-medium">
              Excluye alto impacto
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {INJURIES.map((inj) => {
              const active = onboarding.injuries.includes(inj.id);
              return (
                <button
                  key={inj.id}
                  type="button"
                  onClick={() => toggleInjury(inj.id)}
                  className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition-all ${
                    active
                      ? 'bg-[#181A20] text-white'
                      : 'bg-white text-brand-subtle border border-slate-200 hover:border-[#00B87C]'
                  }`}
                >
                  {inj.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-white/70 rounded-2xl border border-white/60 mb-4">
          <span className="material-symbols-outlined text-[18px] text-[#00B87C] shrink-0">
            verified_user
          </span>
          <p className="text-[11.5px] text-brand-subtle leading-tight">
            <strong className="text-brand-heading font-semibold">
              Garantía culinaria inteligente:
            </strong>{' '}
            Samba filtra con reglas simbólicas estrictas para preservar tu seguridad alimentaria y articular.
          </p>
        </div>

        <div className="mt-auto pt-2 pb-1">
          <button
            type="button"
            onClick={() => setScreen('create-account')}
            className="w-full h-14 bg-[#181A20] hover:bg-[#232332] active:scale-[0.98] transition-all duration-150 rounded-full flex items-center justify-center gap-2 text-white text-[16px] font-bold tracking-wide shadow-md shadow-[#181A20]/20"
          >
            <span>Finalizar y crear plan</span>
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        </div>
      </section>
    </MobileShell>
  );
}
