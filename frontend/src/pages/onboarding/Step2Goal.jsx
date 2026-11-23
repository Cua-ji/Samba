import React from 'react';
import { MobileShell } from '../../components/layout/MobileShell';
import { BrandHeader } from '../../components/layout/BrandHeader';
import { useSamba } from '../../context/SambaContext';

const GOALS = [
  {
    id: 'perder_grasa',
    title: 'Perder grasa & definir',
    desc: 'Déficit calórico estratégico protegiendo tu masa muscular',
    icon: 'local_fire_department',
  },
  {
    id: 'ganar_masa',
    title: 'Ganar masa muscular',
    desc: 'Superávit progresivo para maximizar fuerza e hipertrofia',
    icon: 'fitness_center',
  },
  {
    id: 'recomposicion',
    title: 'Recomposición corporal',
    desc: 'Quemar grasa y tonificar de manera equilibrada',
    icon: 'balance',
  },
  {
    id: 'salud_vitalidad',
    title: 'Mejorar salud y vitalidad',
    desc: 'Equilibrio metabólico, más energía y bienestar general',
    icon: 'favorite',
  },
];

export function Step2Goal() {
  const { onboarding, updateOnboarding, setScreen } = useSamba();

  return (
    <MobileShell variant="mesh">
      <BrandHeader onBack={() => setScreen('onboarding-1')} />

      <section className="relative z-10 px-7 pt-4 pb-6 flex flex-col flex-1 justify-start text-left overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-2.5 mb-5">
          <div className="flex items-center justify-between text-[12px] font-bold tracking-wider">
            <span className="text-[#00B87C] uppercase tracking-widest font-extrabold">
              Paso 2 de 5
            </span>
            <span className="text-brand-subtle font-medium">40% completado</span>
          </div>
          <div className="w-full h-1.5 bg-emerald-900/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#00B87C] rounded-full w-[40%] transition-all duration-300" />
          </div>
        </div>

        <div className="mb-5">
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-brand-heading tracking-tight leading-tight mb-2">
            ¿Cuál es tu objetivo?
          </h1>
          <p className="text-[14px] leading-snug font-normal text-brand-secondary">
            Selecciona tu meta para personalizar tus calorías, recetas y rutinas diarias.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 mb-3.5">
          {GOALS.map((goal) => {
            const selected = onboarding.goal === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => updateOnboarding({ goal: goal.id })}
                className={`text-left rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 ${
                  selected
                    ? 'bg-white border-2 border-[#00B87C]'
                    : 'bg-white/90 hover:bg-white border border-white/80 hover:border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-emerald-100/70 text-[#00B87C] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">{goal.icon}</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-brand-heading leading-tight">
                      {goal.title}
                    </p>
                    <p className="text-[11.5px] text-brand-subtle leading-tight mt-0.5">
                      {goal.desc}
                    </p>
                  </div>
                </div>
                {selected ? (
                  <div className="w-5 h-5 rounded-full bg-[#00B87C] text-white flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[15px] font-bold">check</span>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 p-3 bg-white/70 rounded-2xl border border-white/60 mb-4">
          <span className="material-symbols-outlined text-[18px] text-[#00B87C] shrink-0">
            verified
          </span>
          <p className="text-[11.5px] text-brand-subtle leading-tight">
            Podrás recalibrar o cambiar de objetivo en cualquier momento desde tu perfil.
          </p>
        </div>

        <div className="mt-auto pt-2 pb-1">
          <button
            type="button"
            onClick={() => setScreen('onboarding-3')}
            className="w-full h-14 bg-[#181A20] hover:bg-[#232332] active:scale-[0.98] transition-all duration-150 rounded-full flex items-center justify-center gap-2 text-white text-[16px] font-bold tracking-wide shadow-md shadow-[#181A20]/20"
          >
            <span>Continuar</span>
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        </div>
      </section>
    </MobileShell>
  );
}
