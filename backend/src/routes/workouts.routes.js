import express from 'express';
import {
  getHydratedUser,
  getWorkoutsCatalog,
  getWorkoutById,
  createCatalogWorkout,
  saveLogicalTraces,
  recordWorkoutAffinity,
  removeTodayWorkoutLog,
} from '../db/repository.js';
import { evaluateWorkoutsForUser } from '../symbolic/engine.js';
import { generatePersonalizedWorkoutsWithAI } from '../services/aiRecommender.js';
import { enrichWorkoutsEvaluationWithML, predictSafetyML } from '../services/mlService.js';

const router = express.Router();

async function evaluateAndRankWorkouts(user) {
  const catalog = await getWorkoutsCatalog(user.id, { onlyAi: true });
  const rawEval = evaluateWorkoutsForUser(user, catalog);
  return enrichWorkoutsEvaluationWithML(user, rawEval);
}

router.post('/:userId/generate-ai', async (req, res, next) => {
  try {
    const user = await getHydratedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const excludeRoutines = Array.isArray(req.body?.excludeRoutines)
      ? req.body.excludeRoutines.filter((x) => typeof x === 'string' && x.trim().length > 0)
      : [];

    const generated = await generatePersonalizedWorkoutsWithAI(user, { excludeRoutines });
    const updatedUser = await getHydratedUser(user.id);
    const evaluation = await evaluateAndRankWorkouts(updatedUser);

    return res.status(201).json({
      generated,
      user: updatedUser,
      evaluation,
    });
  } catch (err) {
    if (err.message?.includes('Ollama') || err.message?.includes('Motor Simbolico')) {
      return res.status(502).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/catalog', async (req, res, next) => {
  try {
    const { requesterUserId, workout } = req.body || {};
    const requester = await getHydratedUser(requesterUserId);
    if (!requester) {
      return res.status(404).json({ error: 'Usuario solicitante no encontrado.' });
    }
    if (requester.role !== 'superusuario') {
      return res.status(403).json({
        error: 'Solo un superusuario puede agregar rutinas al catalogo PostgreSQL.',
      });
    }

    if (!workout?.title || !workout?.impactLevel || !workout?.mainBenefit) {
      return res.status(400).json({
        error: 'Datos incompletos: se requiere title, impactLevel y mainBenefit.',
      });
    }

    const mlSafety = await predictSafetyML(
      `${workout.title} ${workout.mainBenefit} ${(workout.exercises || []).join(' ')}`,
      0.7
    );
    if (mlSafety) {
      if (mlSafety.highImpact) workout.impactLevel = 'alto';
      if (mlSafety.contraindications?.length) {
        workout.contraindications = Array.from(
          new Set([...(workout.contraindications || []), ...mlSafety.contraindications])
        );
      }
    }

    const created = await createCatalogWorkout(workout);
    return res.status(201).json({ workout: created });
  } catch (err) {
    next(err);
  }
});

router.get('/:userId', async (req, res, next) => {
  try {
    const user = await getHydratedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const evaluation = await evaluateAndRankWorkouts(user);

    await saveLogicalTraces(
      user.id,
      evaluation.traces.filter((t) => t.outcome === 'discarded')
    );

    return res.json(evaluation);
  } catch (err) {
    next(err);
  }
});

router.post('/:userId/affinity', async (req, res, next) => {
  try {
    const { workoutId, rating, completed = true, action = null } = req.body || {};
    if (!workoutId) {
      return res.status(400).json({ error: 'workoutId es obligatorio.' });
    }

    const existingUser = await getHydratedUser(req.params.userId);
    if (!existingUser) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const workout = await getWorkoutById(workoutId);
    if (!workout) return res.status(404).json({ error: 'Rutina no encontrada en PostgreSQL.' });

    const delta = Number(rating) >= 0 ? 1 : -1;
    const { user, affinityRecord } = await recordWorkoutAffinity(
      existingUser.id,
      workout,
      delta,
      delta > 0 && completed,
      action
    );

    const evaluation = await evaluateAndRankWorkouts(user);

    return res.json({
      user,
      todayLog: user.todayLog,
      affinityRecord,
      evaluation,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:userId/today/:workoutId', async (req, res, next) => {
  try {
    const user = await removeTodayWorkoutLog(req.params.userId, req.params.workoutId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const evaluation = await evaluateAndRankWorkouts(user);
    return res.json({
      user,
      todayLog: user.todayLog,
      evaluation,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
