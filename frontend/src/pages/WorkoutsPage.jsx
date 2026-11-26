import React, { useCallback, useEffect, useState } from 'react';
import { AppTopBar } from '../components/layout/AppTopBar';
import { WorkoutVisual } from '../components/workouts/WorkoutVisual';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

const INJURY_NAMES = {
  rodilla: 'Rodilla',
  lumbar: 'Zona lumbar',
  hombro: 'Hombro',
  tobillo: 'Tobillo',
};

function getImpactBadge(impactLevel, recommended) {
  const levelLabel =
    impactLevel === 'alto'
      ? 'IMPACTO ALTO'
      : impactLevel === 'medio'
      ? 'IMPACTO MEDIO'
      : 'IMPACTO BAJO';
  return recommended ? `${levelLabel} • SUGERIDA` : levelLabel;
}

function getChecklistStorageKey(userId) {
  const dateKey = new Date().toISOString().slice(0, 10);
  return `samba_workout_checks_${userId}_${dateKey}`;
}

export function WorkoutsPage({ refreshTrigger }) {
  const { user, setUser, todayLog, setTodayLog } = useSamba();
  const [data, setData] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [expandedSheetId, setExpandedSheetId] = useState(null);
  const [showDiscards, setShowDiscards] = useState(false);
  const [checkedMap, setCheckedMap] = useState({});
  const [restSeconds, setRestSeconds] = useState(0);
  const [feedback, setFeedback] = useState('');

  const loadWorkouts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.getWorkouts(user.id);
      setData(res);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts, refreshTrigger]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = localStorage.getItem(getChecklistStorageKey(user.id));
      setCheckedMap(saved ? JSON.parse(saved) : {});
    } catch {
      setCheckedMap({});
    }
  }, [user?.id]);

  useEffect(() => {
    if (restSeconds <= 0) return undefined;
    const t = setInterval(() => {
      setRestSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [restSeconds]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(''), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!user) return null;

  const groups = data?.groups || [];
  const activeGroup =
    groups.find((g) => g.groupId === selectedGroupId) || groups[0] || null;
  const discardedWorkouts = data?.discardedWorkouts || [];
  const sessionGoal = data?.sessionGoal || {
    minCalories: 280,
    maxCalories: 360,
  };

  const burnedToday = todayLog?.caloriesBurned || 0;
  const completedTodayMap = (todayLog?.completedWorkouts || []).reduce((acc, w) => {
    acc[w.workoutId] = (acc[w.workoutId] || 0) + 1;
    return acc;
  }, {});

  function toggleExerciseCheck(workoutId, idx) {
    setCheckedMap((prev) => {
      const current = prev[workoutId] || {};
      const nextWorkout = { ...current, [idx]: !current[idx] };
      const next = { ...prev, [workoutId]: nextWorkout };
      try {
        localStorage.setItem(getChecklistStorageKey(user.id), JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  async function handleCompleteWorkout(workout) {
    setActionId(workout.id);
    setFeedback('');
    try {
      const res = await api.setWorkoutAffinity(user.id, workout.id, 1, true);
      setUser(res.user);
      setTodayLog(res.todayLog);
      setData(res.evaluation);
      // Marcar todos los ejercicios como hechos visualmente
      const allDone = {};
      (workout.exercises || []).forEach((_, i) => {
        allDone[i] = true;
      });
      setCheckedMap((prev) => {
        const next = { ...prev, [workout.id]: allDone };
        try {
          localStorage.setItem(getChecklistStorageKey(user.id), JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      setFeedback(`Sesión registrada (-${workout.caloriesBurned} kcal en tu día).`);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleDislikeWorkout(workoutId, isCurrentlyLowPriority = false) {
    setActionId(workoutId);
    setFeedback('');
    try {
      const res = isCurrentlyLowPriority
        ? await api.setWorkoutAffinity(user.id, workoutId, 0, false, 'unmark')
        : await api.setWorkoutAffinity(user.id, workoutId, -1, false);
      setUser(res.user);
      setData(res.evaluation);
      setFeedback(
        isCurrentlyLowPriority
          ? 'Prioridad restaurada para esta rutina.'
          : 'Prioridad reducida. Toca de nuevo para desmarcar.'
      );
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleUndoWorkout(workoutId) {
    setActionId(workoutId);
    setFeedback('');
    try {
      const res = await api.undoTodayWorkout(user.id, workoutId);
      setUser(res.user);
      setTodayLog(res.todayLog);
      setData(res.evaluation);
      setFeedback('Sesión quitada de tu registro de hoy.');
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleGenerateAiWorkouts() {
    if (generatingAi) return;
    setGeneratingAi(true);
    setFeedback('');
    try {
      const currentRoutines = activeGroup
        ? [
            activeGroup.groupName,
            ...(activeGroup.options || []).map((opt) => opt.title),
          ].filter(Boolean)
        : [];
      const res = await api.generateAiWorkouts(user.id, currentRoutines);
      setUser(res.user);
      setData(res.evaluation);
      const aiGroup = res.evaluation?.groups?.find((g) => g.isAi);
      if (aiGroup) setSelectedGroupId(aiGroup.groupId);
      setFeedback('Nuevas rutinas personalizadas listas.');
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setGeneratingAi(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <AppTopBar title="ENTRENO" />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="flex flex-col w-full px-4 sm:px-margin pt-4 pb-6 space-y-4">
        <section className="flex flex-col gap-1">
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Sesión de hoy
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Marca cada ejercicio mientras entrenas y registra tu gasto calórico.
          </p>
        </section>

        {/* Meta de Entrenamiento + Cronometro rapido de descanso */}
        <div className="rounded-3xl bg-white p-4 shadow-sm space-y-3 border border-white/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#E8F9EF] flex items-center justify-center text-[#006c49] shrink-0">
                <span className="material-symbols-outlined text-[22px]">fitness_center</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Quema por sesión
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold tabular-nums">
                  {sessionGoal.minCalories} – {sessionGoal.maxCalories} kcal
                </span>
              </div>
            </div>

            {data?.mlActive ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8F9EF] text-[#006c49] text-[10.5px] font-bold shrink-0">
                <span className="material-symbols-outlined text-[14px]">neurology</span>
                AffinityNet
              </span>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high text-primary font-label-md text-label-md shrink-0 whitespace-nowrap">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Seguro</span>
              </div>
            )}
          </div>

          {/* Barra de descanso entre series + resumen quemado hoy */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7] text-[11.5px] tabular-nums">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#006c49]">timer</span>
              {restSeconds > 0 ? (
                <span className="font-bold text-[#151D24]">
                  Descanso: {Math.floor(restSeconds / 60)}:
                  {String(restSeconds % 60).padStart(2, '0')}
                </span>
              ) : (
                <span className="text-[#4A7265] font-medium">Descanso entre series:</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {restSeconds > 0 ? (
                <button
                  type="button"
                  onClick={() => setRestSeconds(0)}
                  className="px-3 py-1.5 min-h-[30px] rounded-full bg-[#181A20] text-white text-[11px] font-bold"
                >
                  Detener
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setRestSeconds(45)}
                    className="px-3 py-1.5 min-h-[30px] rounded-full bg-white border border-[#CBF3DB] text-[#006c49] text-[11px] font-bold hover:bg-[#E8F9EF]"
                  >
                    45s
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestSeconds(90)}
                    className="px-3 py-1.5 min-h-[30px] rounded-full bg-white border border-[#CBF3DB] text-[#006c49] text-[11px] font-bold hover:bg-[#E8F9EF]"
                  >
                    90s
                  </button>
                </>
              )}
              {burnedToday > 0 && (
                <span className="ml-1 font-bold text-[#006c49] whitespace-nowrap">-{burnedToday} kcal hoy</span>
              )}
            </div>
          </div>
        </div>

        {/* Escudo articular */}
        {((user.injuries || []).length > 0 || discardedWorkouts.length > 0) && (
          <div className="rounded-2xl bg-white/90 px-3.5 py-2.5 shadow-sm border border-[#CBF3DB] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[#006c49] text-[18px] shrink-0">
                  health_and_safety
                </span>
                <span className="text-[11.5px] font-semibold text-[#151D24] truncate">
                  Protección articular:{' '}
                  {(user.injuries || []).length > 0
                    ? user.injuries.map((i) => INJURY_NAMES[i] || i).join(', ')
                    : 'Rango seguro'}
                </span>
              </div>
              {discardedWorkouts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDiscards((v) => !v)}
                  className="text-[11px] font-bold text-[#006c49] shrink-0 hover:underline"
                >
                  {showDiscards ? 'Ocultar' : `${discardedWorkouts.length} bloqueadas`}
                </button>
              )}
            </div>

            {showDiscards && discardedWorkouts.length > 0 && (
              <div className="pt-1.5 border-t border-[#E1EFE7] space-y-1 text-[11px] text-[#4A7265]">
                {discardedWorkouts.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#93000a] shrink-0 mt-0.5">
                      block
                    </span>
                    <span>
                      <strong className="text-[#151D24]">{d.title}:</strong> {d.discardReason}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
            Evaluando seguridad biomecánica y afinidad neuronal...
          </div>
        ) : !activeGroup ? (
          <div className="bg-white rounded-3xl p-6 text-center space-y-3 border border-outline-variant/20 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-[#E8F9EF] text-[#006c49] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">fitness_center</span>
            </div>
            <div className="space-y-1">
              <p className="text-[14px] font-bold text-[#151D24]">
                Sin rutinas cargadas para tu perfil
              </p>
              <p className="text-[12.5px] text-on-surface-variant">
                Genera 3 rutinas personalizadas adaptadas a tu objetivo y articulaciones.
              </p>
            </div>
            <button
              type="button"
              disabled={generatingAi}
              onClick={handleGenerateAiWorkouts}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#181A20] hover:bg-[#232332] text-white text-[12.5px] font-semibold transition-all active:scale-95 disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[17px] text-[#6ffbbe] ${
                  generatingAi ? 'animate-spin' : ''
                }`}
              >
                {generatingAi ? 'progress_activity' : 'auto_awesome'}
              </span>
              <span>{generatingAi ? 'Preparando rutinas...' : 'Generar rutinas seguras'}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeGroup.options.map((w) => {
              const isFavorite = (w.affinity?.score || 0) >= 2;
              const isLowPriority =
                (w.affinity?.negativeCount || 0) > 0 || (w.affinity?.score || 0) <= -2;
              const completedTodayCount = completedTodayMap[w.id] || 0;
              const exercises = Array.isArray(w.exercises) ? w.exercises : [];
              const workoutChecks = checkedMap[w.id] || {};
              const checkedCount = exercises.filter((_, idx) => Boolean(workoutChecks[idx])).length;
              const checkPct =
                exercises.length > 0 ? Math.round((checkedCount / exercises.length) * 100) : 0;
              const sheetOpen = expandedSheetId === w.id;

              return (
                <article
                  key={w.id}
                  className={`relative flex flex-col rounded-3xl bg-white p-4 shadow-sm border transition-all ${
                    completedTodayCount > 0
                      ? 'border-2 border-[#00B87C] ring-2 ring-[#00B87C]/15'
                      : isFavorite
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
                        w.recommended
                          ? 'bg-[#00B87C] text-white'
                          : 'bg-surface-container-low text-on-surface-variant'
                      }`}
                    >
                      {getImpactBadge(w.impactLevel, w.recommended)}
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {typeof w.mlAffinityPct === 'number' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F4FBF7] border border-[#CBF3DB] text-[#006c49] text-[10.5px] font-bold tabular-nums">
                          <span className="material-symbols-outlined text-[13px]">neurology</span>
                          {w.mlAffinityPct}% afinidad
                        </span>
                      )}
                      {isFavorite && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-[#006c49] text-[10.5px] font-bold">
                          <span className="material-symbols-outlined text-[13px]">grade</span>
                          Favorito
                        </span>
                      )}
                      {isLowPriority && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10.5px] font-bold">
                          Baja prioridad
                        </span>
                      )}
                    </div>
                  </div>

                  <WorkoutVisual impactLevel={w.impactLevel} recommended={w.recommended} />

                  <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight mb-1">
                    {w.title}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-2.5">
                    {w.mainBenefit}
                  </p>

                  {/* Checklist interactivo de ejercicios */}
                  {exercises.length > 0 && (
                    <div className="rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7] px-3 py-2.5 mb-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A7265] tabular-nums">
                          Checklist ({checkedCount}/{exercises.length} ejercicios)
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedSheetId(sheetOpen ? null : w.id)}
                          className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-[#006c49] hover:underline whitespace-nowrap shrink-0"
                        >
                          <span>{sheetOpen ? 'Ocultar ficha' : 'Ficha técnica'}</span>
                          <span className="material-symbols-outlined text-[14px]">
                            {sheetOpen ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </div>

                      <div className="w-full bg-white h-1.5 rounded-full overflow-hidden border border-[#E1EFE7]">
                        <div
                          className="bg-[#00B87C] h-full rounded-full transition-all duration-300"
                          style={{ width: `${checkPct}%` }}
                        />
                      </div>

                      <div className="space-y-1.5 pt-0.5">
                        {exercises.map((ex, idx) => {
                          const done = Boolean(workoutChecks[idx]);
                          return (
                            <button
                              key={`${w.id}_ex_${idx}`}
                              type="button"
                              onClick={() => toggleExerciseCheck(w.id, idx)}
                              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11.5px] transition-all ${
                                done
                                  ? 'bg-[#E8F9EF] border-[#00B87C]/40 text-[#006c49] line-through'
                                  : 'bg-white border-[#CBF3DB] text-[#151D24] hover:border-[#00B87C]'
                              }`}
                            >
                              <span
                                className={`material-symbols-outlined text-[17px] shrink-0 ${
                                  done ? 'text-[#00B87C]' : 'text-slate-400'
                                }`}
                              >
                                {done ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                              <span className="font-medium leading-snug">{ex}</span>
                            </button>
                          );
                        })}
                      </div>

                      {sheetOpen && (
                        <div className="pt-2 border-t border-[#E1EFE7] text-[11.5px] text-[#3c4a42] leading-snug">
                          {w.technicalSheet}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Métricas */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3 tabular-nums">
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface font-label-sm text-label-sm font-bold">
                      -{w.caloriesBurned} kcal
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E8F9EF] text-[#006c49] font-label-sm text-label-sm font-bold">
                      {w.durationMin} min
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {w.equipment}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {w.intensity}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {completedTodayCount > 0 ? (
                      <>
                        <div className="flex-1 h-10 rounded-full bg-[#E8F9EF] text-[#006c49] px-3.5 text-[12px] font-bold flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">task_alt</span>
                          <span>Sesión completada hoy</span>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(actionId)}
                          onClick={() => handleUndoWorkout(w.id)}
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
                          onClick={() => handleCompleteWorkout(w)}
                          className="flex-1 h-10 rounded-full bg-[#181A20] hover:bg-[#232332] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-[16px] text-[#6ffbbe]">
                            check_circle
                          </span>
                          <span>
                            {checkedCount === exercises.length && exercises.length > 0
                              ? 'Finalizar sesión (100%)'
                              : 'Registrar rutina'}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(actionId)}
                          onClick={() => handleDislikeWorkout(w.id, isLowPriority)}
                          title={
                            isLowPriority
                              ? 'Quitar baja prioridad'
                              : 'Reducir prioridad de esta rutina'
                          }
                          aria-label={
                            isLowPriority
                              ? 'Quitar baja prioridad de esta rutina'
                              : 'Reducir prioridad de esta rutina'
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
              onClick={handleGenerateAiWorkouts}
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
                {generatingAi ? 'Generando rutinas con IA...' : 'Generar nuevas rutinas con IA'}
              </span>
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
