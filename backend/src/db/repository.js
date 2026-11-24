import { pool, withTransaction } from './pool.js';
import { hashPassword } from './security.js';

function mapMealRow(row) {
  return {
    id: row.id,
    baseId: row.base_id,
    baseName: row.base_name,
    mealTime: row.meal_time,
    budgetTier: row.budget_tier,
    suggested: Boolean(row.suggested),
    title: row.title,
    description: row.description,
    prepMinutes: Number(row.prep_minutes),
    estimatedCostUsd: Number(row.estimated_cost_usd),
    badges: row.badges || [],
    mainIngredient: {
      name: row.main_ingredient_name,
      priceTier: row.main_ingredient_price_tier,
      allergens: row.main_ingredient_allergens || [],
    },
    ingredients: row.ingredients || [],
    allergens: row.allergens || [],
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    visualTheme: row.visual_theme,
    nutritionalSheet: row.nutritional_sheet,
    source: row.source || 'seed',
    generatedForUserId: row.generated_for_user_id || null,
    dataSources: Array.isArray(row.data_sources) ? row.data_sources : [],
    isActive: Boolean(row.is_active),
  };
}

function mapWorkoutRow(row) {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name,
    title: row.title,
    durationMin: Number(row.duration_min),
    equipment: row.equipment,
    caloriesBurned: Number(row.calories_burned),
    intensity: row.intensity,
    impactLevel: row.impact_level,
    contraindications: row.contraindications || [],
    targetGoals: row.target_goals || [],
    mainBenefit: row.main_benefit,
    exercises: row.exercises || [],
    recommended: Boolean(row.recommended),
    technicalSheet: row.technical_sheet,
    source: row.source || 'seed',
    generatedForUserId: row.generated_for_user_id || null,
    dataSources: Array.isArray(row.data_sources) ? row.data_sources : [],
    isActive: Boolean(row.is_active),
  };
}

function mapUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    sex: row.sex,
    age: Number(row.age),
    weightKg: Number(row.weight_kg),
    heightCm: Number(row.height_cm),
    goal: row.goal,
    activityLevel: row.activity_level,
    allergies: row.allergies || [],
    injuries: row.injuries || [],
    hydrationLiters: Number(row.hydration_liters),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMealsCatalog(mealTime = null, userId = null, { onlyAi = false } = {}) {
  const conditions = ['is_active = TRUE'];
  const params = [];

  if (onlyAi) {
    conditions.push(`source = 'ollama_usda_ai'`);
  }
  if (mealTime) {
    params.push(mealTime);
    conditions.push(`meal_time = $${params.length}`);
  }
  if (userId) {
    params.push(userId);
    conditions.push(`(generated_for_user_id IS NULL OR generated_for_user_id = $${params.length})`);
  } else {
    conditions.push('generated_for_user_id IS NULL');
  }

  const sql = `
    SELECT * FROM meals
    WHERE ${conditions.join(' AND ')}
    ORDER BY (CASE WHEN generated_for_user_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC, base_id, estimated_cost_usd ASC
  `;
  const res = await pool.query(sql, params);
  return res.rows.map(mapMealRow);
}

export async function getMealById(mealId) {
  const res = await pool.query('SELECT * FROM meals WHERE id = $1 AND is_active = TRUE', [mealId]);
  return res.rows[0] ? mapMealRow(res.rows[0]) : null;
}

export async function deactivateUserAiMeals(userId, mealTime) {
  await pool.query(
    `UPDATE meals
     SET is_active = FALSE
     WHERE generated_for_user_id = $1
       AND meal_time = $2
       AND source = 'ollama_usda_ai'
       AND is_active = TRUE`,
    [userId, mealTime]
  );
}

