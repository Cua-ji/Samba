import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction, closePool } from './pool.js';
import { hashPassword } from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INIT_SQL_PATH = path.resolve(__dirname, '../../../database/init.sql');
const MEALS_JSON_PATH = path.resolve(__dirname, '../data/knowledge_meals.json');
const WORKOUTS_JSON_PATH = path.resolve(__dirname, '../data/knowledge_workouts.json');

export async function ensureDatabaseReady() {
  const initSql = fs.readFileSync(INIT_SQL_PATH, 'utf-8');
  await pool.query(initSql);

  // Migracion idempotente para volumenes PostgreSQL existentes
  await pool.query(`
    ALTER TABLE meals
      ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'seed',
      ADD COLUMN IF NOT EXISTS generated_for_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS data_sources JSONB NOT NULL DEFAULT '[]'::jsonb;

    ALTER TABLE workouts
      ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'seed',
      ADD COLUMN IF NOT EXISTS generated_for_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS data_sources JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  const meals = JSON.parse(fs.readFileSync(MEALS_JSON_PATH, 'utf-8'));
  const workouts = JSON.parse(fs.readFileSync(WORKOUTS_JSON_PATH, 'utf-8'));

  await withTransaction(async (client) => {
    for (const m of meals) {
      await client.query(
        `INSERT INTO meals (
          id, base_id, base_name, meal_time, budget_tier, suggested, title, description,
          prep_minutes, estimated_cost_usd, badges, main_ingredient_name,
          main_ingredient_price_tier, main_ingredient_allergens, ingredients, allergens,
          calories, protein, carbs, fat, visual_theme, nutritional_sheet
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22
        ) ON CONFLICT (id) DO NOTHING`,
        [
          m.id,
          m.baseId,
          m.baseName,
          m.mealTime,
          m.budgetTier,
          Boolean(m.suggested),
          m.title,
          m.description,
          Number(m.prepMinutes),
          Number(m.estimatedCostUsd),
          m.badges || [],
          m.mainIngredient.name,
          m.mainIngredient.priceTier,
          m.mainIngredient.allergens || [],
          m.ingredients || [],
          m.allergens || [],
          Number(m.calories),
          Number(m.protein),
          Number(m.carbs),
          Number(m.fat),
          m.visualTheme || 'chicken_balanced',
          m.nutritionalSheet,
        ]
      );
    }

    for (const w of workouts) {
      await client.query(
        `INSERT INTO workouts (
          id, group_id, group_name, title, duration_min, equipment, calories_burned,
          intensity, impact_level, contraindications, target_goals, main_benefit,
          exercises, recommended, technical_sheet
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15
        ) ON CONFLICT (id) DO NOTHING`,
        [
          w.id,
          w.groupId,
          w.groupName,
          w.title,
          Number(w.durationMin),
          w.equipment,
          Number(w.caloriesBurned),
          w.intensity,
          w.impactLevel,
          w.contraindications || [],
          w.targetGoals || [],
          w.mainBenefit,
          w.exercises || [],
          Boolean(w.recommended),
          w.technicalSheet,
        ]
      );
    }

    const demoUsers = [
      {
        id: 'usr_alejandro',
        name: 'Alejandro Morales',
        email: 'alejandro@samba.app',
        passwordHash: hashPassword('Samba2026'),
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
        hydrationLiters: 1.5,
      },
      {
        id: 'usr_superadmin',
        name: 'Sofia Navarro',
        email: 'admin@samba.app',
        passwordHash: hashPassword('Admin2026'),
        role: 'superusuario',
        status: 'activa',
        sex: 'mujer',
        age: 32,
        weightKg: 61.0,
        heightCm: 168,
        goal: 'recomposicion',
        activityLevel: 'moderado',
        allergies: ['gluten'],
        injuries: [],
        hydrationLiters: 2.0,
      },
      {
        id: 'usr_invitado',
        name: 'Invitado Samba',
        email: 'invitado@samba.app',
        passwordHash: hashPassword('Invitado2026'),
        role: 'invitado',
        status: 'activa',
        sex: 'hombre',
        age: 30,
        weightKg: 75.0,
        heightCm: 175,
        goal: 'salud_vitalidad',
        activityLevel: 'ligeramente',
        allergies: [],
        injuries: [],
        hydrationLiters: 1.0,
      },
    ];

    for (const u of demoUsers) {
      await client.query(
        `INSERT INTO users (
          id, name, email, password_hash, role, status, sex, age,
          weight_kg, height_cm, goal, activity_level, allergies, injuries, hydration_liters
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15
        ) ON CONFLICT (id) DO NOTHING`,
        [
          u.id,
          u.name,
          u.email,
          u.passwordHash,
          u.role,
          u.status,
          u.sex,
          u.age,
          u.weightKg,
          u.heightCm,
          u.goal,
          u.activityLevel,
          u.allergies,
          u.injuries,
          u.hydrationLiters,
        ]
      );
    }

    // Sembrar afinidad, logs e historial inicial de Alejandro solo si aun no existen datos suyos
    const histCountRes = await client.query(
      'SELECT COUNT(*)::int AS cnt FROM user_history WHERE user_id = $1',
      ['usr_alejandro']
    );
    if (histCountRes.rows[0].cnt === 0) {
      await client.query(
        `INSERT INTO user_meal_affinity (user_id, meal_id, score, chosen_count, ignored_count)
         VALUES
           ('usr_alejandro', 'alm_pollo_medio', 4, 2, 0),
           ('usr_alejandro', 'cen_salteado_bajo', 2, 1, 0)
         ON CONFLICT (user_id, meal_id) DO NOTHING`
      );

      await client.query(
        `INSERT INTO user_workout_affinity (user_id, workout_id, score, completed_count, positive_count, negative_count)
         VALUES
           ('usr_alejandro', 'rut_hipertrofia_torso', 1, 1, 1, 0)
         ON CONFLICT (user_id, workout_id) DO NOTHING`
      );

      await client.query(
        `INSERT INTO daily_meal_logs (user_id, log_date, meal_id, title, meal_time, calories, protein, carbs, fat)
         VALUES
           ('usr_alejandro', CURRENT_DATE, 'alm_pollo_medio', 'Version Balanceada & Granos', 'almuerzo', 585, 44, 50, 19),
           ('usr_alejandro', CURRENT_DATE, 'cen_salteado_bajo', 'Fajitas Economicas de Pollo y Calabacin', 'cena', 430, 34, 42, 12)`
      );

      await client.query(
        `INSERT INTO daily_workout_logs (user_id, log_date, workout_id, title, calories_burned, rating)
         VALUES
           ('usr_alejandro', CURRENT_DATE, 'rut_hipertrofia_torso', 'Fuerza Hipertrofia: Torso & Core', 360, 1)`
      );

      await client.query(
        `INSERT INTO user_history (user_id, event_type, entity_id, label, delta)
         VALUES
           ('usr_alejandro', 'meal_choose', 'alm_pollo_medio', 'Elegido: Version Balanceada & Granos (+2 afinidad, Favorito)', 2),
           ('usr_alejandro', 'workout_rate', 'rut_hipertrofia_torso', 'Completada: Fuerza Hipertrofia: Torso & Core (+1 afinidad)', 1)`
      );

      await client.query(
        `INSERT INTO logical_traces (user_id, rule, entity_type, entity_id, entity_title, outcome, reason, details)
         VALUES
           ('usr_alejandro', 'descartado(alm_tacos_bajo, alergia([lactosa]))', 'meal', 'alm_tacos_bajo', 'Tacos Clasicos de Salmon y Yogur', 'discarded', 'Descartado por restriccion del usuario (Lactosa / Lacteos).', '{"mealTime":"almuerzo"}'::jsonb),
           ('usr_alejandro', 'ejercicio_descartado(rut_correr_hiit, lesion([rodilla]))', 'workout', 'rut_correr_hiit', 'Correr / HIIT de Alto Impacto', 'discarded', 'Excluido por seguridad articular (Rodilla). Rutina de impacto alto contraindicada para tu lesion activa.', '{"impactLevel":"alto"}'::jsonb)`
      );
    }
  });
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  ensureDatabaseReady()
    .then(async () => {
      const [u, m, w] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS cnt FROM users'),
        pool.query('SELECT COUNT(*)::int AS cnt FROM meals'),
        pool.query('SELECT COUNT(*)::int AS cnt FROM workouts'),
      ]);
      console.log(
        `PostgreSQL seeded cleanly: users=${u.rows[0].cnt}, meals=${m.rows[0].cnt}, workouts=${w.rows[0].cnt}`
      );
      await closePool();
    })
    .catch(async (err) => {
      console.error('Error seeding PostgreSQL:', err);
      await closePool();
      process.exit(1);
    });
}
