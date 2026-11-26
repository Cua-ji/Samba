/**
 * Cliente HTTP para el microservicio de redes neuronales (ml_service).
 * Si el servicio no esta activo o excede el timeout, retorna null para hacer fallback determinista.
 */

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');
const ML_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 1500);

const GOAL_ORDER = ['perder_grasa', 'ganar_masa', 'recomposicion', 'salud_vitalidad'];
const ACTIVITY_ORDER = ['sedentario', 'ligeramente', 'moderadamente', 'muy_activo'];
const IMPACT_MAP = { bajo: 0, medio: 1, alto: 2 };

async function postMl(path, payload) {
  try {
    const res = await fetch(`${ML_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ML_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function checkMlServiceHealth() {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(1200),
    });
    if (!res.ok) return { connected: false, baseUrl: ML_SERVICE_URL, modelsLoaded: [] };
    const data = await res.json();
    return {
      connected: true,
      baseUrl: ML_SERVICE_URL,
      modelsLoaded: data.models_loaded || [],
    };
  } catch {
    return { connected: false, baseUrl: ML_SERVICE_URL, modelsLoaded: [] };
  }
}

export async function predictIntentML(query) {
  if (!query) return null;
  return postMl('/predict/intent', { query: String(query) });
}

export async function predictSafetyML(text, threshold = 0.65) {
  if (!text) return null;
  return postMl('/predict/safety', { text: String(text), threshold });
}

export async function predictAffinityML(user, candidates, isMeal) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const payload = {
    sex: user?.sex === 'mujer' ? 0 : 1,
    age: Number(user?.age || 28),
    weight_kg: Number(user?.weightKg || user?.weight_kg || 72.5),
    height_cm: Number(user?.heightCm || user?.height_cm || 176),
    goal_idx: Math.max(0, GOAL_ORDER.indexOf(user?.goal || 'perder_grasa')),
    activity_idx: Math.max(
      0,
      ACTIVITY_ORDER.indexOf(user?.activityLevel || user?.activity_level || 'ligeramente')
    ),
    candidates: candidates.map((item) => ({
      id: String(item.id),
      is_meal: isMeal ? 1 : 0,
      calories: Number(isMeal ? item.calories || 0 : item.caloriesBurned || 0),
      protein: Number(item.protein || 0),
      carbs: Number(item.carbs || 0),
      fat: Number(item.fat || 0),
      cost_usd: Number(item.estimatedCostUsd || 0),
      prep_min: Number(item.prepMinutes || 0),
      duration_min: Number(item.durationMin || 0),
      impact_num: IMPACT_MAP[item.impactLevel] ?? 0,
    })),
  };

  return postMl('/predict/affinity', payload);
}

export async function enrichMealsEvaluationWithML(user, evaluation) {
  const affinityRes = await predictAffinityML(user, evaluation.validMeals, true);
  const scores = affinityRes?.scores || null;

  const attachScore = (meal) => {
    const rawScore = scores?.[meal.id];
    if (typeof rawScore !== 'number') return { ...meal, mlAffinityPct: null };
    const bonus = meal.affinity?.isFavorite ? 0.06 : meal.affinity?.lowPriority ? -0.15 : 0;
    const bounded = Math.min(0.99, Math.max(0.35, rawScore + bonus));
    return {
      ...meal,
      mlAffinityScore: bounded,
      mlAffinityPct: Math.round(bounded * 100),
    };
  };

  const validMeals = evaluation.validMeals.map(attachScore);
  const baseDishes = evaluation.baseDishes.map((group) => {
    const options = group.options.map(attachScore);
    const maxMl = options.reduce((acc, o) => Math.max(acc, o.mlAffinityScore || 0), 0);
    const isAi = options.some((o) => o.source === 'ollama_usda_ai');
    return {
      ...group,
      isAi,
      maxMlScore: maxMl,
      options,
    };
  });

  baseDishes.sort((a, b) => {
    if (a.isAi !== b.isAi) return a.isAi ? -1 : 1;
    if (a.hasFavorite !== b.hasFavorite) return a.hasFavorite ? -1 : 1;
    if (b.maxAffinity !== a.maxAffinity) return b.maxAffinity - a.maxAffinity;
    return b.maxMlScore - a.maxMlScore;
  });

  return {
    ...evaluation,
    mlActive: Boolean(scores),
    mlModel: scores ? 'AffinityNet' : null,
    validMeals,
    baseDishes,
  };
}

export async function enrichWorkoutsEvaluationWithML(user, evaluation) {
  const affinityRes = await predictAffinityML(user, evaluation.validWorkouts, false);
  const scores = affinityRes?.scores || null;

  const attachScore = (workout) => {
    const rawScore = scores?.[workout.id];
    if (typeof rawScore !== 'number') return { ...workout, mlAffinityPct: null };
    const bonus =
      (workout.affinity?.score || 0) >= 2
        ? 0.06
        : (workout.affinity?.score || 0) <= -2
        ? -0.15
        : 0;
    const bounded = Math.min(0.99, Math.max(0.35, rawScore + bonus));
    return {
      ...workout,
      mlAffinityScore: bounded,
      mlAffinityPct: Math.round(bounded * 100),
    };
  };

  const validWorkouts = evaluation.validWorkouts.map(attachScore);
  const groups = evaluation.groups.map((group) => {
    const options = group.options.map(attachScore).sort((a, b) => {
      if (b.affinity.score !== a.affinity.score) return b.affinity.score - a.affinity.score;
      if ((b.mlAffinityScore || 0) !== (a.mlAffinityScore || 0)) {
        return (b.mlAffinityScore || 0) - (a.mlAffinityScore || 0);
      }
      if (a.goalMatch !== b.goalMatch) return a.goalMatch ? -1 : 1;
      return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
    });
    const isAi = options.some((o) => o.source === 'ollama_wger_ai');
    return { ...group, isAi, options };
  });

  groups.sort((a, b) => (a.isAi === b.isAi ? 0 : a.isAi ? -1 : 1));

  return {
    ...evaluation,
    mlActive: Boolean(scores),
    mlModel: scores ? 'AffinityNet' : null,
    validWorkouts,
    groups,
  };
}
