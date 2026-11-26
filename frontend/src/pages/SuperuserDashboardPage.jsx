import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppTopBar } from '../components/layout/AppTopBar';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

const ROLE_STYLES = {
  superusuario: {
    label: 'Superusuario',
    badge: 'bg-[#181A20] text-[#6ffbbe]',
  },
  usuario: {
    label: 'Usuario',
    badge: 'bg-[#E8F9EF] text-[#006c49]',
  },
  invitado: {
    label: 'Invitado',
    badge: 'bg-slate-100 text-slate-700',
  },
};

const GOAL_LABELS = {
  perder_grasa: 'Perder grasa',
  ganar_masa: 'Ganar masa',
  recomposicion: 'Recomposición',
  salud_vitalidad: 'Salud y vitalidad',
};

const ACTIVITY_LABELS = {
  sedentario: 'Sedentario',
  ligeramente: 'Ligero',
  moderadamente: 'Moderado',
  muy_activo: 'Muy activo',
};

const ALLERGY_NAMES = {
  gluten: 'Gluten',
  lactosa: 'Lactosa',
  frutos_secos: 'Frutos secos',
  pescados_mariscos: 'Mariscos',
  huevo: 'Huevo',
};

const INJURY_NAMES = {
  rodilla: 'Rodilla',
  lumbar: 'Lumbar',
  hombro: 'Hombro',
  tobillo: 'Tobillo',
};

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'usuario', label: 'Usuarios' },
  { id: 'invitado', label: 'Invitados' },
  { id: 'superusuario', label: 'Admins' },
  { id: 'inactiva', label: 'Inactivos' },
];

function getInitials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'U';
}

