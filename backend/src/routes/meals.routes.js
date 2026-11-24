import express from 'express';
import {
  getHydratedUser,
  getMealsCatalog,
  getMealById,
  createCatalogMeal,
  saveLogicalTraces,
  recordMealAffinity,
} from '../db/repository.js';
import { checkPriceConsistency, evaluateMealsForUser } from '../symbolic/engine.js';
import { generatePersonalizedMealWithAI } from '../services/aiRecommender.js';

const router = express.Router();

function filterLatestBase(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) return [];
  const latestBaseId = catalog[0].baseId;
  return catalog.filter((m) => m.baseId === latestBaseId);
}

router.post('/:userId/generate-ai', async (req, res, next) => {
  try {
    const user = await getHydratedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const mealTime = ['desayuno', 'almuerzo', 'cena'].includes(req.body?.mealTime)
      ? req.body.mealTime
      : 'almuerzo';

    const generated = await generatePersonalizedMealWithAI(user, mealTime);
    const catalog = filterLatestBase(await getMealsCatalog(mealTime, user.id, { onlyAi: true }));
    const updatedUser = await getHydratedUser(user.id);
    const evaluation = evaluateMealsForUser(updatedUser, catalog, { mealTime });

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
    const { requesterUserId, meal } = req.body || {};
    const requester = await getHydratedUser(requesterUserId);
    if (!requester) {
      return res.status(404).json({ error: 'Usuario solicitante no encontrado.' });
    }
    if (requester.role !== 'superusuario') {
      return res.status(403).json({
        error: 'Solo un superusuario puede agregar platillos al catalogo PostgreSQL.',
      });
    }

    if (!meal?.title || !meal?.mealTime || !meal?.budgetTier || !meal?.mainIngredient?.name) {
      return res.status(400).json({
        error: 'Datos incompletos: se requiere title, mealTime, budgetTier y mainIngredient.',
      });
    }

    const priceCheck = checkPriceConsistency(meal);
    if (!priceCheck.consistent) {
      return res.status(400).json({
        error: priceCheck.reason,
        rule: priceCheck.rule,
      });
    }

    const created = await createCatalogMeal(meal);
    return res.status(201).json({ meal: created });
  } catch (err) {
    next(err);
  }
});

router.get('/:userId', async (req, res, next) => {
  try {
    const user = await getHydratedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const mealTime = req.query.mealTime || 'almuerzo';
    const catalog = filterLatestBase(await getMealsCatalog(mealTime, user.id, { onlyAi: true }));
    const evaluation = evaluateMealsForUser(user, catalog, { mealTime });

    await saveLogicalTraces(
      user.id,
      evaluation.traces.filter((t) => t.outcome === 'discarded')
    );

    return res.json({
      mealTime,
      ...evaluation,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:userId/affinity', async (req, res, next) => {
  try {
    const { mealId, action } = req.body || {};
    if (!mealId || !['choose', 'ignore'].includes(action)) {
      return res.status(400).json({ error: 'Parametros invalidos (mealId, action: choose|ignore).' });
    }

    const existingUser = await getHydratedUser(req.params.userId);
    if (!existingUser) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const meal = await getMealById(mealId);
    if (!meal) return res.status(404).json({ error: 'Platillo no encontrado en PostgreSQL.' });

    const { user, affinityRecord } = await recordMealAffinity(existingUser.id, meal, action);
    const catalog = filterLatestBase(await getMealsCatalog(meal.mealTime, user.id, { onlyAi: true }));
    const evaluation = evaluateMealsForUser(user, catalog, { mealTime: meal.mealTime });

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

export default router;
