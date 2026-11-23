/**
 * Motor Simbolico Determinista de Samba (Equivalente declarativo a reglas Prolog).
 *
 * Reglas implementadas:
 * 1. descartado(Usuario, Platillo, Razon) - Filtrado duro por alergias/intolerancias.
 * 2. precio_consistente(Platillo) - Valida coherencia entre nivel de precio del platillo y su ingrediente principal + banda calorica.
 * 3. ejercicio_descartado(Usuario, Rutina, Razon) - Filtrado duro por lesiones (excluye alto impacto y contraindicaciones).
 * 4. Afinidad y prioridad:
 *    - Platillos: Elegir (+2 puntos; >= 2 veces -> "Favorito"), Ignorar (-1 punto; >= 2 veces -> baja prioridad).
 *    - Entrenos: Completar/calificar positivamente (+1 punto), calificar negativamente (-1 punto).
 * 5. Registro exacto de trazas logicas para UI y pipeline RAG.
 */

import { calculateMifflinStJeor } from './mifflin.js';
import { detectAllergensFromText, classifyExerciseImpact } from './keywords.js';

export const ALLERGY_LABELS = {
  gluten: 'Sin gluten / Celiaco',
  lactosa: 'Lactosa / Lacteos',
  frutos_secos: 'Frutos secos / Cacahuates',
  pescados_mariscos: 'Pescados y mariscos',
  huevo: 'Huevo',
};

export const INJURY_LABELS = {
  rodilla: 'Rodilla',
  lumbar: 'Zona lumbar / Espalda baja',
  hombro: 'Hombro',
  tobillo: 'Tobillo',
};

export const BUDGET_LABELS = {
  bajo: 'Presupuesto Bajo',
  medio: 'Presupuesto Medio',
  alto: 'Presupuesto Alto',
};

function createTrace({ rule, entityType, entityId, entityTitle, outcome, reason, details = {} }) {
  return {
    id: `${rule}_${entityId}_${Math.random().toString(36).slice(2, 7)}`,
    rule,
    entityType,
    entityId,
    entityTitle,
    outcome,
    reason,
    details,
    timestamp: new Date().toISOString(),
  };
}

export function detectAllergensInMealText(meal) {
  const blob = [
    meal?.title,
    meal?.description,
    meal?.mainIngredient?.name,
    ...(Array.isArray(meal?.ingredients) ? meal.ingredients : []),
  ]
    .filter(Boolean)
    .join(' ');
  return detectAllergensFromText(blob);
}

export function detectHighImpactInWorkoutText(workout) {
  const blob = [
    workout?.title,
    workout?.technicalSheet,
    ...(Array.isArray(workout?.exercises) ? workout.exercises : []),
  ]
    .filter(Boolean)
    .join(' ');
  return classifyExerciseImpact(blob);
}

/**
 * Regla Prolog equivalente:
 * descartado(U, P, alergia(A)) :- alergia_usuario(U, A), contiene_alergeno(P, A).
 * Incluye validacion semantica sobre ingredientes y texto para blindar salidas de IA.
 */
export function checkAllergyDiscard(user, meal) {
  const userAllergies = Array.isArray(user?.allergies) ? user.allergies : [];
  const mealAllergens = Array.isArray(meal?.allergens) ? meal.allergens : [];
  const mainAllergens = Array.isArray(meal?.mainIngredient?.allergens)
    ? meal.mainIngredient.allergens
    : [];
  const detectedFromIngredients = detectAllergensInMealText(meal);

  const combinedMealAllergens = Array.from(
    new Set([...mealAllergens, ...mainAllergens, ...detectedFromIngredients])
  );
  const conflicts = combinedMealAllergens.filter((a) => userAllergies.includes(a));

  if (conflicts.length > 0) {
    const names = conflicts.map((c) => ALLERGY_LABELS[c] || c).join(', ');
    return {
      discarded: true,
      conflicts,
      rule: `descartado(${meal.id}, alergia([${conflicts.join(',')}]))`,
      reason: `Descartado por restriccion del usuario (${names}). Contiene alergeno en ${meal.mainIngredient?.name || meal.title}.`,
    };
  }

  return { discarded: false, conflicts: [], rule: null, reason: null };
}

