import express from 'express';
import {
  findUserAuthByEmail,
  createUser,
  reactivateUser,
  getHydratedUser,
  getDemoAccounts,
  getMealsCatalog,
  getWorkoutsCatalog,
  saveLogicalTraces,
} from '../db/repository.js';
import { verifyPassword } from '../db/security.js';
import { calculateMifflinStJeor } from '../symbolic/mifflin.js';
import { evaluateMealsForUser, evaluateWorkoutsForUser } from '../symbolic/engine.js';

const router = express.Router();
const VALID_ROLES = ['superusuario', 'usuario', 'invitado'];

router.get('/demo-accounts', async (_req, res, next) => {
  try {
    const accounts = await getDemoAccounts();
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role = 'usuario',
      sex = 'hombre',
      age = 28,
      weightKg = 72.5,
      heightCm = 176,
      goal = 'perder_grasa',
      activityLevel = 'ligeramente',
      allergies = [],
      injuries = [],
    } = req.body || {};

    const trimmedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (trimmedName.length < 2) {
      return res.status(400).json({ error: 'Ingresa tu nombre (al menos 2 caracteres).' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Ingresa un correo electronico valido.' });
    }
    if (rawPassword.length < 8 || !/\d/.test(rawPassword)) {
      return res.status(400).json({
        error: 'La contrasena debe tener minimo 8 caracteres y al menos 1 numero.',
      });
    }

    const existing = await findUserAuthByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con ese correo.' });
    }

    const safeRole = VALID_ROLES.includes(role) ? role : 'usuario';
    const createdUser = await createUser({
      name: trimmedName,
      email: normalizedEmail,
      password: rawPassword,
      role: safeRole,
      sex: String(sex).toLowerCase() === 'mujer' ? 'mujer' : 'hombre',
      age: Number(age) || 28,
      weightKg: Number(weightKg) || 70,
      heightCm: Number(heightCm) || 170,
      goal,
      activityLevel,
      allergies: Array.isArray(allergies) ? allergies : [],
      injuries: Array.isArray(injuries) ? injuries : [],
    });

    const [mealsCatalog, workoutsCatalog] = await Promise.all([
      getMealsCatalog(),
      getWorkoutsCatalog(),
    ]);
    const mealsEval = evaluateMealsForUser(createdUser, mealsCatalog);
    const workoutsEval = evaluateWorkoutsForUser(createdUser, workoutsCatalog);

    await saveLogicalTraces(createdUser.id, [
      ...mealsEval.traces.filter((t) => t.outcome === 'discarded'),
      ...workoutsEval.traces.filter((t) => t.outcome === 'discarded'),
    ]);

    const user = await getHydratedUser(createdUser.id);
    const metabolism = calculateMifflinStJeor(user);

    return res.status(201).json({
      user,
      metabolism,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, reactivate = false } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    const authUser = await findUserAuthByEmail(normalizedEmail);
    if (!authUser || !verifyPassword(rawPassword, authUser.passwordHash)) {
      return res.status(401).json({ error: 'Correo o contrasena incorrectos.' });
    }

    let hydratedUser = await getHydratedUser(authUser.id);
    if (hydratedUser.status === 'inactiva') {
      if (!reactivate) {
        return res.status(403).json({
          code: 'ACCOUNT_INACTIVE',
          canReactivate: true,
          error:
            'Tu cuenta esta inactiva temporalmente. Tu historial y afinidad se conservan intactos; deseas reactivarla ahora?',
          userPreview: {
            name: hydratedUser.name,
            email: hydratedUser.email,
            historyCount: (hydratedUser.history || []).length,
          },
        });
      }
      hydratedUser = await reactivateUser(hydratedUser.id);
    }

    const metabolism = calculateMifflinStJeor(hydratedUser);
    return res.json({
      user: hydratedUser,
      metabolism,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
