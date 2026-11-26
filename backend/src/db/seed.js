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

    // Eliminar cuenta de ejemplo alejandro@samba.app si existiera en la BD
    await client.query(
      `DELETE FROM users WHERE id = 'usr_alejandro' OR email = 'alejandro@samba.app'`
    );

    const demoUsers = [
      {
        id: 'usr_superadmin',
        name: 'Admin',
        email: 'admin@gmail.com',
        passwordHash: hashPassword('admin1234'),
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
        name: 'Invitado',
        email: 'invitado@gmail.com',
        passwordHash: hashPassword('invitado1234'),
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
        ) ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role`,
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
