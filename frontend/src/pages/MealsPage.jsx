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

function cleanMealTitle(title = '') {
  return String(title)
    .replace(/\s*\(\s*(?:(?:bajo|medio|alto)\s+presupuesto|presupuesto\s+(?:bajo|medio|alto))\s*\)\s*/gi, ' ')
    .replace(/\s*[-–:]?\s*(?:(?:bajo|medio|alto)\s+presupuesto|presupuesto\s+(?:bajo|medio|alto))\s*$/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanMealDescription(description = '') {
  return String(description)
    .replace(/\s*\(\s*(?:(?:bajo|medio|alto)\s+presupuesto|presupuesto\s+(?:bajo|medio|alto|limitado|moderado|elevado))\s*\)\s*/gi, ' ')
    .replace(/\s*(?:,?\s*(?:ideal|perfect[ao]|pensad[ao]|diseñad[ao]|adaptad[ao])?\s*(?:para|con|de|en)\s+(?:un\s+)?(?:(?:bajo|medio|alto)\s+presupuesto|presupuesto\s+(?:bajo|medio|alto|limitado|moderado|elevado)))/gi, '')
    .replace(/\s*(?:(?:bajo|medio|alto)\s+presupuesto|presupuesto\s+(?:bajo|medio|alto|limitado|moderado|elevado))/gi, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function MealsPage({ refreshTrigger }) {
  const { user, setUser, setTodayLog } = useSamba();
  const [mealTime, setMealTime] = useState('almuerzo');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [feedback, setFeedback] = useState('');

  const loadMeals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.getMeals(user.id, mealTime);
      setData(res);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, mealTime]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals, refreshTrigger]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(''), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!user) return null;

  const baseDishes = data?.baseDishes || [];
  const activeBase = baseDishes[0] || null;
  const mealGoal = data?.mealGoal || { min: 520, max: 650 };

  async function handleChooseMeal(mealId) {
    setActionId(mealId);
    setFeedback('');
    try {
      const res = await api.setMealAffinity(user.id, mealId, 'choose');
      setUser(res.user);
      setTodayLog(res.todayLog);
      setData({ mealTime, ...res.evaluation });
      setFeedback('Platillo elegido. Balance diario actualizado.');
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
      const currentDishes = activeBase
        ? [
            activeBase.baseName,
            ...(activeBase.options || []).map((opt) => opt.title),
          ].filter(Boolean)
        : [];
      const res = await api.generateAiMeal(user.id, mealTime, currentDishes);
      setUser(res.user);
      setData({ mealTime, ...res.evaluation });
      setFeedback('Platillo actualizado con 3 nuevas opciones.');
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

        {/* Tag platillo base */}
        {activeBase && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white shadow-sm border border-outline-variant/30">
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
              lunch_dining
            </span>
            <span className="font-label-md text-label-md font-bold text-on-surface tracking-tight truncate">
              {activeBase.baseName.replace(/^Base(\s+IA)?:\s*/i, '')}
            </span>
          </div>
        )}

        {feedback && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[390px] rounded-2xl bg-[#181A20] text-white px-4 py-3 text-[12.5px] font-semibold shadow-lg border border-white/10 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-[#6ffbbe] shrink-0">
                check_circle
              </span>
              <span className="truncate">{feedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback('')}
              aria-label="Cerrar notificación"
              className="text-white/70 hover:text-white shrink-0 flex items-center"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-3xl p-6 text-center text-[13px] text-on-surface-variant">
            Cargando opciones del día...
          </div>
        ) : !activeBase ? (
          <div className="bg-white rounded-3xl p-6 text-center space-y-3 border border-outline-variant/20 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-[#E8F9EF] text-[#006c49] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
            </div>
            <div className="space-y-1">
              <p className="text-[14px] font-bold text-[#151D24]">
                Aún no tienes opciones para tu {mealTime}
              </p>
              <p className="text-[12.5px] text-on-surface-variant">
                Toca el botón para preparar 3 opciones personalizadas (bajo, medio y alto presupuesto) para ti.
              </p>
            </div>
            <button
              type="button"
              disabled={generatingAi}
              onClick={handleGenerateAiMeal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#181A20] hover:bg-[#232332] text-white text-[12.5px] font-semibold transition-all active:scale-95 disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[17px] text-[#6ffbbe] ${
                  generatingAi ? 'animate-spin' : ''
                }`}
              >
                {generatingAi ? 'progress_activity' : 'restaurant_menu'}
              </span>
              <span>{generatingAi ? 'Preparando opciones...' : `Ver opciones de ${mealTime}`}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeBase.options.map((opt) => {
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

                  <DishVisual theme={opt.visualTheme} />

                  <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight mb-1">
                    {cleanMealTitle(opt.title)}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-2.5">
                    {cleanMealDescription(opt.description)}
                  </p>

                  {/* Lista unificada de ingredientes */}
                  {Array.isArray(opt.ingredients) && opt.ingredients.length > 0 && (
                    <div className="rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7] px-3 py-2.5 mb-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#4A7265] mb-1.5">
                        Ingredientes
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {opt.ingredients.map((ing, idx) => (
                          <span
                            key={`${opt.id}_ing_${idx}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-[11px] font-medium text-[#151D24] border border-[#CBF3DB]"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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
                  </div>

                  {/* Acción: Elegir */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={Boolean(actionId)}
                      onClick={() => handleChooseMeal(opt.id)}
                      className="w-full h-10 rounded-full bg-[#181A20] hover:bg-[#232332] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#6ffbbe]">
                        check_circle
                      </span>
                      <span>Elegir</span>
                    </button>
                  </div>
                </article>
              );
            })}

            <button
              type="button"
              disabled={generatingAi}
              onClick={handleGenerateAiMeal}
              className="w-full h-11 rounded-full bg-white hover:bg-surface-container text-primary font-label-md text-[13px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm border border-outline-variant/40 disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  generatingAi ? 'animate-spin' : ''
                }`}
              >
                {generatingAi ? 'progress_activity' : 'shuffle'}
              </span>
              <span>{generatingAi ? 'Generando nuevo platillo...' : 'Cambiar platillo'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
