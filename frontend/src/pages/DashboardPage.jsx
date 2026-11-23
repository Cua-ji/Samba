import React, { useMemo, useState } from 'react';
import { AppTopBar } from '../components/layout/AppTopBar';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export function DashboardPage() {
  const {
    user,
    setUser,
    metabolism,
    todayLog,
    setActiveTab,
    openChatWithPrompt,
  } = useSamba();

  const [selectedOffset, setSelectedOffset] = useState(0);
  const [showFormula, setShowFormula] = useState(false);
  const [updatingWater, setUpdatingWater] = useState(false);

  const weekDays = useMemo(() => {
    const today = new Date();
    return [-2, -1, 0, 1, 2, 3, 4].map((offset) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      return {
        offset,
        letter: DAY_LETTERS[d.getDay()],
        dayNum: d.getDate(),
        hasLog: offset <= 0,
      };
    });
  }, []);

  if (!user || !metabolism) return null;

  const firstName = user.name.split(' ')[0];
  const targetCalories = metabolism.targetCalories || 2000;
  const consumedCalories = todayLog?.caloriesConsumed || 0;
  const remainingCalories = Math.max(0, targetCalories - consumedCalories);
  const overCalories = consumedCalories > targetCalories;

  const progressRatio = Math.min(1, consumedCalories / Math.max(1, targetCalories));
  const circumference = 2 * Math.PI * 41; // r = 41 -> ~257.61
  const strokeDashoffset = circumference * (1 - progressRatio);

  const proteinTarget = metabolism.macrosTarget?.protein || 140;
  const carbsTarget = metabolism.macrosTarget?.carbs || 200;
  const fatTarget = metabolism.macrosTarget?.fat || 60;

  const proteinConsumed = todayLog?.proteinConsumed || 0;
  const carbsConsumed = todayLog?.carbsConsumed || 0;
  const fatConsumed = todayLog?.fatConsumed || 0;

  const proteinPct = Math.min(100, Math.round((proteinConsumed / proteinTarget) * 100));
  const carbsPct = Math.min(100, Math.round((carbsConsumed / carbsTarget) * 100));
  const fatPct = Math.min(100, Math.round((fatConsumed / fatTarget) * 100));

  async function handleAddWater() {
    if (updatingWater) return;
    const next = Math.min(3.5, Number(((user.hydrationLiters || 0) + 0.25).toFixed(2)));
    setUpdatingWater(true);
    try {
      const res = await api.updateProfile(user.id, { hydrationLiters: next });
      setUser(res.user);
    } finally {
      setUpdatingWater(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar">
      <AppTopBar title="INICIO" />

      <div className="flex flex-col w-full px-margin pt-4 pb-6 space-y-4">
        {/* Saludo & Tira semanal */}
        <section className="flex flex-col space-y-3">
          <div className="flex flex-col">
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Hola, {firstName}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Este es tu plan de hoy ({metabolism.goalLabel})
            </p>
          </div>

          <div className="flex items-center justify-between gap-1.5 pt-1">
            {weekDays.map((day) => {
              const isSelected = selectedOffset === day.offset;
              return (
                <button
                  key={day.offset}
                  type="button"
                  onClick={() => setSelectedOffset(day.offset)}
                  className={`flex flex-col items-center justify-center flex-1 rounded-2xl transition-all ${
                    isSelected
                      ? 'py-3 bg-[#181A20] text-white shadow-[0_8px_20px_-4px_rgba(24,26,32,0.3)] scale-105'
                      : 'py-2.5 bg-white/85 text-on-surface-variant hover:bg-white'
                  }`}
                >
                  <span
                    className={`font-label-sm text-label-sm uppercase ${
                      isSelected ? 'text-primary-fixed' : 'opacity-70'
                    }`}
                  >
                    {day.letter}
                  </span>
                  <span
                    className={`font-headline-sm text-headline-sm mt-0.5 font-extrabold tabular-nums ${
                      isSelected ? 'text-white' : 'text-on-surface'
                    }`}
                  >
                    {day.dayNum}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${
                      isSelected
                        ? 'bg-primary-fixed'
                        : day.hasLog
                        ? 'bg-[#00B87C]'
                        : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </section>

        {/* Tarjeta Balance Calorico (Mifflin-St Jeor + Anillo SVG + Macros) */}
        <section className="bg-white rounded-3xl p-5 shadow-[0_8px_24px_-4px_rgba(17,24,39,0.06),0_4px_12px_-2px_rgba(0,184,124,0.08)] flex flex-col space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">
                vital_signs
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Balance Calórico
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowFormula((v) => !v)}
              className="px-2.5 py-1 rounded-full bg-primary-fixed/40 text-on-primary-fixed-variant font-label-sm text-label-sm font-bold flex items-center gap-1 whitespace-nowrap"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00B87C]" />
              {overCalories ? 'Meta superada' : 'En objetivo'}
            </button>
          </div>

          {showFormula && (
            <div className="rounded-2xl bg-[#F4FBF7] border border-[#CBF3DB] p-3 text-[11.5px] text-[#3c4a42] leading-snug">
              {metabolism.formulaSummary}
            </div>
          )}

          {/* Anillo SVG dinamico */}
          <div className="flex items-center gap-5 pt-1">
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  className="stroke-surface-container"
                  cx="50"
                  cy="50"
                  fill="none"
                  r="41"
                  strokeWidth="9"
                />
                <circle
                  className="stroke-[#00B87C] transition-all duration-500"
                  cx="50"
                  cy="50"
                  fill="none"
                  r="41"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  strokeWidth="9"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-label-sm text-[10px] uppercase text-on-surface-variant font-semibold">
                  Consumidas
                </span>
                <span className="font-headline-md text-[21px] text-on-surface font-extrabold leading-tight tabular-nums">
                  {consumedCalories.toLocaleString('es-MX')}
                </span>
                <span className="font-label-sm text-[10.5px] text-on-surface-variant/80">
                  kcal
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-center flex-1 space-y-2">
              <div className="p-3 rounded-2xl bg-surface-container-low flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Restante
                  </span>
                  <span className="font-headline-sm text-headline-sm text-tertiary font-bold tabular-nums">
                    {remainingCalories.toLocaleString('es-MX')} kcal
                  </span>
                </div>
                <span className="material-symbols-outlined text-tertiary-container text-[24px]">
                  flag
                </span>
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Meta Mifflin-St Jeor
                </span>
                <span className="font-label-md text-label-md text-on-surface font-bold tabular-nums">
                  {targetCalories.toLocaleString('es-MX')} kcal
                </span>
              </div>
            </div>
          </div>

          {/* Desglose de Macronutrientes */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="flex flex-col p-2.5 rounded-2xl bg-surface-container-low/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Proteína
                </span>
                <span className="font-label-sm text-label-sm font-bold text-tertiary tabular-nums">
                  {proteinPct}%
                </span>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#00B87C] h-full rounded-full transition-all duration-300"
                  style={{ width: `${proteinPct}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between pt-0.5 tabular-nums">
                <span className="font-label-md text-label-md font-bold text-on-surface">
                  {proteinConsumed}g
                </span>
                <span className="font-body-sm text-[10px] text-on-surface-variant">
                  / {proteinTarget}g
                </span>
              </div>
            </div>

            <div className="flex flex-col p-2.5 rounded-2xl bg-surface-container-low/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Carbos
                </span>
                <span className="font-label-sm text-label-sm font-bold text-[#006c49] tabular-nums">
                  {carbsPct}%
                </span>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-tertiary-fixed-dim h-full rounded-full transition-all duration-300"
                  style={{ width: `${carbsPct}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between pt-0.5 tabular-nums">
                <span className="font-label-md text-label-md font-bold text-on-surface">
                  {carbsConsumed}g
                </span>
                <span className="font-body-sm text-[10px] text-on-surface-variant">
                  / {carbsTarget}g
                </span>
              </div>
            </div>

            <div className="flex flex-col p-2.5 rounded-2xl bg-surface-container-low/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Grasas
                </span>
                <span className="font-label-sm text-label-sm font-bold text-secondary tabular-nums">
                  {fatPct}%
                </span>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-secondary h-full rounded-full transition-all duration-300"
                  style={{ width: `${fatPct}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between pt-0.5 tabular-nums">
                <span className="font-label-md text-label-md font-bold text-on-surface">
                  {fatConsumed}g
                </span>
                <span className="font-body-sm text-[10px] text-on-surface-variant">
                  / {fatTarget}g
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tarjeta Asistente RAG Neuro-Simbolico (DESIGN.md) */}
        <section className="rounded-3xl p-4 bg-gradient-to-br from-[#E8F9EF] to-[#FFFFFF] border border-[#CBF3DB] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#CBF3DB] text-[#2E7D5B] text-[10.5px] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B]" />
              SAMBA AI
            </span>
            <span className="text-[11px] font-semibold text-[#4A7265]">
              RAG Neuro-Simbólico
            </span>
          </div>
          <p className="text-[13px] text-[#18181B] leading-snug">
            Pregunta sobre tus platillos por presupuesto, alergias o por qué ciertas rutinas fueron descartadas por tu seguridad articular.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openChatWithPrompt('')}
              className="flex-1 h-11 rounded-full bg-[#181A20] hover:bg-[#232332] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
              <span>Abrir Chat IA</span>
            </button>
            <button
              type="button"
              onClick={() => openChatWithPrompt('¿Qué puedo cenar hoy barato?')}
              className="px-3.5 h-11 rounded-full bg-[#CBF3DB] text-[#18181B] text-[12px] font-semibold hover:bg-[#b5ebd0] transition-colors whitespace-nowrap"
            >
              ¿Cena barata?
            </button>
          </div>
        </section>

        {/* Accesos rapidos y widget de hidratacion */}
        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('platillo')}
            className="bg-white rounded-3xl p-4 shadow-sm border border-white/80 text-left flex flex-col justify-between gap-2 hover:shadow-md transition-all"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#E8F9EF] text-[#006c49] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">restaurant</span>
            </div>
            <div>
              <p className="text-[13.5px] font-bold text-on-surface">Elegir Platillo</p>
              <p className="text-[11px] text-on-surface-variant">
                {todayLog?.chosenMeals?.length || 0} comidas hoy
              </p>
            </div>
          </button>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-white/80 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-2xl bg-[#E8F9EF] text-[#006c49] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">water_drop</span>
              </div>
              <button
                type="button"
                disabled={updatingWater}
                onClick={handleAddWater}
                className="px-2.5 py-1 rounded-full bg-[#181A20] text-white text-[11px] font-bold active:scale-95 transition-transform"
              >
                +0.25 L
              </button>
            </div>
            <div>
              <p className="text-[13.5px] font-bold text-on-surface tabular-nums">
                {(user.hydrationLiters || 0).toFixed(2)} / 2.50 L
              </p>
              <p className="text-[11px] text-on-surface-variant">Hidratación diaria</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
