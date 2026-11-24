import React, { useEffect, useState } from 'react';
import { useSamba } from '../../context/SambaContext';
import { api } from '../../services/api';

const ALLERGY_OPTIONS = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'lactosa', label: 'Lactosa' },
  { id: 'frutos_secos', label: 'Frutos secos' },
  { id: 'pescados_mariscos', label: 'Pescados y mariscos' },
  { id: 'huevo', label: 'Huevo' },
];

const INJURY_OPTIONS = [
  { id: 'rodilla', label: 'Rodilla' },
  { id: 'lumbar', label: 'Lumbar' },
  { id: 'hombro', label: 'Hombro' },
  { id: 'tobillo', label: 'Tobillo' },
];

const GOAL_OPTIONS = [
  { id: 'perder_grasa', label: 'Perder grasa & definir' },
  { id: 'ganar_masa', label: 'Ganar masa muscular' },
  { id: 'recomposicion', label: 'Recomposición corporal' },
  { id: 'salud_vitalidad', label: 'Mejorar salud y vitalidad' },
];

const INITIAL_MEAL_FORM = {
  title: '',
  baseName: 'Base: Bowl Especial del Dia',
  mealTime: 'cena',
  budgetTier: 'bajo',
  mainIngredientName: '',
  mainIngredientPriceTier: 'bajo',
  description: '',
  calories: 440,
  protein: 35,
  carbs: 40,
  fat: 14,
  estimatedCostUsd: 2.8,
  prepMinutes: 15,
};

const INITIAL_WORKOUT_FORM = {
  title: '',
  groupId: 'torso_core',
  groupName: 'Torso, Brazos & Core',
  durationMin: 30,
  equipment: 'Mancuernas',
  caloriesBurned: 310,
  intensity: 'Moderada Controlada',
  impactLevel: 'bajo',
  mainBenefit: '',
};