export function SuperuserDashboardPage({ refreshTrigger }) {
  const { user } = useSamba();
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [feedback, setFeedback] = useState('');

  const loadAudit = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.getAdminAudit(user.id);
      setAuditData(res);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit, refreshTrigger]);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(''), 3500);
    return () => clearTimeout(t);
  }, [feedback]);

  const accounts = auditData?.accounts || [];
  const stats = auditData?.stats || {};

  const summary = useMemo(() => {
    const activeCount = accounts.filter((a) => a.status === 'activa').length;
    const inactiveCount = accounts.length - activeCount;
    const byRole = {
      usuario: accounts.filter((a) => a.role === 'usuario').length,
      invitado: accounts.filter((a) => a.role === 'invitado').length,
      superusuario: accounts.filter((a) => a.role === 'superusuario').length,
    };
    const withRestrictions = accounts.filter(
      (a) => (a.allergiesCount || 0) > 0 || (a.injuriesCount || 0) > 0
    ).length;
    return { activeCount, inactiveCount, byRole, withRestrictions };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (roleFilter === 'inactiva' && acc.status !== 'inactiva') return false;
      if (['usuario', 'invitado', 'superusuario'].includes(roleFilter) && acc.role !== roleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        String(acc.name || '').toLowerCase().includes(q) ||
        String(acc.email || '').toLowerCase().includes(q)
      );
    });
  }, [accounts, search, roleFilter]);

  async function handleToggleUserStatus(acc) {
    if (acc.id === user?.id) return;
    setUpdatingId(acc.id);
    setFeedback('');
    const nextStatus = acc.status === 'activa' ? 'inactiva' : 'activa';
    try {
      await api.updateProfile(acc.id, { status: nextStatus });
      setAuditData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          accounts: prev.accounts.map((item) =>
            item.id === acc.id ? { ...item, status: nextStatus } : item
          ),
        };
      });
      setFeedback(
        `Cuenta de ${acc.name} marcada como ${nextStatus === 'activa' ? 'activa' : 'inactiva'}.`
      );
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <AppTopBar title="ADMIN SAMBA" />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="flex flex-col w-full px-4 sm:px-margin pt-4 pb-8 space-y-4">
        {/* Encabezado */}
        <section className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#181A20] text-[#6ffbbe] text-[10.5px] font-bold uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-[13px]">shield_person</span>
              <span>Superusuario</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Panel de control
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Monitoreo de cuentas, seguridad clínica y catálogo.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAudit}
            disabled={loading}
            aria-label="Actualizar panel"
            className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-white/80 flex items-center justify-center text-[#006c49] hover:bg-[#E8F9EF] transition-colors shrink-0 disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </section>

        {feedback && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[390px] rounded-2xl bg-[#181A20] text-white px-4 py-3 text-[12.5px] font-semibold shadow-lg border border-white/10 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-[#6ffbbe] shrink-0">
                check_circle
              </span>
              <span className="truncate">{feedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback('')}
              aria-label="Cerrar notificación"
              className="text-white/70 hover:text-white shrink-0 flex items-center"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* KPIs principales */}
        <section className="grid grid-cols-2 gap-3 tabular-nums">
          <div className="rounded-3xl bg-white p-4 shadow-sm border border-white/80 space-y-1">
            <div className="flex items-center justify-between text-[#006c49]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Usuarios
              </span>
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
            <p className="text-[24px] font-extrabold text-[#151D24] leading-tight">
              {auditData?.totalUsers ?? '—'}
            </p>
            <p className="text-[11px] text-[#4A7265]">
              {summary.activeCount} activas • {summary.inactiveCount} inactivas
            </p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm border border-white/80 space-y-1">
            <div className="flex items-center justify-between text-[#006c49]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Trazas IA/Prolog
              </span>
              <span className="material-symbols-outlined text-[18px]">neurology</span>
            </div>
            <p className="text-[24px] font-extrabold text-[#151D24] leading-tight">
              {stats.traces ?? '—'}
            </p>
            <p className="text-[11px] text-[#4A7265]">
              {summary.withRestrictions} con alergia/lesión
            </p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm border border-white/80 space-y-1">
            <div className="flex items-center justify-between text-[#006c49]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Registros
              </span>
              <span className="material-symbols-outlined text-[18px]">monitoring</span>
            </div>
            <p className="text-[24px] font-extrabold text-[#151D24] leading-tight">
              {typeof stats.meal_logs === 'number'
                ? stats.meal_logs + (stats.workout_logs || 0)
                : '—'}
            </p>
            <p className="text-[11px] text-[#4A7265]">
              {stats.meal_logs ?? 0} comidas • {stats.workout_logs ?? 0} entrenos
            </p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm border border-white/80 space-y-1">
            <div className="flex items-center justify-between text-[#006c49]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Catálogo PG
              </span>
              <span className="material-symbols-outlined text-[18px]">database</span>
            </div>
            <p className="text-[24px] font-extrabold text-[#151D24] leading-tight">
              {typeof stats.meals === 'number' ? stats.meals + (stats.workouts || 0) : '—'}
            </p>
            <p className="text-[11px] text-[#4A7265]">
              {stats.meals ?? 0} platillos • {stats.workouts ?? 0} rutinas
            </p>
          </div>
        </section>

        {/* Distribución por rol */}
        <section className="rounded-3xl bg-white p-4 shadow-sm border border-white/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4A7265]">
              Distribución por rol
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
            <div className="rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7] py-2 px-2">
              <p className="text-[16px] font-extrabold text-[#006c49]">{summary.byRole.usuario}</p>
              <p className="text-[10.5px] font-semibold text-[#4A7265]">Usuarios</p>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 py-2 px-2">
              <p className="text-[16px] font-extrabold text-slate-700">{summary.byRole.invitado}</p>
              <p className="text-[10.5px] font-semibold text-slate-500">Invitados</p>
            </div>
            <div className="rounded-2xl bg-[#181A20] py-2 px-2">
              <p className="text-[16px] font-extrabold text-[#6ffbbe]">
                {summary.byRole.superusuario}
              </p>
              <p className="text-[10.5px] font-semibold text-white/80">Superusuarios</p>
            </div>
          </div>

          {typeof stats.external_foods === 'number' && (
            <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-[#F4FBF7] text-[11px] text-[#4A7265] tabular-nums">
              <span>Caché clínico externo:</span>
              <span className="font-bold text-[#151D24]">
                {stats.external_foods} USDA • {stats.external_exercises} wger
              </span>
            </div>
          )}
        </section>

        {/* Buscador y filtros de usuarios */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#4A7265]">
              Usuarios registrados ({filteredAccounts.length})
            </h3>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-white/80 shadow-sm text-[13px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-[#00B87C]/40"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {FILTERS.map((f) => {
              const active = roleFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRoleFilter(f.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all ${
                    active
                      ? 'bg-[#181A20] text-white shadow-sm'
                      : 'bg-white text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Lista de usuarios */}
        {loading && !auditData ? (
          <div className="bg-white rounded-3xl p-6 text-center text-[13px] text-on-surface-variant">
            Cargando auditoría de usuarios...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 text-center text-[13px] text-on-surface-variant">
            No hay usuarios que coincidan con el filtro actual.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredAccounts.map((acc) => {
              const roleMeta = ROLE_STYLES[acc.role] || ROLE_STYLES.usuario;
              const isExpanded = expandedUserId === acc.id;
              const isSelf = acc.id === user.id;
              const isInactive = acc.status === 'inactiva';

              return (
                <article
                  key={acc.id}
                  className={`rounded-3xl bg-white p-4 shadow-sm border transition-all ${
                    isInactive ? 'border-amber-200 opacity-85' : 'border-white/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedUserId(isExpanded ? null : acc.id)}
                    className="w-full text-left flex items-start justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0 ${
                          acc.role === 'superusuario'
                            ? 'bg-[#181A20] text-[#6ffbbe]'
                            : 'bg-[#E8F9EF] text-[#006c49]'
                        }`}
                      >
                        {getInitials(acc.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[14px] text-[#151D24] truncate">
                            {acc.name}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] font-bold text-[#006c49]">(Tú)</span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-on-surface-variant truncate">{acc.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${roleMeta.badge}`}
                      >
                        {roleMeta.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isInactive
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-[#006c49]'
                        }`}
                      >
                        {isInactive ? 'Inactiva' : 'Activa'}
                      </span>
                    </div>
                  </button>

                  {/* Resumen rápido */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-[#4A7265] tabular-nums">
                    <span>{GOAL_LABELS[acc.goal] || 'Sin meta'}</span>
                    <span>
                      {acc.allergiesCount} alerg. • {acc.injuriesCount} les. • {acc.tracesCount}{' '}
                      trazas
                    </span>
                  </div>

                  {/* Detalle expandible + acciones de administrador */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#E1EFE7] space-y-3 text-[11.5px]">
                      <div className="grid grid-cols-2 gap-2 tabular-nums">
                        <div className="rounded-2xl bg-[#F4FBF7] px-3 py-2">
                          <span className="block text-[10px] uppercase font-bold text-[#4A7265]">
                            Actividad
                          </span>
                          <span className="font-semibold text-[#151D24]">
                            {ACTIVITY_LABELS[acc.activityLevel] || acc.activityLevel || '—'}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-[#F4FBF7] px-3 py-2">
                          <span className="block text-[10px] uppercase font-bold text-[#4A7265]">
                            Historial
                          </span>
                          <span className="font-semibold text-[#151D24]">
                            {acc.historyCount} eventos • {(acc.mealLogsCount || 0) + (acc.workoutLogsCount || 0)} logs
                          </span>
                        </div>
                      </div>

                      {((acc.allergies || []).length > 0 || (acc.injuries || []).length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                          {(acc.allergies || []).map((al) => (
                            <span
                              key={al}
                              className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10.5px] font-semibold"
                            >
                              Alergia: {ALLERGY_NAMES[al] || al}
                            </span>
                          ))}
                          {(acc.injuries || []).map((inj) => (
                            <span
                              key={inj}
                              className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10.5px] font-semibold"
                            >
                              Lesión: {INJURY_NAMES[inj] || inj}
                            </span>
                          ))}
                        </div>
                      )}

                      {!isSelf && (
                        <button
                          type="button"
                          disabled={updatingId === acc.id}
                          onClick={() => handleToggleUserStatus(acc)}
                          className={`w-full h-9 rounded-full text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 ${
                            isInactive
                              ? 'bg-[#00B87C] text-white hover:bg-[#00a36d]'
                              : 'bg-slate-100 text-[#151D24] hover:bg-slate-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isInactive ? 'person_check' : 'person_off'}
                          </span>
                          <span>
                            {updatingId === acc.id
                              ? 'Actualizando...'
                              : isInactive
                              ? 'Reactivar cuenta'
                              : 'Desactivar cuenta'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
