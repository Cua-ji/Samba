import React, { useState } from 'react';
import { MobileShell } from '../components/layout/MobileShell';
import { BrandHeader } from '../components/layout/BrandHeader';
import { useSamba } from '../context/SambaContext';
import { api } from '../services/api';

const ROLES = [
  { id: 'usuario', label: 'Usuario' },
  { id: 'superusuario', label: 'Superusuario' },
  { id: 'invitado', label: 'Invitado' },
];

export function CreateAccountPage() {
  const { onboarding, updateOnboarding, setScreen, enterDashboardWithSession } = useSamba();
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

      <section className="relative z-10 px-6 pt-3 pb-6 flex flex-col flex-1 justify-between overflow-y-auto no-scrollbar">
        <div>
          <div className="mb-4">
            <h1 className="text-[30px] leading-[1.12] font-extrabold text-slate-900 tracking-tight">
              Crea tu cuenta para guardar tu plan
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600 font-medium">
              Hemos calculado tus calorías, macros y plan nutricional según tus respuestas. Regístrate para acceder de inmediato.
            </p>
          </div>

          <form className="space-y-3.5" onSubmit={handleCreateAccount}>
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
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres y 1 número"
                    className="w-full bg-transparent border-0 p-0 text-slate-800 text-[15px] font-medium focus:outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Mostrar contraseña"
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1 ml-2"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>

                {/* Validaciones en vivo */}
                <div className="pt-1 flex items-center gap-4 text-xs font-semibold">
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

              {/* Rol de perfil */}
              <div className="pt-1 border-t border-slate-100">
                <span className="block text-xs font-bold text-slate-700 mb-2">
                  Rol del perfil activo
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {ROLES.map((r) => {
                    const active = onboarding.role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => updateOnboarding({ role: r.id })}
                        className={`py-1.5 px-2 rounded-full text-[11.5px] font-bold transition-all ${
                          active
                            ? 'bg-[#181A20] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
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

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 px-6 bg-[#181A20] hover:bg-[#232332] text-white rounded-full font-bold text-[15.5px] shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                <span>{submitting ? 'Creando perfil...' : 'Crear cuenta y ver mi plan'}</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          </form>
        </div>

        <footer className="mt-4 pt-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
          <span className="text-[14px]">¿Ya tienes una cuenta?</span>
          <button
            type="button"
            onClick={() => setScreen('login')}
            className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-white text-slate-800 font-bold text-[13px] shadow-sm hover:text-[#00B87C] active:scale-95 transition-all"
          >
            Iniciar sesión
          </button>
        </footer>
      </section>
    </MobileShell>
  );
}
