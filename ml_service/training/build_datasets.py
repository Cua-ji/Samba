"""Genera datasets reproducibles para IntentNet, SafetyNet y AffinityNet usando el catalogo real de Samba."""

import json
import random
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
MEALS_PATH = ROOT_DIR / "backend" / "src" / "data" / "knowledge_meals.json"
WORKOUTS_PATH = ROOT_DIR / "backend" / "src" / "data" / "knowledge_workouts.json"

MEAL_TIME_LABELS = ["none", "desayuno", "almuerzo", "cena"]
BUDGET_LABELS = ["none", "bajo", "medio", "alto"]
SAFETY_LABELS = [
    "gluten",
    "lactosa",
    "frutos_secos",
    "pescados_mariscos",
    "huevo",
    "alto_impacto",
    "rodilla",
    "lumbar",
    "hombro",
    "tobillo",
]


def build_intent_dataset(seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    samples = []

    meal_phrases = {
        "desayuno": ["desayuno", "desayunar", "desayune", "en la manana", "para la manana", "temprano"],
        "almuerzo": ["almuerzo", "almorzar", "almuerce", "comida", "mediodia", "para comer hoy"],
        "cena": ["cena", "cenar", "ceno", "en la noche", "nocturno", "algo ligero de noche"],
    }
    budget_phrases = {
        "bajo": ["barato", "economico", "presupuesto bajo", "accesible", "que no sea caro"],
        "medio": ["presupuesto medio", "equilibrado", "balanceado", "sugerido"],
        "alto": ["premium", "gourmet", "presupuesto alto", "sin limite de costo", "caro"],
    }

    # 1. Consultas de comida (combinando mealTime y budgetTier)
    meal_templates = [
        "Que me recomiendas de {m} {b}?",
        "Quiero opciones para {m} con {b}",
        "Dame un platillo de {m} {b} sin alergenos",
        "Necesito ideas de {m} {b}",
        "Cual es el mejor {m} {b} para mi?",
        "Sugiereme algo para {m} {b} por favor",
    ]
    for m_label, m_words in meal_phrases.items():
        for b_label, b_words in budget_phrases.items():
            for _ in range(14):
                tmpl = rng.choice(meal_templates)
                q = tmpl.format(m=rng.choice(m_words), b=rng.choice(b_words))
                samples.append({
                    "query": q,
                    "mealTime": m_label,
                    "budgetTier": b_label,
                    "flags": [0, 1, 0, 0],
                })
        # Solo mealTime sin presupuesto
        for _ in range(18):
            q = f"Que puedo {rng.choice(m_words)} hoy segun mis alergias?"
            samples.append({
                "query": q,
                "mealTime": m_label,
                "budgetTier": "none",
                "flags": [0, 1, 0, 0],
            })

    # Solo presupuesto sin mealTime
    for b_label, b_words in budget_phrases.items():
        for _ in range(18):
            q = f"Muestrame platillos de {rng.choice(b_words)} ricos en proteina"
            samples.append({
                "query": q,
                "mealTime": "none",
                "budgetTier": b_label,
                "flags": [0, 1, 0, 1],
            })

    # 2. Consultas de entrenamiento y lesiones
    workout_templates = [
        "Que rutina de ejercicio me toca hoy?",
        "Puedo salir a correr o trotar?",
        "Dame ejercicios para entrenar sin lastimar mi rodilla",
        "Rutina de cardio segura para mi lesion lumbar",
        "Que entrenamiento de fuerza puedo hacer en casa?",
        "Puedo hacer saltos o HIIT hoy?",
        "Sugiereme una rutina para el gimnasio",
        "Ejercicios de bajo impacto para tobillo y rodilla",
        "Quiero entrenar torso y core sin dolor de hombro",
    ]
    for _ in range(95):
        base = rng.choice(workout_templates)
        suffix = rng.choice(["", " por favor", " segun mi perfil", " hoy"])
        samples.append({
            "query": base + suffix,
            "mealTime": "none",
            "budgetTier": "none",
            "flags": [1, 0, 0, 0],
        })

    # 3. Consultas de por que se descarto (comida o ejercicio)
    why_workout = [
        "Por que me descartaron correr?",
        "Por que no puedo hacer burpees o saltos?",
        "Cual es la razon por la que se excluyo la rutina de impacto?",
        "Por que me prohibieron correr en mi plan?",
        "Explicame por que se descarto ese ejercicio",
    ]
    for _ in range(55):
        samples.append({
            "query": rng.choice(why_workout),
            "mealTime": "none",
            "budgetTier": "none",
            "flags": [1, 0, 1, 0],
        })

    why_meal = [
        "Por que me descartaron la avena con leche?",
        "Por que no me recomiendas platillos con queso o crema?",
        "Por que se excluyo ese desayuno de mi menu?",
        "Que platillos fueron bloqueados por mis alergias?",
    ]
    for _ in range(55):
        samples.append({
            "query": rng.choice(why_meal),
            "mealTime": "none",
            "budgetTier": "none",
            "flags": [0, 1, 1, 0],
        })

    # 4. Consultas de calorias / macros / balance
    macro_templates = [
        "Cuantas calorias y proteinas debo consumir hoy?",
        "Como va mi balance calorico y mis macros?",
        "Cual es mi IMC y meta diaria de kcal?",
        "Resumen de mis carbohidratos y grasas de hoy",
        "Cuanta proteina me falta para llegar a mi meta?",
    ]
    for _ in range(75):
        samples.append({
            "query": rng.choice(macro_templates),
            "mealTime": "none",
            "budgetTier": "none",
            "flags": [0, 0, 0, 1],
        })

    # 5. Mixtas (ej. cena + macros, o rutina + calorias)
    for _ in range(40):
        samples.append({
            "query": "Cuantas calorias tiene una cena economica y cuanta proteina aporta?",
            "mealTime": "cena",
            "budgetTier": "bajo",
            "flags": [0, 1, 0, 1],
        })
        samples.append({
            "query": "Cuantas kcal quemo con una rutina de bajo impacto?",
            "mealTime": "none",
            "budgetTier": "none",
            "flags": [1, 0, 0, 1],
        })

    rng.shuffle(samples)
    return samples


def _labels_to_vec(active: list[str]) -> list[int]:
    active_set = set(active)
    return [1 if lbl in active_set else 0 for lbl in SAFETY_LABELS]


def build_safety_dataset(seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    meals = json.loads(MEALS_PATH.read_text(encoding="utf-8"))
    workouts = json.loads(WORKOUTS_PATH.read_text(encoding="utf-8"))
    samples = []

    # 1. Ejemplos reales del catalogo de platillos
    for m in meals:
        text = f"{m['title']} {m['description']} {' '.join(m['ingredients'])}"
        vec = _labels_to_vec(m.get("allergens", []))
        samples.append({"text": text, "labels": vec})
        # Variacion corta solo ingredientes
        samples.append({"text": ", ".join(m["ingredients"]), "labels": vec})

    # 2. Ejemplos reales del catalogo de rutinas
    for w in workouts:
        text = f"{w['title']} {w.get('technicalSheet', '')} {' '.join(w['exercises'])}"
        active = list(w.get("contraindications", []))
        if w.get("impactLevel") == "alto":
            active.append("alto_impacto")
        vec = _labels_to_vec(active)
        samples.append({"text": text, "labels": vec})

    # 3. Aumentacion bilingue (ES/EN) para USDA/wger y frases seguras engañosas
    synthetic_safety = [
        ("whole milk yogurt cheese whey protein butter cream", ["lactosa"]),
        ("leche entera queso crema yogurt griego mantequilla", ["lactosa"]),
        ("almond milk oat milk coconut milk dairy free sin lactosa", []),
        ("bebida de almendra sin lactosa ni gluten", ["frutos_secos"]),
        ("wheat bread pasta spaghetti flour tortillas gluten", ["gluten"]),
        ("pan integral pasta de trigo harina tortilla de harina", ["gluten"]),
        ("gluten free rice quinoa chicken breast avocado", []),
        ("peanuts walnuts almonds cashews pistachios frutos secos", ["frutos_secos"]),
        ("salmon tuna shrimp cod fish mariscos camaron atun", ["pescados_mariscos"]),
        ("scrambled eggs omelette huevo clara yema mayonesa", ["huevo"]),
        ("pechuga de pollo arroz integral brocoli aceite de oliva", []),
        ("box jumps burpees plyometric sprint running high impact", ["alto_impacto", "rodilla", "tobillo", "lumbar"]),
        ("correr trotar saltos al cajon burpees explosivos", ["alto_impacto", "rodilla", "tobillo", "lumbar"]),
        ("heavy barbell back squat conventional deadlift", ["alto_impacto", "lumbar", "rodilla"]),
        ("sentadilla trasera pesada peso muerto convencional", ["alto_impacto", "lumbar", "rodilla"]),
        ("overhead barbell press handstand weighted dips", ["alto_impacto", "hombro"]),
        ("press militar con barra fondos profundos", ["alto_impacto", "hombro"]),
        ("stationary cycling swimming walking low impact sin saltos", []),
        ("ciclismo estacionario caminata plancha isometrica sin impacto", []),
    ]
    for text, active in synthetic_safety:
        for _ in range(15):
            words = text.split()
            rng.shuffle(words)
            samples.append({"text": " ".join(words), "labels": _labels_to_vec(active)})

    # Combinaciones mixtas (multi-alergeno y ejercicio + alergeno)
    single_allergens = [
        ("whole milk cheese yogurt", ["lactosa"]),
        ("leche queso crema mantequilla", ["lactosa"]),
        ("scrambled eggs omelette huevo", ["huevo"]),
        ("wheat bread pasta harina pan", ["gluten"]),
        ("almonds peanuts walnuts nueces almendras", ["frutos_secos"]),
        ("salmon tuna shrimp camaron pescado", ["pescados_mariscos"]),
        ("box jumps burpees running sprint", ["alto_impacto", "rodilla", "tobillo", "lumbar"]),
        ("jump rope jumping jacks saltos cuerda pliometria", ["alto_impacto", "rodilla", "tobillo"]),
        ("ankle hops lateral bounds sprints impacto tobillo", ["alto_impacto", "tobillo", "rodilla"]),
        ("overhead press handstand press militar fondos", ["alto_impacto", "hombro"]),
    ]
    for _ in range(150):
        chosen = rng.sample(single_allergens, k=rng.randint(2, 3))
        combined_text = " ".join(t for t, _ in chosen)
        combined_labels = [lbl for _, lbls in chosen for lbl in lbls]
        samples.append({"text": combined_text, "labels": _labels_to_vec(combined_labels)})

    rng.shuffle(samples)
    return samples


def build_affinity_dataset(seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    meals = json.loads(MEALS_PATH.read_text(encoding="utf-8"))
    workouts = json.loads(WORKOUTS_PATH.read_text(encoding="utf-8"))
    samples = []

    goals = ["perder_grasa", "ganar_masa", "recomposicion", "salud_vitalidad"]
    activities = ["sedentario", "ligeramente", "moderadamente", "muy_activo"]
    sexes = ["hombre", "mujer"]

    for _ in range(1800):
        sex = rng.choice(sexes)
        age = rng.randint(18, 62)
        weight = rng.uniform(52, 108)
        height = rng.uniform(152, 192)
        goal = rng.choice(goals)
        activity = rng.choice(activities)

        is_meal = rng.random() < 0.65
        if is_meal:
            item = rng.choice(meals)
            calories = item["calories"]
            protein = item["protein"]
            carbs = item["carbs"]
            fat = item["fat"]
            cost = item["estimatedCostUsd"]
            prep = item["prepMinutes"]
            duration = 0
            impact_num = 0
            # Regla base realista evaluando densidad proteica y rango segun tiempo de comida
            meal_time = item.get("mealTime", "almuerzo")
            ideal_max = 480 if meal_time == "desayuno" else (640 if meal_time == "almuerzo" else 540)
            protein_density = protein / max(1, calories)  # ej. 35g / 520kcal = 0.067

            score = 0.50
            if goal == "perder_grasa":
                if calories <= ideal_max and protein_density >= 0.058:
                    score += 0.32
                elif protein >= 28:
                    score += 0.18
            elif goal == "ganar_masa":
                if calories >= (ideal_max - 90) and protein >= 30:
                    score += 0.34
            elif goal == "recomposicion":
                if protein_density >= 0.060 and protein >= 28:
                    score += 0.32
            elif goal == "salud_vitalidad":
                if prep <= 20 and fat <= 22:
                    score += 0.28

            if cost <= 5.5:
                score += 0.08
            if item.get("suggested"):
                score += 0.10
        else:
            item = rng.choice(workouts)
            calories = item["caloriesBurned"]
            protein = 0
            carbs = 0
            fat = 0
            cost = 0.0
            prep = 0
            duration = item["durationMin"]
            impact_map = {"bajo": 0, "medio": 1, "alto": 2}
            impact_num = impact_map.get(item["impactLevel"], 1)

            score = 0.40
            if goal in item.get("targetGoals", []):
                score += 0.35
            if activity in ("sedentario", "ligeramente") and impact_num == 2:
                score -= 0.30
            elif activity in ("moderadamente", "muy_activo") and duration >= 30:
                score += 0.15
            if item.get("recommended"):
                score += 0.1

        label = 1 if (score + rng.uniform(-0.12, 0.12)) >= 0.65 else 0
        samples.append({
            "features": {
                "sex": 1 if sex == "hombre" else 0,
                "age": age,
                "weight_kg": round(weight, 1),
                "height_cm": round(height, 1),
                "goal_idx": goals.index(goal),
                "activity_idx": activities.index(activity),
                "is_meal": 1 if is_meal else 0,
                "calories": calories,
                "protein": protein,
                "carbs": carbs,
                "fat": fat,
                "cost_usd": cost,
                "prep_min": prep,
                "duration_min": duration,
                "impact_num": impact_num,
            },
            "label": label,
        })

    return samples


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    intent_data = build_intent_dataset()
    safety_data = build_safety_dataset()
    affinity_data = build_affinity_dataset()

    (DATA_DIR / "intent_dataset.json").write_text(
        json.dumps(intent_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA_DIR / "safety_dataset.json").write_text(
        json.dumps(safety_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA_DIR / "affinity_dataset.json").write_text(
        json.dumps(affinity_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Datasets generados: intent={len(intent_data)}, safety={len(safety_data)}, affinity={len(affinity_data)}")


if __name__ == "__main__":
    main()
