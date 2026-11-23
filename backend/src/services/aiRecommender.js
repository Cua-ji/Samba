import { calculateMifflinStJeor } from '../symbolic/mifflin.js';
import {
  ALLERGY_LABELS,
  INJURY_LABELS,
  checkAllergyDiscard,
  checkPriceConsistency,
  checkWorkoutDiscard,
} from '../symbolic/engine.js';
import {
  fetchAndCacheUsdaFoods,
  fetchAndCacheWgerExercises,
} from './externalData.js';
import { ollamaChat, stripEmojis } from './ollama.js';
import {
  addUserHistoryEvent,
  createCatalogMeal,
  createCatalogWorkout,
  getMealsCatalog,
  getWorkoutsCatalog,
  saveLogicalTraces,
} from '../db/repository.js';

const MEAL_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['baseName', 'variants'],
  properties: {
    baseName: { type: 'string' },
    variants: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        required: [
          'budgetTier',
          'title',
          'description',
          'prepMinutes',
          'estimatedCostUsd',
          'mainIngredientName',
          'ingredients',
          'calories',
          'protein',
          'carbs',
          'fat',
          'nutritionalSheet',
          'usedUsdaFdcIds',
        ],
        properties: {
          budgetTier: { type: 'string', enum: ['bajo', 'medio', 'alto'] },
          title: { type: 'string' },
          description: { type: 'string' },
          prepMinutes: { type: 'integer' },
          estimatedCostUsd: { type: 'number' },
          mainIngredientName: { type: 'string' },
          ingredients: { type: 'array', items: { type: 'string' } },
          calories: { type: 'integer' },
          protein: { type: 'integer' },
          carbs: { type: 'integer' },
          fat: { type: 'integer' },
          nutritionalSheet: { type: 'string' },
          usedUsdaFdcIds: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
  },
};

const WORKOUT_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['groupName', 'routines'],
  properties: {
    groupName: { type: 'string' },
    routines: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        required: [
          'title',
          'durationMin',
          'equipment',
          'caloriesBurned',
          'intensity',
          'impactLevel',
          'mainBenefit',
          'exercises',
          'technicalSheet',
          'usedWgerIds',
        ],
        properties: {
          title: { type: 'string' },
          durationMin: { type: 'integer' },
          equipment: { type: 'string' },
          caloriesBurned: { type: 'integer' },
          intensity: { type: 'string' },
          impactLevel: { type: 'string', enum: ['bajo', 'medio', 'alto'] },
          mainBenefit: { type: 'string' },
          exercises: { type: 'array', items: { type: 'string' } },
          technicalSheet: { type: 'string' },
          usedWgerIds: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
  },
};

function sanitizeVisualTheme(mealTime, budgetTier) {
  const suffix = budgetTier === 'bajo' ? 'classic' : budgetTier === 'medio' ? 'balanced' : 'gourmet';
  const prefix = mealTime === 'desayuno' ? 'bowl' : mealTime === 'cena' ? 'dinner' : 'chicken';
  return `${prefix}_${suffix}`;
}

