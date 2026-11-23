import express from 'express';
import {
  getHydratedUser,
  updateUserProfile,
  getAdminAuditSummary,
  getMealsCatalog,
  getWorkoutsCatalog,
  saveLogicalTraces,
} from '../db/repository.js';
import { calculateMifflinStJeor } from '../symbolic/mifflin.js';
import { evaluateMealsForUser, evaluateWorkoutsForUser } from '../symbolic/engine.js';

const router = express.Router();
const VALID_ROLES = ['superusuario', 'usuario', 'invitado'];
const VALID_STATUSES = ['activa', 'inactiva'];

router.get('/:userId', async (req, res, next) => {
  try {
    const user = await getHydratedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const metabolism = calculateMifflinStJeor(user);
    return res.json({
      user,
      metabolism,
      todayLog: user.todayLog,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:userId', async (req, res, next) => {
  try {
    const existing = await getHydratedUser(req.params.userId);
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const updates = { ...(req.body || {}) };
    if (updates.role && !VALID_ROLES.includes(updates.role)) {
      delete updates.role;
    }
    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      delete updates.status;
    }

    const updated = await updateUserProfile(req.params.userId, updates);
    const [mealsCatalog, workoutsCatalog] = await Promise.all([
      getMealsCatalog(),
      getWorkoutsCatalog(),
    ]);

    const mealsEval = evaluateMealsForUser(updated, mealsCatalog);
    const workoutsEval = evaluateWorkoutsForUser(updated, workoutsCatalog);
    await saveLogicalTraces(updated.id, [
      ...mealsEval.traces.filter((t) => t.outcome === 'discarded'),
      ...workoutsEval.traces.filter((t) => t.outcome === 'discarded'),
    ]);

    const refreshed = await getHydratedUser(updated.id);
    const metabolism = calculateMifflinStJeor(refreshed);

    return res.json({
      user: refreshed,
      metabolism,
      todayLog: refreshed.todayLog,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:userId/admin-audit', async (req, res, next) => {
  try {
    const requester = await getHydratedUser(req.params.userId);
    if (!requester) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (requester.role !== 'superusuario') {
      return res.status(403).json({
        error: 'Acceso restringido: se requiere rol superusuario para auditar cuentas.',
      });
    }

    const accounts = await getAdminAuditSummary();
    return res.json({ totalUsers: accounts.length, accounts });
  } catch (err) {
    next(err);
  }
});

export default router;
