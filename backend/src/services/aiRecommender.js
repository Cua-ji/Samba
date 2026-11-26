import { calculateMifflinStJeor } from '../symbolic/mifflin.js';
import {
  ALLERGY_LABELS,
  INJURY_LABELS,
  checkAllergyDiscard,
  checkPriceConsistency,
  checkWorkoutDiscard,
} from '../symbolic/engine.js';
import { detectAllergensFromText } from '../symbolic/keywords.js';
import {
  fetchAndCacheUsdaFoods,
  fetchAndCacheWgerExercises,
} from './externalData.js';
import { ollamaChat, stripEmojis } from './ollama.js';
import { predictSafetyML } from './mlService.js';
import {
  addUserHistoryEvent,
  createCatalogMeal,
  createCatalogWorkout,
  deactivateUserAiMeals,
  deactivateUserAiWorkouts,
  getMealsCatalog,
  getRecentUserAiMeals,
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

const CULINARY_ARCHETYPES = {
  desayuno: [
    { name: 'Bowl Energetico de Avena o Quinoa', style: 'bowl tibio con proteina y toppings naturales' },
    { name: 'Tostadas o Arepas Proteicas', style: 'base crocante salada con proteina y vegetales frescos' },
    { name: 'Revuelto o Cazuela Mananera', style: 'salteado caliente al sarten con vegetales y proteina' },
    { name: 'Tacos o Burrito de Desayuno', style: 'tortillas de maiz rellenas con proteina y salsa fresca' },
    { name: 'Hash de Camote y Vegetales', style: 'cubos de camote dorados al sarten con proteina y hierbas' },
    { name: 'Hotcakes o Crepas Saludables', style: 'preparacion esponjosa de avena con acompanamiento proteico' },
    { name: 'Plato Rustico con Legumbres y Aguacate', style: 'desayuno salado saciante estilo latino' },
  ],
  almuerzo: [
    { name: 'Tacos o Fajitas Saludables', style: 'estilo mexicano con tortillas de maiz, pimientos y salsa fresca' },
    { name: 'Bowl Mediterraneo o Asiatico', style: 'base de grano integral con vegetales asados y aderezo ligero' },
    { name: 'Salteado Wok con Vegetales', style: 'coccion rapida a fuego alto con jengibre, ajo y vegetales crujientes' },
    { name: 'Arroz Salteado Proteico', style: 'arroz integral salteado con especias, vegetales y proteina' },
    { name: 'Proteina a la Plancha con Pure de Camote', style: 'corte a la plancha con guarnicion cremosa de camote y verduras' },
    { name: 'Estofado o Curry Suave Casero', style: 'guiso aromatico con especias suaves, vegetales y grano' },
    { name: 'Brochetas al Grill con Ensalada Tibia', style: 'proteina asada en brochetas con vegetales a la parrilla' },
    { name: 'Cazuela Horneada de Vegetales y Proteina', style: 'horneado con hierbas aromaticas y guarnicion integral' },
    { name: 'Pasta Integral Proteica', style: 'pasta con salsa natural de tomate o hierbas y proteina', requiresNoAllergy: 'gluten' },
    { name: 'Tostadas o Wraps Artesanales', style: 'armado fresco con vegetales crujientes y proteina marinada' },
  ],
  cena: [
    { name: 'Crema o Sopa Proteica Reconfortante', style: 'caldo o crema ligera de vegetales con proteina y guarnicion' },
    { name: 'Tacos de Lechuga o Tostadas Ligeras', style: 'envueltos frescos y ligeros con proteina sazonada' },
    { name: 'Salteado Ligero al Sarten', style: 'vegetales salteados con ajo y proteina magra de facil digestion' },
    { name: 'Proteina al Horno con Vegetales Rostizados', style: 'horneado con calabacin, pimientos o esparragos y hierbas' },
    { name: 'Bowl Tibio Ligero de Quinoa', style: 'cena balanceada de facil digestion con quinoa y vegetales' },
    { name: 'Brochetas al Grill con Guarnicion Fresca', style: 'asado ligero con ensalada fresca de pepino y limon' },
    { name: 'Calabacines o Pimientos Rellenos', style: 'vegetales rellenos horneados con proteina y especias' },
    { name: 'Ceviche o Plato Frio Proteico', style: 'preparacion fresca citrica con aguacate y cilantro', requiresNoAllergy: 'pescados_mariscos' },
  ],
};

const PROTEIN_SUGGESTIONS_BY_TIER = {
  bajo: [
    'Lentejas guisadas',
    'Frijoles negros',
    'Garbanzos sazonados',
    'Huevos revueltos o cocidos',
    'Atun en agua',
    'Tofu firme dorado',
    'Muslo de pollo sin piel',
  ],
  medio: [
    'Pechuga de pollo a la plancha',
    'Pechuga de pavo asada',
    'Carne molida magra de res',
    'Lomo de cerdo magro',
    'Filete de tilapia',
  ],
  alto: [
    'Filete de salmon a la plancha',
    'Camarones salteados al ajillo',
    'Corte magro de res (sirloin)',
    'Lomo fino de res a la parrilla',
    'Pechuga de pavo organica con portobello y esparragos',
  ],
};

const SPANISH_STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'con', 'sin', 'y', 'e', 'o', 'en', 'al', 'a', 'para', 'por', 'sobre',
  'base', 'ia', 'presupuesto', 'bajo', 'medio', 'alto', 'opcion', 'platillo',
  'estilo', 'saludable', 'saludables', 'ligero', 'ligera', 'fresco', 'fresca',
  'g', 'gr', 'kg', 'ml', 'l', 'taza', 'tazas', 'cucharada', 'cucharadas',
  'cucharadita', 'cucharaditas', 'pizca', 'al', 'gusto', 'pieza', 'piezas',
  'cortado', 'cortada', 'en', 'cubos', 'picado', 'picada', 'rebanado', 'rebanada',
  'cocido', 'cocida', 'crudo', 'cruda', 'rallado', 'rallada',
]);