export async function createCatalogMeal(meal) {
  const id =
    meal.id ||
    `${meal.mealTime.slice(0, 3)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

  const res = await pool.query(
    `INSERT INTO meals (
      id, base_id, base_name, meal_time, budget_tier, suggested, title, description,
      prep_minutes, estimated_cost_usd, badges, main_ingredient_name,
      main_ingredient_price_tier, main_ingredient_allergens, ingredients, allergens,
      calories, protein, carbs, fat, visual_theme, nutritional_sheet,
      source, generated_for_user_id, data_sources
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22,
      $23, $24, $25::jsonb
    ) RETURNING *`,
    [
      id,
      meal.baseId || `base_${id}`,
      meal.baseName || `Base: ${meal.title}`,
      meal.mealTime,
      meal.budgetTier,
      Boolean(meal.suggested),
      meal.title,
      meal.description,
      Number(meal.prepMinutes || 15),
      Number(meal.estimatedCostUsd || 4.0),
      meal.badges || [`${meal.prepMinutes || 15} min prep`, 'Catalogo PG'],
      meal.mainIngredient.name,
      meal.mainIngredient.priceTier,
      meal.mainIngredient.allergens || [],
      meal.ingredients || [meal.mainIngredient.name],
      meal.allergens || [],
      Number(meal.calories),
      Number(meal.protein),
      Number(meal.carbs),
      Number(meal.fat),
      meal.visualTheme || 'chicken_balanced',
      meal.nutritionalSheet ||
        `Ficha nutricional: ${meal.calories} kcal (${meal.protein}g proteina, ${meal.carbs}g carbohidratos, ${meal.fat}g grasas). Ingrediente principal: ${meal.mainIngredient.name}.`,
      meal.source || 'seed',
      meal.generatedForUserId || null,
      JSON.stringify(meal.dataSources || []),
    ]
  );

  return mapMealRow(res.rows[0]);
}

export async function getWorkoutsCatalog(userId = null) {
  const conditions = ['is_active = TRUE'];
  const params = [];

  if (userId) {
    params.push(userId);
    conditions.push(`(generated_for_user_id IS NULL OR generated_for_user_id = $${params.length})`);
  } else {
    conditions.push('generated_for_user_id IS NULL');
  }

  const sql = `
    SELECT * FROM workouts
    WHERE ${conditions.join(' AND ')}
    ORDER BY (CASE WHEN generated_for_user_id IS NOT NULL THEN 0 ELSE 1 END), created_at DESC, group_id, recommended DESC, calories_burned ASC
  `;
  const res = await pool.query(sql, params);
  return res.rows.map(mapWorkoutRow);
}

export async function getWorkoutById(workoutId) {
  const res = await pool.query('SELECT * FROM workouts WHERE id = $1 AND is_active = TRUE', [
    workoutId,
  ]);
  return res.rows[0] ? mapWorkoutRow(res.rows[0]) : null;
}

export async function createCatalogWorkout(workout) {
  const id =
    workout.id ||
    `rut_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

  const res = await pool.query(
    `INSERT INTO workouts (
      id, group_id, group_name, title, duration_min, equipment, calories_burned,
      intensity, impact_level, contraindications, target_goals, main_benefit,
      exercises, recommended, technical_sheet, source, generated_for_user_id, data_sources
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17, $18::jsonb
    ) RETURNING *`,
    [
      id,
      workout.groupId || 'torso_core',
      workout.groupName || 'Torso, Brazos & Core',
      workout.title,
      Number(workout.durationMin || 30),
      workout.equipment || 'Sin equipo',
      Number(workout.caloriesBurned || 300),
      workout.intensity || 'Moderada',
      workout.impactLevel || 'bajo',
      workout.contraindications || [],
      workout.targetGoals || ['salud_vitalidad', 'perder_grasa'],
      workout.mainBenefit,
      workout.exercises || ['Calentamiento articular 5 min', 'Bloque principal controlado'],
      Boolean(workout.recommended),
      workout.technicalSheet ||
        `Ficha tecnica: ${workout.durationMin || 30} min, impacto ${workout.impactLevel || 'bajo'} (${workout.caloriesBurned || 300} kcal estimadas). ${workout.mainBenefit}`,
      workout.source || 'seed',
      workout.generatedForUserId || null,
      JSON.stringify(workout.dataSources || []),
    ]
  );

  return mapWorkoutRow(res.rows[0]);
}

