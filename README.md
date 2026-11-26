# Samba (Whixte & Co.)

Sistema experto neuro-simbólico para recomendaciones personalizadas de nutrición y entrenamiento físico con arquitectura **RAG (Retrieval-Augmented Generation)**, **3 redes neuronales en PyTorch (`ml_service`)**, persistencia relacional en **PostgreSQL (Supabase)**, inferencia local con **Ollama (`qwen2.5:7b`)** y sincronización de fuentes externas reales (**USDA FoodData Central** + **wger Workout API**).

## Arquitectura General

- **Base de Datos (`database/init.sql` + Supabase):**
  - PostgreSQL gestionado en **Supabase** (configurable vía `DATABASE_URL` en `backend/.env`, con SSL automático para conexiones no locales).
  - Tablas principales: `users`, `meals`, `workouts`, `external_foods`, `external_exercises`, `user_meal_affinity`, `user_workout_affinity`, `daily_meal_logs`, `daily_workout_logs`, `daily_hydration_logs`, `user_history`, `logical_traces`.
- **Redes Neuronales (`ml_service/`):**
  - Microservicio FastAPI en `http://127.0.0.1:8001` (`ml_service/app.py`) con tres modelos PyTorch entrenados:
    - `IntentNet`: clasificación de intención del chat (tiempo de comida, presupuesto y flags de consulta).
    - `SafetyNet`: detección multi-etiqueta de alérgenos y contraindicaciones en texto.
    - `AffinityNet`: puntuación personalizada de afinidad usuario–platillo/rutina.
- **IA Local + Fuentes Reales (`backend/src/services/`):**
  - **Ollama (`ollama.js`):** Conectado a `http://127.0.0.1:11434` con el modelo `qwen2.5:7b` para el Chat RAG y generación JSON estructurada.
  - **Fuentes Externas (`externalData.js`):** Consulta y almacena en caché en PostgreSQL alimentos reales de **USDA FoodData Central** (`external_foods`) y ejercicios reales de **wger Workout API** (`external_exercises`).
  - **Recomendador Neuro-Simbólico (`aiRecommender.js`):** Genera menús (`bajo`/`medio`/`alto`) y rutinas con Ollama usando datos reales de USDA/wger, valida cada salida contra `SafetyNet` y las reglas simbólicas (`descartado`, `precio_consistente`, `ejercicio_descartado`) con reintento correctivo automático y guarda las propuestas aprobadas en PostgreSQL.
- **Motor Simbólico (`backend/src/symbolic/`):**
  - `mifflin.js`: Cálculo metabólico Mifflin-St Jeor, TDEE, macros objetivo e IMC dinámico.
  - `engine.js` y `keywords.js`: Reglas estrictas de alergias, consistencia de presupuesto/calorías, lesiones articulares, afinidad (`Favorito >= 2`, baja prioridad `>= 2`) y trazas lógicas.
- **Frontend (`frontend/`):** React 18 + Vite + Tailwind CSS.

## Configuración y Ejecución

1. **Configurar la conexión a Supabase y Ollama:**
   En `backend/.env`, verifica `DATABASE_URL`, `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL=qwen2.5:7b` y `USDA_API_KEY`.

2. **Aplicar esquema/migración y cargar datos iniciales:**
   ```powershell
   npm.cmd run db:seed
   ```

3. **Verificar Ollama local:**
   Asegúrate de tener Ollama corriendo con `qwen2.5:7b` (`ollama pull qwen2.5:7b`).

4. **Ejecutar Microservicio ML, Backend y Frontend:**
   - Terminal 1 (Redes Neuronales en `http://127.0.0.1:8001`):
     ```powershell
     npm.cmd run ml:start
     ```
   - Terminal 2 (API Backend en `http://localhost:3001`):
     ```powershell
     npm.cmd run start:backend
     ```
   - Terminal 3 (Frontend en `http://localhost:5173`):
     ```powershell
     npm.cmd run dev:frontend
     ```

5. **Pruebas y Entrenamiento:**
   - Pruebas del Motor Simbólico y RAG:
     ```powershell
     npm.cmd run test:symbolic
     ```
   - Re-entrenar las 3 redes neuronales:
     ```powershell
     npm.cmd run ml:train
     ```

## Cuentas de Prueba Pre-cargadas

- **Superusuario (auditoría global y alta de platillos/rutinas al catálogo):** `admin@gmail.com` / `admin1234`
- **Invitado:** `invitado@gmail.com` / `invitado1234`