export function normalizeDishTokens(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|l|oz|cup)?\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !SPANISH_STOPWORDS.has(w));
}

export function jaccardSimilarity(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function deduplicateIngredients(ingredients) {
  const seenKeys = new Set();
  const result = [];
  for (const raw of ingredients) {
    const cleaned = stripEmojis(raw);
    if (!cleaned) continue;
    const tokens = normalizeDishTokens(cleaned);
    const key = tokens.length > 0 ? tokens.slice(0, 3).sort().join('|') : cleaned.toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    result.push(cleaned);
  }
  return result;
}

export function checkMealNovelty(baseName, variants, recentNames = []) {
  const cleanRecent = recentNames
    .map((n) => String(n || '').replace(/^Base(\s+IA)?:\s*/i, '').trim())
    .filter(Boolean);
  if (cleanRecent.length === 0) {
    return { novel: true, reason: null };
  }

  const baseTokens = normalizeDishTokens(String(baseName || '').replace(/^Base(\s+IA)?:\s*/i, ''));
  for (const prev of cleanRecent) {
    const prevTokens = normalizeDishTokens(prev);
    const sim = jaccardSimilarity(baseTokens, prevTokens);
    if (sim >= 0.6) {
      return {
        novel: false,
        reason: `El platillo base '${baseName}' es demasiado parecido al platillo reciente '${prev}'. Genera un concepto culinario completamente diferente.`,
      };
    }
  }

  let repeatedVariants = 0;
  const repeatedTitles = [];
  for (const v of variants) {
    const vTokens = normalizeDishTokens(v.title);
    const matchesRecent = cleanRecent.some((prev) => jaccardSimilarity(vTokens, normalizeDishTokens(prev)) >= 0.65);
    if (matchesRecent) {
      repeatedVariants++;
      repeatedTitles.push(v.title);
    }
  }

  if (repeatedVariants >= 2) {
    return {
      novel: false,
      reason: `Varias opciones (${repeatedTitles.join(', ')}) repiten platillos ya mostrados recientemente. Cambia el tipo de preparacion e ingredientes.`,
    };
  }

  return { novel: true, reason: null };
}

export function checkVariantsDiversity(variants) {
  if (!Array.isArray(variants) || variants.length < 3) {
    return { diverse: false, reason: 'Se requieren exactamente 3 variantes distintas.' };
  }

  for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const a = variants[i];
      const b = variants[j];

      const titleSim = jaccardSimilarity(normalizeDishTokens(a.title), normalizeDishTokens(b.title));
      if (titleSim >= 0.7) {
        return {
          diverse: false,
          reason: `Las opciones '${a.title}' (${a.budgetTier}) y '${b.title}' (${b.budgetTier}) tienen titulos demasiado similares. Cada presupuesto debe ofrecer una variante claramente distinta.`,
        };
      }

      const mainA = normalizeDishTokens(a.mainIngredient?.name || a.mainIngredientName || '');
      const mainB = normalizeDishTokens(b.mainIngredient?.name || b.mainIngredientName || '');
      const mainSim = jaccardSimilarity(mainA, mainB);
      if (mainSim >= 0.75) {
        return {
          diverse: false,
          reason: `Las opciones '${a.budgetTier}' y '${b.budgetTier}' usan practicamente el mismo ingrediente principal ('${a.mainIngredient?.name || a.mainIngredientName}' vs '${b.mainIngredient?.name || b.mainIngredientName}'). Usa una proteina o ingrediente principal distinto en cada nivel de presupuesto.`,
        };
      }

      const ingA = normalizeDishTokens((a.ingredients || []).join(' '));
      const ingB = normalizeDishTokens((b.ingredients || []).join(' '));
      const ingSim = jaccardSimilarity(ingA, ingB);
      if (ingSim >= 0.72) {
        return {
          diverse: false,
          reason: `Las opciones '${a.budgetTier}' y '${b.budgetTier}' comparten casi los mismos ingredientes (${Math.round(ingSim * 100)}% similitud). Diferencia tambien las guarniciones, vegetales y preparacion.`,
        };
      }
    }
  }

  return { diverse: true, reason: null };
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function pickDiverseArchetype(mealTime, userAllergies, recentNames) {
  const pool = (CULINARY_ARCHETYPES[mealTime] || CULINARY_ARCHETYPES.almuerzo).filter(
    (arch) => !arch.requiresNoAllergy || !userAllergies.includes(arch.requiresNoAllergy)
  );
  const recentTokensList = recentNames.map((n) => normalizeDishTokens(n));
  const freshPool = pool.filter((arch) => {
    const archTokens = normalizeDishTokens(arch.name);
    return !recentTokensList.some((rt) => jaccardSimilarity(archTokens, rt) >= 0.35);
  });
  return pickRandom(freshPool.length > 0 ? freshPool : pool) || pool[0];
}