export async function upsertExternalFoods(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  await withTransaction(async (client) => {
    for (const item of items) {
      await client.query(
        `INSERT INTO external_foods (
          fdc_id, description, data_type, calories, protein, carbs, fat, allergen_tags, source_name, fetched_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (fdc_id) DO UPDATE SET
          description = EXCLUDED.description,
          calories = EXCLUDED.calories,
          protein = EXCLUDED.protein,
          carbs = EXCLUDED.carbs,
          fat = EXCLUDED.fat,
          allergen_tags = EXCLUDED.allergen_tags,
          fetched_at = NOW()`,
        [
          Number(item.fdcId),
          item.description,
          item.dataType || 'Foundation',
          Number(item.calories || 0),
          Number(item.protein || 0),
          Number(item.carbs || 0),
          Number(item.fat || 0),
          item.allergenTags || [],
          item.sourceName || 'USDA FoodData Central',
        ]
      );
    }
  });
}

export async function getSafeExternalFoods(allergies = [], limit = 16) {
  const res = await pool.query(
    `SELECT fdc_id, description, data_type, calories, protein, carbs, fat, allergen_tags, source_name
     FROM external_foods
     WHERE NOT (allergen_tags && $1::text[])
     ORDER BY fetched_at DESC
     LIMIT $2`,
    [allergies, limit]
  );
  return res.rows.map((r) => ({
    fdcId: Number(r.fdc_id),
    description: r.description,
    dataType: r.data_type,
    calories: Number(r.calories),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fat: Number(r.fat),
    allergenTags: r.allergen_tags || [],
    sourceName: r.source_name,
  }));
}

export async function upsertExternalExercises(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  await withTransaction(async (client) => {
    for (const item of items) {
      await client.query(
        `INSERT INTO external_exercises (
          wger_id, name, category, muscles, equipment, impact_level, contraindications, description, source_name, fetched_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (wger_id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          muscles = EXCLUDED.muscles,
          equipment = EXCLUDED.equipment,
          impact_level = EXCLUDED.impact_level,
          contraindications = EXCLUDED.contraindications,
          description = EXCLUDED.description,
          fetched_at = NOW()`,
        [
          Number(item.wgerId),
          item.name,
          item.category || 'General',
          item.muscles || [],
          item.equipment || [],
          item.impactLevel || 'bajo',
          item.contraindications || [],
          item.description || '',
          item.sourceName || 'wger Workout API',
        ]
      );
    }
  });
}

export async function getSafeExternalExercises(injuries = [], limit = 20) {
  const hasLowerBodyOrLumbar = injuries.some((i) => ['rodilla', 'tobillo', 'lumbar'].includes(i));
  const res = await pool.query(
    `SELECT wger_id, name, category, muscles, equipment, impact_level, contraindications, description, source_name
     FROM external_exercises
     WHERE NOT (contraindications && $1::text[])
       AND ($2::boolean = FALSE OR impact_level <> 'alto')
     ORDER BY fetched_at DESC
     LIMIT $3`,
    [injuries, hasLowerBodyOrLumbar, limit]
  );
  return res.rows.map((r) => ({
    wgerId: Number(r.wger_id),
    name: r.name,
    category: r.category,
    muscles: r.muscles || [],
    equipment: r.equipment || [],
    impactLevel: r.impact_level,
    contraindications: r.contraindications || [],
    description: r.description,
    sourceName: r.source_name,
  }));
}

export async function findUserAuthByEmail(email) {
  const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  if (!res.rows[0]) return null;
  return {
    ...mapUserRow(res.rows[0]),
    passwordHash: res.rows[0].password_hash,
  };
}

