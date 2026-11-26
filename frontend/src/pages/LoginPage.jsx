import React, { useState } from 'react';
import { MobileShell } from '../components/layout/MobileShell';
import { BrandHeader } from '../components/layout/BrandHeader';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

export function LoginPage() {
  const { setScreen, enterDashboardWithSession } = useSamba();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [inactiveNotice, setInactiveNotice] = useState(null);

  async function handleSubmit(e, reactivate = false) {
    if (e) e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.login({ email, password, reactivate });
      setInactiveNotice(null);
      await enterDashboardWithSession(res);
    } catch (err) {
      if (err.payload?.code === 'ACCOUNT_INACTIVE') {
        setInactiveNotice(err.payload);
      } else {
        setError(err.message || 'No se pudo iniciar sesión.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MobileShell variant="mesh">
      <BrandHeader onBack={() => setScreen('welcome')} />

      <section className="relative z-10 px-5 sm:px-7 pt-3 pb-3 flex flex-col flex-1 min-h-0 justify-start text-left overflow-y-auto no-scrollbar">
        <div className="mb-4">
          <h1 className="text-[28px] sm:text-[34px] font-extrabold text-brand-heading tracking-tight leading-tight mb-1.5">
            Iniciar sesión
          </h1>
          <p className="text-[14.5px] leading-snug font-normal text-brand-secondary">
            Bienvenido de nuevo a tu plan de nutrición y bienestar
          </p>
        </div>

        <form id="login-form" className="flex flex-col gap-4 w-full" onSubmit={(e) => handleSubmit(e, false)}>
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-white/80 flex flex-col gap-4 mb-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-brand-heading" htmlFor="login-email">
                Correo electrónico
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-brand-subtle pointer-events-none flex items-center">
                  <span className="material-symbols-outlined text-[20px] text-[#4A7265]">mail</span>
                </div>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full py-3.5 pl-12 pr-4 bg-[#F8FAF9] focus:bg-white rounded-2xl border border-slate-200/80 focus:border-[#00B87C] focus:outline-none focus:ring-2 focus:ring-emerald-400/20 text-brand-heading font-medium text-[15px] placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-brand-heading" htmlFor="login-pass">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-brand-subtle pointer-events-none flex items-center">
                  <span className="material-symbols-outlined text-[20px] text-[#4A7265]">lock</span>
                </div>
                <input
                  id="login-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-3.5 pl-12 pr-12 bg-[#F8FAF9] focus:bg-white rounded-2xl border border-slate-200/80 focus:border-[#00B87C] focus:outline-none focus:ring-2 focus:ring-emerald-400/20 text-brand-heading font-medium text-[15px] placeholder:text-slate-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Mostrar contraseña"
                  className="absolute right-2 w-10 h-10 rounded-full text-brand-subtle hover:text-brand-heading focus:outline-none flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[20px] text-[#4A7265]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
              <span className="material-symbols-outlined text-[17px] text-[#00B87C] shrink-0 mt-0.5">
                verified_user
              </span>
              <p className="text-[12px] text-brand-subtle leading-tight">
                Tus credenciales y datos de salud están cifrados bajo estándares de grado médico.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-error-container px-4 py-3 text-[13px] font-medium text-on-error-container">
              {error}
            </div>
          )}

          {inactiveNotice && (
            <div className="rounded-2xl bg-white p-4 border border-amber-300 shadow-sm space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">
                  pause_circle
                </span>
                <p className="text-[12.5px] text-brand-heading leading-snug">
                  {inactiveNotice.error} ({inactiveNotice.userPreview?.historyCount || 0} registros en historial).
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(null, true)}
                className="w-full py-2.5 rounded-full bg-[#00B87C] text-white text-[13px] font-bold hover:bg-[#00a26d] transition-colors"
              >
                Reactivar cuenta y entrar al Dashboard
              </button>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-14 bg-[#181A20] hover:bg-[#232332] active:scale-[0.98] transition-all duration-150 rounded-full flex items-center justify-center gap-2 text-white text-[16px] font-bold tracking-wide shadow-md shadow-[#181A20]/20 disabled:opacity-60"
            >
              <span>{submitting ? 'Ingresando...' : 'Iniciar sesión'}</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
        </form>
      </section>

      <footer className="relative z-10 px-5 sm:px-7 pt-2 pb-5 safe-bottom flex flex-col items-center w-full gap-3 shrink-0">
        <div className="flex items-center justify-center flex-wrap gap-2 text-[14px]">
          <span className="text-brand-subtle font-medium">¿No tienes una cuenta?</span>
          <button
            type="button"
            onClick={() => setScreen('onboarding-1')}
            className="bg-white/95 hover:bg-white text-brand-heading font-semibold px-3.5 py-2 rounded-lg text-[13.5px] shadow-sm hover:shadow active:scale-95 transition-all duration-150 inline-flex items-center justify-center"
          >
            Regístrate
          </button>
        </div>
      </footer>
    </MobileShell>
  );
}
