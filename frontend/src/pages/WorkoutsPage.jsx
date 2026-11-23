import React, { useCallback, useEffect, useState } from 'react';
import { AppTopBar } from '../components/layout/AppTopBar';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

export function WorkoutsPage({ refreshTrigger }) {
  const { user, setUser, setTodayLog, openChatWithPrompt } = useSamba();
  const [data, setData] = useState(null);
  const [groupIndex, setGroupIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [openWhyId, setOpenWhyId] = useState(null);
  const [showDiscarded, setShowDiscarded] = useState(false);

  const loadWorkouts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.getWorkouts(user.id);
      setData(res);
      setGroupIndex(0);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts, refreshTrigger]);

  if (!user) return null;

  const groups = data?.groups || [];
  const activeGroup = groups[groupIndex] || null;
  const sessionGoal = data?.sessionGoal || {
    minCalories: 280,
    maxCalories: 360,
    activityLabel: 'Ligeramente activo',
  };
  const discardedWorkouts = data?.discardedWorkouts || [];
  const hasInjuries = (user.injuries || []).length > 0;

  async function handleRate(workoutId, rating) {
    setRatingBusy(`${workoutId}_${rating}`);
    setFeedback('');
    try {
      const res = await api.setWorkoutAffinity(user.id, workoutId, rating, rating > 0);
      setUser(res.user);
      setTodayLog(res.todayLog);
      setData(res.evaluation);
      setFeedback(
        rating > 0
          ? 'Sesión completada y calificada (+1 afinidad). Registrada en tu historial.'
          : 'Calificación negativa registrada (-1 afinidad). Priorizaremos otras rutinas.'
      );
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setRatingBusy(null);
    }
  }

  async function handleGenerateAiWorkouts() {
    if (generatingAi) return;
    setGeneratingAi(true);
    setFeedback('');
    try {
      const res = await api.generateAiWorkouts(user.id);
      setUser(res.user);
      setData(res.evaluation);
      setGroupIndex(0);
      setFeedback(
        `Plan IA (${res.generated.modelUsed} + wger Workout API) validado por el Motor Simbólico y guardado en PostgreSQL.`
      );
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
        <header className="flex flex-col gap-1">
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Rutinas recomendadas
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Elige la rutina segura que mejor se adapte a tu energía, lesiones y objetivo de hoy.
          </p>
        </header>

        {/* Tarjeta meta de entrenamiento */}
        <section className="bg-white rounded-3xl p-5 shadow-sm flex flex-col gap-3 border border-outline-variant/30">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed/40">
              <span className="w-2 h-2 rounded-full bg-[#00B87C]" />
              <span className="font-label-sm text-label-sm font-bold text-on-primary-container uppercase tracking-wide whitespace-nowrap">
                Meta de Entrenamiento
              </span>
            </div>
            <span className="font-label-sm text-label-sm font-semibold text-primary">Hoy</span>
          </div>

          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-headline-lg text-headline-lg text-on-surface font-bold tabular-nums">
              {sessionGoal.minCalories} – {sessionGoal.maxCalories}
            </span>
            <span className="font-body-md text-body-md text-on-surface-variant">
              kcal estimadas • {sessionGoal.activityLabel}
            </span>
          </div>

          {activeGroup && (
            <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  fitness_center
                </span>
              </div>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Enfoque actual:
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant font-medium truncate">
                {activeGroup.groupName}
              </span>
            </div>
          )}
        </section>

        {/* Banner de proteccion articular + acceso a Chat RAG */}
        <section className="rounded-3xl p-4 bg-gradient-to-br from-[#E8F9EF] to-[#FFFFFF] border border-[#CBF3DB] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B]" />
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#2E7D5B]">
                {hasInjuries ? 'Protección Articular Activa' : 'Filtro Simbólico Activo'}
              </span>
            </div>
            <p className="text-[12px] text-[#3c4a42] leading-snug">
              {hasInjuries
                ? `Se excluyeron ${discardedWorkouts.length} rutinas de alto impacto incompatibles con tus lesiones (${user.injuries.join(', ')}).`
                : 'Todas las intensidades habilitadas. Pregunta a Samba AI si deseas adaptar el impacto.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              openChatWithPrompt(
                hasInjuries
                  ? '¿Por qué no me recomiendas correr?'
                  : '¿Qué rutina me recomiendas según mi objetivo?'
              )
            }
            className="px-3.5 py-2 rounded-full bg-[#181A20] text-white text-[11.5px] font-bold shrink-0 whitespace-nowrap active:scale-95 transition-transform"
          >
            Consultar IA
          </button>
        </section>

        {/* Cambiar rutina + Generar con IA */}
        <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Enfoque {groups.length > 0 ? `${groupIndex + 1} de ${groups.length}` : '0'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={generatingAi}
              onClick={handleGenerateAiWorkouts}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#181A20] hover:bg-[#232332] text-white font-label-sm text-label-sm font-bold active:scale-95 transition-all shadow-sm disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[16px] text-[#6ffbbe] ${
                  generatingAi ? 'animate-spin' : ''
                }`}
              >
                {generatingAi ? 'progress_activity' : 'neurology'}
              </span>
              <span>{generatingAi ? 'wger + Ollama...' : 'Generar rutina IA'}</span>
            </button>
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => setGroupIndex((i) => (i + 1) % groups.length)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-primary font-label-sm text-label-sm font-bold hover:bg-surface-container active:scale-95 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">shuffle</span>
                <span>Cambiar rutina</span>
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div className="rounded-2xl bg-[#CBF3DB] px-4 py-2.5 text-[12.5px] font-semibold text-[#005236] border border-[#00B87C]/30">
            {feedback}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-3xl p-6 text-center text-[13px] text-on-surface-variant">
            Evaluando rutinas seguras en el Motor Simbólico...
          </div>
        ) : !activeGroup ? (
          <div className="bg-white rounded-3xl p-6 text-center text-[13px] text-on-surface-variant">
            No se encontraron rutinas compatibles. Revisa tus lesiones en Perfil.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeGroup.options.map((w) => {
              const isWhyOpen = openWhyId === w.id;
              return (
                <article
                  key={w.id}
                  className={`bg-white rounded-3xl p-5 shadow-sm flex flex-col gap-3 transition-all border ${
                    w.recommended ? 'border-2 border-[#00B87C]' : 'border-white/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-bold whitespace-nowrap ${
                            w.recommended
                              ? 'bg-primary-fixed text-on-primary-fixed'
                              : 'bg-surface-container text-on-surface'
                          }`}
                        >
                          {w.recommended ? `RECOMENDADA • ${w.durationMin} MIN` : `${w.durationMin} MIN`}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-secondary-container font-label-sm text-label-sm font-medium text-on-secondary-container">
                          {w.equipment}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#E8F9EF] font-label-sm text-label-sm font-bold text-[#006c49] uppercase">
                          Impacto {w.impactLevel}
                        </span>
                        {w.source === 'ollama_wger_ai' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#181A20] text-[#6ffbbe] font-label-sm text-label-sm font-bold">
                            IA Local • wger
                          </span>
                        )}
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-1">
                        {w.title}
                      </h3>
                    </div>
                  </div>

                  {/* Metricas */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary-fixed/30 text-on-primary-container font-label-sm text-label-sm font-bold tabular-nums">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        local_fire_department
                      </span>
                      <span>{w.caloriesBurned} kcal quemadas</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-surface-container font-label-sm text-label-sm text-on-surface-variant font-medium">
                      {w.intensity}
                    </span>
                    <span className="ml-auto text-[11px] font-bold text-[#4A7265]">
                      Afinidad: {w.affinity.score >= 0 ? `+${w.affinity.score}` : w.affinity.score}
                    </span>
                  </div>

                  {/* Ganancia principal */}
                  <div className="p-3 rounded-2xl bg-surface-container-low flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                      trending_up
                    </span>
                    <div className="flex flex-col text-body-sm">
                      <span className="font-label-sm text-label-sm font-bold text-on-surface">
                        Ganancia principal:
                      </span>
                      <p className="text-on-surface-variant text-[12.5px] leading-tight mt-0.5">
                        {w.mainBenefit}
                      </p>
                    </div>
                  </div>

                  {/* Lista compacta de ejercicios */}
                  <ul className="space-y-1 px-1">
                    {w.exercises.map((ex, idx) => (
                      <li
                        key={idx}
                        className="text-[12px] text-[#3c4a42] flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00B87C] shrink-0" />
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Botones Completar/Calificar (+1/-1) y Explicabilidad "¿Por qué?" */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={Boolean(ratingBusy)}
                      onClick={() => handleRate(w.id, 1)}
                      className="flex-1 h-10 rounded-full bg-[#181A20] hover:bg-[#232332] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#6ffbbe]">
                        check_circle
                      </span>
                      <span>Completar (+1)</span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(ratingBusy)}
                      onClick={() => handleRate(w.id, -1)}
                      className="px-3.5 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-[#3c4a42] text-[12px] font-semibold flex items-center justify-center gap-1 active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[16px]">thumb_down</span>
                      <span>-1</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenWhyId(isWhyOpen ? null : w.id)}
                      className="px-3 h-10 rounded-full bg-[#E8F9EF] text-[#006c49] text-[12px] font-bold flex items-center justify-center shrink-0"
                    >
                      ¿Por qué?
                    </button>
                  </div>

                  {isWhyOpen && (
                    <div className="p-3 rounded-2xl bg-[#F4FBF7] border border-[#CBF3DB] text-[11.5px] text-[#3c4a42] space-y-1.5">
                      <p className="font-semibold text-[#151D24]">{w.explainability.summary}</p>
                      <p className="font-mono text-[10.5px] text-[#006c49]">
                        Reglas: {w.explainability.rulesVerified.join(' | ')}
                      </p>
                      {Array.isArray(w.dataSources) && w.dataSources.length > 0 && (
                        <p className="text-[10.5px] text-[#4A7265]">
                          Fuentes wger:{' '}
                          {w.dataSources
                            .map((s) => `${s.name} (ID ${s.wgerId})`)
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

        {/* Ejercicios descartados por lesiones */}
        <section className="bg-white/90 rounded-3xl p-4 border border-[#E1EFE7]">
          <button
            type="button"
            onClick={() => setShowDiscarded((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <p className="text-[13px] font-bold text-[#151D24]">
                Rutinas descartadas ({discardedWorkouts.length})
              </p>
              <p className="text-[11px] text-[#52525B]">
                Trazas de exclusión de alto impacto por lesiones activas
              </p>
            </div>
            <span className="material-symbols-outlined text-[20px] text-[#4A7265]">
              {showDiscarded ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showDiscarded && (
            <div className="mt-3 space-y-2">
              {discardedWorkouts.length === 0 ? (
                <p className="text-[12px] text-[#52525B]">
                  No hay rutinas descartadas; no tienes lesiones activas configuradas.
                </p>
              ) : (
                discardedWorkouts.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-2xl bg-error-container/40 border border-error/20 text-[11.5px]"
                  >
                    <p className="font-bold text-[#151D24]">
                      {d.title} ({d.impactLevel} impacto)
                    </p>
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