/**
 * Regla Prolog equivalente:
 * precio_consistente(P) :-
 *   nivel_precio_platillo(P, Nivel),
 *   ingrediente_principal(P, Ing),
 *   nivel_precio_ingrediente(Ing, Nivel),
 *   calorias_consistentes(P).
 */
export function checkPriceConsistency(meal, mealBand) {
  const dishTier = meal?.budgetTier;
  const ingredientTier = meal?.mainIngredient?.priceTier;
  const validTiers = ['bajo', 'medio', 'alto'];

  if (!validTiers.includes(dishTier) || !validTiers.includes(ingredientTier)) {
    return {
      consistent: false,
      rule: `not(precio_consistente(${meal?.id || 'unknown'}))`,
      reason: 'Nivel de precio invalido o faltante en platillo o ingrediente principal.',
    };
  }

  if (dishTier !== ingredientTier) {
    return {
      consistent: false,
      rule: `not(precio_consistente(${meal.id}))`,
      reason: `Inconsistencia de presupuesto: platillo clasificado como '${dishTier}' pero ingrediente principal ('${meal.mainIngredient?.name}') es '${ingredientTier}'.`,
    };
  }

  const cals = Number(meal?.calories || 0);
  // Margen amplio de consistencia metabolica por tiempo de comida (+/- 38% sobre banda base)
  const minSafe = mealBand ? Math.round(mealBand.min * 0.62) : 250;
  const maxSafe = mealBand ? Math.round(mealBand.max * 1.48) : 950;
  const caloriesConsistent = cals >= minSafe && cals <= maxSafe;

  if (!caloriesConsistent) {
    return {
      consistent: false,
      rule: `not(calorias_consistentes(${meal.id}))`,
      reason: `Inconsistencia calorica: ${cals} kcal queda fuera del rango metabolico esperado (${minSafe}-${maxSafe} kcal) para ${meal.mealTime}.`,
    };
  }

  return {
    consistent: true,
    rule: `precio_consistente(${meal.id}, ${dishTier})`,
    reason: `Precio consistente (${BUDGET_LABELS[dishTier]} = ingrediente principal '${meal.mainIngredient.name}') y carga calorica valida (${cals} kcal).`,
  };
}

/**
 * Regla Prolog equivalente:
 * ejercicio_descartado(U, R, lesion(L)) :-
 *   lesion_usuario(U, L),
 *   (contraindicado(R, L) ; (impacto(R, alto), lesion_impacto(L))).
 */
export function checkWorkoutDiscard(user, workout) {
  const userInjuries = Array.isArray(user?.injuries) ? user.injuries : [];
  if (userInjuries.length === 0) {
    return { discarded: false, conflicts: [], rule: null, reason: null };
  }

  const contraindications = Array.isArray(workout?.contraindications)
    ? workout.contraindications
    : [];
  const inferredFromText = detectHighImpactInWorkoutText(workout);
  const effectiveImpact =
    inferredFromText.impactLevel === 'alto' ? 'alto' : workout?.impactLevel;
  const effectiveContraindications = Array.from(
    new Set([...contraindications, ...inferredFromText.contraindications])
  );
  const impactLowerBodyInjuries = ['rodilla', 'tobillo', 'lumbar'];

  const directConflicts = effectiveContraindications.filter((c) => userInjuries.includes(c));
  const impactConflicts =
    effectiveImpact === 'alto'
      ? userInjuries.filter((inj) => impactLowerBodyInjuries.includes(inj))
      : [];

  const allConflicts = Array.from(new Set([...directConflicts, ...impactConflicts]));

  if (allConflicts.length > 0) {
    const injuryNames = allConflicts.map((i) => INJURY_LABELS[i] || i).join(', ');
    return {
      discarded: true,
      conflicts: allConflicts,
      rule: `ejercicio_descartado(${workout.id}, lesion([${allConflicts.join(',')}]))`,
      reason: `Excluido por seguridad articular (${injuryNames}). Rutina de impacto ${workout.impactLevel} contraindicada para tu lesion activa.`,
    };
  }

  return { discarded: false, conflicts: [], rule: null, reason: null };
}