export async function generatePersonalizedMealWithAI(user, mealTime = 'almuerzo') {
  const metabolism = calculateMifflinStJeor(user);
  const mealBand = metabolism.mealBands[mealTime] || metabolism.mealBands.almuerzo;
  const userAllergies = Array.isArray(user.allergies) ? user.allergies : [];
  const usdaFoods = await fetchAndCacheUsdaFoods({ allergies: userAllergies, mealTime });

  const allMeals = await getMealsCatalog(null, user.id);
  const favoriteMeals = allMeals
    .filter((m) => (user.affinity?.meals?.[m.id]?.chosenCount || 0) >= 2)
    .map((m) => m.title);
  const ignoredMeals = allMeals
    .filter((m) => (user.affinity?.meals?.[m.id]?.ignoredCount || 0) >= 2)
    .map((m) => m.title);

  const allergyDescriptions =
    userAllergies.length > 0
      ? userAllergies.map((a) => `${a} (${ALLERGY_LABELS[a] || a})`).join(', ')
      : 'Ninguna';

  const systemPrompt = [
    'Eres un nutricionista clinico para Samba (Whixte & Co.).',
    'Responde UNICAMENTE en JSON valido siguiendo el esquema requerido, completamente en espanol y SIN emojis.',
    'REGLAS ESTRICTAS:',
    `1. El usuario tiene alergias/intolerancias: [${allergyDescriptions}]. PROHIBIDO incluir cualquier alimento o derivado de esas alergias en titulos, descripciones o ingredientes.`,
    `2. Crea UN platillo base coherente para '${mealTime}' con exactamente 3 variantes de presupuesto: 'bajo', 'medio' y 'alto', variando el ingrediente principal segun el presupuesto.`,
    `3. Cada variante debe estar entre ${mealBand.min} y ${mealBand.max} kcal (meta ideal ${mealBand.target} kcal).`,
    '4. Basate en los alimentos verificados de USDA FoodData Central proporcionados abajo y cita sus fdcId en usedUsdaFdcIds.',
  ].join('\n');

  const baseUserPrompt = JSON.stringify(
    {
      perfilUsuario: {
        nombre: user.name,
        objetivo: metabolism.goalLabel,
        metaCaloricaDiaria: metabolism.targetCalories,
        tiempoComida: mealTime,
        rangoCaloricoObjetivo: mealBand,
        alergiasProhibidas: userAllergies,
        favoritosDelUsuario: favoriteMeals,
        platillosIgnorados: ignoredMeals,
      },
      fuentesUsdaDisponibles: usdaFoods.slice(0, 10).map((f) => ({
        fdcId: f.fdcId,
        alimento: f.description,
        por100g: { kcal: f.calories, prot: f.protein, carb: f.carbs, grasa: f.fat },
      })),
    },
    null,
    2
  );

  let promptToSend = baseUserPrompt;
  let lastError = null;
  let validatedVariants = null;
  let parsedBaseName = null;
  let modelUsed = null;
  let retries = 0;
  const validationRejections = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    retries = attempt;
    const response = await ollamaChat({
      systemPrompt,
      userPrompt: promptToSend,
      formatSchema: MEAL_RESPONSE_SCHEMA,
      temperature: attempt === 0 ? 0.25 : 0.1,
      timeoutMs: 65000,
    });
    modelUsed = response.modelUsed;

    let parsed;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      lastError = 'La respuesta de Ollama no fue JSON valido.';
      promptToSend = `${baseUserPrompt}\n\nCORRECCION OBLIGATORIA: Devuelve unicamente un objeto JSON valido sin texto extra.`;
      continue;
    }

    const rawVariants = Array.isArray(parsed.variants) ? parsed.variants : [];
    const tiers = ['bajo', 'medio', 'alto'];
    const normalized = [];
    const errors = [];

    for (let idx = 0; idx < tiers.length; idx++) {
      const expectedTier = tiers[idx];
      const v =
        rawVariants.find((item) => item.budgetTier === expectedTier) || rawVariants[idx];
      if (!v) {
        errors.push(`Falta variante para presupuesto ${expectedTier}`);
        continue;
      }

      const cleanTitle = stripEmojis(v.title || `Opcion ${expectedTier}`);
      const cleanDesc = stripEmojis(v.description || '');
      const cleanMain = stripEmojis(v.mainIngredientName || cleanTitle);
      const cleanIngredients = (Array.isArray(v.ingredients) ? v.ingredients : [cleanMain])
        .map((x) => stripEmojis(x))
        .filter(Boolean);

      const protein = Math.max(12, Math.min(80, Math.round(Number(v.protein) || 32)));
      const carbs = Math.max(10, Math.min(110, Math.round(Number(v.carbs) || 45)));
      const fat = Math.max(4, Math.min(45, Math.round(Number(v.fat) || 14)));
      const computedKcal = protein * 4 + carbs * 4 + fat * 9;
      let calories = Math.round(Number(v.calories) || computedKcal);
      if (Math.abs(calories - computedKcal) > 120) {
        calories = computedKcal;
      }
      calories = Math.max(mealBand.min - 40, Math.min(mealBand.max + 60, calories));

      const defaultCost = expectedTier === 'bajo' ? 2.9 : expectedTier === 'medio' ? 5.1 : 8.6;
      const cost = Number(v.estimatedCostUsd) || defaultCost;

      const usedIds = Array.isArray(v.usedUsdaFdcIds) ? v.usedUsdaFdcIds : [];
      const citedSources = usdaFoods
        .filter((f) => usedIds.includes(f.fdcId))
        .slice(0, 4)
        .map((f) => ({
          provider: 'USDA FoodData Central',
          fdcId: f.fdcId,
          description: f.description,
        }));
      if (citedSources.length === 0 && usdaFoods[0]) {
        citedSources.push({
          provider: 'USDA FoodData Central',
          fdcId: usdaFoods[0].fdcId,
          description: usdaFoods[0].description,
        });
      }

      const candidate = {
        mealTime,
        budgetTier: expectedTier,
        suggested: expectedTier === 'medio',
        title: cleanTitle,
        description: cleanDesc,
        prepMinutes: Math.max(5, Math.min(45, Math.round(Number(v.prepMinutes) || 15))),
        estimatedCostUsd: Number(cost.toFixed(2)),
        badges: [
          `${Math.max(5, Math.min(45, Math.round(Number(v.prepMinutes) || 15)))} min prep`,
          'IA Local + USDA',
        ],
        mainIngredient: {
          name: cleanMain,
          priceTier: expectedTier,
          allergens: [],
        },
        ingredients: cleanIngredients,
        allergens: [],
        calories,
        protein,
        carbs,
        fat,
        visualTheme: sanitizeVisualTheme(mealTime, expectedTier),
        nutritionalSheet: stripEmojis(
          v.nutritionalSheet ||
            `Ficha nutricional generada con respaldo USDA: ${calories} kcal (${protein}g proteina, ${carbs}g carbohidratos, ${fat}g grasas).`
        ),
        source: 'ollama_usda_ai',
        generatedForUserId: user.id,
        dataSources: citedSources,
      };

      const allergyCheck = checkAllergyDiscard(user, candidate);
      if (allergyCheck.discarded) {
        errors.push(`Variante ${expectedTier} rechazada: ${allergyCheck.reason}`);
        validationRejections.push({
          rule: allergyCheck.rule,
          entityType: 'meal',
          entityId: `ai_guardrail_${expectedTier}`,
          entityTitle: candidate.title,
          outcome: 'ai_guardrail_rejected',
          reason: `Guardrail simbolico bloqueo propuesta de Ollama: ${allergyCheck.reason}`,
          details: { attempt, mealTime },
        });
        continue;
      }

      const priceCheck = checkPriceConsistency(candidate, mealBand);
      if (!priceCheck.consistent) {
        errors.push(`Variante ${expectedTier} inconsistente: ${priceCheck.reason}`);
        validationRejections.push({
          rule: priceCheck.rule,
          entityType: 'meal',
          entityId: `ai_guardrail_${expectedTier}`,
          entityTitle: candidate.title,
          outcome: 'ai_guardrail_rejected',
          reason: priceCheck.reason,
          details: { attempt, mealTime },
        });
        continue;
      }

      normalized.push(candidate);
    }

    if (errors.length === 0 && normalized.length === 3) {
      validatedVariants = normalized;
      parsedBaseName = stripEmojis(parsed.baseName || `Base IA: ${normalized[1].title}`);
      if (!parsedBaseName.toLowerCase().startsWith('base:')) {
        parsedBaseName = `Base IA: ${parsedBaseName}`;
      }
      break;
    }

    lastError = errors.join(' | ');
    promptToSend = `${baseUserPrompt}\n\nRECHAZO DEL MOTOR SIMBOLICO: ${lastError}. Regenera las 3 variantes evitando estrictamente esos alergenos o errores.`;
  }

  if (validationRejections.length > 0) {
    await saveLogicalTraces(user.id, validationRejections);
  }

  if (!validatedVariants) {
    throw new Error(
      `El Motor Simbolico rechazo la propuesta de IA tras validar reglas: ${lastError}`
    );
  }

  const baseId = `base_ai_${mealTime}_${Date.now().toString(36)}`;
  const savedMeals = [];
  for (const variant of validatedVariants) {
    const saved = await createCatalogMeal({
      ...variant,
      baseId,
      baseName: parsedBaseName,
    });
    savedMeals.push(saved);
  }

  await addUserHistoryEvent(user.id, {
    eventType: 'ai_meal_generated',
    entityId: baseId,
    label: `Platillo IA generado (${modelUsed} + USDA): ${parsedBaseName}`,
    delta: 0,
  });

  await saveLogicalTraces(user.id, [
    {
      rule: `generacion_ia_aprobada(${baseId}, modelo=${modelUsed}, fuente=USDA)`,
      entityType: 'meal',
      entityId: baseId,
      entityTitle: parsedBaseName,
      outcome: 'ai_approved',
      reason: `3 variantes de presupuesto aprobadas sin alergenos (${allergyDescriptions}) y con precio_consistente.`,
      details: { mealTime, retries, usdaSourcesCount: usdaFoods.length },
    },
  ]);

  return {
    baseId,
    baseName: parsedBaseName,
    variants: savedMeals,
    providerUsed: 'ollama',
    modelUsed,
    retries,
    usdaSourcesUsed: usdaFoods.slice(0, 6),
  };
}