export function ProfileDrawer({ onProfileUpdated }) {
  const {
    user,
    setUser,
    setMetabolism,
    setTodayLog,
    metabolism,
    profileOpen,
    setProfileOpen,
    logout,
  } = useSamba();
  const [saving, setSaving] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showCatalogEditor, setShowCatalogEditor] = useState(false);
  const [catalogMode, setCatalogMode] = useState('meal');
  const [mealForm, setMealForm] = useState(INITIAL_MEAL_FORM);
  const [workoutForm, setWorkoutForm] = useState(INITIAL_WORKOUT_FORM);

  const loadHealthAndAudit = () => {
    if (user?.role === 'superusuario') {
      api
        .getAdminAudit(user.id)
        .then((res) => setAuditData(res))
        .catch(() => setAuditData(null));
    } else {
      setAuditData(null);
    }
  };

  useEffect(() => {
    if (profileOpen && user?.id) {
      loadHealthAndAudit();
    }
  }, [profileOpen, user?.id, user?.role]);

  if (!profileOpen || !user) return null;

  async function patchUser(patch, msg) {
    setSaving(true);
    setStatusMessage('');
    try {
      const res = await api.updateProfile(user.id, patch);
      setUser(res.user);
      setMetabolism(res.metabolism);
      setTodayLog(res.todayLog);
      if (msg) setStatusMessage(msg);
      if (onProfileUpdated) onProfileUpdated();
      loadHealthAndAudit();
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleArrayItem(field, id) {
    const current = Array.isArray(user[field]) ? user[field] : [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    patchUser({ [field]: next }, 'Reglas del Motor Simbólico actualizadas en PostgreSQL.');
  }

  async function handleCreateCatalogMeal(e) {
    e.preventDefault();
    setSaving(true);
    setStatusMessage('');
    try {
      await api.createCatalogMeal(user.id, {
        title: mealForm.title.trim(),
        baseName: mealForm.baseName.trim() || `Base: ${mealForm.title.trim()}`,
        mealTime: mealForm.mealTime,
        budgetTier: mealForm.budgetTier,
        suggested: mealForm.budgetTier === 'medio',
        description:
          mealForm.description.trim() ||
          `${mealForm.title.trim()} preparado con ${mealForm.mainIngredientName.trim()}.`,
        prepMinutes: Number(mealForm.prepMinutes),
        estimatedCostUsd: Number(mealForm.estimatedCostUsd),
        mainIngredient: {
          name: mealForm.mainIngredientName.trim(),
          priceTier: mealForm.mainIngredientPriceTier,
          allergens: [],
        },
        allergens: [],
        calories: Number(mealForm.calories),
        protein: Number(mealForm.protein),
        carbs: Number(mealForm.carbs),
        fat: Number(mealForm.fat),
      });
      setMealForm(INITIAL_MEAL_FORM);
      setStatusMessage('Platillo guardado en PostgreSQL y validado con precio_consistente.');
      if (onProfileUpdated) onProfileUpdated();
      loadHealthAndAudit();
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCatalogWorkout(e) {
    e.preventDefault();
    setSaving(true);
    setStatusMessage('');
    try {
      await api.createCatalogWorkout(user.id, {
        title: workoutForm.title.trim(),
        groupId: workoutForm.groupId,
        groupName: workoutForm.groupName,
        durationMin: Number(workoutForm.durationMin),
        equipment: workoutForm.equipment.trim(),
        caloriesBurned: Number(workoutForm.caloriesBurned),
        intensity: workoutForm.intensity.trim(),
        impactLevel: workoutForm.impactLevel,
        contraindications: workoutForm.impactLevel === 'alto' ? ['rodilla', 'tobillo'] : [],
        mainBenefit: workoutForm.mainBenefit.trim(),
      });
      setWorkoutForm(INITIAL_WORKOUT_FORM);
      setStatusMessage('Rutina guardada en PostgreSQL y disponible para el Motor Simbólico.');
      if (onProfileUpdated) onProfileUpdated();
      loadHealthAndAudit();
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  const nextStatus = user.status === 'activa' ? 'inactiva' : 'activa';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-full max-w-[430px] h-[90vh] bg-[#F4FBF7] rounded-t-[24px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-[#E1EFE7] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[17px] font-extrabold text-[#151D24]">{user.name}</h2>
            <p className="text-[12px] text-[#4A7265]">
              {user.email} • Rol: <strong className="uppercase">{user.role}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProfileOpen(false)}
            aria-label="Cerrar perfil"
            className="w-9 h-9 rounded-full bg-[#F4FBF7] hover:bg-[#E8F9EF] text-[#181A20] flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 no-scrollbar">
          {statusMessage && (
            <div className="rounded-2xl bg-[#CBF3DB] px-3.5 py-2.5 text-[12px] font-semibold text-[#005236]">
              {statusMessage}
            </div>
          )}

          {/* Estado de cuenta sin borrar historial */}
          <section className="bg-white rounded-3xl p-4 border border-[#E1EFE7] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-[#151D24]">Estado de Cuenta</h3>
                <p className="text-[11.5px] text-[#52525B]">
                  Desactivar conserva historial ({(user.history || []).length} eventos) y trazas.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                  user.status === 'activa'
                    ? 'bg-emerald-100 text-[#006c49]'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {user.status}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  patchUser(
                    { status: nextStatus },
                    `Cuenta marcada como '${nextStatus}' conservando todo el historial.`
                  )
                }
                className="flex-1 py-2 px-3 rounded-full bg-[#181A20] text-white text-[12px] font-semibold hover:bg-[#232332] disabled:opacity-60"
              >
                {user.status === 'activa' ? 'Marcar Inactiva (sin borrar)' : 'Reactivar Cuenta'}
              </button>
            </div>
          </section>

          {/* Datos metabolicos */}
          {metabolism && (
            <section className="bg-white rounded-3xl p-4 border border-[#E1EFE7] space-y-2">
              <h3 className="text-[14px] font-bold text-[#151D24]">
                Perfil Metabólico (Mifflin-St Jeor)
              </h3>
              <p className="text-[12px] text-[#3c4a42] leading-snug">
                {metabolism.formulaSummary}
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="rounded-2xl bg-[#F4FBF7] p-2">
                  <span className="block text-[10px] font-bold text-[#52525B] uppercase">IMC</span>
                  <span className="text-[14px] font-extrabold text-[#151D24] tabular-nums">
                    {metabolism.imc.bmi}
                  </span>
                </div>
                <div className="rounded-2xl bg-[#F4FBF7] p-2">
                  <span className="block text-[10px] font-bold text-[#52525B] uppercase">TMB</span>
                  <span className="text-[14px] font-extrabold text-[#151D24] tabular-nums">
                    {metabolism.bmr}
                  </span>
                </div>
                <div className="rounded-2xl bg-[#F4FBF7] p-2">
                  <span className="block text-[10px] font-bold text-[#52525B] uppercase">Meta</span>
                  <span className="text-[14px] font-extrabold text-[#006c49] tabular-nums">
                    {metabolism.targetCalories}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Objetivo, Alergias y Lesiones */}
          <section className="bg-white rounded-3xl p-4 border border-[#E1EFE7] space-y-3.5">
            <div>
              <h3 className="text-[13.5px] font-bold text-[#151D24] mb-2">Objetivo</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {GOAL_OPTIONS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    disabled={saving}
                    onClick={() => patchUser({ goal: g.id }, 'Objetivo recalibrado.')}
                    className={`py-2 px-2.5 rounded-2xl text-[11.5px] font-semibold text-left border transition-all ${
                      user.goal === g.id
                        ? 'bg-[#E8F9EF] border-[#00B87C] text-[#005236]'
                        : 'bg-[#F4FBF7] border-transparent text-[#3c4a42]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[13.5px] font-bold text-[#151D24] mb-2">
                Alergias e Intolerancias (Filtro duro)
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {ALLERGY_OPTIONS.map((a) => {
                  const active = (user.allergies || []).includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={saving}
                      onClick={() => toggleArrayItem('allergies', a.id)}
                      className={`px-3 py-1.5 rounded-full text-[11.5px] font-semibold border transition-all ${
                        active
                          ? 'bg-[#181A20] text-white border-[#181A20]'
                          : 'bg-white text-[#52525B] border-[#E1EFE7]'
                      }`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-[13.5px] font-bold text-[#151D24] mb-2">
                Lesiones Activas (Excluye alto impacto)
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {INJURY_OPTIONS.map((inj) => {
                  const active = (user.injuries || []).includes(inj.id);
                  return (
                    <button
                      key={inj.id}
                      type="button"
                      disabled={saving}
                      onClick={() => toggleArrayItem('injuries', inj.id)}
                      className={`px-3 py-1.5 rounded-full text-[11.5px] font-semibold border transition-all ${
                        active
                          ? 'bg-[#181A20] text-white border-[#181A20]'
                          : 'bg-white text-[#52525B] border-[#E1EFE7]'
                      }`}
                    >
                      {inj.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Panel Superusuario + Catalogo PostgreSQL */}
          {auditData && (
            <section className="bg-white rounded-3xl p-4 border border-[#00B87C]/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-bold text-[#006c49]">
                  Auditoría Superusuario ({auditData.totalUsers} cuentas)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCatalogEditor((v) => !v)}
                  className="px-2.5 py-1 rounded-full bg-[#181A20] text-white text-[11px] font-semibold"
                >
                  {showCatalogEditor ? 'Ocultar alta' : 'Agregar al Catálogo PG'}
                </button>
              </div>

              {showCatalogEditor && (
                <div className="p-3 rounded-2xl bg-[#F4FBF7] border border-[#CBF3DB] space-y-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCatalogMode('meal')}
                      className={`py-1.5 rounded-full text-[11.5px] font-bold ${
                        catalogMode === 'meal'
                          ? 'bg-[#00B87C] text-white'
                          : 'bg-white text-[#3c4a42]'
                      }`}
                    >
                      Nuevo Platillo
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogMode('workout')}
                      className={`py-1.5 rounded-full text-[11.5px] font-bold ${
                        catalogMode === 'workout'
                          ? 'bg-[#00B87C] text-white'
                          : 'bg-white text-[#3c4a42]'
                      }`}
                    >
                      Nueva Rutina
                    </button>
                  </div>

                  {catalogMode === 'meal' ? (
                    <form onSubmit={handleCreateCatalogMeal} className="space-y-2 text-[12px]">
                      <input
                        type="text"
                        required
                        placeholder="Nombre del platillo"
                        value={mealForm.title}
                        onChange={(e) => setMealForm({ ...mealForm, title: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={mealForm.mealTime}
                          onChange={(e) => setMealForm({ ...mealForm, mealTime: e.target.value })}
                          className="px-2.5 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                        >
                          <option value="desayuno">Desayuno</option>
                          <option value="almuerzo">Almuerzo</option>
                          <option value="cena">Cena</option>
                        </select>
                        <select
                          value={mealForm.budgetTier}
                          onChange={(e) =>
                            setMealForm({
                              ...mealForm,
                              budgetTier: e.target.value,
                              mainIngredientPriceTier: e.target.value,
                            })
                          }
                          className="px-2.5 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                        >
                          <option value="bajo">Presupuesto Bajo</option>
                          <option value="medio">Presupuesto Medio</option>
                          <option value="alto">Presupuesto Alto</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Ingrediente principal (ej. Pechuga de pavo)"
                        value={mealForm.mainIngredientName}
                        onChange={(e) =>
                          setMealForm({ ...mealForm, mainIngredientName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={mealForm.mainIngredientPriceTier}
                          onChange={(e) =>
                            setMealForm({
                              ...mealForm,
                              mainIngredientPriceTier: e.target.value,
                            })
                          }
                          className="px-2.5 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                        >
                          <option value="bajo">Ingrediente: Bajo</option>
                          <option value="medio">Ingrediente: Medio</option>
                          <option value="alto">Ingrediente: Alto</option>
                        </select>
                        <input
                          type="number"
                          min="250"
                          max="900"
                          value={mealForm.calories}
                          onChange={(e) =>
                            setMealForm({ ...mealForm, calories: Number(e.target.value) })
                          }
                          placeholder="Calorias"
                          className="px-2.5 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-2 rounded-full bg-[#181A20] text-white font-bold text-[12px]"
                      >
                        Guardar Platillo en PostgreSQL
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleCreateCatalogWorkout} className="space-y-2 text-[12px]">
                      <input
                        type="text"
                        required
                        placeholder="Nombre de la rutina"
                        value={workoutForm.title}
                        onChange={(e) =>
                          setWorkoutForm({ ...workoutForm, title: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={workoutForm.impactLevel}
                          onChange={(e) =>
                            setWorkoutForm({ ...workoutForm, impactLevel: e.target.value })
                          }
                          className="px-2.5 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                        >
                          <option value="bajo">Impacto Bajo</option>
                          <option value="medio">Impacto Medio</option>
                          <option value="alto">Impacto Alto</option>
                        </select>
                        <input
                          type="number"
                          min="10"
                          max="90"
                          value={workoutForm.durationMin}
                          onChange={(e) =>
                            setWorkoutForm({
                              ...workoutForm,
                              durationMin: Number(e.target.value),
                            })
                          }
                          placeholder="Minutos"
                          className="px-2.5 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                        />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Beneficio principal"
                        value={workoutForm.mainBenefit}
                        onChange={(e) =>
                          setWorkoutForm({ ...workoutForm, mainBenefit: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#E1EFE7]"
                      />
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-2 rounded-full bg-[#181A20] text-white font-bold text-[12px]"
                      >
                        Guardar Rutina en PostgreSQL
                      </button>
                    </form>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                {auditData.accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-2.5 rounded-2xl bg-[#F4FBF7] flex items-center justify-between text-[11.5px]"
                  >
                    <div>
                      <p className="font-bold text-[#151D24]">
                        {acc.name} ({acc.role})
                      </p>
                      <p className="text-[#52525B]">{acc.email}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold uppercase text-[#006c49]">{acc.status}</span>
                      <p className="text-[10.5px] text-[#52525B]">
                        {acc.historyCount} hist / {acc.tracesCount} trazas
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Trazas logicas recientes */}
          <section className="bg-white rounded-3xl p-4 border border-[#E1EFE7] space-y-2">
            <h3 className="text-[13.5px] font-bold text-[#151D24]">
              Trazas Lógicas del Motor ({(user.traces || []).length})
            </h3>
            {(user.traces || []).length === 0 ? (
              <p className="text-[12px] text-[#52525B]">
                No hay descartes registrados para tu perfil actual.
              </p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto no-scrollbar">
                {user.traces.slice(0, 10).map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7] text-[11px]"
                  >
                    <p className="font-mono font-bold text-[#006c49] break-all">{t.rule}</p>
                    <p className="text-[#3c4a42] mt-0.5">{t.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Historial conservado */}
          <section className="bg-white rounded-3xl p-4 border border-[#E1EFE7] space-y-2">
            <h3 className="text-[13.5px] font-bold text-[#151D24]">
              Historial de Actividad ({(user.history || []).length})
            </h3>
            {(user.history || []).length === 0 ? (
              <p className="text-[12px] text-[#52525B]">Aún no has registrado acciones hoy.</p>
            ) : (
              <ul className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                {user.history.slice(0, 10).map((h) => (
                  <li
                    key={h.id}
                    className="text-[11.5px] text-[#3c4a42] bg-[#F4FBF7] px-3 py-1.5 rounded-xl"
                  >
                    {h.label}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="p-4 bg-white border-t border-[#E1EFE7] safe-bottom shrink-0">
          <button
            type="button"
            onClick={logout}
            className="w-full h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-[#181A20] font-bold text-[14px] flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[19px]">logout</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