export async function getTodayLog(userId) {
  const [mealLogsRes, workoutLogsRes] = await Promise.all([
    pool.query(
      `SELECT meal_id, title, meal_time, calories, protein, carbs, fat, logged_at
       FROM daily_meal_logs
       WHERE user_id = $1 AND log_date = CURRENT_DATE
       ORDER BY logged_at DESC, id DESC`,
      [userId]
    ),
    pool.query(
      `SELECT workout_id, title, calories_burned, rating, logged_at
       FROM daily_workout_logs
       WHERE user_id = $1 AND log_date = CURRENT_DATE
       ORDER BY logged_at DESC, id DESC`,
      [userId]
    ),
  ]);

  const chosenMeals = mealLogsRes.rows.map((r) => ({
    mealId: r.meal_id,
    title: r.title,
    mealTime: r.meal_time,
    calories: Number(r.calories),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fat: Number(r.fat),
    loggedAt: r.logged_at,
  }));

  const completedWorkouts = workoutLogsRes.rows.map((r) => ({
    workoutId: r.workout_id,
    title: r.title,
    caloriesBurned: Number(r.calories_burned),
    rating: Number(r.rating),
    loggedAt: r.logged_at,
  }));

  const totals = chosenMeals.reduce(
    (acc, item) => ({
      caloriesConsumed: acc.caloriesConsumed + item.calories,
      proteinConsumed: acc.proteinConsumed + item.protein,
      carbsConsumed: acc.carbsConsumed + item.carbs,
      fatConsumed: acc.fatConsumed + item.fat,
    }),
    { caloriesConsumed: 0, proteinConsumed: 0, carbsConsumed: 0, fatConsumed: 0 }
  );

  return {
    date: new Date().toISOString().slice(0, 10),
    ...totals,
    chosenMeals,
    completedWorkouts,
  };
}

export async function getHydratedUser(userId) {
  const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!userRes.rows[0]) return null;

  const [mealAffRes, workoutAffRes, historyRes, tracesRes, todayLog] = await Promise.all([
    pool.query(
      'SELECT meal_id, score, chosen_count, ignored_count, last_action_at FROM user_meal_affinity WHERE user_id = $1',
      [userId]
    ),
    pool.query(
      'SELECT workout_id, score, completed_count, positive_count, negative_count, last_action_at FROM user_workout_affinity WHERE user_id = $1',
      [userId]
    ),
    pool.query(
      'SELECT id, event_type, entity_id, label, delta, created_at FROM user_history WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 60',
      [userId]
    ),
    pool.query(
      'SELECT id, rule, entity_type, entity_id, entity_title, outcome, reason, details, created_at FROM logical_traces WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 60',
      [userId]
    ),
    getTodayLog(userId),
  ]);

  const mealsAffinity = {};
  for (const row of mealAffRes.rows) {
    mealsAffinity[row.meal_id] = {
      score: Number(row.score),
      chosenCount: Number(row.chosen_count),
      ignoredCount: Number(row.ignored_count),
      lastActionAt: row.last_action_at,
    };
  }

  const workoutsAffinity = {};
  for (const row of workoutAffRes.rows) {
    workoutsAffinity[row.workout_id] = {
      score: Number(row.score),
      completedCount: Number(row.completed_count),
      positiveCount: Number(row.positive_count),
      negativeCount: Number(row.negative_count),
      lastActionAt: row.last_action_at,
    };
  }

  const history = historyRes.rows.map((r) => ({
    id: `hist_${r.id}`,
    type: r.event_type,
    entityId: r.entity_id,
    label: r.label,
    delta: Number(r.delta),
    timestamp: r.created_at,
  }));

  const traces = tracesRes.rows.map((r) => ({
    id: `trace_${r.id}`,
    rule: r.rule,
    entityType: r.entity_type,
    entityId: r.entity_id,
    entityTitle: r.entity_title,
    outcome: r.outcome,
    reason: r.reason,
    details: r.details || {},
    timestamp: r.created_at,
  }));

  return {
    ...mapUserRow(userRes.rows[0]),
    affinity: {
      meals: mealsAffinity,
      workouts: workoutsAffinity,
    },
    history,
    traces,
    todayLog,
  };
}

