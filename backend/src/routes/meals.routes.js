import express from 'express';
import {
  getHydratedUser,
  getMealsCatalog,
  getMealById,
  createCatalogMeal,
  saveLogicalTraces,
  recordMealAffinity,
  removeTodayMealLog,
} from '../db/repository.js';
import { checkPriceConsistency, evaluateMealsForUser } from '../symbolic/engine.js';
import { generatePersonalizedMealWithAI } from '../services/aiRecommender.js';
import { enrichMealsEvaluationWithML, predictSafetyML } from '../services/mlService.js';

const router = express.Router();

async function evaluateAndRankMeals(user, mealTime) {
  const catalog = await getMealsCatalog(mealTime, user.id, { onlyAi: true });
  const rawEval = evaluateMealsForUser(user, catalog, { mealTime });
  return enrichMealsEvaluationWithML(user, rawEval);
}

router.post('/:userId/generate-ai', async (req, res, next) => {
  try {
    const user = await getHydratedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const mealTime = ['desayuno', 'almuerzo', 'cena'].includes(req.body?.mealTime)
      ? req.body.mealTime
      : 'almuerzo';
    const excludeDishes = Array.isArray(req.body?.excludeDishes)
      ? req.body.excludeDishes.filter((x) => typeof x === 'string' && x.trim().length > 0)
      : [];

    const generated = await generatePersonalizedMealWithAI(user, mealTime, { excludeDishes });
    const updatedUser = await getHydratedUser(user.id);
    const evaluation = await evaluateAndRankMeals(updatedUser, mealTime);

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

    const mlSafety = await predictSafetyML(
      `${meal.title} ${meal.description || ''} ${(meal.ingredients || []).join(' ')}`,
      0.7
    );
    if (mlSafety?.allergens?.length) {
      meal.allergens = Array.from(new Set([...(meal.allergens || []), ...mlSafety.allergens]));
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
    const evaluation = await evaluateAndRankMeals(user, mealTime);

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
    if (!mealId || !['choose', 'ignore', 'unignore'].includes(action)) {
      return res
        .status(400)
        .json({ error: 'Parametros invalidos (mealId, action: choose|ignore|unignore).' });
    }

    const existingUser = await getHydratedUser(req.params.userId);
    if (!existingUser) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const meal = await getMealById(mealId);
    if (!meal) return res.status(404).json({ error: 'Platillo no encontrado en PostgreSQL.' });

    const { user, affinityRecord } = await recordMealAffinity(existingUser.id, meal, action);
    const evaluation = await evaluateAndRankMeals(user, meal.mealTime);

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

router.delete('/:userId/today/:mealId', async (req, res, next) => {
  try {
    const mealTime = req.query.mealTime || 'almuerzo';
    const user = await removeTodayMealLog(req.params.userId, req.params.mealId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const evaluation = await evaluateAndRankMeals(user, mealTime);
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
