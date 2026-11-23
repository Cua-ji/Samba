const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Error de comunicacion con el servidor Samba.');
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  getDemoAccounts: () => request('/auth/demo-accounts'),
  register: (payload) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getProfile: (userId) => request(`/profile/${encodeURIComponent(userId)}`),
  updateProfile: (userId, payload) =>
    request(`/profile/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getAdminAudit: (userId) => request(`/profile/${encodeURIComponent(userId)}/admin-audit`),
  getMeals: (userId, mealTime = 'almuerzo') =>
    request(`/meals/${encodeURIComponent(userId)}?mealTime=${encodeURIComponent(mealTime)}`),
  generateAiMeal: (userId, mealTime = 'almuerzo') =>
    request(`/meals/${encodeURIComponent(userId)}/generate-ai`, {
      method: 'POST',
      body: JSON.stringify({ mealTime }),
    }),
  createCatalogMeal: (requesterUserId, meal) =>
    request('/meals/catalog', {
      method: 'POST',
      body: JSON.stringify({ requesterUserId, meal }),
    }),
  setMealAffinity: (userId, mealId, action) =>
    request(`/meals/${encodeURIComponent(userId)}/affinity`, {
      method: 'POST',
      body: JSON.stringify({ mealId, action }),
    }),
  getWorkouts: (userId) => request(`/workouts/${encodeURIComponent(userId)}`),
  generateAiWorkouts: (userId) =>
    request(`/workouts/${encodeURIComponent(userId)}/generate-ai`, {
      method: 'POST',
    }),
  createCatalogWorkout: (requesterUserId, workout) =>
    request('/workouts/catalog', {
      method: 'POST',
      body: JSON.stringify({ requesterUserId, workout }),
    }),
  setWorkoutAffinity: (userId, workoutId, rating, completed = true) =>
    request(`/workouts/${encodeURIComponent(userId)}/affinity`, {
      method: 'POST',
      body: JSON.stringify({ workoutId, rating, completed }),
    }),
  askChat: (userId, message) =>
    request('/chat/ask', {
      method: 'POST',
      body: JSON.stringify({ userId, message }),
    }),
};
