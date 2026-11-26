import express from 'express';
import {
  getHydratedUser,
  getDailyLogByDate,
  getDailyLogDatesSummary,
  updateUserProfile,
  getAdminAuditSummary,
  getDatabaseStats,
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

router.get('/:userId/daily-log', async (req, res, next) => {
  try {
    const user = await getHydratedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const date = typeof req.query.date === 'string' ? req.query.date : null;
    const log = await getDailyLogByDate(user.id, date);
    if (log.isFuture) {
      return res.status(400).json({ error: 'No se pueden consultar días posteriores al actual.' });
    }
    return res.json(log);
  } catch (err) {
    next(err);
  }
});

router.get('/:userId/daily-logs-summary', async (req, res, next) => {
  try {
    const user = await getHydratedUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const todayStr = new Date().toISOString().slice(0, 10);
    const startDate =
      typeof req.query.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.startDate)
        ? req.query.startDate
        : todayStr;
    const endDate =
      typeof req.query.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate)
        ? req.query.endDate
        : todayStr;

    const activeDates = await getDailyLogDatesSummary(user.id, startDate, endDate);
    return res.json({ activeDates });
  } catch (err) {
    next(err);
  }
});

router.patch('/:userId', async (req, res, next) => {
  try {
    const existing = await getHydratedUser(req.params.userId);
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const updates = { ...(req.body || {}) };
    if (updates.targetDate && updates.targetDate !== existing.todayLog?.date) {
      return res.status(400).json({ error: 'Solo puedes registrar cambios en el día actual.' });
    }
    delete updates.targetDate;
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

    const [accounts, stats] = await Promise.all([
      getAdminAuditSummary(),
      getDatabaseStats(),
    ]);
    return res.json({ totalUsers: accounts.length, accounts, stats });
  } catch (err) {
    next(err);
  }
});

export default router;
