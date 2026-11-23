/**
 * Calculos biometricos y metabolicos deterministas (Mifflin-St Jeor + IMC).
 */

export const ACTIVITY_FACTORS = {
  sedentario: {
    factor: 1.2,
    label: 'Sedentario',
    description: 'Trabajo de escritorio, poco movimiento (< 5,000 pasos/dia).',
  },
  ligeramente: {
    factor: 1.375,
    label: 'Ligeramente activo',
    description: 'Caminatas suaves, recados cotidianos (5,000 - 8,000 pasos).',
  },
  moderado: {
    factor: 1.55,
    label: 'Moderadamente activo',
    description: 'De pie la mayor parte del dia, tareas dinamicas (8,000 - 12,000 pasos).',
  },
  muy_activo: {
    factor: 1.725,
    label: 'Muy activo / Atleta',
    description: 'Trabajo fisico intenso o alta movilidad continua (> 12,000 pasos).',
  },
};

export const GOAL_ADJUSTMENTS = {
  perder_grasa: {
    calorieDelta: -400,
    label: 'Perder grasa & definir',
    macroSplit: { proteinPct: 0.32, carbsPct: 0.38, fatPct: 0.3 },
  },
  ganar_masa: {
    calorieDelta: 300,
    label: 'Ganar masa muscular',
    macroSplit: { proteinPct: 0.28, carbsPct: 0.48, fatPct: 0.24 },
  },
  recomposicion: {
    calorieDelta: -100,
    label: 'Recomposicion corporal',
    macroSplit: { proteinPct: 0.3, carbsPct: 0.42, fatPct: 0.28 },
  },
  salud_vitalidad: {
    calorieDelta: 0,
    label: 'Mejorar salud y vitalidad',
    macroSplit: { proteinPct: 0.25, carbsPct: 0.45, fatPct: 0.3 },
  },
};

export function calculateIMC(weightKg, heightCm) {
  const safeWeight = Math.max(30, Number(weightKg) || 70);
  const safeHeightM = Math.max(1.2, (Number(heightCm) || 170) / 100);
  const bmi = Number((safeWeight / (safeHeightM * safeHeightM)).toFixed(1));

  let category = 'Saludable';
  if (bmi < 18.5) category = 'Bajo peso';
  else if (bmi < 25) category = 'Saludable';
  else if (bmi < 30) category = 'Sobrepeso';
  else category = 'Obesidad';

  return { bmi, category };
}

export function calculateMifflinStJeor({
  sex = 'hombre',
  age = 28,
  weightKg = 72.5,
  heightCm = 176,
  activityLevel = 'ligeramente',
  goal = 'perder_grasa',
}) {
  const w = Math.max(30, Number(weightKg) || 70);
  const h = Math.max(120, Number(heightCm) || 170);
  const a = Math.max(14, Number(age) || 28);
  const isFemale = String(sex).toLowerCase() === 'mujer';

  // Ecuacion Mifflin-St Jeor:
  // Hombre: (10 * kg) + (6.25 * cm) - (5 * edad) + 5
  // Mujer:  (10 * kg) + (6.25 * cm) - (5 * edad) - 161
  const sexConstant = isFemale ? -161 : 5;
  const bmr = Math.round(10 * w + 6.25 * h - 5 * a + sexConstant);

  const activityMeta = ACTIVITY_FACTORS[activityLevel] || ACTIVITY_FACTORS.ligeramente;
  const tdee = Math.round(bmr * activityMeta.factor);

  const goalMeta = GOAL_ADJUSTMENTS[goal] || GOAL_ADJUSTMENTS.salud_vitalidad;
  const minFloor = isFemale ? 1250 : 1400;
  const targetCalories = Math.max(minFloor, Math.round((tdee + goalMeta.calorieDelta) / 10) * 10);

  const proteinTarget = Math.round((targetCalories * goalMeta.macroSplit.proteinPct) / 4);
  const carbsTarget = Math.round((targetCalories * goalMeta.macroSplit.carbsPct) / 4);
  const fatTarget = Math.round((targetCalories * goalMeta.macroSplit.fatPct) / 9);

  const imc = calculateIMC(w, h);

  // Distribucion aproximada por tiempo de comida: 25% desayuno, 35% almuerzo, 30% cena (+10% margen snacks)
  const mealBands = {
    desayuno: {
      min: Math.round(targetCalories * 0.2),
      max: Math.round(targetCalories * 0.3),
      target: Math.round(targetCalories * 0.25),
    },
    almuerzo: {
      min: Math.round(targetCalories * 0.28),
      max: Math.round(targetCalories * 0.4),
      target: Math.round(targetCalories * 0.35),
    },
    cena: {
      min: Math.round(targetCalories * 0.22),
      max: Math.round(targetCalories * 0.33),
      target: Math.round(targetCalories * 0.28),
    },
  };

  return {
    bmr,
    tdee,
    targetCalories,
    activityFactor: activityMeta.factor,
    activityLabel: activityMeta.label,
    goalLabel: goalMeta.label,
    calorieDelta: goalMeta.calorieDelta,
    macrosTarget: {
      protein: proteinTarget,
      carbs: carbsTarget,
      fat: fatTarget,
    },
    imc,
    mealBands,
    formulaSummary: `Mifflin-St Jeor (${isFemale ? 'Mujer' : 'Hombre'}): TMB ${bmr} kcal x ${activityMeta.factor} (${activityMeta.label}) = ${tdee} kcal; ajuste objetivo (${goalMeta.calorieDelta >= 0 ? '+' : ''}${goalMeta.calorieDelta} kcal) = ${targetCalories} kcal/dia.`,
  };
}