export function getMealAffinityState(user, mealId) {
  const record = user?.affinity?.meals?.[mealId] || {
    score: 0,
    chosenCount: 0,
    ignoredCount: 0,
  };
  const isFavorite = record.chosenCount >= 2;
  const lowPriority = record.ignoredCount >= 2 && !isFavorite;
  return {
    score: record.score || 0,
    chosenCount: record.chosenCount || 0,
    ignoredCount: record.ignoredCount || 0,
    isFavorite,
    lowPriority,
  };
}

export function getWorkoutAffinityState(user, workoutId) {
  const record = user?.affinity?.workouts?.[workoutId] || {
    score: 0,
    completedCount: 0,
    positiveCount: 0,
    negativeCount: 0,
  };
  return {
    score: record.score || 0,
    completedCount: record.completedCount || 0,
    positiveCount: record.positiveCount || 0,
    negativeCount: record.negativeCount || 0,
  };
}

/**
 * Evalua todo el catalogo de platillos para un usuario y tiempo de comida.
 */
export function evaluateMealsForUser(user, allMeals, options = {}) {
  const mealTime = options.mealTime || null;
  const budgetFilter = options.budgetTier || null;
  const metabolism = calculateMifflinStJeor(user);

  const candidates = allMeals.filter((m) => (!mealTime ? true : m.mealTime === mealTime));
  const validMeals = [];
  const discardedMeals = [];
  const traces = [];

  for (const meal of candidates) {
    const allergyCheck = checkAllergyDiscard(user, meal);
    if (allergyCheck.discarded) {
      const trace = createTrace({
        rule: allergyCheck.rule,
        entityType: 'meal',
        entityId: meal.id,
        entityTitle: meal.title,
        outcome: 'discarded',
        reason: allergyCheck.reason,
        details: { mealTime: meal.mealTime, budgetTier: meal.budgetTier, conflicts: allergyCheck.conflicts },
      });
      traces.push(trace);
      discardedMeals.push({
        ...meal,
        discardReason: allergyCheck.reason,
        rule: allergyCheck.rule,
        conflicts: allergyCheck.conflicts,
      });
      continue;
    }

    const mealBand = metabolism.mealBands[meal.mealTime];
    const priceCheck = checkPriceConsistency(meal, mealBand);
    if (!priceCheck.consistent) {
      const trace = createTrace({
        rule: priceCheck.rule,
        entityType: 'meal',
        entityId: meal.id,
        entityTitle: meal.title,
        outcome: 'discarded',
        reason: priceCheck.reason,
        details: { mealTime: meal.mealTime, budgetTier: meal.budgetTier },
      });
      traces.push(trace);
      discardedMeals.push({
        ...meal,
        discardReason: priceCheck.reason,
        rule: priceCheck.rule,
      });
      continue;
    }

    if (budgetFilter && meal.budgetTier !== budgetFilter) {
      continue;
    }

    const affinity = getMealAffinityState(user, meal.id);
    const tierOrder = meal.budgetTier === 'bajo' ? 1 : meal.budgetTier === 'medio' ? 2 : 3;

    const rulesApplied = [
      `alergias_seguras(${meal.id})`,
      priceCheck.rule,
    ];
    if (affinity.isFavorite) rulesApplied.push(`favorito(${meal.id}, veces=${affinity.chosenCount})`);
    if (affinity.lowPriority) rulesApplied.push(`baja_prioridad(${meal.id}, ignorado=${affinity.ignoredCount})`);

    const whyParts = [
      `Aporta ${meal.calories} kcal (${meal.protein}g P, ${meal.carbs}g C, ${meal.fat}g G) alineadas a tu meta diaria de ${metabolism.targetCalories} kcal.`,
      `Cumple consistencia de presupuesto (${BUDGET_LABELS[meal.budgetTier]}) usando '${meal.mainIngredient.name}'.`,
    ];
    if ((user?.allergies || []).length > 0) {
      whyParts.push('Verificado libre de tus alergias e intolerancias declaradas.');
    }
    if (affinity.isFavorite) {
      whyParts.push(`Marcado como Favorito tras elegirlo ${affinity.chosenCount} veces (afinidad +${affinity.score}).`);
    } else if (affinity.lowPriority) {
      whyParts.push(`Prioridad reducida tras ignorarlo ${affinity.ignoredCount} veces (afinidad ${affinity.score}).`);
    }

    const validTrace = createTrace({
      rule: priceCheck.rule,
      entityType: 'meal',
      entityId: meal.id,
      entityTitle: meal.title,
      outcome: 'valid',
      reason: whyParts.join(' '),
      details: { mealTime: meal.mealTime, budgetTier: meal.budgetTier, affinityScore: affinity.score },
    });
    traces.push(validTrace);

    validMeals.push({
      ...meal,
      tierOrder,
      affinity,
      priceConsistency: priceCheck,
      rulesApplied,
      whyRecommended: whyParts.join(' '),
    });
  }

  // Agrupar por platillo base para la UI (manteniendo hasta 3 opciones de presupuesto por platillo base)
  const baseMap = new Map();
  for (const meal of validMeals) {
    if (!baseMap.has(meal.baseId)) {
      baseMap.set(meal.baseId, {
        baseId: meal.baseId,
        baseName: meal.baseName,
        mealTime: meal.mealTime,
        options: [],
        maxAffinity: -999,
        hasFavorite: false,
      });
    }
    const group = baseMap.get(meal.baseId);
    group.options.push(meal);
    if (meal.affinity.score > group.maxAffinity) {
      group.maxAffinity = meal.affinity.score;
    }
    if (meal.affinity.isFavorite) {
      group.hasFavorite = true;
    }
  }

  // Ordenar opciones dentro de cada base: bajo -> medio -> alto (si no son baja prioridad, o enviando baja prioridad al final si hay empate)
  const baseDishes = Array.from(baseMap.values()).map((group) => {
    group.options.sort((a, b) => {
      if (a.affinity.lowPriority !== b.affinity.lowPriority) {
        return a.affinity.lowPriority ? 1 : -1;
      }
      if (a.affinity.isFavorite !== b.affinity.isFavorite) {
        return a.affinity.isFavorite ? -1 : 1;
      }
      return a.tierOrder - b.tierOrder;
    });
    return group;
  });

  // Ordenar platillos base priorizando favoritos y mayor afinidad acumulada
  baseDishes.sort((a, b) => {
    if (a.hasFavorite !== b.hasFavorite) return a.hasFavorite ? -1 : 1;
    if (b.maxAffinity !== a.maxAffinity) return b.maxAffinity - a.maxAffinity;
    return b.options.length - a.options.length;
  });

  const activeMealBand = mealTime
    ? metabolism.mealBands[mealTime]
    : metabolism.mealBands.almuerzo;

  return {
    metabolism,
    mealGoal: activeMealBand,
    baseDishes,
    validMeals,
    discardedMeals,
    traces,
  };
}

