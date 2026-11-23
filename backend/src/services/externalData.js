import {
  detectAllergensFromText,
  classifyExerciseImpact,
} from '../symbolic/keywords.js';
import {
  getSafeExternalFoods,
  upsertExternalFoods,
  getSafeExternalExercises,
  upsertExternalExercises,
} from '../db/repository.js';

const USDA_SEARCH_QUERIES = {
  desayuno: ['rolled oats', 'quinoa cooked', 'chicken breast', 'avocado'],
  almuerzo: ['chicken breast', 'brown rice', 'black beans', 'sweet potato'],
  cena: ['turkey breast', 'broccoli', 'spinach', 'chickpeas'],
};

const CURATED_USDA_BACKUP = [
  {
    fdcId: 171477,
    description: 'Chicken breast, skinless, boneless, cooked',
    dataType: 'Foundation',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    allergenTags: [],
    sourceName: 'USDA FoodData Central (Referencia)',
  },
  {
    fdcId: 169704,
    description: 'Rice, brown, long-grain, cooked',
    dataType: 'Foundation',
    calories: 112,
    protein: 2.6,
    carbs: 23.5,
    fat: 0.9,
    allergenTags: [],
    sourceName: 'USDA FoodData Central (Referencia)',
  },
  {
    fdcId: 173735,
    description: 'Beans, black, mature seeds, cooked',
    dataType: 'Foundation',
    calories: 132,
    protein: 8.9,
    carbs: 23.7,
    fat: 0.5,
    allergenTags: [],
    sourceName: 'USDA FoodData Central (Referencia)',
  },
  {
    fdcId: 171705,
    description: 'Avocados, raw, all commercial varieties',
    dataType: 'Foundation',
    calories: 160,
    protein: 2,
    carbs: 8.5,
    fat: 14.7,
    allergenTags: [],
    sourceName: 'USDA FoodData Central (Referencia)',
  },
  {
    fdcId: 168482,
    description: 'Sweet potato, cooked, baked in skin',
    dataType: 'Foundation',
    calories: 90,
    protein: 2,
    carbs: 20.7,
    fat: 0.2,
    allergenTags: [],
    sourceName: 'USDA FoodData Central (Referencia)',
  },
  {
    fdcId: 170379,
    description: 'Broccoli, cooked, boiled, drained',
    dataType: 'Foundation',
    calories: 35,
    protein: 2.4,
    carbs: 7.2,
    fat: 0.4,
    allergenTags: [],
    sourceName: 'USDA FoodData Central (Referencia)',
  },
  {
    fdcId: 171500,
    description: 'Turkey, breast, meat only, roasted',
    dataType: 'Foundation',
    calories: 147,
    protein: 30,
    carbs: 0,
    fat: 2.1,
    allergenTags: [],
    sourceName: 'USDA FoodData Central (Referencia)',
  },
  {
    fdcId: 168917,
    description: 'Quinoa, cooked',
    dataType: 'Foundation',
    calories: 120,
    protein: 4.4,
    carbs: 21.3,
    fat: 1.9,
    allergenTags: [],
    sourceName: 'USDA FoodData Central (Referencia)',
  },
];

function extractUsdaNutrient(foodNutrients, names) {
  if (!Array.isArray(foodNutrients)) return 0;
  const hit = foodNutrients.find((n) =>
    names.some((target) => (n.nutrientName || '').toLowerCase().includes(target))
  );
  return hit ? Number(hit.value || 0) : 0;
}

export async function fetchAndCacheUsdaFoods({ allergies = [], mealTime = 'almuerzo' }) {
  let cached = await getSafeExternalFoods(allergies, 16);
  if (cached.length >= 6) {
    return cached;
  }

  const apiKey = (process.env.USDA_API_KEY || 'DEMO_KEY').trim();
  const terms = [...(USDA_SEARCH_QUERIES[mealTime] || USDA_SEARCH_QUERIES.almuerzo)];
  if (!allergies.includes('pescados_mariscos')) terms.push('salmon');
  if (!allergies.includes('huevo')) terms.push('egg');

  const collected = [];
  for (const term of terms.slice(0, 3)) {
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
        term
      )}&pageSize=5&api_key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SambaWellness/1.0 (WhixteCo)' },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const f of data.foods || []) {
        const description = String(f.description || '').trim();
        if (!description || !f.fdcId) continue;
        const calories = extractUsdaNutrient(f.foodNutrients, ['energy']);
        const protein = extractUsdaNutrient(f.foodNutrients, ['protein']);
        const carbs = extractUsdaNutrient(f.foodNutrients, ['carbohydrate']);
        const fat = extractUsdaNutrient(f.foodNutrients, ['total lipid']);
        if (calories <= 0) continue;

        collected.push({
          fdcId: Number(f.fdcId),
          description,
          dataType: f.dataType || 'USDA',
          calories,
          protein,
          carbs,
          fat,
          allergenTags: detectAllergensFromText(`${description} ${f.ingredients || ''}`),
          sourceName: 'USDA FoodData Central',
        });
      }
    } catch {
      // Silencio intencional: si falla una consulta, sigue con las demas o respaldo local
    }
  }

  if (collected.length > 0) {
    await upsertExternalFoods(collected);
    cached = await getSafeExternalFoods(allergies, 16);
  }

  if (cached.length < 4) {
    await upsertExternalFoods(CURATED_USDA_BACKUP);
    cached = await getSafeExternalFoods(allergies, 16);
  }

  return cached;
}

function stripHtmlTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CURATED_WGER_BACKUP = [
  {
    wgerId: 9001,
    name: 'Puente de Gluteo en Suelo',
    category: 'Piernas y Gluteo',
    muscles: ['Gluteus maximus', 'Biceps femoris'],
    equipment: ['Peso corporal'],
    impactLevel: 'bajo',
    contraindications: [],
    description: 'Elevacion controlada de cadera desde el suelo sin impacto en rodilla.',
    sourceName: 'wger Workout API (Referencia)',
  },
  {
    wgerId: 9002,
    name: 'Remo Unilateral con Mancuerna',
    category: 'Espalda',
    muscles: ['Latissimus dorsi', 'Rhomboids'],
    equipment: ['Mancuerna'],
    impactLevel: 'bajo',
    contraindications: [],
    description: 'Traccion controlada unilateral con apoyo firme en banco.',
    sourceName: 'wger Workout API (Referencia)',
  },
  {
    wgerId: 9003,
    name: 'Press de Pecho en Suelo',
    category: 'Pecho',
    muscles: ['Pectoralis major', 'Triceps brachii'],
    equipment: ['Mancuernas'],
    impactLevel: 'bajo',
    contraindications: [],
    description: 'Empuje horizontal seguro que limita hiperextension de hombro.',
    sourceName: 'wger Workout API (Referencia)',
  },
  {
    wgerId: 9004,
    name: 'Plancha Frontal Isometrica',
    category: 'Core',
    muscles: ['Rectus abdominis', 'Transversus abdominis'],
    equipment: ['Tapete'],
    impactLevel: 'bajo',
    contraindications: [],
    description: 'Estabilizacion isometrica de tronco sin saltos ni carga axial.',
    sourceName: 'wger Workout API (Referencia)',
  },
];

export async function fetchAndCacheWgerExercises({ injuries = [] }) {
  let cached = await getSafeExternalExercises(injuries, 20);
  if (cached.length >= 8) {
    return cached;
  }

  try {
    const res = await fetch('https://wger.de/api/v2/exerciseinfo/?limit=40', {
      headers: { 'User-Agent': 'SambaWellness/1.0 (WhixteCo)' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const parsed = [];
      for (const ex of data.results || []) {
        const translations = Array.isArray(ex.translations) ? ex.translations : [];
        // Idioma 4 = Espanol, 2 = Ingles
        const picked =
          translations.find((t) => t.language === 4 && t.name) ||
          translations.find((t) => t.language === 2 && t.name);
        if (!picked) continue;

        const cleanName = String(picked.name).trim();
        const cleanDesc = stripHtmlTags(picked.description).slice(0, 260);
        const category = ex.category?.name || 'General';
        const muscles = (ex.muscles || []).map((m) => m.name_en || m.name).filter(Boolean);
        const equipment = (ex.equipment || []).map((eq) => eq.name).filter(Boolean);
        const classification = classifyExerciseImpact(`${cleanName} ${cleanDesc}`);

        parsed.push({
          wgerId: Number(ex.id),
          name: cleanName,
          category,
          muscles,
          equipment: equipment.length > 0 ? equipment : ['Peso corporal'],
          impactLevel: classification.impactLevel,
          contraindications: classification.contraindications,
          description: cleanDesc || `Ejercicio de ${category} (${muscles.join(', ') || 'general'}).`,
          sourceName: 'wger Workout API',
        });
      }

      if (parsed.length > 0) {
        await upsertExternalExercises(parsed);
        cached = await getSafeExternalExercises(injuries, 20);
      }
    }
  } catch {
    // Fallback al respaldo curado si wger no responde a tiempo
  }

  if (cached.length < 4) {
    await upsertExternalExercises(CURATED_WGER_BACKUP);
    cached = await getSafeExternalExercises(injuries, 20);
  }

  return cached;
}
