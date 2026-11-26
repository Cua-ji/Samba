import React, { useState } from 'react';
import { MobileShell } from '../components/layout/MobileShell';
import { BrandHeader } from '../components/layout/BrandHeader';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

export function CreateAccountPage() {
  const { onboarding, setScreen, enterDashboardWithSession } = useSamba();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const displayName = onboarding.name.trim() || 'Nuevo Usuario';
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleCreateAccount(e) {
    e.preventDefault();
    setError('');
    if (!isEmailValid) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!hasMinLength || !hasNumber) {
      setError('La contraseña debe tener al menos 8 caracteres y 1 número.');
      return;
    }

    setSubmitting(true);
    try {
      const authData = await api.register({
        ...onboarding,
        role: 'usuario',
        name: displayName,
        email: email.trim(),
        password,
      });
      await enterDashboardWithSession(authData);
    } catch (err) {
      setError(err.message || 'No pudimos crear la cuenta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MobileShell variant="mesh">
      <BrandHeader onBack={() => setScreen('onboarding-5')} />

      <section className="relative z-10 px-5 sm:px-6 pt-2 pb-4 flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div>
          <div className="mb-3.5">
            <h1 className="text-[26px] sm:text-[30px] leading-[1.12] font-extrabold text-slate-900 tracking-tight">
              Crea tu cuenta para guardar tu plan
            </h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600 font-medium">
              Hemos calculado tus calorías, macros y plan nutricional según tus respuestas. Regístrate para acceder de inmediato.
            </p>
          </div>

          <form id="create-account-form" className="space-y-3" onSubmit={handleCreateAccount}>
            {/* Confirmed Profile Badge */}
            <div className="bg-white/95 rounded-[24px] p-4 shadow-sm border border-white/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-[#00B87C]/15 text-[#006c49] flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-[22px]">person</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[15px] font-bold text-slate-900 leading-tight truncate">
                      {displayName}
                    </h2>
                    <span className="w-4 h-4 rounded-full bg-[#00B87C] text-white flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[12px] font-bold">
                        check
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Plan personalizado listo para ti
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#006c49] bg-[#00B87C]/15 px-2.5 py-1 rounded-full shrink-0">
                Verificado
              </span>
            </div>

            {/* Card de Credenciales */}
            <div className="bg-white rounded-[28px] p-5 shadow-sm space-y-4 border border-white/60">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-800" htmlFor="reg-email">
                  Correo electrónico
                </label>
                <div className="relative flex items-center bg-[#f1f5f9]/70 rounded-2xl px-4 py-3 border border-slate-200/80 focus-within:border-[#00B87C] focus-within:bg-white transition-all">
                  <span className="material-symbols-outlined text-[20px] text-slate-400 mr-3 shrink-0">
                    mail
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="off"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-transparent border-0 p-0 text-slate-800 text-[15px] font-medium focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-800" htmlFor="reg-pass">
                  Contraseña segura
                </label>
                <div className="relative flex items-center bg-[#f1f5f9]/70 rounded-2xl px-4 py-3 border border-slate-200/80 focus-within:border-[#00B87C] focus-within:bg-white transition-all">
                  <span className="material-symbols-outlined text-[20px] text-slate-400 mr-3 shrink-0">
                    lock
                  </span>
                  <input
                    id="reg-pass"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mín. 8 caracteres y 1 número"
                    className="w-full min-w-0 bg-transparent border-0 p-0 text-slate-800 text-[14.5px] font-medium focus:outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Mostrar contraseña"
                    className="text-slate-400 hover:text-slate-600 transition-colors w-9 h-9 -mr-1.5 flex items-center justify-center shrink-0"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>

                {/* Validaciones en vivo */}
                <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold">
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasMinLength ? 'text-[#006c49]' : 'text-slate-500'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        hasMinLength ? 'bg-[#00B87C] text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px] font-bold">
                        check
                      </span>
                    </span>
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasNumber ? 'text-[#006c49]' : 'text-slate-500'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        hasNumber ? 'bg-[#00B87C] text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px] font-bold">
                        check
                      </span>
                    </span>
                    <span>Al menos 1 número</span>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex items-start gap-2.5 text-xs text-slate-600">
                <span className="material-symbols-outlined text-[17px] text-[#00B87C] shrink-0 mt-0.5">
                  verified_user
                </span>
                <p className="leading-snug">
                  Tus datos están protegidos y cifrados bajo estándares de grado médico.
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl bg-error-container px-4 py-3 text-[13px] font-medium text-on-error-container">
                {error}
              </div>
            )}
          </form>
        </div>
      </section>

      <footer className="relative z-10 px-5 sm:px-6 pt-2.5 pb-4 safe-bottom bg-gradient-to-t from-[#c6ecdc] via-[#d5f7e8]/95 to-transparent flex flex-col gap-2.5 shrink-0">
        <button
          type="submit"
          form="create-account-form"
          disabled={submitting}
          className="w-full h-13 py-3.5 px-5 bg-[#181A20] hover:bg-[#232332] text-white rounded-full font-bold text-[15px] shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <span>{submitting ? 'Creando perfil...' : 'Crear cuenta y ver mi plan'}</span>
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>

        <div className="flex items-center justify-center flex-wrap gap-2 text-sm font-medium text-slate-600">
          <span className="text-[13.5px]">¿Ya tienes una cuenta?</span>
          <button
            type="button"
            onClick={() => setScreen('login')}
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-full bg-white text-slate-800 font-bold text-[13px] shadow-sm hover:text-[#00B87C] active:scale-95 transition-all"
          >
            Iniciar sesión
          </button>
        </div>
      </footer>
    </MobileShell>
  );
}