/**
 * Evalua todas las rutinas de entrenamiento contra lesiones, objetivo y afinidad.
 */
export function evaluateWorkoutsForUser(user, allWorkouts) {
  const metabolism = calculateMifflinStJeor(user);
  const userGoal = user?.goal || 'perder_grasa';
  const userInjuries = Array.isArray(user?.injuries) ? user.injuries : [];

  const validWorkouts = [];
  const discardedWorkouts = [];
  const traces = [];

  for (const workout of allWorkouts) {
    const injuryCheck = checkWorkoutDiscard(user, workout);
    if (injuryCheck.discarded) {
      const trace = createTrace({
        rule: injuryCheck.rule,
        entityType: 'workout',
        entityId: workout.id,
        entityTitle: workout.title,
        outcome: 'discarded',
        reason: injuryCheck.reason,
        details: {
          groupId: workout.groupId,
          impactLevel: workout.impactLevel,
          conflicts: injuryCheck.conflicts,
        },
      });
      traces.push(trace);
      discardedWorkouts.push({
        ...workout,
        discardReason: injuryCheck.reason,
        rule: injuryCheck.rule,
        conflicts: injuryCheck.conflicts,
      });
      continue;
    }

    const affinity = getWorkoutAffinityState(user, workout.id);
    const goalMatch = Array.isArray(workout.targetGoals) && workout.targetGoals.includes(userGoal);

    const rulesVerified = [`impacto_seguro(${workout.id}, ${workout.impactLevel})`];
    if (userInjuries.length > 0) {
      rulesVerified.push(
        `proteccion_articular(${workout.id}, lesiones_respetadas=[${userInjuries.join(',')}])`
      );
    }
    if (goalMatch) {
      rulesVerified.push(`objetivo_alineado(${workout.id}, ${userGoal})`);
    }
    if (affinity.score !== 0) {
      rulesVerified.push(`afinidad_rutina(${workout.id}, ${affinity.score >= 0 ? '+' : ''}${affinity.score})`);
    }

    const injuryText =
      userInjuries.length > 0
        ? `Compatible con tu proteccion de ${userInjuries.map((i) => INJURY_LABELS[i] || i).join(', ')} gracias a su impacto ${workout.impactLevel}.`
        : `Impacto ${workout.impactLevel} apto para tu perfil fisico sin lesiones declaradas.`;

    const goalText = goalMatch
      ? `Alineada directamente con tu objetivo (${metabolism.goalLabel}).`
      : `Complemento aerobico y de fuerza general para tu meta (${metabolism.goalLabel}).`;

    const explainability = {
      summary: `${injuryText} ${goalText}`,
      rulesVerified,
      injuryProtection: injuryText,
      goalMatch: goalText,
      affinityScore: affinity.score,
    };

    const validTrace = createTrace({
      rule: rulesVerified[0],
      entityType: 'workout',
      entityId: workout.id,
      entityTitle: workout.title,
      outcome: 'valid',
      reason: explainability.summary,
      details: { groupId: workout.groupId, impactLevel: workout.impactLevel, affinityScore: affinity.score },
    });
    traces.push(validTrace);

    validWorkouts.push({
      ...workout,
      affinity,
      goalMatch,
      explainability,
    });
  }

  // Agrupar por enfoque muscular/funcional
  const groupMap = new Map();
  for (const w of validWorkouts) {
    if (!groupMap.has(w.groupId)) {
      groupMap.set(w.groupId, {
        groupId: w.groupId,
        groupName: w.groupName,
        options: [],
      });
    }
    groupMap.get(w.groupId).options.push(w);
  }

  const groups = Array.from(groupMap.values()).map((g) => {
    g.options.sort((a, b) => {
      if (b.affinity.score !== a.affinity.score) return b.affinity.score - a.affinity.score;
      if (a.goalMatch !== b.goalMatch) return a.goalMatch ? -1 : 1;
      return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
    });
    return g;
  });

  const minBurn = validWorkouts.length
    ? Math.min(...validWorkouts.map((w) => w.caloriesBurned))
    : 250;
  const maxBurn = validWorkouts.length
    ? Math.max(...validWorkouts.map((w) => w.caloriesBurned))
    : 380;

  return {
    metabolism,
    sessionGoal: {
      minCalories: minBurn,
      maxCalories: maxBurn,
      activityLabel: metabolism.activityLabel,
    },
    groups,
    validWorkouts,
    discardedWorkouts,
    traces,
  };
}
