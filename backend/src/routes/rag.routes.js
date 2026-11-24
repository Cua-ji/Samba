import express from 'express';
import {
  getHydratedUser,
  getMealsCatalog,
  getWorkoutsCatalog,
  saveLogicalTraces,
} from '../db/repository.js';
import { runRagPipeline } from '../rag/pipeline.js';

const router = express.Router();

router.post('/ask', async (req, res, next) => {
  try {
    const { userId, message } = req.body || {};
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      return res.status(400).json({ error: 'Escribe una consulta para el asistente Samba.' });
    }

    const user = await getHydratedUser(userId || 'usr_alejandro');
    if (!user) {
      return res.status(404).json({ error: 'No existe un perfil de usuario activo.' });
    }

    const [mealsCatalog, workoutsCatalog] = await Promise.all([
      getMealsCatalog(null, user.id, { onlyAi: true }),
      getWorkoutsCatalog(user.id),
    ]);

    const result = await runRagPipeline(user, cleanMessage, mealsCatalog, workoutsCatalog);

    await saveLogicalTraces(user.id, [
      {
        rule: `consulta_rag(modo=${result.providerUsed}, valid_meals=${result.retrieval.validMealsCount}, valid_workouts=${result.retrieval.validWorkoutsCount})`,
        entityType: 'rag',
        entityId: 'chat',
        entityTitle: cleanMessage.slice(0, 60),
        outcome: 'rag_query',
        reason: `Contexto auditado recuperado desde PostgreSQL: ${result.retrieval.activeRules.length} reglas activas y ${result.retrieval.discardTraces.meals.length + result.retrieval.discardTraces.workouts.length} descartes citables.`,
        details: { providerUsed: result.providerUsed },
      },
    ]);

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
