import React, { useEffect, useRef, useState } from 'react';
import { useSamba } from '../../context/SambaContext';
import { api } from '../../services/api';

const QUICK_PROMPTS = [
  '¿Qué puedo cenar hoy barato?',
  '¿Por qué no me recomiendas correr?',
  'Resume mis calorías y macros de hoy',
  '¿Qué opciones de almuerzo son seguras para mí?',
];

export function SambaChatDrawer() {
  const { user, chatOpen, setChatOpen, chatInitialPrompt, setChatInitialPrompt, refreshProfile } =
    useSamba();
  const [messages, setMessages] = useState([
    {
      id: 'welcome_rag',
      role: 'assistant',
      text: 'Soy Samba AI. Cada respuesta consulta primero tu perfil en el Motor Simbólico para garantizar cero alucinaciones, respetar tus alergias o lesiones y citar tus reglas activas.',
      providerUsed: 'sistema_neuro_simbolico',
      retrieval: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedAuditId, setExpandedAuditId] = useState(null);
  const listEndRef = useRef(null);

  useEffect(() => {
    if (chatOpen && chatInitialPrompt) {
      setInput(chatInitialPrompt);
      setChatInitialPrompt('');
    }
  }, [chatOpen, chatInitialPrompt, setChatInitialPrompt]);

  useEffect(() => {
    if (chatOpen && listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  if (!chatOpen) return null;

  async function handleSend(textToSend) {
    const clean = String(textToSend ?? input).trim();
    if (!clean || sending || !user) return;

    const userMsg = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: clean,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (textToSend === undefined) setInput('');
    setSending(true);

    try {
      const res = await api.askChat(user.id, clean);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: res.answer,
          providerUsed: res.providerUsed,
          modelUsed: res.modelUsed,
          retrieval: res.retrieval,
        },
      ]);
      refreshProfile(user.id).catch(() => {});
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: err.message || 'No fue posible consultar el pipeline RAG en este momento.',
          providerUsed: 'error',
          retrieval: null,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function renderProviderLabel(provider, modelUsed) {
    if (provider === 'ollama') return `Ollama Local (${modelUsed || 'qwen2.5:7b'})`;
    if (provider === 'gemini') return 'Gemini API';
    if (provider === 'openai') return 'OpenAI API';
    if (provider === 'fallback_local') return 'Fallback Local Auditado';
    if (provider === 'sistema_neuro_simbolico') return 'Motor Simbólico';
    return 'Sistema';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-full sm:max-w-[460px] md:max-w-[500px] h-[88dvh] max-h-[88vh] bg-[#F4FBF7] rounded-t-[24px] shadow-2xl flex flex-col overflow-hidden border-t border-white">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-white border-b border-[#E1EFE7] flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#CBF3DB] text-[#2E7D5B] text-[10.5px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#00B87C]" />
              SAMBA AI
            </span>
            <div className="min-w-0">
              <h2 className="text-[14px] sm:text-[15px] font-bold text-[#151D24] leading-tight truncate">
                Asistente RAG Neuro-Simbólico
              </h2>
              <p className="text-[11px] text-[#52525B] truncate">
                Paso A Simbólico + Paso B Auditado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            aria-label="Cerrar chat"
            className="w-9 h-9 rounded-full bg-[#F4FBF7] hover:bg-[#E8F9EF] text-[#181A20] flex items-center justify-center transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Preguntas rapidas */}
        <div className="px-4 py-2.5 bg-white/70 border-b border-[#E1EFE7] flex flex-wrap items-center gap-1.5 shrink-0">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1.5 rounded-full bg-white border border-[#E1EFE7] hover:border-[#00B87C] text-[11px] font-semibold text-[#181A20] transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Historial de mensajes */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const auditOpen = expandedAuditId === msg.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-line ${
                    isUser
                      ? 'bg-[#181A20] text-white rounded-br-sm'
                      : 'bg-gradient-to-br from-[#E8F9EF] to-[#FFFFFF] border border-[#CBF3DB] text-[#18181B] rounded-bl-sm shadow-sm'
                  }`}
                >
                  {!isUser && (
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#CBF3DB] text-[#2E7D5B] text-[10px] font-bold tracking-wider uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B]" />
                        SAMBA AI
                      </span>
                      <span className="text-[10px] font-semibold text-[#4A7265]">
                        {renderProviderLabel(msg.providerUsed, msg.modelUsed)}
                      </span>
                    </div>
                  )}

                  <p>{msg.text}</p>

                  {!isUser && msg.retrieval && (
                    <div className="mt-2.5 pt-2 border-t border-[#CBF3DB]/80">
                      <button
                        type="button"
                        onClick={() => setExpandedAuditId(auditOpen ? null : msg.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006c49] hover:underline"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {auditOpen ? 'expand_less' : 'fact_check'}
                        </span>
                        <span>
                          {auditOpen
                            ? 'Ocultar auditoría simbólica'
                            : `Auditar RAG (${msg.retrieval.activeRules.length} reglas, ${msg.retrieval.discardTraces.meals.length + msg.retrieval.discardTraces.workouts.length} descartes)`}
                        </span>
                      </button>

                      {auditOpen && (
                        <div className="mt-2 p-2.5 rounded-xl bg-white/90 border border-[#E1EFE7] text-[11px] space-y-2 text-[#3c4a42]">
                          {Array.isArray(msg.retrieval.mlModelsUsed) &&
                            msg.retrieval.mlModelsUsed.length > 0 && (
                              <div>
                                <p className="font-bold text-[#151D24] uppercase tracking-wider text-[10px] mb-1">
                                  Redes Neuronales Activas (PyTorch)
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {msg.retrieval.mlModelsUsed.map((mName) => (
                                    <span
                                      key={mName}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E8F9EF] text-[#006c49] font-bold text-[10px]"
                                    >
                                      <span className="material-symbols-outlined text-[12px]">
                                        neurology
                                      </span>
                                      {mName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          <div>
                            <p className="font-bold text-[#151D24] uppercase tracking-wider text-[10px] mb-1">
                              Paso A - Reglas Activas
                            </p>
                            <ul className="space-y-0.5 font-mono text-[10.5px]">
                              {msg.retrieval.activeRules.map((r, idx) => (
                                <li key={idx}>{r}</li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <p className="font-bold text-[#151D24] uppercase tracking-wider text-[10px] mb-1">
                              Opciones Válidas Recuperadas
                            </p>
                            <p>
                              Platillos ({msg.retrieval.documents.meals.length}):{' '}
                              {msg.retrieval.documents.meals.map((m) => m.title).join(', ') || 'N/A'}
                            </p>
                            <p className="mt-0.5">
                              Rutinas ({msg.retrieval.documents.workouts.length}):{' '}
                              {msg.retrieval.documents.workouts.map((w) => w.title).join(', ') || 'N/A'}
                            </p>
                          </div>

                          {(msg.retrieval.discardTraces.meals.length > 0 ||
                            msg.retrieval.discardTraces.workouts.length > 0) && (
                            <div>
                              <p className="font-bold text-[#151D24] uppercase tracking-wider text-[10px] mb-1">
                                Trazas de Descarte Citables
                              </p>
                              <ul className="space-y-1">
                                {[
                                  ...msg.retrieval.discardTraces.meals.slice(0, 2),
                                  ...msg.retrieval.discardTraces.workouts.slice(0, 2),
                                ].map((t) => (
                                  <li key={t.id} className="leading-tight">
                                    <span className="font-mono font-semibold text-[#93000a]">
                                      {t.rule}
                                    </span>{' '}
                                    - {t.title}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="flex items-start">
              <div className="rounded-2xl px-4 py-3 bg-white border border-[#CBF3DB] text-[12.5px] text-[#4A7265] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] animate-spin text-[#00B87C]">
                  progress_activity
                </span>
                <span>Consultando motor simbólico y generando respuesta...</span>
              </div>
            </div>
          )}
          <div ref={listEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="px-4 py-3 bg-white border-t border-[#E1EFE7] flex items-center gap-2 safe-bottom shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta por cenas, rutinas o reglas..."
            className="flex-1 min-w-0 h-12 px-4 rounded-2xl bg-[#F4FBF7] border border-[#E1EFE7] focus:border-[#00B87C] focus:bg-white focus:outline-none text-[14px] text-[#18181B] placeholder:text-[#71717A]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Enviar consulta"
            className="w-12 h-12 rounded-full bg-[#181A20] hover:bg-[#232332] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
