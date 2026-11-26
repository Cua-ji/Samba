import React, { useEffect, useMemo, useState } from 'react';
import { AppTopBar } from '../components/layout/AppTopBar';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

const WEEK_DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatReadableDate(date) {
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

export function DashboardPage() {
  const {
    user,
    setUser,
    metabolism,
    todayLog,
    setTodayLog,
    setActiveTab,
    openChatWithPrompt,
  } = useSamba();

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);
  const [selectedDayLog, setSelectedDayLog] = useState(null);
  const [loadingDayLog, setLoadingDayLog] = useState(false);
  const [activeDates, setActiveDates] = useState([]);
  const [showFormula, setShowFormula] = useState(false);
  const [updatingWater, setUpdatingWater] = useState(false);

  const createdDateStr = useMemo(() => {
    if (!user?.createdAt) return todayStr;
    const parsed = new Date(user.createdAt);
    return Number.isNaN(parsed.getTime()) ? todayStr : toLocalDateStr(parsed);
  }, [user?.createdAt, todayStr]);

  const weekDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    return WEEK_DAY_LETTERS.map((letter, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = toLocalDateStr(d);
      return {
        dateStr,
        readableDate: formatReadableDate(d),
        letter,
        dayNum: d.getDate(),
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
        isBeforeAccount: dateStr < createdDateStr,
        isPast: dateStr < todayStr && dateStr >= createdDateStr,
      };
    });
  }, [todayStr, createdDateStr]);

  const selectedDay = weekDays.find((d) => d.dateStr === selectedDateStr) || weekDays.find((d) => d.isToday) || weekDays[0];
  const isReadOnlyDay = selectedDay ? selectedDay.isPast : false;

  useEffect(() => {
    if (!user?.id || weekDays.length === 0) return;
    const startDate = weekDays[0].dateStr;
    const endDate = weekDays[weekDays.length - 1].dateStr;
    api
      .getDailyLogsSummary(user.id, startDate, endDate)
      .then((res) => setActiveDates(res.activeDates || []))
      .catch(() => {});
  }, [user?.id, todayLog, weekDays]);

  useEffect(() => {
    if (!user?.id || !selectedDay) return;
    if (selectedDay.isToday) {
      setSelectedDayLog(null);
      setLoadingDayLog(false);
      return;
    }
    if (selectedDay.isFuture || selectedDay.isBeforeAccount) {
      setSelectedDateStr(todayStr);
      return;
    }

    let cancelled = false;
    setLoadingDayLog(true);
    api
      .getDailyLog(user.id, selectedDay.dateStr)
      .then((res) => {
        if (!cancelled) setSelectedDayLog(res);
      })
      .catch(() => {
        if (!cancelled) setSelectedDayLog(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDayLog(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedDay, todayStr]);

  if (!user || !metabolism) return null;

  const activeLog = isReadOnlyDay ? selectedDayLog : todayLog;
  const firstName = user.name.split(' ')[0];
  const targetCalories = metabolism.targetCalories || 2000;
  const consumedCalories = activeLog?.caloriesConsumed || 0;
  const remainingCalories = Math.max(0, targetCalories - consumedCalories);
  const overCalories = consumedCalories > targetCalories;

  const progressRatio = Math.min(1, consumedCalories / Math.max(1, targetCalories));
  const circumference = 2 * Math.PI * 41;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const proteinTarget = metabolism.macrosTarget?.protein || 140;
  const carbsTarget = metabolism.macrosTarget?.carbs || 200;
  const fatTarget = metabolism.macrosTarget?.fat || 60;

  const proteinConsumed = activeLog?.proteinConsumed || 0;
  const carbsConsumed = activeLog?.carbsConsumed || 0;
  const fatConsumed = activeLog?.fatConsumed || 0;

  const proteinPct = Math.min(100, Math.round((proteinConsumed / proteinTarget) * 100));
  const carbsPct = Math.min(100, Math.round((carbsConsumed / carbsTarget) * 100));
  const fatPct = Math.min(100, Math.round((fatConsumed / fatTarget) * 100));

  const hydrationLiters = isReadOnlyDay
    ? Number(activeLog?.hydrationLiters || 0)
    : Number(todayLog?.hydrationLiters ?? user.hydrationLiters ?? 0);

  const chosenMeals = activeLog?.chosenMeals || [];
  const completedWorkouts = activeLog?.completedWorkouts || [];

  async function handleAddWater() {
    if (updatingWater || isReadOnlyDay) return;
    const next = Math.min(3.5, Number((hydrationLiters + 0.25).toFixed(2)));
    setUpdatingWater(true);
    try {
      const res = await api.updateProfile(user.id, {
        hydrationLiters: next,
        targetDate: selectedDay.dateStr,
      });
      setUser(res.user);
      if (res.todayLog) setTodayLog(res.todayLog);
    } finally {
      setUpdatingWater(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <AppTopBar title="INICIO" />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="flex flex-col w-full px-4 sm:px-margin pt-4 pb-6 space-y-4">
        {/* Saludo & Tira semanal */}
        <section className="flex flex-col space-y-3">
          <div className="flex flex-col">
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Hola, {firstName}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              {isReadOnlyDay
                ? `Historial del ${selectedDay.readableDate} (${metabolism.goalLabel})`
                : `Este es tu plan de hoy (${metabolism.goalLabel})`}
            </p>
          </div>

          <div className="flex items-center justify-between gap-1.5 pt-1">
            {weekDays.map((day) => {
              const isSelected = selectedDay?.dateStr === day.dateStr;
              const isBlocked = day.isFuture || day.isBeforeAccount;
              const hasActivity = !isBlocked && activeDates.includes(day.dateStr);
              return (
                <button
                  key={day.dateStr}
                  type="button"
                  disabled={isBlocked}
                  onClick={() => !isBlocked && setSelectedDateStr(day.dateStr)}
                  aria-label={
                    day.isFuture
                      ? `Día futuro ${day.dayNum} bloqueado`
                      : day.isBeforeAccount
                      ? `Día ${day.dayNum} anterior a tu registro`
                      : `Ver día ${day.dayNum}`
                  }
                  className={`flex flex-col items-center justify-center flex-1 rounded-2xl transition-all ${
                    isBlocked
                      ? 'py-2.5 bg-white/45 text-on-surface-variant/45 opacity-55 cursor-not-allowed'
                      : isSelected
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
                      isSelected ? 'text-white' : isBlocked ? 'text-on-surface/40' : 'text-on-surface'
                    }`}
                  >
                    {day.dayNum}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${
                      isSelected
                        ? 'bg-primary-fixed'
                        : hasActivity
                        ? 'bg-[#00B87C]'
                        : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {isReadOnlyDay && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[#181A20] text-white text-[12px] shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[17px] text-[#6ffbbe] shrink-0">
                  lock
                </span>
                <span className="font-medium truncate">
                  Día pasado • Solo lectura
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateStr(todayStr)}
                className="px-3 py-1 rounded-full bg-[#00B87C] text-white text-[11px] font-bold shrink-0 whitespace-nowrap"
              >
                Volver a hoy
              </button>
            </div>
          )}
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

          {loadingDayLog ? (
            <div className="py-8 text-center text-[12.5px] text-on-surface-variant">
              Cargando historial del día...
            </div>
          ) : (
            <>
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

                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="font-body-sm text-[11.5px] text-on-surface-variant leading-tight">
                      Meta Mifflin-St Jeor
                    </span>
                    <span className="font-label-md text-[12.5px] text-on-surface font-bold tabular-nums whitespace-nowrap shrink-0">
                      {targetCalories.toLocaleString('es-MX')} kcal
                    </span>
                  </div>
                </div>
              </div>

              {/* Desglose de Macronutrientes */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="flex flex-col p-2 sm:p-2.5 rounded-2xl bg-surface-container-low/90 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-label-sm text-[10.5px] text-on-surface-variant truncate">
                      Proteína
                    </span>
                    <span className="font-label-sm text-[10.5px] font-bold text-tertiary tabular-nums shrink-0">
                      {proteinPct}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#00B87C] h-full rounded-full transition-all duration-300"
                      style={{ width: `${proteinPct}%` }}
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-0.5 pt-0.5 tabular-nums">
                    <span className="font-label-md text-[12.5px] font-bold text-on-surface">
                      {proteinConsumed}g
                    </span>
                    <span className="font-body-sm text-[10px] text-on-surface-variant whitespace-nowrap">
                      / {proteinTarget}g
                    </span>
                  </div>
                </div>

                <div className="flex flex-col p-2 sm:p-2.5 rounded-2xl bg-surface-container-low/90 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-label-sm text-[10.5px] text-on-surface-variant truncate">
                      Carbos
                    </span>
                    <span className="font-label-sm text-[10.5px] font-bold text-[#006c49] tabular-nums shrink-0">
                      {carbsPct}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-tertiary-fixed-dim h-full rounded-full transition-all duration-300"
                      style={{ width: `${carbsPct}%` }}
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-0.5 pt-0.5 tabular-nums">
                    <span className="font-label-md text-[12.5px] font-bold text-on-surface">
                      {carbsConsumed}g
                    </span>
                    <span className="font-body-sm text-[10px] text-on-surface-variant whitespace-nowrap">
                      / {carbsTarget}g
                    </span>
                  </div>
                </div>

                <div className="flex flex-col p-2 sm:p-2.5 rounded-2xl bg-surface-container-low/90 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-label-sm text-[10.5px] text-on-surface-variant truncate">
                      Grasas
                    </span>
                    <span className="font-label-sm text-[10.5px] font-bold text-secondary tabular-nums shrink-0">
                      {fatPct}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-secondary h-full rounded-full transition-all duration-300"
                      style={{ width: `${fatPct}%` }}
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-0.5 pt-0.5 tabular-nums">
                    <span className="font-label-md text-[12.5px] font-bold text-on-surface">
                      {fatConsumed}g
                    </span>
                    <span className="font-body-sm text-[10px] text-on-surface-variant whitespace-nowrap">
                      / {fatTarget}g
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Historial de actividades del dia seleccionado */}
        <section className="bg-white rounded-3xl p-4 shadow-sm border border-white/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">history</span>
              <h3 className="font-headline-sm text-[15px] text-on-surface font-bold">
                {isReadOnlyDay ? 'Registro del día' : 'Actividad de hoy'}
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-on-surface-variant tabular-nums">
              {chosenMeals.length} comidas • {completedWorkouts.length} entrenos
            </span>
          </div>

          {chosenMeals.length === 0 && completedWorkouts.length === 0 && hydrationLiters === 0 ? (
            <p className="text-[12.5px] text-on-surface-variant py-2">
              {isReadOnlyDay
                ? 'No se registraron comidas, rutinas ni hidratación en este día.'
                : 'Aún no registras comidas ni rutinas hoy.'}
            </p>
          ) : (
            <div className="space-y-2">
              {chosenMeals.map((meal, idx) => (
                <div
                  key={`${meal.mealId}_${idx}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-[#006c49] shrink-0">
                      restaurant
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-bold text-on-surface truncate">{meal.title}</p>
                      <p className="text-[10.5px] text-on-surface-variant capitalize">
                        {meal.mealTime}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11.5px] font-bold text-[#006c49] tabular-nums shrink-0">
                    +{meal.calories} kcal
                  </span>
                </div>
              ))}

              {completedWorkouts.map((workout, idx) => (
                <div
                  key={`${workout.workoutId}_${idx}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-surface-container-low border border-outline-variant/20"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                      fitness_center
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-bold text-on-surface truncate">
                        {workout.title}
                      </p>
                      <p className="text-[10.5px] text-on-surface-variant">Entreno completado</p>
                    </div>
                  </div>
                  <span className="text-[11.5px] font-bold text-on-surface tabular-nums shrink-0">
                    -{workout.caloriesBurned} kcal
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tarjeta Asistente Samba AI (solo hoy) */}
        {!isReadOnlyDay && (
          <section className="rounded-3xl p-4 bg-gradient-to-br from-[#E8F9EF] to-[#FFFFFF] border border-[#CBF3DB] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#CBF3DB] text-[#2E7D5B] text-[10.5px] font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B]" />
                SAMBA AI
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
            </div>
          </section>
        )}

        {/* Accesos rapidos y widget de hidratacion */}
        <section className="grid grid-cols-2 gap-3">
          {isReadOnlyDay ? (
            <div className="bg-white/80 rounded-3xl p-4 shadow-sm border border-white/80 flex flex-col justify-between gap-2">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">restaurant</span>
              </div>
              <div>
                <p className="text-[13.5px] font-bold text-on-surface">Comidas del día</p>
                <p className="text-[11px] text-on-surface-variant">
                  {chosenMeals.length} registradas
                </p>
              </div>
            </div>
          ) : (
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
                  {chosenMeals.length} comidas hoy
                </p>
              </div>
            </button>
          )}

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-white/80 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-2xl bg-[#E8F9EF] text-[#006c49] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">water_drop</span>
              </div>
              {isReadOnlyDay ? (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                  Cerrado
                </span>
              ) : (
                <button
                  type="button"
                  disabled={updatingWater}
                  onClick={handleAddWater}
                  className="px-3 py-1.5 min-h-[32px] rounded-full bg-[#181A20] text-white text-[11px] font-bold active:scale-95 transition-transform whitespace-nowrap"
                >
                  +0.25 L
                </button>
              )}
            </div>
            <div>
              <p className="text-[13.5px] font-bold text-on-surface tabular-nums">
                {hydrationLiters.toFixed(2)} / 2.50 L
              </p>
              <p className="text-[11px] text-on-surface-variant">Hidratación diaria</p>
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
