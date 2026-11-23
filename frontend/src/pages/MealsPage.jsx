import React, { useCallback, useEffect, useState } from 'react';
import { AppTopBar } from '../components/layout/AppTopBar';
import { DishVisual } from '../components/meals/DishVisual';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

const MEAL_TIMES = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'cena', label: 'Cena' },
];

const BUDGET_BADGES = {
  bajo: 'PRESUPUESTO BAJO',
  medio: 'PRESUPUESTO MEDIO • SUGERIDO',
  alto: 'PRESUPUESTO ALTO',
};

export function MealsPage({ refreshTrigger }) {
  const { user, setUser, setTodayLog } = useSamba();
  const [mealTime, setMealTime] = useState('almuerzo');
  const [data, setData] = useState(null);
  const [baseIndex, setBaseIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [openWhyId, setOpenWhyId] = useState(null);
  const [showDiscarded, setShowDiscarded] = useState(false);

  const loadMeals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.getMeals(user.id, mealTime);
      setData(res);
      setBaseIndex(0);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, mealTime]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals, refreshTrigger]);

  if (!user) return null;

  const baseDishes = data?.baseDishes || [];
  const activeBase = baseDishes[baseIndex] || null;
  const mealGoal = data?.mealGoal || { min: 520, max: 650 };
  const discardedMeals = data?.discardedMeals || [];

  async function handleAffinity(mealId, action) {
    setActionId(`${mealId}_${action}`);
    setFeedback('');
    try {
      const res = await api.setMealAffinity(user.id, mealId, action);
      setUser(res.user);
      setTodayLog(res.todayLog);
      setData({ mealTime, ...res.evaluation });
      if (action === 'choose') {
        setFeedback(
          res.affinityRecord.isFavorite
            ? 'Platillo elegido (+2 pts) y marcado como Favorito. Balance diario actualizado.'
            : 'Platillo elegido (+2 pts). Balance diario actualizado.'
        );
      } else {
        setFeedback(
          res.affinityRecord.lowPriority
            ? 'Platillo ignorado (-1 pt). Prioridad reducida tras >= 2 descartes.'
            : 'Platillo ignorado (-1 pt). Preferencia registrada.'
        );
      }
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleGenerateAiMeal() {
    if (generatingAi) return;
    setGeneratingAi(true);
    setFeedback('');
    try {
      const res = await api.generateAiMeal(user.id, mealTime);
      setUser(res.user);
      setData({ mealTime, ...res.evaluation });
      setBaseIndex(0);
      setFeedback(
        `Menú IA (${res.generated.modelUsed} + USDA FoodData Central) validado por el Motor Simbólico y guardado en PostgreSQL.`
      );
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setGeneratingAi(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar">
      <AppTopBar title="PLATILLO" />

      <div className="flex flex-col w-full px-margin pt-4 pb-6 space-y-4">
        <section className="flex flex-col gap-1">
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Opciones del día
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Elige el menú que mejor se adapte a tu presupuesto y restricciones.
          </p>
        </section>

        {/* Selector Desayuno / Almuerzo / Cena */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {MEAL_TIMES.map((mt) => {
            const active = mealTime === mt.id;
            return (
              <button
                key={mt.id}
                type="button"
                onClick={() => setMealTime(mt.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-label-md font-label-md shadow-sm transition-all flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#181A20] text-white'
                    : 'bg-white text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {active && <span className="w-2 h-2 rounded-full bg-[#00B87C]" />}
                <span>{mt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Meta Calorica (sin superposiciones) */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white shadow-sm gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[22px]">local_fire_department</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Meta de {mealTime}
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold tabular-nums">
                {mealGoal.min} – {mealGoal.max} kcal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high text-primary font-label-md text-label-md shrink-0 whitespace-nowrap">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Balanceado</span>
          </div>
        </div>

        {/* Tag platillo base + Cambiar platillo + Generar con IA */}
        {activeBase && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white shadow-sm border border-outline-variant/30">
              <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
                lunch_dining
              </span>
              <span className="font-label-md text-label-md font-bold text-on-surface tracking-tight truncate">
                {activeBase.baseName}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-label-sm text-label-sm font-medium text-on-surface-variant">
                Opción {baseIndex + 1} de {baseDishes.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={generatingAi}
                  onClick={handleGenerateAiMeal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181A20] hover:bg-[#232332] text-white font-label-md text-[12px] font-semibold transition-all active:scale-95 shadow-sm shrink-0 disabled:opacity-60"
                >
                  <span
                    className={`material-symbols-outlined text-[16px] text-[#6ffbbe] ${
                      generatingAi ? 'animate-spin' : ''
                    }`}
                  >
                    {generatingAi ? 'progress_activity' : 'neurology'}
                  </span>
                  <span>{generatingAi ? 'USDA + Ollama...' : 'Generar con IA'}</span>
                </button>
                {baseDishes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBaseIndex((i) => (i + 1) % baseDishes.length)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-primary hover:bg-surface-container font-label-md text-[12px] font-semibold transition-all active:scale-95 shadow-sm border border-outline-variant/30 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[17px]">shuffle</span>
                    <span>Cambiar platillo</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {feedback && (
          <div className="rounded-2xl bg-[#CBF3DB] px-4 py-2.5 text-[12.5px] font-semibold text-[#005236] border border-[#00B87C]/30">
            {feedback}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-3xl p-6 text-center text-[13px] text-on-surface-variant">
            Evaluando reglas simbólicas y consistencia de precio...
          </div>
        ) : !activeBase ? (
          <div className="bg-white rounded-3xl p-6 text-center text-[13px] text-on-surface-variant">
            No hay opciones compatibles para este tiempo de comida con tus alergias actuales.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeBase.options.map((opt) => {
              const isWhyOpen = openWhyId === opt.id;
              const isMedium = opt.budgetTier === 'medio';
              return (
                <article
                  key={opt.id}
                  className={`relative flex flex-col rounded-3xl bg-white p-4 shadow-sm border transition-all ${
                    opt.affinity.isFavorite
                      ? 'border-2 border-[#00B87C]'
                      : opt.affinity.lowPriority
                      ? 'border-slate-200 opacity-85'
                      : 'border-white/80'
                  }`}
                >
                  {/* Badges superiores sin solapamiento */}
                  <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold tracking-wide whitespace-nowrap ${
                        isMedium
                          ? 'bg-[#00B87C] text-white'
                          : 'bg-surface-container-low text-on-surface-variant'
                      }`}
                    >
                      {BUDGET_BADGES[opt.budgetTier]}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {opt.source === 'ollama_usda_ai' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8F9EF] text-[#006c49] border border-[#CBF3DB] text-[10.5px] font-bold">
                          IA Local • USDA
                        </span>
                      )}
                      {opt.affinity.isFavorite && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-[#006c49] text-[10.5px] font-bold">
                          <span className="material-symbols-outlined text-[13px]">grade</span>
                          Favorito ({opt.affinity.chosenCount}x)
                        </span>
                      )}
                      {opt.affinity.lowPriority && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10.5px] font-bold">
                          Baja prioridad
                        </span>
                      )}
                    </div>
                  </div>

                  <DishVisual
                    theme={opt.visualTheme}
                    prepMinutes={opt.prepMinutes}
                    estimatedCostUsd={opt.estimatedCostUsd}
                    badges={opt.badges}
                  />

                  <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight mb-1">
                    {opt.title}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-2.5">
                    {opt.description}
                  </p>

                  {/* Ingrediente principal y validacion precio_consistente */}
                  <div className="rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7] px-3 py-2 mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#4A7265]">
                        Ingrediente principal ({opt.mainIngredient.priceTier})
                      </span>
                      <span className="text-[12px] font-semibold text-[#151D24] truncate block">
                        {opt.mainIngredient.name}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[#006c49] text-[10px] font-bold border border-[#CBF3DB] shrink-0 whitespace-nowrap">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      Precio OK
                    </span>
                  </div>

                  {/* Macros */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3 tabular-nums">
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface font-label-sm text-label-sm">
                      {opt.calories} kcal
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E8F9EF] text-[#006c49] font-label-sm text-label-sm">
                      {opt.protein}g P
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {opt.carbs}g C
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {opt.fat}g G
                    </span>
                    <span className="ml-auto text-[11px] font-bold text-[#4A7265]">
                      Afinidad: {opt.affinity.score >= 0 ? `+${opt.affinity.score}` : opt.affinity.score}
                    </span>
                  </div>

                  {/* Acciones de afinidad + ¿Por qué? */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={Boolean(actionId)}
                      onClick={() => handleAffinity(opt.id, 'choose')}
                      className="flex-1 h-10 rounded-full bg-[#181A20] hover:bg-[#232332] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#6ffbbe]">
                        check_circle
                      </span>
                      <span>Elegir (+2)</span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(actionId)}
                      onClick={() => handleAffinity(opt.id, 'ignore')}
                      className="px-3.5 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-[#3c4a42] text-[12px] font-semibold flex items-center justify-center gap-1 active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[16px]">thumb_down</span>
                      <span>Ignorar (-1)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenWhyId(isWhyOpen ? null : opt.id)}
                      className="px-3 h-10 rounded-full bg-[#E8F9EF] text-[#006c49] text-[12px] font-bold flex items-center justify-center gap-1 shrink-0"
                    >
                      <span>¿Por qué?</span>
                    </button>
                  </div>

                  {isWhyOpen && (
                    <div className="mt-3 p-3 rounded-2xl bg-[#F4FBF7] border border-[#CBF3DB] text-[11.5px] text-[#3c4a42] space-y-1.5">
                      <p className="font-semibold text-[#151D24]">{opt.whyRecommended}</p>
                      <p className="font-mono text-[10.5px] text-[#006c49]">
                        Reglas: {opt.rulesApplied.join(' | ')}
                      </p>
                      {Array.isArray(opt.dataSources) && opt.dataSources.length > 0 && (
                        <p className="text-[10.5px] text-[#4A7265]">
                          Fuentes USDA:{' '}
                          {opt.dataSources
                            .map((s) => `${s.description} (FDC ${s.fdcId})`)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Opciones descartadas por el Motor Simbolico */}
        <section className="bg-white/90 rounded-3xl p-4 border border-[#E1EFE7]">
          <button
            type="button"
            onClick={() => setShowDiscarded((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <p className="text-[13px] font-bold text-[#151D24]">
                Opciones descartadas ({discardedMeals.length})
              </p>
              <p className="text-[11px] text-[#52525B]">
                Trazas exactas del Motor Simbólico por alergias o consistencia
              </p>
            </div>
            <span className="material-symbols-outlined text-[20px] text-[#4A7265]">
              {showDiscarded ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showDiscarded && (
            <div className="mt-3 space-y-2">
              {discardedMeals.length === 0 ? (
                <p className="text-[12px] text-[#52525B]">
                  Ningún platillo de {mealTime} fue descartado con tus restricciones actuales.
                </p>
              ) : (
                discardedMeals.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-2xl bg-error-container/40 border border-error/20 text-[11.5px]"
                  >
                    <p className="font-bold text-[#151D24]">{d.title}</p>
                    <p className="font-mono text-[10.5px] text-error mt-0.5">{d.rule}</p>
                    <p className="text-[#3c4a42] mt-0.5">{d.discardReason}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
