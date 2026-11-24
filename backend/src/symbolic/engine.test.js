import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateIMC, calculateMifflinStJeor } from './mifflin.js';
import {
  checkAllergyDiscard,
  checkPriceConsistency,
  checkWorkoutDiscard,
  evaluateMealsForUser,
  evaluateWorkoutsForUser,
} from './engine.js';
import { retrieveSymbolicContext } from '../rag/retrieval.js';
import { generateGroundedResponse } from '../rag/generator.js';
import {
  checkMealNovelty,
  checkVariantsDiversity,
  deduplicateIngredients,
} from '../services/aiRecommender.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mealsCatalog = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/knowledge_meals.json'), 'utf-8')
);
const workoutsCatalog = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/knowledge_workouts.json'), 'utf-8')
);

test('Mifflin-St Jeor e IMC calculan correctamente valores de referencia', () => {
  const imc = calculateIMC(72.5, 176);
  assert.equal(imc.bmi, 23.4);
  assert.equal(imc.category, 'Saludable');

  const male = calculateMifflinStJeor({
    sex: 'hombre',
    age: 28,
    weightKg: 72.5,
    heightCm: 176,
    activityLevel: 'ligeramente',
    goal: 'perder_grasa',
  });
  // BMR = 10*72.5 + 6.25*176 - 5*28 + 5 = 725 + 1100 - 140 + 5 = 1690
  assert.equal(male.bmr, 1690);
  // TDEE = Math.round(1690 * 1.375) = 2324 -> -400 = 1924 -> rounded to 1920
  assert.equal(male.tdee, 2324);
  assert.equal(male.targetCalories, 1920);
  assert.ok(male.macrosTarget.protein > 100);

  const female = calculateMifflinStJeor({
    sex: 'mujer',
    age: 32,
    weightKg: 61,
    heightCm: 168,
    activityLevel: 'moderado',
    goal: 'recomposicion',
  });
  // BMR = 610 + 1050 - 160 - 161 = 1339
  assert.equal(female.bmr, 1339);
});

test('Catalogo completo mantiene precio_consistente y opciones seguras aun con multiples alergias', () => {
  const userWithAllergies = {
    sex: 'hombre',
    age: 28,
    weightKg: 72.5,
    heightCm: 176,
    goal: 'perder_grasa',
    activityLevel: 'ligeramente',
    allergies: ['gluten', 'lactosa', 'frutos_secos', 'pescados_mariscos', 'huevo'],
    injuries: [],
    affinity: { meals: {}, workouts: {} },
  };

  for (const mealTime of ['desayuno', 'almuerzo', 'cena']) {
    const res = evaluateMealsForUser(userWithAllergies, mealsCatalog, { mealTime });
    assert.ok(res.validMeals.length > 0, `Debe existir al menos un platillo seguro para ${mealTime}`);
    assert.ok(res.discardedMeals.length > 0, `Debe generar descartes por alergias para ${mealTime}`);
    for (const m of res.validMeals) {
      assert.equal(m.budgetTier, m.mainIngredient.priceTier);
      assert.equal(m.priceConsistency.consistent, true);
    }
  }
});

test('Regla descartado excluye lacteos cuando el usuario declara intolerancia a la lactosa', () => {
  const lactoseUser = {
    allergies: ['lactosa'],
    affinity: { meals: {}, workouts: {} },
  };
  const dairyMeal = mealsCatalog.find((m) => m.id === 'alm_tacos_bajo');
  const check = checkAllergyDiscard(lactoseUser, dairyMeal);
  assert.equal(check.discarded, true);
  assert.match(check.rule, /descartado\(alm_tacos_bajo, alergia\(\[lactosa\]\)\)/);
});

test('Regla precio_consistente rechaza platillos con discrepancia de presupuesto o calorias', () => {
  const inconsistentMeal = {
    id: 'test_inconsistente',
    mealTime: 'cena',
    budgetTier: 'bajo',
    calories: 440,
    mainIngredient: {
      name: 'Langostinos importados con trufa',
      priceTier: 'alto',
      allergens: [],
    },
  };
  const check = checkPriceConsistency(inconsistentMeal, { min: 400, max: 520 });
  assert.equal(check.consistent, false);
  assert.match(check.reason, /Inconsistencia de presupuesto/);

  const badCalorieMeal = {
    id: 'test_cal_baja',
    mealTime: 'almuerzo',
    budgetTier: 'bajo',
    calories: 90,
    mainIngredient: {
      name: 'Pollo simple',
      priceTier: 'bajo',
      allergens: [],
    },
  };
  const checkCal = checkPriceConsistency(badCalorieMeal, { min: 500, max: 700 });
  assert.equal(checkCal.consistent, false);
  assert.match(checkCal.reason, /Inconsistencia calorica/);
});