export async function createUser({
  name,
  email,
  password,
  role = 'usuario',
  sex = 'hombre',
  age = 28,
  weightKg = 72.5,
  heightCm = 176,
  goal = 'perder_grasa',
  activityLevel = 'ligeramente',
  allergies = [],
  injuries = [],
}) {
  const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const passwordHash = hashPassword(password);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (
        id, name, email, password_hash, role, status, sex, age,
        weight_kg, height_cm, goal, activity_level, allergies, injuries, hydration_liters
      ) VALUES (
        $1, $2, $3, $4, $5, 'activa', $6, $7,
        $8, $9, $10, $11, $12, $13, 0.50
      )`,
      [
        id,
        name,
        email,
        passwordHash,
        role,
        sex,
        Number(age),
        Number(weightKg),
        Number(heightCm),
        goal,
        activityLevel,
        allergies,
        injuries,
      ]
    );

    await client.query(
      `INSERT INTO user_history (user_id, event_type, entity_id, label, delta)
       VALUES ($1, 'account_created', 'profile', $2, 0)`,
      [id, `Cuenta creada (${role}, estado activa)`]
    );
  });

  return getHydratedUser(id);
}

export async function reactivateUser(userId) {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET status = 'activa', updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    await client.query(
      `INSERT INTO user_history (user_id, event_type, entity_id, label, delta)
       VALUES ($1, 'status_change', 'profile', 'Cuenta reactivada conservando historial previo', 0)`,
      [userId]
    );
  });
  return getHydratedUser(userId);
}

export async function updateUserProfile(userId, updates) {
  const existing = await getHydratedUser(userId);
  if (!existing) return null;

  await withTransaction(async (client) => {
    const nextName =
      typeof updates.name === 'string' && updates.name.trim().length >= 2
        ? updates.name.trim()
        : existing.name;
    const nextSex = updates.sex === 'hombre' || updates.sex === 'mujer' ? updates.sex : existing.sex;
    const nextAge = updates.age !== undefined ? Number(updates.age) : existing.age;
    const nextWeight = updates.weightKg !== undefined ? Number(updates.weightKg) : existing.weightKg;
    const nextHeight = updates.heightCm !== undefined ? Number(updates.heightCm) : existing.heightCm;
    const nextGoal = updates.goal || existing.goal;
    const nextActivity = updates.activityLevel || existing.activityLevel;
    const nextAllergies = Array.isArray(updates.allergies) ? updates.allergies : existing.allergies;
    const nextInjuries = Array.isArray(updates.injuries) ? updates.injuries : existing.injuries;
    const nextHydration =
      updates.hydrationLiters !== undefined
        ? Math.min(4.5, Math.max(0, Number(updates.hydrationLiters)))
        : existing.hydrationLiters;
    const nextRole = updates.role || existing.role;
    const nextStatus = updates.status || existing.status;

    await client.query(
      `UPDATE users SET
        name = $2, sex = $3, age = $4, weight_kg = $5, height_cm = $6,
        goal = $7, activity_level = $8, allergies = $9, injuries = $10,
        hydration_liters = $11, role = $12, status = $13, updated_at = NOW()
      WHERE id = $1`,
      [
        userId,
        nextName,
        nextSex,
        nextAge,
        nextWeight,
        nextHeight,
        nextGoal,
        nextActivity,
        nextAllergies,
        nextInjuries,
        nextHydration,
        nextRole,
        nextStatus,
      ]
    );

    if (updates.role && updates.role !== existing.role) {
      await client.query(
        `INSERT INTO user_history (user_id, event_type, entity_id, label, delta)
         VALUES ($1, 'role_change', 'profile', $2, 0)`,
        [userId, `Rol actualizado de ${existing.role} a ${updates.role}`]
      );
    }

    if (updates.status && updates.status !== existing.status) {
      await client.query(
        `INSERT INTO user_history (user_id, event_type, entity_id, label, delta)
         VALUES ($1, 'status_change', 'profile', $2, 0)`,
        [userId, `Estado de cuenta cambiado a '${updates.status}' (historial conservado)`]
      );
    }
  });

  return getHydratedUser(userId);
}

export async function addUserHistoryEvent(userId, { eventType, entityId, label, delta = 0 }) {
  await pool.query(
    `INSERT INTO user_history (user_id, event_type, entity_id, label, delta)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, eventType, entityId, label, delta]
  );
}

export async function saveLogicalTraces(userId, newTraces) {
  if (!Array.isArray(newTraces) || newTraces.length === 0) return;

  const existingRes = await pool.query(
    'SELECT rule, entity_id, outcome FROM logical_traces WHERE user_id = $1 ORDER BY id DESC LIMIT 120',
    [userId]
  );
  const existingKeys = new Set(
    existingRes.rows.map((r) => `${r.rule}|${r.entity_id}|${r.outcome}`)
  );

  const toInsert = [];
  for (const t of newTraces) {
    const key = `${t.rule}|${t.entityId}|${t.outcome}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      toInsert.push(t);
    }
  }

  if (toInsert.length === 0) return;

  await withTransaction(async (client) => {
    for (const t of toInsert.slice(0, 30)) {
      await client.query(
        `INSERT INTO logical_traces (user_id, rule, entity_type, entity_id, entity_title, outcome, reason, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          userId,
          t.rule,
          t.entityType,
          t.entityId,
          t.entityTitle,
          t.outcome,
          t.reason,
          JSON.stringify(t.details || {}),
        ]
      );
    }
  });
}

