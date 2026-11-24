import React, { useCallback, useEffect, useState } from 'react';
import { AppTopBar } from '../components/layout/AppTopBar';
import { WorkoutVisual } from '../components/workouts/WorkoutVisual';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

function getImpactBadge(impactLevel, recommended) {
  const levelLabel =
    impactLevel === 'alto'
      ? 'IMPACTO ALTO'
      : impactLevel === 'medio'
      ? 'IMPACTO MEDIO'
      : 'IMPACTO BAJO';
  return recommended ? `${levelLabel} • SUGERIDA` : levelLabel;
}

export function WorkoutsPage({ refreshTrigger }) {
  const { user, setUser, setTodayLog } = useSamba();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [actionId, setActionId] = useState(null);
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
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(''), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!user) return null;

  const groups = data?.groups || [];
  const activeGroup = groups[0] || null;
  const sessionGoal = data?.sessionGoal || {
    minCalories: 280,
    maxCalories: 360,
  };

  async function handleChooseWorkout(workoutId) {
    setActionId(workoutId);
    setFeedback('');
    try {
      const res = await api.setWorkoutAffinity(user.id, workoutId, 1, true);
      setUser(res.user);
      setTodayLog(res.todayLog);
      setData(res.evaluation);
      setFeedback('Rutina elegida. Balance diario actualizado.');
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
      setFeedback('Entreno actualizado con 3 nuevas rutinas.');
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setGeneratingAi(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar">
      <AppTopBar title="ENTRENO" />

      <div className="flex flex-col w-full px-margin pt-4 pb-6 space-y-4">
        <section className="flex flex-col gap-1">
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Opciones del día
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Elige la rutina que mejor se adapte a tu energía, equipo y lesiones.
          </p>
        </section>

        {/* Meta de Entrenamiento (sin superposiciones) */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white shadow-sm gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[22px]">fitness_center</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Meta de entreno
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold tabular-nums">
                {sessionGoal.minCalories} – {sessionGoal.maxCalories} kcal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high text-primary font-label-md text-label-md shrink-0 whitespace-nowrap">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Seguro</span>
          </div>
        </div>

        {/* Tag enfoque actual */}
        {activeGroup && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white shadow-sm border border-outline-variant/30">
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
              fitness_center
            </span>
            <span className="font-label-md text-label-md font-bold text-on-surface tracking-tight truncate">
              {activeGroup.groupName}
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
            Cargando rutinas del día...
          </div>
        ) : !activeGroup ? (
          <div className="bg-white rounded-3xl p-6 text-center space-y-3 border border-outline-variant/20 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-[#E8F9EF] text-[#006c49] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">fitness_center</span>
            </div>
            <div className="space-y-1">
              <p className="text-[14px] font-bold text-[#151D24]">
                Aún no tienes rutinas para hoy
              </p>
              <p className="text-[12.5px] text-on-surface-variant">
                Toca el botón para preparar 3 rutinas personalizadas adaptadas a tu objetivo y lesiones.
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
                {generatingAi ? 'progress_activity' : 'fitness_center'}
              </span>
              <span>{generatingAi ? 'Preparando rutinas...' : 'Ver opciones de entreno'}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeGroup.options.map((w) => {
              const isFavorite = (w.affinity?.score || 0) >= 2;
              const isLowPriority = (w.affinity?.score || 0) <= -2;
              return (
                <article
                  key={w.id}
                  className={`relative flex flex-col rounded-3xl bg-white p-4 shadow-sm border transition-all ${
                    isFavorite
                      ? 'border-2 border-[#00B87C]'
                      : isLowPriority
                      ? 'border-slate-200 opacity-85'
                      : 'border-white/80'
                  }`}
                >
                  {/* Badges superiores sin solapamiento */}
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

                    <div className="flex items-center gap-1.5">
                      {isFavorite && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-[#006c49] text-[10.5px] font-bold">
                          <span className="material-symbols-outlined text-[13px]">grade</span>
                          Favorito ({w.affinity.score}x)
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

                  {/* Lista unificada de ejercicios */}
                  {Array.isArray(w.exercises) && w.exercises.length > 0 && (
                    <div className="rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7] px-3 py-2.5 mb-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#4A7265] mb-1.5">
                        Ejercicios
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {w.exercises.map((ex, idx) => (
                          <span
                            key={`${w.id}_ex_${idx}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-[11px] font-medium text-[#151D24] border border-[#CBF3DB]"
                          >
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Métricas */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3 tabular-nums">
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface font-label-sm text-label-sm">
                      {w.caloriesBurned} kcal
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E8F9EF] text-[#006c49] font-label-sm text-label-sm">
                      {w.durationMin} min
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {w.equipment}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {w.intensity}
                    </span>
                  </div>

                  {/* Acción: Elegir */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={Boolean(actionId)}
                      onClick={() => handleChooseWorkout(w.id)}
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
              onClick={handleGenerateAiWorkouts}
              className="w-full h-11 rounded-full bg-white hover:bg-surface-container text-primary font-label-md text-[13px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm border border-outline-variant/40 disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  generatingAi ? 'animate-spin' : ''
                }`}
              >
                {generatingAi ? 'progress_activity' : 'shuffle'}
              </span>
              <span>{generatingAi ? 'Generando nueva rutina...' : 'Cambiar rutina'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