test('Regla ejercicio_descartado excluye correr y alto impacto ante lesion de rodilla', () => {
  const kneeUser = {
    sex: 'hombre',
    age: 28,
    weightKg: 72.5,
    heightCm: 176,
    goal: 'perder_grasa',
    activityLevel: 'ligeramente',
    allergies: [],
    injuries: ['rodilla'],
    affinity: { meals: {}, workouts: {} },
  };

  const running = workoutsCatalog.find((w) => w.id === 'rut_correr_hiit');
  const runningCheck = checkWorkoutDiscard(kneeUser, running);
  assert.equal(runningCheck.discarded, true);
  assert.match(runningCheck.rule, /ejercicio_descartado\(rut_correr_hiit/);

  const evaluation = evaluateWorkoutsForUser(kneeUser, workoutsCatalog);
  assert.equal(
    evaluation.validWorkouts.some((w) => w.impactLevel === 'alto'),
    false,
    'Ninguna rutina de alto impacto debe permanecer valida para lesion de rodilla'
  );
  assert.ok(
    evaluation.discardedWorkouts.some((w) => w.id === 'rut_correr_hiit'),
    'Correr / HIIT debe aparecer en descartados con su traza'
  );
});

test('Afinidad de platillos marca Favorito (>=2 elecciones) y baja prioridad (>=2 ignorados)', () => {
  const user = {
    sex: 'hombre',
    age: 28,
    weightKg: 72.5,
    heightCm: 176,
    goal: 'perder_grasa',
    activityLevel: 'ligeramente',
    allergies: [],
    injuries: [],
    affinity: {
      meals: {
        cen_salteado_bajo: { score: 4, chosenCount: 2, ignoredCount: 0 },
        cen_mar_alto: { score: -2, chosenCount: 0, ignoredCount: 2 },
      },
      workouts: {},
    },
  };

  const res = evaluateMealsForUser(user, mealsCatalog, { mealTime: 'cena' });
  const fav = res.validMeals.find((m) => m.id === 'cen_salteado_bajo');
  const low = res.validMeals.find((m) => m.id === 'cen_mar_alto');

  assert.equal(fav.affinity.isFavorite, true);
  assert.equal(fav.affinity.score, 4);
  assert.equal(low.affinity.lowPriority, true);
  assert.equal(low.affinity.score, -2);
});

test('Pipeline RAG Paso A + Fallback Local responde con hechos auditados y cero emojis', async () => {
  const user = {
    id: 'usr_test',
    name: 'Alejandro Morales',
    role: 'usuario',
    status: 'activa',
    sex: 'hombre',
    age: 28,
    weightKg: 72.5,
    heightCm: 176,
    goal: 'perder_grasa',
    activityLevel: 'ligeramente',
    allergies: ['lactosa'],
    injuries: ['rodilla'],
    affinity: { meals: {}, workouts: {} },
    dailyLogs: {},
  };

  // Pregunta 1: Cena barata
  const dinnerCtx = retrieveSymbolicContext(
    user,
    '¿Qué puedo cenar hoy barato?',
    mealsCatalog,
    workoutsCatalog
  );
  assert.equal(dinnerCtx.intent.mealTime, 'cena');
  assert.equal(dinnerCtx.intent.budgetTier, 'bajo');
  assert.ok(dinnerCtx.documents.meals.every((m) => m.mealTime === 'cena' && m.budgetTier === 'bajo'));

  const prevProvider = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = 'fallback';
  const dinnerGen = await generateGroundedResponse('¿Qué puedo cenar hoy barato?', dinnerCtx);
  assert.equal(dinnerGen.providerUsed, 'fallback_local');
  assert.match(dinnerGen.answer, /Fajitas Economicas de Pollo|Atun a la Plancha/);

  // Pregunta 2: Por que no me recomiendas correr
  const runCtx = retrieveSymbolicContext(
    user,
    '¿Por qué no me recomiendas correr?',
    mealsCatalog,
    workoutsCatalog
  );
  const runGen = await generateGroundedResponse('¿Por qué no me recomiendas correr?', runCtx);
  process.env.LLM_PROVIDER = prevProvider;
  assert.match(runGen.answer, /ejercicio_descartado\(rut_correr_hiit/);
  assert.match(runGen.answer, /Ciclismo Estatico|Fuerza Hipertrofia/);
});

test('Guardrail simbolico detecta alergenos e impacto ocultos en salidas de IA', () => {
  const user = {
    allergies: ['lactosa'],
    injuries: ['rodilla'],
  };

  // Caso IA intenta meter queso crema diciendo alergenos []
  const sneakyMeal = {
    id: 'ai_sneaky_meal',
    mealTime: 'cena',
    budgetTier: 'medio',
    title: 'Pollo cremoso fit',
    description: 'Pollo salteado con salsa ligera',
    mainIngredient: { name: 'Pechuga de pollo', priceTier: 'medio', allergens: [] },
    ingredients: ['Pechuga de pollo', 'Queso crema ligero', 'Espinaca'],
    allergens: [],
  };
  const mealCheck = checkAllergyDiscard(user, sneakyMeal);
  assert.equal(mealCheck.discarded, true);
  assert.ok(mealCheck.conflicts.includes('lactosa'));

  // Caso IA intenta meter burpees diciendo impactLevel 'bajo'
  const sneakyWorkout = {
    id: 'ai_sneaky_workout',
    title: 'Cardio express en casa',
    impactLevel: 'bajo',
    contraindications: [],
    exercises: ['Burpees continuos 4x15', 'Saltos de tijera'],
  };
  const workoutCheck = checkWorkoutDiscard(user, sneakyWorkout);
  assert.equal(workoutCheck.discarded, true);
  assert.ok(workoutCheck.conflicts.includes('rodilla'));
});

test('Guardrails de novedad y diversidad rechazan platillos repetidos y opciones similares', () => {
  const repeatedNovelty = checkMealNovelty(
    'Ensalada de Pollo con Brocoli',
    [
      { title: 'Ensalada de Pollo con Brocoli' },
      { title: 'Ensalada de Pollo con Brocoli y Aguacate' },
      { title: 'Ensalada de Pollo con Brocoli y Quinoa' },
    ],
    ['Base IA: Ensalada de Pollo con Brocoli']
  );
  assert.equal(repeatedNovelty.novel, false);

  const freshNovelty = checkMealNovelty(
    'Tacos Saludables Estilo Mexicano',
    [
      { title: 'Tacos de Frijoles Negros y Nopales' },
      { title: 'Tacos de Pechuga de Pavo al Pastor' },
      { title: 'Tacos de Camarones al Ajillo con Aguacate' },
    ],
    ['Base IA: Ensalada de Pollo con Brocoli']
  );
  assert.equal(freshNovelty.novel, true);

  const similarVariants = checkVariantsDiversity([
    {
      budgetTier: 'bajo',
      title: 'Ensalada de Pollo con Brocoli',
      mainIngredient: { name: 'Pechuga de pollo' },
      ingredients: ['200g pechuga de pollo', '100g brocoli', '100g lechuga', '1 tomate'],
    },
    {
      budgetTier: 'medio',
      title: 'Ensalada de Pollo con Brocoli y Aguacate',
      mainIngredient: { name: 'Pechuga de pollo' },
      ingredients: ['200g pechuga de pollo', '100g brocoli', '100g lechuga', '1 tomate', 'medio aguacate'],
    },
    {
      budgetTier: 'alto',
      title: 'Ensalada de Pollo con Brocoli y Quinoa',
      mainIngredient: { name: 'Pechuga de pollo' },
      ingredients: ['200g pechuga de pollo', '100g brocoli', '100g lechuga', '1 tomate', '80g quinoa'],
    },
  ]);
  assert.equal(similarVariants.diverse, false);

  const diverseVariants = checkVariantsDiversity([
    {
      budgetTier: 'bajo',
      title: 'Tacos de Frijoles Negros y Calabacin',
      mainIngredient: { name: 'Frijoles negros cocidos' },
      ingredients: ['150g frijoles negros', '3 tortillas de maiz', '100g calabacin', 'pico de gallo'],
    },
    {
      budgetTier: 'medio',
      title: 'Fajitas de Pechuga de Pollo con Pimientos',
      mainIngredient: { name: 'Pechuga de pollo a la plancha' },
      ingredients: ['180g pechuga de pollo', '1 pimiento rojo', '1 cebolla morada', '2 tortillas de maiz', '50g aguacate'],
    },
    {
      budgetTier: 'alto',
      title: 'Tacos de Salmon Sellado con Mango y Esparragos',
      mainIngredient: { name: 'Filete de salmon' },
      ingredients: ['170g filete de salmon', '80g esparragos asados', '60g mango picado', 'col morada', 'aceite de oliva extra virgen'],
    },
  ]);
  assert.equal(diverseVariants.diverse, true);

  const deduped = deduplicateIngredients([
    '200g de pechuga de pollo',
    '1 tomate, cortado en cubos',
    '100g de tomate',
    '100g de brocoli',
  ]);
  assert.equal(deduped.length, 3);
});