export async function recordMealAffinity(userId, meal, action) {
  const delta = action === 'choose' ? 2 : -1;
  const chosenInc = action === 'choose' ? 1 : 0;
  const ignoredInc = action === 'ignore' ? 1 : 0;

  const updatedAffinity = await withTransaction(async (client) => {
    const affRes = await client.query(
      `INSERT INTO user_meal_affinity (user_id, meal_id, score, chosen_count, ignored_count, last_action_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, meal_id) DO UPDATE SET
         score = user_meal_affinity.score + $3,
         chosen_count = user_meal_affinity.chosen_count + $4,
         ignored_count = user_meal_affinity.ignored_count + $5,
         last_action_at = NOW()
       RETURNING score, chosen_count, ignored_count, last_action_at`,
      [userId, meal.id, delta, chosenInc, ignoredInc]
    );

    const row = affRes.rows[0];
    const isFavorite = Number(row.chosen_count) >= 2;
    const lowPriority = Number(row.ignored_count) >= 2 && !isFavorite;

    if (action === 'choose') {
      await client.query(
        `INSERT INTO daily_meal_logs (user_id, log_date, meal_id, title, meal_time, calories, protein, carbs, fat)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          meal.id,
          meal.title,
          meal.mealTime,
          meal.calories,
          meal.protein,
          meal.carbs,
          meal.fat,
        ]
      );
    }

    const histLabel =
      action === 'choose'
        ? `Elegido: ${meal.title} (+2 afinidad${isFavorite ? ', Favorito' : ''})`
        : `Ignorado: ${meal.title} (-1 afinidad${lowPriority ? ', baja prioridad' : ''})`;

    await client.query(
      `INSERT INTO user_history (user_id, event_type, entity_id, label, delta)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action === 'choose' ? 'meal_choose' : 'meal_ignore', meal.id, histLabel, delta]
    );

    const traceRule =
      action === 'choose'
        ? `afinidad_platillo(${meal.id}, +2, elegido=${row.chosen_count}${isFavorite ? ', favorito=true' : ''})`
        : `afinidad_platillo(${meal.id}, -1, ignorado=${row.ignored_count}${lowPriority ? ', baja_prioridad=true' : ''})`;

    const traceReason =
      action === 'choose'
        ? `Incremento +2 puntos (total ${row.score}). ${isFavorite ? 'Alcanzo >=2 elecciones: marcado como Favorito.' : ''}`
        : `Reduccion -1 punto (total ${row.score}). ${lowPriority ? 'Ignorado >=2 veces: prioridad reducida.' : ''}`;

    await client.query(
      `INSERT INTO logical_traces (user_id, rule, entity_type, entity_id, entity_title, outcome, reason, details)
       VALUES ($1, $2, 'meal', $3, $4, 'affinity', $5, $6::jsonb)`,
      [
        userId,
        traceRule,
        meal.id,
        meal.title,
        traceReason.trim(),
        JSON.stringify({ mealTime: meal.mealTime, score: Number(row.score) }),
      ]
    );

    return {
      score: Number(row.score),
      chosenCount: Number(row.chosen_count),
      ignoredCount: Number(row.ignored_count),
      lastActionAt: row.last_action_at,
      isFavorite,
      lowPriority,
    };
  });

  const user = await getHydratedUser(userId);
  return { user, affinityRecord: updatedAffinity };
}

