import {
  evaluateMealsForUser,
  evaluateWorkoutsForUser,
  ALLERGY_LABELS,
  INJURY_LABELS,
  BUDGET_LABELS,
} from '../symbolic/engine.js';

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function detectQueryIntent(query) {
  const q = normalizeText(query);

  let mealTime = null;
  if (/\b(desayun\w*|manana)\b/.test(q)) mealTime = 'desayuno';
  else if (/\b(almuerz\w*|almorz\w*|comida|mediodia)\b/.test(q)) mealTime = 'almuerzo';
  else if (/\b(cena\w*|noche|nocturn\w*)\b/.test(q)) mealTime = 'cena';

  let budgetTier = null;
  if (/\b(barat\w*|economic\w*|bajo|ahorr\w*|presupuesto bajo|accesible\w*)\b/.test(q)) {
    budgetTier = 'bajo';
  } else if (/\b(medio|sugerid\w*|balancead\w*|equilibrad\w*)\b/.test(q)) {
    budgetTier = 'medio';
  } else if (/\b(alto|gourmet|premium|caro|cara|organic\w*)\b/.test(q)) {
    budgetTier = 'alto';
  }

  const mentionsWorkout =
    /\b(entren\w*|rutina\w*|ejercici\w*|corr\w*|trot\w*|cardio|gym|gimnasio|salt\w*|sentadilla\w*|lesion\w*|rodilla\w*|lumbar\w*|hombro\w*|tobillo\w*|impacto)\b/.test(
      q
    );
  const mentionsRunning = /\b(corr\w*|trot\w*|running|sprint\w*|hiit|salt\w*|pliometria)\b/.test(q);
  const mentionsMeal =
    mealTime !== null ||
    budgetTier !== null ||
    /\b(comer|platillo\w*|menu\w*|receta\w*|proteina\w*|carbo\w*|grasa\w*|alergi\w*|lactosa|gluten|favorit\w*|ingrediente\w*)\b/.test(
      q
    );
  const mentionsWhyDiscard = /\b(por que|descart\w*|no me recom\w*|prohib\w*|exclui\w*|evit\w*)\b/.test(q);
  const mentionsMacros = /\b(caloria\w*|kcal|macro\w*|proteina\w*|carbo\w*|grasa\w*|imc|meta|balance|resumen)\b/.test(q);

  return {
    mealTime,
    budgetTier,
    mentionsWorkout,
    mentionsRunning,
    mentionsMeal,
    mentionsWhyDiscard,
    mentionsMacros,
    rawQuery: query,
    normalizedQuery: q,
  };
}

function resolveTodayLog(user) {
  if (user?.todayLog) return user.todayLog;
  const dateKey = new Date().toISOString().slice(0, 10);
  if (user?.dailyLogs?.[dateKey]) return user.dailyLogs[dateKey];
  return {
    date: dateKey,
    caloriesConsumed: 0,
    proteinConsumed: 0,
    carbsConsumed: 0,
    fatConsumed: 0,
    chosenMeals: [],
    completedWorkouts: [],
  };
}

/**
 * Paso A (Retrieval / Recuperacion Neuro-Simbolica):
 * Consulta el Motor Simbolico con el perfil activo del usuario y recupera:
 * (1) opciones validas filtradas, (2) fichas nutricionales/tecnicas, (3) reglas de descarte activadas.
 */
