import React, { useMemo, useState } from 'react';
import { MobileShell } from '../../components/layout/MobileShell';
import { BrandHeader } from '../../components/layout/BrandHeader';
import { useSamba } from '../../context/SambaContext';

function computeIMC(weightKg, heightCm) {
  const w = Math.max(30, Number(weightKg) || 70);
  const hM = Math.max(1.2, (Number(heightCm) || 170) / 100);
  const bmi = Number((w / (hM * hM)).toFixed(1));
  let label = 'Saludable';
  if (bmi < 18.5) label = 'Bajo peso';
  else if (bmi < 25) label = 'Saludable';
  else if (bmi < 30) label = 'Sobrepeso';
  else label = 'Obesidad';
  return { bmi, label };
}

export function Step3Physical() {
  const { onboarding, updateOnboarding, setScreen } = useSamba();
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');

  const imc = useMemo(
    () => computeIMC(onboarding.weightKg, onboarding.heightCm),
    [onboarding.weightKg, onboarding.heightCm]
  );

  const displayWeight =
    weightUnit === 'kg'
      ? onboarding.weightKg.toFixed(1)
      : (onboarding.weightKg * 2.20462).toFixed(1);

  const totalInches = Math.round(onboarding.heightCm / 2.54);
  const feetPart = Math.floor(totalInches / 12);
  const inchPart = totalInches % 12;
  const displayHeight =
    heightUnit === 'cm'
      ? Math.round(onboarding.heightCm)
      : `${feetPart}'${inchPart}"`;

  function adjustAge(delta) {
    const next = Math.min(90, Math.max(15, onboarding.age + delta));
    updateOnboarding({ age: next });
  }

  function adjustWeight(direction) {
    if (weightUnit === 'kg') {
      const nextKg = Math.min(220, Math.max(35, Number((onboarding.weightKg + direction * 0.5).toFixed(1))));
      updateOnboarding({ weightKg: nextKg });
    } else {
      const currentLb = onboarding.weightKg * 2.20462;
      const nextLb = Math.min(485, Math.max(77, currentLb + direction * 1.0));
      updateOnboarding({ weightKg: Number((nextLb / 2.20462).toFixed(2)) });
    }
  }

  function adjustHeight(direction) {
    if (heightUnit === 'cm') {
      const nextCm = Math.min(220, Math.max(130, Math.round(onboarding.heightCm + direction)));
      updateOnboarding({ heightCm: nextCm });
    } else {
      const nextInches = Math.min(87, Math.max(51, totalInches + direction));
      updateOnboarding({ heightCm: Number((nextInches * 2.54).toFixed(1)) });
    }
  }

  return (
    <MobileShell variant="mesh">
      <BrandHeader onBack={() => setScreen('onboarding-2')} />

      <section className="relative z-10 px-5 sm:px-7 pt-3 pb-4 flex flex-col flex-1 min-h-0 justify-start text-left overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-2.5 mb-5">
          <div className="flex items-center justify-between text-[12px] font-bold tracking-wider">
            <span className="text-[#00B87C] uppercase tracking-widest font-extrabold">
              Paso 3 de 5
            </span>
            <span className="text-brand-subtle font-medium">60% completado</span>
          </div>
          <div className="w-full h-1.5 bg-emerald-900/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#00B87C] rounded-full w-[60%] transition-all duration-300" />
          </div>
        </div>

        <div className="mb-4">
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-brand-heading tracking-tight leading-tight mb-2">
            Tus datos físicos
          </h1>
          <p className="text-[14px] leading-snug font-normal text-brand-secondary">
            Necesarios para calcular tu gasto calórico basal y tasa metabólica exacta.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 mb-3.5">
          {/* Sexo y Edad */}
          <div className="bg-white/95 rounded-2xl p-3.5 shadow-sm border border-white/80 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-brand-heading">Sexo y Edad</span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-full">
                <button
                  type="button"
                  onClick={() => updateOnboarding({ sex: 'hombre' })}
                  className={`px-3.5 py-1.5 min-h-[34px] rounded-full text-[12px] transition-all ${
                    onboarding.sex === 'hombre'
                      ? 'bg-[#181A20] text-white font-bold shadow-sm'
                      : 'text-brand-subtle hover:text-brand-heading font-medium'
                  }`}
                >
                  Hombre
                </button>
                <button
                  type="button"
                  onClick={() => updateOnboarding({ sex: 'mujer' })}
                  className={`px-3.5 py-1.5 min-h-[34px] rounded-full text-[12px] transition-all ${
                    onboarding.sex === 'mujer'
                      ? 'bg-[#181A20] text-white font-bold shadow-sm'
                      : 'text-brand-subtle hover:text-brand-heading font-medium'
                  }`}
                >
                  Mujer
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-[12px] text-brand-subtle font-medium">Edad cumplida</span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label="Disminuir edad"
                  onClick={() => adjustAge(-1)}
                  className="w-10 h-10 rounded-full bg-emerald-100/70 text-[#00B87C] flex items-center justify-center active:scale-95 text-lg font-bold"
                >
                  -
                </button>
                <div className="flex items-baseline gap-1 min-w-[64px] justify-center tabular-nums">
                  <span className="text-[22px] font-extrabold text-brand-heading">
                    {onboarding.age}
                  </span>
                  <span className="text-[11px] font-bold text-brand-subtle uppercase">Años</span>
                </div>
                <button
                  type="button"
                  aria-label="Aumentar edad"
                  onClick={() => adjustAge(1)}
                  className="w-10 h-10 rounded-full bg-emerald-100/70 text-[#00B87C] flex items-center justify-center active:scale-95 text-lg font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Peso actual */}
          <div className="bg-white/95 rounded-2xl p-3.5 shadow-sm border border-white/80 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#00B87C]">scale</span>
                <span className="text-[13px] font-bold text-brand-heading">Peso actual</span>
              </div>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-full">
                <button
                  type="button"
                  onClick={() => setWeightUnit('kg')}
                  className={`px-3 py-1 min-h-[32px] rounded-full text-[11.5px] transition-all ${
                    weightUnit === 'kg'
                      ? 'bg-[#181A20] text-white font-bold shadow-sm'
                      : 'text-brand-subtle font-medium'
                  }`}
                >
                  kg
                </button>
                <button
                  type="button"
                  onClick={() => setWeightUnit('lb')}
                  className={`px-3 py-1 min-h-[32px] rounded-full text-[11.5px] transition-all ${
                    weightUnit === 'lb'
                      ? 'bg-[#181A20] text-white font-bold shadow-sm'
                      : 'text-brand-subtle font-medium'
                  }`}
                >
                  lb
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-[11px] text-brand-subtle">Precisión decimal</span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label="Disminuir peso"
                  onClick={() => adjustWeight(-1)}
                  className="w-10 h-10 rounded-full bg-emerald-100/70 text-[#00B87C] flex items-center justify-center active:scale-95 text-lg font-bold"
                >
                  -
                </button>
                <div className="flex items-baseline gap-1 min-w-[74px] justify-center tabular-nums">
                  <span className="text-[22px] font-extrabold text-brand-heading">
                    {displayWeight}
                  </span>
                  <span className="text-[11px] font-bold text-brand-subtle uppercase">
                    {weightUnit}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Aumentar peso"
                  onClick={() => adjustWeight(1)}
                  className="w-10 h-10 rounded-full bg-emerald-100/70 text-[#00B87C] flex items-center justify-center active:scale-95 text-lg font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Estatura */}
          <div className="bg-white/95 rounded-2xl p-3.5 shadow-sm border border-white/80 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#00B87C]">
                  straighten
                </span>
                <span className="text-[13px] font-bold text-brand-heading">Estatura</span>
              </div>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-full">
                <button
                  type="button"
                  onClick={() => setHeightUnit('cm')}
                  className={`px-3 py-1 min-h-[32px] rounded-full text-[11.5px] transition-all ${
                    heightUnit === 'cm'
                      ? 'bg-[#181A20] text-white font-bold shadow-sm'
                      : 'text-brand-subtle font-medium'
                  }`}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() => setHeightUnit('ft')}
                  className={`px-3 py-1 min-h-[32px] rounded-full text-[11.5px] transition-all ${
                    heightUnit === 'ft'
                      ? 'bg-[#181A20] text-white font-bold shadow-sm'
                      : 'text-brand-subtle font-medium'
                  }`}
                >
                  ft
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-[11px] text-brand-subtle">Altura de pie</span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label="Disminuir estatura"
                  onClick={() => adjustHeight(-1)}
                  className="w-10 h-10 rounded-full bg-emerald-100/70 text-[#00B87C] flex items-center justify-center active:scale-95 text-lg font-bold"
                >
                  -
                </button>
                <div className="flex items-baseline gap-1 min-w-[74px] justify-center tabular-nums">
                  <span className="text-[22px] font-extrabold text-brand-heading">
                    {displayHeight}
                  </span>
                  <span className="text-[11px] font-bold text-brand-subtle uppercase">
                    {heightUnit}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Aumentar estatura"
                  onClick={() => adjustHeight(1)}
                  className="w-10 h-10 rounded-full bg-emerald-100/70 text-[#00B87C] flex items-center justify-center active:scale-95 text-lg font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* IMC Estimado dinamico en vivo */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-100/70 rounded-xl border border-emerald-200/60">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[17px] text-[#00B87C]">
                monitoring
              </span>
              <span className="text-[12px] font-bold text-brand-heading tabular-nums">
                IMC Estimado: {imc.bmi} kg/m²
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#006c49] bg-white/90 px-2.5 py-0.5 rounded-full">
              {imc.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-white/70 rounded-2xl border border-white/60 mb-2">
          <span className="material-symbols-outlined text-[18px] text-[#00B87C] shrink-0">
            verified_user
          </span>
          <p className="text-[11.5px] text-brand-subtle leading-tight">
            Tus datos biométricos están protegidos y solo se usan para tu plan nutricional.
          </p>
        </div>
      </section>

      <footer className="relative z-10 px-5 sm:px-7 pt-2 pb-4 safe-bottom bg-gradient-to-t from-[#c6ecdc] via-[#d5f7e8]/95 to-transparent shrink-0">
        <button
          type="button"
          onClick={() => setScreen('onboarding-4')}
          className="w-full h-14 bg-[#181A20] hover:bg-[#232332] active:scale-[0.98] transition-all duration-150 rounded-full flex items-center justify-center gap-2 text-white text-[16px] font-bold tracking-wide shadow-md shadow-[#181A20]/20"
        >
          <span>Continuar</span>
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
      </footer>
    </MobileShell>
  );
}