function pickSafeProteinsByTier(userAllergies, recentMainIngredients = []) {
  const recentNorm = recentMainIngredients.map((x) => normalizeDishTokens(x));
  const result = {};

  for (const tier of ['bajo', 'medio', 'alto']) {
    const safe = PROTEIN_SUGGESTIONS_BY_TIER[tier].filter((p) => {
      const detected = detectAllergensFromText(p);
      return !detected.some((a) => userAllergies.includes(a));
    });
    const fresh = safe.filter((p) => {
      const pTokens = normalizeDishTokens(p);
      return !recentNorm.some((rt) => jaccardSimilarity(pTokens, rt) >= 0.5);
    });
    const candidates = fresh.length > 0 ? fresh : safe;
    result[tier] = pickRandom(candidates) || safe[0] || 'Proteina segura segun perfil';
  }

  return result;
}

function sanitizeVisualTheme(mealTime, budgetTier, title = '') {
  const suffix = budgetTier === 'bajo' ? 'classic' : budgetTier === 'medio' ? 'balanced' : 'gourmet';
  const norm = String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let prefix = mealTime === 'desayuno' ? 'bowl' : mealTime === 'cena' ? 'dinner' : 'chicken';
  if (/\b(taco|tacos|fajita|fajitas|burrito|tostada|tostadas|wrap|wraps)\b/.test(norm)) {
    prefix = 'tacos';
  } else if (/\b(salmon|atun|tilapia|pescado|camaron|camarones|ceviche|marisco)\b/.test(norm)) {
    prefix = 'fish';
  } else if (/\b(pasta|fideo|fideos|espagueti|penne)\b/.test(norm)) {
    prefix = 'pasta';
  } else if (/\b(sopa|crema|caldo|estofado|guiso|curry)\b/.test(norm)) {
    prefix = 'soup';
  } else if (/\b(huevo|huevos|omelette|revuelto)\b/.test(norm)) {
    prefix = 'eggs';
  } else if (/\b(avena|hotcake|crepa)\b/.test(norm)) {
    prefix = 'oatmeal';
  } else if (/\b(bowl|quinoa|arroz|ensalada)\b/.test(norm)) {
    prefix = 'bowl';
  }

  return `${prefix}_${suffix}`;
}