export async function generatePersonalizedWorkoutsWithAI(user) {
  const metabolism = calculateMifflinStJeor(user);
  const userInjuries = Array.isArray(user.injuries) ? user.injuries : [];
  const safeExercises = await fetchAndCacheWgerExercises({ injuries: userInjuries });

  const allWorkouts = await getWorkoutsCatalog(user.id);
  const likedWorkouts = allWorkouts
    .filter((w) => (user.affinity?.workouts?.[w.id]?.score || 0) > 0)
    .map((w) => w.title);
  const dislikedWorkouts = allWorkouts
    .filter((w) => (user.affinity?.workouts?.[w.id]?.score || 0) < 0)
    .map((w) => w.title);

  const injuryDescriptions =
    userInjuries.length > 0
      ? userInjuries.map((i) => `${i} (${INJURY_LABELS[i] || i})`).join(', ')
      : 'Ninguna';

  const systemPrompt = [
    'Eres un preparador fisico clinico para Samba (Whixte & Co.).',
    'Responde UNICAMENTE en JSON valido siguiendo el esquema requerido, completamente en espanol y SIN emojis.',
    'REGLAS ESTRICTAS:',
    `1. Lesiones activas del usuario: [${injuryDescriptions}].`,
    userInjuries.length > 0
      ? '2. OBLIGATORIO: Todas las rutinas deben ser de impacto "bajo" y esta ESTRICTAMENTE PROHIBIDO incluir correr, trotar, sprints, saltos, burpees, pliometria, sentadillas pesadas o movimientos de alto impacto.'
      : '2. Puedes variar la intensidad de forma segura segun el objetivo del usuario.',
    '3. Crea exactamente 3 rutinas complementarias (20 a 45 minutos) adaptadas al objetivo del usuario.',
    '4. Basate en los ejercicios verificados de wger Workout API proporcionados y cita sus wgerId en usedWgerIds.',
  ].join('\n');

  const baseUserPrompt = JSON.stringify(
    {
      perfilUsuario: {
        nombre: user.name,
        objetivo: metabolism.goalLabel,
        nivelActividad: metabolism.activityLabel,
        lesionesActivas: userInjuries,
        rutinasPreferidas: likedWorkouts,
        rutinasEvitadas: dislikedWorkouts,
      },
      ejerciciosWgerSeguros: safeExercises.slice(0, 12).map((e) => ({
        wgerId: e.wgerId,
        nombre: e.name,
        categoria: e.category,
        musculos: e.muscles,
        impacto: e.impactLevel,
      })),
    },
    null,
    2
  );

  let promptToSend = baseUserPrompt;
  let lastError = null;
  let validatedRoutines = null;
  let parsedGroupName = null;
  let modelUsed = null;
  let retries = 0;
  const validationRejections = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    retries = attempt;
    const response = await ollamaChat({
      systemPrompt,
      userPrompt: promptToSend,
      formatSchema: WORKOUT_RESPONSE_SCHEMA,
      temperature: attempt === 0 ? 0.25 : 0.1,
      timeoutMs: 65000,
    });
    modelUsed = response.modelUsed;

    let parsed;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      lastError = 'La respuesta de Ollama no fue JSON valido.';
      promptToSend = `${baseUserPrompt}\n\nCORRECCION OBLIGATORIA: Devuelve unicamente JSON valido.`;
      continue;
    }

    const rawRoutines = Array.isArray(parsed.routines) ? parsed.routines : [];
    const normalized = [];
    const errors = [];

    for (let idx = 0; idx < Math.min(3, rawRoutines.length); idx++) {
      const r = rawRoutines[idx];
      const cleanTitle = stripEmojis(r.title || `Rutina Adaptada ${idx + 1}`);
      const cleanExercises = (Array.isArray(r.exercises) ? r.exercises : [])
        .map((ex) => stripEmojis(ex))
        .filter(Boolean);
      const impactLevel =
        userInjuries.length > 0
          ? 'bajo'
          : ['bajo', 'medio', 'alto'].includes(r.impactLevel)
          ? r.impactLevel
          : 'bajo';

      const usedIds = Array.isArray(r.usedWgerIds) ? r.usedWgerIds : [];
      const citedSources = safeExercises
        .filter((e) => usedIds.includes(e.wgerId))
        .slice(0, 4)
        .map((e) => ({
          provider: 'wger Workout API',
          wgerId: e.wgerId,
          name: e.name,
        }));
      if (citedSources.length === 0 && safeExercises[0]) {
        citedSources.push({
          provider: 'wger Workout API',
          wgerId: safeExercises[0].wgerId,
          name: safeExercises[0].name,
        });
      }

      const candidate = {
        title: cleanTitle,
        durationMin: Math.max(15, Math.min(60, Math.round(Number(r.durationMin) || 30))),
        equipment: stripEmojis(r.equipment || 'Sin equipo / Mancuernas'),
        caloriesBurned: Math.max(120, Math.min(550, Math.round(Number(r.caloriesBurned) || 290))),
        intensity: stripEmojis(r.intensity || 'Moderada Controlada'),
        impactLevel,
        contraindications: [],
        targetGoals: [user.goal || 'salud_vitalidad'],
        mainBenefit: stripEmojis(r.mainBenefit || 'Fortalecimiento y movilidad segura.'),
        exercises:
          cleanExercises.length > 0
            ? cleanExercises
            : ['Activacion controlada 5 min', 'Bloque principal sin impacto 20 min'],
        recommended: idx === 1,
        technicalSheet: stripEmojis(
          r.technicalSheet ||
            `Ficha tecnica generada con respaldo wger: impacto ${impactLevel}, segura para perfil actual.`
        ),
        source: 'ollama_wger_ai',
        generatedForUserId: user.id,
        dataSources: citedSources,
      };

      const injuryCheck = checkWorkoutDiscard(user, candidate);
      if (injuryCheck.discarded) {
        errors.push(`Rutina '${candidate.title}' rechazada: ${injuryCheck.reason}`);
        validationRejections.push({
          rule: injuryCheck.rule,
          entityType: 'workout',
          entityId: `ai_guardrail_w_${idx}`,
          entityTitle: candidate.title,
          outcome: 'ai_guardrail_rejected',
          reason: `Guardrail simbolico bloqueo propuesta de Ollama: ${injuryCheck.reason}`,
          details: { attempt },
        });
        continue;
      }

      normalized.push(candidate);
    }

    if (errors.length === 0 && normalized.length >= 2) {
      validatedRoutines = normalized;
      parsedGroupName = stripEmojis(parsed.groupName || 'Plan Personalizado IA (wger)');
      break;
    }

    lastError = errors.join(' | ') || 'Cantidad insuficiente de rutinas validas.';
    promptToSend = `${baseUserPrompt}\n\nRECHAZO DEL MOTOR SIMBOLICO: ${lastError}. Elimina cualquier ejercicio de impacto o salto y responde solo rutinas seguras de bajo impacto.`;
  }

  if (validationRejections.length > 0) {
    await saveLogicalTraces(user.id, validationRejections);
  }

  if (!validatedRoutines) {
    throw new Error(
      `El Motor Simbolico rechazo las rutinas de IA tras validar lesiones: ${lastError}`
    );
  }

  const groupId = `grp_ai_${Date.now().toString(36)}`;
  const savedRoutines = [];
  for (const routine of validatedRoutines) {
    const saved = await createCatalogWorkout({
      ...routine,
      groupId,
      groupName: parsedGroupName,
    });
    savedRoutines.push(saved);
  }

  await addUserHistoryEvent(user.id, {
    eventType: 'ai_workout_generated',
    entityId: groupId,
    label: `Rutinas IA generadas (${modelUsed} + wger): ${parsedGroupName}`,
    delta: 0,
  });

  await saveLogicalTraces(user.id, [
    {
      rule: `entreno_ia_aprobado(${groupId}, modelo=${modelUsed}, fuente=wger)`,
      entityType: 'workout',
      entityId: groupId,
      entityTitle: parsedGroupName,
      outcome: 'ai_approved',
      reason: `${savedRoutines.length} rutinas aprobadas respetando lesiones [${injuryDescriptions}].`,
      details: { retries, wgerSourcesCount: safeExercises.length },
    },
  ]);

  return {
    groupId,
    groupName: parsedGroupName,
    routines: savedRoutines,
    providerUsed: 'ollama',
    modelUsed,
    retries,
    wgerSourcesUsed: safeExercises.slice(0, 6),
  };
}
