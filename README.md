# Samba (Whixte & Co.)

Sistema experto neuro-simbólico para recomendaciones personalizadas de nutrición y entrenamiento físico con arquitectura **RAG (Retrieval-Augmented Generation)**, persistencia relacional en **PostgreSQL 16 (Docker Desktop)**, inferencia local acelerada por GPU con **Ollama (`qwen2.5:7b`)** y sincronización de fuentes externas reales (**USDA FoodData Central** + **wger Workout API**).

## Arquitectura General

- **Base de Datos (`docker-compose.yml` + `database/init.sql`):**
  - Contenedor `samba-postgres` (`postgres:16-alpine` en `localhost:5432`, base de datos `samba_db`, usuario `samba`, volumen persistente `samba_pgdata`).
  - Contenedor `samba-adminer` (`adminer` en `http://localhost:8080`) para explorar todas las tablas (`users`, `meals`, `workouts`, `external_foods`, `external_exercises`, `user_meal_affinity`, `user_workout_affinity`, `daily_meal_logs`, `daily_workout_logs`, `user_history`, `logical_traces`).
- **IA Local + Fuentes Reales (`backend/src/services/`):**
  - **Ollama (`ollama.js`):** Conectado a `http://127.0.0.1:11434` con el modelo `qwen2.5:7b` para el Chat RAG y generación JSON estructurada.
  - **Fuentes Externas (`externalData.js`):** Consulta y almacena en caché en PostgreSQL alimentos reales de **USDA FoodData Central** (`external_foods`) y ejercicios reales de **wger Workout API** (`external_exercises`).
  - **Recomendador Neuro-Simbólico (`aiRecommender.js`):** Genera menús (`bajo`/`medio`/`alto`) y rutinas con Ollama usando los datos reales de USDA/wger, valida cada salida contra las reglas simbólicas (`descartado`, `precio_consistente`, `ejercicio_descartado`) con reintento correctivo automático y guarda las propuestas aprobadas en PostgreSQL.
- **Motor Simbólico (`backend/src/symbolic/`):**
  - `mifflin.js`: Cálculo metabólico Mifflin-St Jeor, TDEE, macros objetivo e IMC dinámico.
  - `engine.js` y `keywords.js`: Reglas estrictas de alergias, consistencia de presupuesto/calorías, lesiones articulares (incluyendo detección semántica bilingüe sobre texto generado por IA), afinidad (`Favorito >= 2`, baja prioridad `>= 2`) y trazas lógicas.
- **Frontend (`frontend/`):** React 18 + Vite + Tailwind CSS siguiendo el sistema visual de `DESIGN.md` y las 11 pantallas de Stitch (paleta menta `#D5F7E8`, tarjetas blancas redondeadas, acentos `#00B87C`, botones `#181A20`, sin emojis).

## Configuración y Ejecución

1. **Levantar PostgreSQL y Adminer en Docker Desktop:**
   ```powershell
   npm.cmd run db:up
   ```

2. **Aplicar esquema/migración y cargar datos iniciales:**
   ```powershell
   npm.cmd run db:seed
   ```

3. **Verificar Ollama local:**
   Asegúrate de tener Ollama corriendo con `qwen2.5:7b` (`ollama pull qwen2.5:7b`). En `backend/.env` viene configurado `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL=qwen2.5:7b` y `USDA_API_KEY=DEMO_KEY`.

4. **Ejecutar Backend y Frontend:**
   - Terminal 1 (API en `http://localhost:3001`):
     ```powershell
     npm.cmd run start:backend
     ```
   - Terminal 2 (Frontend en `http://localhost:5173`):
     ```powershell
     npm.cmd run dev:frontend
     ```
   - Explorador BD Adminer: `http://localhost:8080` (`Servidor: postgres`, `Usuario: samba`, `Contraseña: samba_secret`, `Base de datos: samba_db`).

5. **Pruebas del Motor Simbólico y RAG:**
   ```powershell
   npm.cmd run test:symbolic
   ```

## Cuentas de Prueba Pre-cargadas

- **Usuario estándar (con intolerancia a lactosa y lesión de rodilla):** `alejandro@samba.app` / `Samba2026`
- **Superusuario (con auditoría global y alta de Platillos/Rutinas al catálogo PostgreSQL):** `admin@samba.app` / `Admin2026`
- **Invitado:** `invitado@samba.app` / `Invitado2026`