export async function generatePersonalizedMealWithAI(user, mealTime = 'almuerzo', options = {}) {
  const metabolism = calculateMifflinStJeor(user);
  const mealBand = metabolism.mealBands[mealTime] || metabolism.mealBands.almuerzo;
  const userAllergies = Array.isArray(user.allergies) ? user.allergies : [];
  const usdaFoods = await fetchAndCacheUsdaFoods({ allergies: userAllergies, mealTime });

  const [allMeals, recentAiMeals] = await Promise.all([
    getMealsCatalog(null, user.id, { onlyAi: true }),
    getRecentUserAiMeals(user.id, mealTime, 18),
  ]);

  const favoriteMeals = allMeals
    .filter((m) => (user.affinity?.meals?.[m.id]?.chosenCount || 0) >= 2)
    .map((m) => m.title);
  const ignoredMeals = allMeals
    .filter((m) => (user.affinity?.meals?.[m.id]?.ignoredCount || 0) >= 2)
    .map((m) => m.title);

  const extraExcluded = Array.isArray(options.excludeDishes) ? options.excludeDishes : [];
  const recentBaseNames = Array.from(
    new Set(
      [
        ...recentAiMeals.map((m) => String(m.baseName || '').replace(/^Base(\s+IA)?:\s*/i, '').trim()),
        ...extraExcluded.map((n) => String(n || '').replace(/^Base(\s+IA)?:\s*/i, '').trim()),
      ].filter(Boolean)
    )
  ).slice(0, 8);

  const recentVariantTitles = Array.from(
    new Set([...recentAiMeals.map((m) => m.title), ...extraExcluded].filter(Boolean))
  ).slice(0, 12);

  const recentMainIngredients = Array.from(
    new Set(recentAiMeals.slice(0, 6).map((m) => m.mainIngredientName).filter(Boolean))
  );

  const chosenArchetype = pickDiverseArchetype(mealTime, userAllergies, [
    ...recentBaseNames,
    ...recentVariantTitles,
  ]);
  const suggestedProteins = pickSafeProteinsByTier(userAllergies, recentMainIngredients);
  const variationSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const allergyDescriptions =
    userAllergies.length > 0
      ? userAllergies.map((a) => `${a} (${ALLERGY_LABELS[a] || a})`).join(', ')
      : 'Ninguna';

  const systemPrompt = [
    'Eres un nutricionista clinico y chef creativo para Samba (Whixte & Co.).',
    'Responde UNICAMENTE en JSON valido siguiendo el esquema requerido, completamente en espanol y SIN emojis.',
    'REGLAS ESTRICTAS:',
    `1. El usuario tiene alergias/intolerancias: [${allergyDescriptions}]. PROHIBIDO incluir cualquier alimento o derivado de esas alergias en titulos, descripciones o ingredientes.`,
    `2. Crea UN concepto culinario NUEVO para '${mealTime}' inspirado en el 'enfoqueCulinarioObligatorio' proporcionado, con exactamente 3 opciones de presupuesto ('bajo', 'medio', 'alto').`,
    '3. NOVEDAD OBLIGATORIA: ESTA ESTRICTAMENTE PROHIBIDO repetir o reciclar cualquiera de los platillos listados en "platillosRecientesProhibidos". No repitas la misma receta ni cambies solo un adjetivo.',
    '4. DIVERSIDAD OBLIGATORIA ENTRE LAS 3 OPCIONES: Las variantes "bajo", "medio" y "alto" DEBEN ser claramente distintas entre si. Cada presupuesto DEBE usar un ingrediente principal (proteina) DIFERENTE (guiate por "proteinasSugeridasPorPresupuesto"), un titulo distinto y acompanamientos/vegetales/preparacion distintos. NO repitas la misma proteina ni la misma lista de ingredientes en las 3 opciones.',
    `5. Cada variante debe estar entre ${mealBand.min} y ${mealBand.max} kcal (meta ideal ${mealBand.target} kcal).`,
    '6. Apoyate en las fuentes USDA proporcionadas y no repitas un mismo ingrediente dos veces dentro de la lista "ingredients" de una misma variante (ejemplo prohibido: poner "1 tomate" y "100g de tomate").',
    '7. NO incluyas el nivel de presupuesto (como "bajo presupuesto", "presupuesto medio", "alto presupuesto", "economico" o "premium") en el campo title ni en description. Incluye en ingredients la lista completa de ingredientes en espanol con cantidades aproximadas.',
  ].join('\n');

  const baseUserPrompt = JSON.stringify(
    {
      semillaVariacion: variationSeed,
      enfoqueCulinarioObligatorio: {
        formato: chosenArchetype.name,
        estilo: chosenArchetype.style,
      },
      proteinasSugeridasPorPresupuesto: suggestedProteins,
      platillosRecientesProhibidos: {
        basesYaMostradas: recentBaseNames,
        titulosYaMostrados: recentVariantTitles,
      },
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
      fuentesUsdaDisponibles: usdaFoods.slice(0, 14).map((f) => ({
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
  const temperatures = [0.75, 0.6, 0.45];

  for (let attempt = 0; attempt < 3; attempt++) {
    retries = attempt;
    const response = await ollamaChat({
      systemPrompt,
      userPrompt: promptToSend,
      formatSchema: MEAL_RESPONSE_SCHEMA,
      temperature: temperatures[attempt] ?? 0.5,
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
      const cleanIngredients = deduplicateIngredients(
        Array.isArray(v.ingredients) ? v.ingredients : [cleanMain]
      );

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

      const citedSources = usdaFoods.slice(0, 3).map((f) => ({
        provider: 'USDA FoodData Central',
        description: f.description,
      }));

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
        ingredients: cleanIngredients.length > 0 ? cleanIngredients : [cleanMain],
        allergens: [],
        calories,
        protein,
        carbs,
        fat,
        visualTheme: sanitizeVisualTheme(mealTime, expectedTier, cleanTitle),
        nutritionalSheet: stripEmojis(
          v.nutritionalSheet ||
            `Ficha nutricional generada con respaldo USDA: ${calories} kcal (${protein}g proteina, ${carbs}g carbohidratos, ${fat}g grasas).`
        ),
        source: 'ollama_usda_ai',
        generatedForUserId: user.id,
        dataSources: citedSources,
      };

      const mlSafety = await predictSafetyML(
        `${candidate.title} ${candidate.description} ${candidate.ingredients.join(' ')}`,
        0.7
      );
      if (mlSafety?.allergens?.length) {
        candidate.allergens = Array.from(new Set([...candidate.allergens, ...mlSafety.allergens]));
      }

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
      const candidateBaseName = stripEmojis(
        parsed.baseName || chosenArchetype.name || `Base IA: ${normalized[1].title}`
      );

      // Validar novedad respecto a platillos recientes y diversidad entre las 3 variantes
      // (en el ultimo intento solo exigimos reglas duras de alergia/precio para no bloquear al usuario)
      if (attempt < 2) {
        const noveltyCheck = checkMealNovelty(candidateBaseName, normalized, [
          ...recentBaseNames,
          ...recentVariantTitles,
        ]);
        if (!noveltyCheck.novel) {
          errors.push(noveltyCheck.reason);
        }

        const diversityCheck = checkVariantsDiversity(normalized);
        if (!diversityCheck.diverse) {
          errors.push(diversityCheck.reason);
        }
      }

      if (errors.length === 0) {
        validatedVariants = normalized;
        parsedBaseName = candidateBaseName;
        if (!parsedBaseName.toLowerCase().startsWith('base:')) {
          parsedBaseName = `Base IA: ${parsedBaseName}`;
        }
        break;
      }
    }

    lastError = errors.join(' | ');
    promptToSend = `${baseUserPrompt}\n\nRECHAZO DEL MOTOR SIMBOLICO: ${lastError}. Regenera las 3 variantes evitando estrictamente esos alergenos, repeticiones o similitudes. Usa exactamente las proteinas sugeridas por presupuesto (${suggestedProteins.bajo} / ${suggestedProteins.medio} / ${suggestedProteins.alto}) y el formato "${chosenArchetype.name}".`;
  }

  if (validationRejections.length > 0) {
    await saveLogicalTraces(user.id, validationRejections);
  }

  if (!validatedVariants) {
    throw new Error(
      `El Motor Simbolico rechazo la propuesta de IA tras validar reglas: ${lastError}`
    );
  }

  await deactivateUserAiMeals(user.id, mealTime);

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

export async function generatePersonalizedWorkoutsWithAI(user, { excludeRoutines = [] } = {}) {
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
  const recentExcluded = Array.isArray(excludeRoutines) ? excludeRoutines.filter(Boolean) : [];

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
        rutinasRecientesNoRepetir: recentExcluded,
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

      const mlSafety = await predictSafetyML(
        `${candidate.title} ${candidate.technicalSheet} ${candidate.exercises.join(' ')}`,
        0.7
      );
      if (mlSafety) {
        if (mlSafety.highImpact) candidate.impactLevel = 'alto';
        if (mlSafety.contraindications?.length) {
          candidate.contraindications = Array.from(
            new Set([...candidate.contraindications, ...mlSafety.contraindications])
          );
        }
      }

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

  await deactivateUserAiWorkouts(user.id);

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
