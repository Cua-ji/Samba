import React from 'react';
import { MobileShell } from '../../components/layout/MobileShell';
import { BrandHeader } from '../../components/layout/BrandHeader';
import { useSamba } from '../../context/SambaContext';

const ACTIVITIES = [
  {
    id: 'sedentario',
    title: 'Sedentario',
    desc: 'Trabajo de escritorio, poco movimiento (< 5.000 pasos/día).',
    icon: 'chair',
  },
  {
    id: 'ligeramente',
    title: 'Ligeramente activo',
    badge: 'HABITUAL',
    desc: 'Caminatas suaves, recados cotidianos (5.000 – 8.000 pasos).',
    icon: 'directions_walk',
  },
  {
    id: 'moderado',
    title: 'Moderadamente activo',
    desc: 'De pie la mayor parte del día, tareas dinámicas (8.000 – 12.000 pasos).',
    icon: 'directions_run',
  },
  {
    id: 'muy_activo',
    title: 'Muy activo / Atleta',
    desc: 'Trabajo físico intenso o alta movilidad continua (> 12.000 pasos).',
    icon: 'fitness_center',
  },
];

export function Step4Activity() {
  const { onboarding, updateOnboarding, setScreen } = useSamba();

  return (
    <MobileShell variant="mesh">
      <BrandHeader onBack={() => setScreen('onboarding-3')} />

      <section className="relative z-10 px-5 sm:px-7 pt-3 pb-4 flex flex-col flex-1 min-h-0 justify-start text-left overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-2.5 mb-5">
          <div className="flex items-center justify-between text-[12px] font-bold tracking-wider">
            <span className="text-[#00B87C] uppercase tracking-widest font-extrabold">
              Paso 4 de 5
            </span>
            <span className="text-brand-subtle font-medium">80% completado</span>
          </div>
          <div className="w-full h-1.5 bg-emerald-900/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#00B87C] rounded-full w-[80%] transition-all duration-300" />
          </div>
        </div>

        <div className="mb-5">
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-[#141b2b] tracking-tight leading-tight mb-2">
            ¿Cuál es tu nivel de actividad?
          </h1>
          <p className="text-[14px] leading-snug font-normal text-brand-secondary">
            Sin contar tus entrenamientos programados (tu rutina y movimiento habitual durante el día).
          </p>
        </div>

        <div className="flex flex-col gap-2.5 mb-3.5">
          {ACTIVITIES.map((act) => {
            const selected = onboarding.activityLevel === act.id;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => updateOnboarding({ activityLevel: act.id })}
                className={`text-left rounded-2xl p-3.5 shadow-sm flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] ${
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
                    <span className="material-symbols-outlined text-[20px]">{act.icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[14px] font-bold text-brand-heading leading-tight">
                        {act.title}
                      </h3>
                      {act.badge && (
                        <span className="text-[10px] font-bold text-[#006c49] bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {act.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-brand-subtle mt-0.5 leading-snug">
                      {act.desc}
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

        <div className="flex items-center gap-2 p-3 bg-white/70 rounded-2xl border border-white/60 mb-2">
          <span className="material-symbols-outlined text-[18px] text-[#00B87C] shrink-0">
            insights
          </span>
          <p className="text-[11.5px] text-brand-subtle leading-tight">
            Ajustaremos tus calorías y macronutrientes diarios según tu gasto energético basal y este nivel de actividad.
          </p>
        </div>
      </section>

      <footer className="relative z-10 px-5 sm:px-7 pt-2 pb-4 safe-bottom bg-gradient-to-t from-[#c6ecdc] via-[#d5f7e8]/95 to-transparent shrink-0">
        <button
          type="button"
          onClick={() => setScreen('onboarding-5')}
          className="w-full h-14 bg-[#181A20] hover:bg-[#232332] active:scale-[0.98] transition-all duration-150 rounded-full flex items-center justify-center gap-2 text-white text-[16px] font-bold tracking-wide shadow-md shadow-[#181A20]/20"
        >
          <span>Continuar</span>
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
      </footer>
    </MobileShell>
  );
}
