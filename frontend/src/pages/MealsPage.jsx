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

const ALLERGY_NAMES = {
  gluten: 'Sin gluten',
  lactosa: 'Sin lactosa',
  frutos_secos: 'Sin frutos secos',
  pescados_mariscos: 'Sin mariscos',
  huevo: 'Sin huevo',
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
  const { user, setUser, metabolism, todayLog, setTodayLog } = useSamba();
  const [mealTime, setMealTime] = useState('almuerzo');
  const [selectedBaseId, setSelectedBaseId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [expandedSheetId, setExpandedSheetId] = useState(null);
  const [showDiscards, setShowDiscards] = useState(false);
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
    setSelectedBaseId(null);
    setShowDiscards(false);
  }, [mealTime]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(''), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!user) return null;

  const baseDishes = data?.baseDishes || [];
  const activeBase =
    baseDishes.find((b) => b.baseId === selectedBaseId) || baseDishes[0] || null;
  const mealGoal = data?.mealGoal || { min: 520, max: 650 };
  const discardedMeals = data?.discardedMeals || [];

  const targetCalories = metabolism?.targetCalories || data?.metabolism?.targetCalories || 2000;
  const consumedCalories = todayLog?.caloriesConsumed || 0;
  const remainingCalories = Math.max(0, targetCalories - consumedCalories);
  const proteinTarget = metabolism?.macrosTarget?.protein || 140;
  const proteinRemaining = Math.max(0, proteinTarget - (todayLog?.proteinConsumed || 0));

  const chosenTodayMap = (todayLog?.chosenMeals || []).reduce((acc, m) => {
    acc[m.mealId] = (acc[m.mealId] || 0) + 1;
    return acc;
  }, {});

  async function handleChooseMeal(mealId) {
    setActionId(mealId);
    setFeedback('');
    try {
      const res = await api.setMealAffinity(user.id, mealId, 'choose');
      setUser(res.user);
      setTodayLog(res.todayLog);
      setData({ mealTime, ...res.evaluation });
      setFeedback('Platillo registrado en tu balance de hoy.');
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleIgnoreMeal(mealId, isCurrentlyLowPriority = false) {
    setActionId(mealId);
    setFeedback('');
    try {
      const action = isCurrentlyLowPriority ? 'unignore' : 'ignore';
      const res = await api.setMealAffinity(user.id, mealId, action);
      setUser(res.user);
      setData({ mealTime, ...res.evaluation });
      setFeedback(
        isCurrentlyLowPriority
          ? 'Prioridad restaurada para este platillo.'
          : 'Prioridad reducida. Toca de nuevo para desmarcar.'
      );
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleUndoMeal(mealId) {
    setActionId(mealId);
    setFeedback('');
    try {
      const res = await api.undoTodayMeal(user.id, mealId, mealTime);
      setUser(res.user);
      setTodayLog(res.todayLog);
      setData({ mealTime, ...res.evaluation });
      setFeedback('Registro quitado de tu día actual.');
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
      const firstAi = res.evaluation?.baseDishes?.find((b) => b.isAi);
      if (firstAi) setSelectedBaseId(firstAi.baseId);
      setFeedback('Nuevas variantes personalizadas listas.');
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setGeneratingAi(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <AppTopBar title="PLATILLO" />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="flex flex-col w-full px-4 sm:px-margin pt-4 pb-6 space-y-4">
        <section className="flex flex-col gap-1">
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Plan nutricional
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Opciones filtradas por tus restricciones y ordenadas por afinidad neuronal.
          </p>
        </section>

        {/* Selector Desayuno / Almuerzo / Cena */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {MEAL_TIMES.map((mt) => {
            const active = mealTime === mt.id;
            const loggedInSlot = (todayLog?.chosenMeals || []).filter(
              (m) => m.mealTime === mt.id
            ).length;
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
                {loggedInSlot > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                      active ? 'bg-[#00B87C] text-white' : 'bg-[#E8F9EF] text-[#006c49]'
                    }`}
                  >
                    {loggedInSlot}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Meta del tiempo de comida + Restante diario en vivo */}
        <div className="rounded-3xl bg-white p-4 shadow-sm space-y-3 border border-white/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#E8F9EF] flex items-center justify-center text-[#006c49] shrink-0">
                <span className="material-symbols-outlined text-[22px]">local_fire_department</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Meta sugerida de {mealTime}
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold tabular-nums">
                  {mealGoal.min} – {mealGoal.max} kcal
                </span>
              </div>
            </div>
            {data?.mlActive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8F9EF] text-[#006c49] text-[10.5px] font-bold shrink-0">
                <span className="material-symbols-outlined text-[14px]">neurology</span>
                AffinityNet
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7] text-[11.5px] tabular-nums">
            <span className="text-[#4A7265] font-medium">Disponible hoy para tu meta:</span>
            <span className="font-bold text-[#151D24] whitespace-nowrap shrink-0">
              {remainingCalories.toLocaleString('es-MX')} kcal • {proteinRemaining}g P
            </span>
          </div>
        </div>

        {/* Escudo de seguridad alimentaria */}
        {((user.allergies || []).length > 0 || discardedMeals.length > 0) && (
          <div className="rounded-2xl bg-white/90 px-3.5 py-2.5 shadow-sm border border-[#CBF3DB] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[#006c49] text-[18px] shrink-0">
                  verified_user
                </span>
                <span className="text-[11.5px] font-semibold text-[#151D24] truncate">
                  Protección activa:{' '}
                  {(user.allergies || []).length > 0
                    ? user.allergies.map((a) => ALLERGY_NAMES[a] || a).join(', ')
                    : 'Consistencia nutricional'}
                </span>
              </div>
              {discardedMeals.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDiscards((v) => !v)}
                  className="text-[11px] font-bold text-[#006c49] shrink-0 hover:underline"
                >
                  {showDiscards ? 'Ocultar' : `${discardedMeals.length} filtrados`}
                </button>
              )}
            </div>

            {showDiscards && discardedMeals.length > 0 && (
              <div className="pt-1.5 border-t border-[#E1EFE7] space-y-1 text-[11px] text-[#4A7265]">
                {discardedMeals.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#93000a] shrink-0 mt-0.5">
                      block
                    </span>
                    <span>
                      <strong className="text-[#151D24]">{cleanMealTitle(d.title)}:</strong>{' '}
                      {d.discardReason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selector horizontal de Platillos Base disponibles */}
        {baseDishes.length > 1 && (
          <div className="space-y-1.5">
            <span className="block px-1 text-[10.5px] font-bold uppercase tracking-wider text-[#4A7265]">
              Menús seguros disponibles ({baseDishes.length})
            </span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {baseDishes.map((b) => {
                const isSelected = activeBase?.baseId === b.baseId;
                const cleanBase = b.baseName.replace(/^Base(\s+IA)?:\s*/i, '');
                return (
                  <button
                    key={b.baseId}
                    type="button"
                    onClick={() => setSelectedBaseId(b.baseId)}
                    className={`shrink-0 px-3.5 py-2 rounded-2xl text-[12px] font-semibold transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-[#181A20] text-white border-[#181A20] shadow-sm'
                        : 'bg-white text-[#151D24] border-[#E1EFE7] hover:border-[#00B87C]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        isSelected ? 'text-[#6ffbbe]' : 'text-[#006c49]'
                      }`}
                    >
                      {b.isAi ? 'auto_awesome' : 'lunch_dining'}
                    </span>
                    <span className="max-w-[180px] truncate">{cleanBase}</span>
                  </button>
                );
              })}
            </div>
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
            Evaluando opciones seguras y afinidad neuronal...
          </div>
        ) : !activeBase ? (
          <div className="bg-white rounded-3xl p-6 text-center space-y-3 border border-outline-variant/20 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-[#E8F9EF] text-[#006c49] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
            </div>
            <div className="space-y-1">
              <p className="text-[14px] font-bold text-[#151D24]">
                Sin opciones activas para {mealTime}
              </p>
              <p className="text-[12.5px] text-on-surface-variant">
                Genera 3 variantes personalizadas (bajo, medio y alto presupuesto) validadas para tu perfil.
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
                {generatingAi ? 'progress_activity' : 'auto_awesome'}
              </span>
              <span>{generatingAi ? 'Preparando opciones...' : `Generar opciones de ${mealTime}`}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeBase.options.map((opt) => {
              const isMedium = opt.budgetTier === 'medio';
              const chosenTodayCount = chosenTodayMap[opt.id] || 0;
              const isLowPriority =
                Boolean(opt.affinity?.lowPriority) || (opt.affinity?.ignoredCount || 0) > 0;
              const sheetOpen = expandedSheetId === opt.id;

              return (
                <article
                  key={opt.id}
                  className={`relative flex flex-col rounded-3xl bg-white p-4 shadow-sm border transition-all ${
                    chosenTodayCount > 0
                      ? 'border-2 border-[#00B87C] ring-2 ring-[#00B87C]/15'
                      : opt.affinity.isFavorite
                      ? 'border-2 border-[#00B87C]'
                      : isLowPriority
                      ? 'border-slate-200 opacity-80'
                      : 'border-white/80'
                  }`}
                >
                  {/* Badges superiores */}
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

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {typeof opt.mlAffinityPct === 'number' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F4FBF7] border border-[#CBF3DB] text-[#006c49] text-[10.5px] font-bold tabular-nums">
                          <span className="material-symbols-outlined text-[13px]">neurology</span>
                          {opt.mlAffinityPct}% afinidad
                        </span>
                      )}
                      {opt.affinity.isFavorite && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-[#006c49] text-[10.5px] font-bold">
                          <span className="material-symbols-outlined text-[13px]">grade</span>
                          Favorito
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
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A7265]">
                          Ingredientes base
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedSheetId(sheetOpen ? null : opt.id)}
                          className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-[#006c49] hover:underline"
                        >
                          <span>{sheetOpen ? 'Ocultar guía' : 'Ver guía y porción'}</span>
                          <span className="material-symbols-outlined text-[14px]">
                            {sheetOpen ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </div>
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

                      {sheetOpen && (
                        <div className="mt-2.5 pt-2 border-t border-[#E1EFE7] text-[11.5px] text-[#3c4a42] space-y-1 leading-snug">
                          <p>{opt.nutritionalSheet}</p>
                          {opt.whyRecommended && (
                            <p className="text-[11px] text-[#4A7265]">{opt.whyRecommended}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Macros + Costo + Prep */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3 tabular-nums">
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface font-label-sm text-label-sm font-bold">
                      {opt.calories} kcal
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E8F9EF] text-[#006c49] font-label-sm text-label-sm font-bold">
                      {opt.protein}g P
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {opt.carbs}g C
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {opt.fat}g G
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      ~${Number(opt.estimatedCostUsd || 0).toFixed(2)}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {opt.prepMinutes} min
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {chosenTodayCount > 0 ? (
                      <>
                        <div className="flex-1 h-10 rounded-full bg-[#E8F9EF] text-[#006c49] px-3.5 text-[12px] font-bold flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">task_alt</span>
                          <span>
                            Registrado hoy{chosenTodayCount > 1 ? ` (${chosenTodayCount}x)` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(actionId)}
                          onClick={() => handleUndoMeal(opt.id)}
                          className="h-10 px-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#151D24] text-[12px] font-semibold flex items-center gap-1 transition-all disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-[15px]">undo</span>
                          <span>Quitar</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={Boolean(actionId)}
                          onClick={() => handleChooseMeal(opt.id)}
                          className="flex-1 h-10 rounded-full bg-[#181A20] hover:bg-[#232332] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-[16px] text-[#6ffbbe]">
                            check_circle
                          </span>
                          <span>Registrar platillo</span>
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(actionId)}
                          onClick={() => handleIgnoreMeal(opt.id, isLowPriority)}
                          title={
                            isLowPriority
                              ? 'Quitar baja prioridad'
                              : 'Reducir prioridad de este platillo'
                          }
                          aria-label={
                            isLowPriority
                              ? 'Quitar baja prioridad de este platillo'
                              : 'Reducir prioridad de este platillo'
                          }
                          aria-pressed={isLowPriority}
                          className={`h-10 px-3 rounded-full text-[11.5px] font-semibold flex items-center gap-1 transition-all disabled:opacity-60 shrink-0 ${
                            isLowPriority
                              ? 'bg-[#181A20] text-white hover:bg-[#232332]'
                              : 'bg-surface-container-low hover:bg-slate-200 text-on-surface-variant'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">thumb_down</span>
                        </button>
                      </>
                    )}
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
                {generatingAi ? 'progress_activity' : 'auto_awesome'}
              </span>
              <span>
                {generatingAi ? 'Generando nuevo platillo con IA...' : 'Generar nuevo menú con IA'}
              </span>
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