export async function recordWorkoutAffinity(userId, workout, rating, completed = true) {
  const delta = Number(rating) >= 0 ? 1 : -1;
  const posInc = delta > 0 ? 1 : 0;
  const negInc = delta < 0 ? 1 : 0;
  const compInc = delta > 0 && completed ? 1 : 0;

  const updatedAffinity = await withTransaction(async (client) => {
    const affRes = await client.query(
      `INSERT INTO user_workout_affinity (user_id, workout_id, score, completed_count, positive_count, negative_count, last_action_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, workout_id) DO UPDATE SET
         score = user_workout_affinity.score + $3,
         completed_count = user_workout_affinity.completed_count + $4,
         positive_count = user_workout_affinity.positive_count + $5,
         negative_count = user_workout_affinity.negative_count + $6,
         last_action_at = NOW()
       RETURNING score, completed_count, positive_count, negative_count, last_action_at`,
      [userId, workout.id, delta, compInc, posInc, negInc]
    );

    const row = affRes.rows[0];

    if (delta > 0 && completed) {
      await client.query(
        `INSERT INTO daily_workout_logs (user_id, log_date, workout_id, title, calories_burned, rating)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)`,
        [userId, workout.id, workout.title, workout.caloriesBurned, delta]
      );
    }

    const histLabel =
      delta > 0
        ? `Sesion completada: ${workout.title} (+1 afinidad)`
        : `Rutina calificada baja: ${workout.title} (-1 afinidad)`;

    await client.query(
      `INSERT INTO user_history (user_id, event_type, entity_id, label, delta)
       VALUES ($1, 'workout_rate', $2, $3, $4)`,
      [userId, workout.id, histLabel, delta]
    );

    await client.query(
      `INSERT INTO logical_traces (user_id, rule, entity_type, entity_id, entity_title, outcome, reason, details)
       VALUES ($1, $2, 'workout', $3, $4, 'affinity', $5, $6::jsonb)`,
      [
        userId,
        `afinidad_entreno(${workout.id}, ${delta > 0 ? '+1' : '-1'}, total=${row.score})`,
        workout.id,
        workout.title,
        delta > 0
          ? `Sesion completada y calificada positivamente (+1). Afinidad acumulada: ${row.score}.`
          : `Calificacion negativa (-1). Se reduce su prioridad futura (afinidad: ${row.score}).`,
        JSON.stringify({ groupId: workout.groupId, score: Number(row.score) }),
      ]
    );

    return {
      score: Number(row.score),
      completedCount: Number(row.completed_count),
      positiveCount: Number(row.positive_count),
      negativeCount: Number(row.negative_count),
      lastActionAt: row.last_action_at,
    };
  });

  const user = await getHydratedUser(userId);
  return { user, affinityRecord: updatedAffinity };
}

export async function getDemoAccounts() {
  const res = await pool.query(
    `SELECT id, name, email, role, status
     FROM users
     WHERE email IN ('alejandro@samba.app', 'admin@samba.app', 'invitado@samba.app')
     ORDER BY CASE role WHEN 'usuario' THEN 1 WHEN 'superusuario' THEN 2 ELSE 3 END`
  );
  return res.rows.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    hint:
      u.email === 'alejandro@samba.app'
        ? 'Samba2026'
        : u.email === 'admin@samba.app'
        ? 'Admin2026'
        : 'Invitado2026',
  }));
}

export async function getAdminAuditSummary() {
  const res = await pool.query(
    `SELECT
       u.id, u.name, u.email, u.role, u.status, u.allergies, u.injuries,
       (SELECT COUNT(*)::int FROM user_history h WHERE h.user_id = u.id) AS history_count,
       (SELECT COUNT(*)::int FROM logical_traces t WHERE t.user_id = u.id) AS traces_count
     FROM users u
     ORDER BY u.created_at ASC`
  );

  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    status: r.status,
    allergiesCount: (r.allergies || []).length,
    injuriesCount: (r.injuries || []).length,
    historyCount: r.history_count,
    tracesCount: r.traces_count,
  }));
}

export async function getDatabaseStats() {
  const res = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM meals WHERE is_active = TRUE) AS meals,
      (SELECT COUNT(*)::int FROM workouts WHERE is_active = TRUE) AS workouts,
      (SELECT COUNT(*)::int FROM daily_meal_logs) AS meal_logs,
      (SELECT COUNT(*)::int FROM daily_workout_logs) AS workout_logs,
      (SELECT COUNT(*)::int FROM logical_traces) AS traces,
      (SELECT COUNT(*)::int FROM external_foods) AS external_foods,
      (SELECT COUNT(*)::int FROM external_exercises) AS external_exercises
  `);
  return res.rows[0];
}
