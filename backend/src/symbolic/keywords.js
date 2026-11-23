function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const SAFE_FOOD_PHRASES =
  /\b(sin gluten|libre de gluten|sin lactosa|libre de lactosa|leche de coco|leche de almendra|leche de soya|leche de soja|leche de avena|leche vegetal|bebida vegetal|sin huevo|sin frutos secos|sin mariscos|sin pescado)\b/g;

const ALLERGEN_PATTERNS = {
  gluten: /\b(wheat|trigo|barley|cebada|rye|centeno|pasta|bread|pan|flour|harina|penne|pappardelle|spaghetti|gluten|couscous|seitan|tortilla de harina)\b/,
  lactosa: /\b(milk|dairy|cheese|yogurt|yogur|butter|cream|whey|casein|leche|queso|mantequilla|crema|requeson|cottage|lactosa|lacteos|parmigiano|mozzarella)\b/,
  frutos_secos: /\b(almond|almonds|almendra|almendras|walnut|walnuts|nuez|nueces|peanut|peanuts|mani|cacahuate|cacahuates|cashew|pistachio|pistacho|hazelnut|avellana|avellanas|pecan|pine nut|pinon|pinones|frutos secos)\b/,
  pescados_mariscos: /\b(fish|pescado|pescados|salmon|tuna|atun|cod|bacalao|tilapia|trout|trucha|robalo|shrimp|camaron|camarones|langostino|langostinos|prawn|crab|cangrejo|lobster|langosta|mariscos|shellfish|sardina|anchovy|anchoa)\b/,
  huevo: /\b(egg|eggs|huevo|huevos|clara de huevo|claras de huevo|yema|mayonnaise|mayonesa|omelette|frittata)\b/,
};

export function detectAllergensFromText(text) {
  const cleaned = normalize(text).replace(SAFE_FOOD_PHRASES, ' ');
  const found = [];
  for (const [key, pattern] of Object.entries(ALLERGEN_PATTERNS)) {
    if (pattern.test(cleaned)) found.push(key);
  }
  return found;
}

const SAFE_EXERCISE_PHRASES =
  /\b(sin saltos|sin impacto|bajo impacto|no impact|low impact|zero impact|sin carga axial)\b/g;

export function classifyExerciseImpact(text) {
  const cleaned = normalize(text).replace(SAFE_EXERCISE_PHRASES, ' ');
  const contraindications = new Set();
  let impactLevel = 'bajo';

  const highImpactRe =
    /\b(run|running|correr|trotar|jogging|sprint|sprints|jump|jumping|salto|saltos|saltar|burpee|burpees|plyo|plyometric|pliometria|box jump|alto impacto|high impact)\b/;
  const axialLoadRe =
    /\b(barbell squat|sentadilla trasera|sentadilla pesada|deadlift|peso muerto convencional|peso muerto pesado|clean and jerk|snatch)\b/;
  const shoulderLoadRe =
    /\b(overhead press|press militar|handstand|fondos profundos|fondos en paralelas|weighted dip)\b/;

  if (highImpactRe.test(cleaned)) {
    impactLevel = 'alto';
    contraindications.add('rodilla');
    contraindications.add('tobillo');
    if (/\b(run|running|correr|sprint|plyo|pliometria)\b/.test(cleaned)) {
      contraindications.add('lumbar');
    }
  }

  if (axialLoadRe.test(cleaned)) {
    impactLevel = 'alto';
    contraindications.add('lumbar');
    contraindications.add('rodilla');
  }

  if (shoulderLoadRe.test(cleaned)) {
    impactLevel = 'alto';
    contraindications.add('hombro');
  }

  return {
    impactLevel,
    contraindications: Array.from(contraindications),
  };
}