export function retrieveSymbolicContext(user, query, mealsCatalog, workoutsCatalog) {
  const intent = detectQueryIntent(query);

  const mealEvaluation = evaluateMealsForUser(user, mealsCatalog, {
    mealTime: intent.mealTime,
    budgetTier: intent.budgetTier,
  });
  const workoutEvaluation = evaluateWorkoutsForUser(user, workoutsCatalog);

  const todayLog = resolveTodayLog(user);
  const metabolism = mealEvaluation.metabolism;

  // Filtrar platillos relevantes (maximo 5 para contexto compacto y preciso)
  let relevantMeals = mealEvaluation.validMeals;
  if (intent.budgetTier) {
    const exactTier = relevantMeals.filter((m) => m.budgetTier === intent.budgetTier);
    if (exactTier.length > 0) relevantMeals = exactTier;
  }
  relevantMeals = [...relevantMeals]
    .sort((a, b) => {
      if (a.affinity.isFavorite !== b.affinity.isFavorite) return a.affinity.isFavorite ? -1 : 1;
      if (b.affinity.score !== a.affinity.score) return b.affinity.score - a.affinity.score;
      return (b.suggested ? 1 : 0) - (a.suggested ? 1 : 0);
    })
    .slice(0, 5);

  // Filtrar rutinas relevantes (maximo 4)
  const relevantWorkouts = [...workoutEvaluation.validWorkouts]
    .sort((a, b) => {
      if (b.affinity.score !== a.affinity.score) return b.affinity.score - a.affinity.score;
      if (a.goalMatch !== b.goalMatch) return a.goalMatch ? -1 : 1;
      return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
    })
    .slice(0, 4);

  // Fichas documentales recuperadas
  const mealDocuments = relevantMeals.map((m) => ({
    entityType: 'meal',
    id: m.id,
    title: m.title,
    baseName: m.baseName,
    mealTime: m.mealTime,
    budgetTier: m.budgetTier,
    budgetLabel: BUDGET_LABELS[m.budgetTier],
    estimatedCostUsd: m.estimatedCostUsd,
    mainIngredient: m.mainIngredient.name,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    isFavorite: m.affinity.isFavorite,
    lowPriority: m.affinity.lowPriority,
    sheet: m.nutritionalSheet,
    rulesApplied: m.rulesApplied,
  }));

  const workoutDocuments = relevantWorkouts.map((w) => ({
    entityType: 'workout',
    id: w.id,
    title: w.title,
    groupName: w.groupName,
    durationMin: w.durationMin,
    caloriesBurned: w.caloriesBurned,
    impactLevel: w.impactLevel,
    mainBenefit: w.mainBenefit,
    exercises: w.exercises,
    sheet: w.technicalSheet,
    rulesVerified: w.explainability.rulesVerified,
  }));

  // Reglas de descarte activadas por alergias, consistencia o lesiones
  const mealDiscardTraces = mealEvaluation.discardedMeals.map((d) => ({
    entityType: 'meal',
    id: d.id,
    title: d.title,
    mealTime: d.mealTime,
    budgetTier: d.budgetTier,
    rule: d.rule,
    reason: d.discardReason,
  }));

  const workoutDiscardTraces = workoutEvaluation.discardedWorkouts.map((d) => ({
    entityType: 'workout',
    id: d.id,
    title: d.title,
    impactLevel: d.impactLevel,
    contraindications: d.contraindications,
    rule: d.rule,
    reason: d.discardReason,
  }));

  const activeRules = [
    `perfil_activo(${user.name}, rol=${user.role}, estado=${user.status})`,
    `objetivo_calorico(Mifflin_St_Jeor, meta=${metabolism.targetCalories}kcal, restante=${Math.max(0, metabolism.targetCalories - todayLog.caloriesConsumed)}kcal)`,
    ...(user.allergies || []).map((a) => `restriccion_alergia(${a}, "${ALLERGY_LABELS[a] || a}")`),
    ...(user.injuries || []).map((i) => `restriccion_lesion(${i}, "${INJURY_LABELS[i] || i}")`),
  ];

  return {
    intent,
    profileSummary: {
      name: user.name,
      role: user.role,
      status: user.status,
      goal: user.goal,
      goalLabel: metabolism.goalLabel,
      activityLabel: metabolism.activityLabel,
      imc: metabolism.imc,
      bmr: metabolism.bmr,
      tdee: metabolism.tdee,
      targetCalories: metabolism.targetCalories,
      caloriesConsumedToday: todayLog.caloriesConsumed,
      caloriesRemainingToday: Math.max(0, metabolism.targetCalories - todayLog.caloriesConsumed),
      macrosTarget: metabolism.macrosTarget,
      macrosConsumedToday: {
        protein: todayLog.proteinConsumed,
        carbs: todayLog.carbsConsumed,
        fat: todayLog.fatConsumed,
      },
      allergies: (user.allergies || []).map((a) => ({ key: a, label: ALLERGY_LABELS[a] || a })),
      injuries: (user.injuries || []).map((i) => ({ key: i, label: INJURY_LABELS[i] || i })),
    },
    validMealsCount: mealEvaluation.validMeals.length,
    validWorkoutsCount: workoutEvaluation.validWorkouts.length,
    documents: {
      meals: mealDocuments,
      workouts: workoutDocuments,
    },
    discardTraces: {
      meals: mealDiscardTraces,
      workouts: workoutDiscardTraces,
    },
    activeRules,
  };
}
