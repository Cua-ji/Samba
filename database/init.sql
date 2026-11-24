-- Samba (Whixte & Co.) - Esquema relacional PostgreSQL 16
-- Almacena usuarios, perfiles, catalogos de platillos y ejercicios, afinidad, registros diarios y trazas logicas.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(24) NOT NULL DEFAULT 'usuario' CHECK (role IN ('superusuario', 'usuario', 'invitado')),
  status VARCHAR(16) NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'inactiva')),
  sex VARCHAR(16) NOT NULL DEFAULT 'hombre' CHECK (sex IN ('hombre', 'mujer')),
  age INTEGER NOT NULL DEFAULT 28 CHECK (age BETWEEN 14 AND 110),
  weight_kg NUMERIC(6,2) NOT NULL DEFAULT 72.50,
  height_cm NUMERIC(6,2) NOT NULL DEFAULT 176.00,
  goal VARCHAR(40) NOT NULL DEFAULT 'perder_grasa',
  activity_level VARCHAR(40) NOT NULL DEFAULT 'ligeramente',
  allergies TEXT[] NOT NULL DEFAULT '{}',
  injuries TEXT[] NOT NULL DEFAULT '{}',
  hydration_liters NUMERIC(4,2) NOT NULL DEFAULT 0.50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meals (
  id VARCHAR(80) PRIMARY KEY,
  base_id VARCHAR(80) NOT NULL,
  base_name VARCHAR(180) NOT NULL,
  meal_time VARCHAR(24) NOT NULL CHECK (meal_time IN ('desayuno', 'almuerzo', 'cena')),
  budget_tier VARCHAR(16) NOT NULL CHECK (budget_tier IN ('bajo', 'medio', 'alto')),
  suggested BOOLEAN NOT NULL DEFAULT FALSE,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  prep_minutes INTEGER NOT NULL DEFAULT 15,
  estimated_cost_usd NUMERIC(6,2) NOT NULL DEFAULT 4.00,
  badges TEXT[] NOT NULL DEFAULT '{}',
  main_ingredient_name VARCHAR(180) NOT NULL,
  main_ingredient_price_tier VARCHAR(16) NOT NULL CHECK (main_ingredient_price_tier IN ('bajo', 'medio', 'alto')),
  main_ingredient_allergens TEXT[] NOT NULL DEFAULT '{}',
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  allergens TEXT[] NOT NULL DEFAULT '{}',
  calories INTEGER NOT NULL,
  protein INTEGER NOT NULL,
  carbs INTEGER NOT NULL,
  fat INTEGER NOT NULL,
  visual_theme VARCHAR(60) NOT NULL DEFAULT 'chicken_balanced',
  nutritional_sheet TEXT NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'seed',
  generated_for_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  data_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meals_time_tier ON meals (meal_time, budget_tier) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_meals_base_id ON meals (base_id);

CREATE TABLE IF NOT EXISTS workouts (
  id VARCHAR(80) PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  group_name VARCHAR(160) NOT NULL,
  title VARCHAR(180) NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  equipment VARCHAR(160) NOT NULL DEFAULT 'Sin equipo',
  calories_burned INTEGER NOT NULL DEFAULT 300,
  intensity VARCHAR(120) NOT NULL DEFAULT 'Moderada',
  impact_level VARCHAR(16) NOT NULL CHECK (impact_level IN ('bajo', 'medio', 'alto')),
  contraindications TEXT[] NOT NULL DEFAULT '{}',
  target_goals TEXT[] NOT NULL DEFAULT '{}',
  main_benefit TEXT NOT NULL,
  exercises TEXT[] NOT NULL DEFAULT '{}',
  recommended BOOLEAN NOT NULL DEFAULT FALSE,
  technical_sheet TEXT NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'seed',
  generated_for_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  data_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workouts_group_impact ON workouts (group_id, impact_level) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS external_foods (
  fdc_id INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  data_type VARCHAR(48),
  calories NUMERIC(8,2) NOT NULL DEFAULT 0,
  protein NUMERIC(8,2) NOT NULL DEFAULT 0,
  carbs NUMERIC(8,2) NOT NULL DEFAULT 0,
  fat NUMERIC(8,2) NOT NULL DEFAULT 0,
  allergen_tags TEXT[] NOT NULL DEFAULT '{}',
  source_name VARCHAR(64) NOT NULL DEFAULT 'USDA FoodData Central',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS external_exercises (
  wger_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category VARCHAR(80),
  muscles TEXT[] NOT NULL DEFAULT '{}',
  equipment TEXT[] NOT NULL DEFAULT '{}',
  impact_level VARCHAR(16) NOT NULL DEFAULT 'bajo',
  contraindications TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  source_name VARCHAR(64) NOT NULL DEFAULT 'wger Workout API',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_meal_affinity (
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_id VARCHAR(80) NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  chosen_count INTEGER NOT NULL DEFAULT 0,
  ignored_count INTEGER NOT NULL DEFAULT 0,
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, meal_id)
);

CREATE TABLE IF NOT EXISTS user_workout_affinity (
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id VARCHAR(80) NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workout_id)
);

CREATE TABLE IF NOT EXISTS daily_meal_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_id VARCHAR(80) NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  meal_time VARCHAR(24) NOT NULL,
  calories INTEGER NOT NULL,
  protein INTEGER NOT NULL,
  carbs INTEGER NOT NULL,
  fat INTEGER NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_meal_logs_user_date ON daily_meal_logs (user_id, log_date DESC, logged_at DESC);

CREATE TABLE IF NOT EXISTS daily_workout_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  workout_id VARCHAR(80) NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  calories_burned INTEGER NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_workout_logs_user_date ON daily_workout_logs (user_id, log_date DESC, logged_at DESC);

CREATE TABLE IF NOT EXISTS daily_hydration_logs (
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  liters NUMERIC(4,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, log_date)
);

CREATE TABLE IF NOT EXISTS user_history (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(48) NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  label TEXT NOT NULL,
  delta INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_history_user_time ON user_history (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS logical_traces (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  entity_title VARCHAR(200) NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logical_traces_user_time ON logical_traces (user_id, created_at DESC, id DESC);
