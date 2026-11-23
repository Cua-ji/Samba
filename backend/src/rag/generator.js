/**
 * Paso B (Augmented Generation):
 * Construye un System Prompt estricto con los hechos simbolicos recuperados
 * y llama a Gemini / OpenAI / Ollama local, o ejecuta el Fallback Local Inteligente.
 */
import { ollamaChat, stripEmojis } from '../services/ollama.js';

export function buildAuditedSystemPrompt(context) {
  const { profileSummary, documents, discardTraces, activeRules } = context;

  return [
    'Eres Samba AI (Whixte & Co.), asistente clinico-deportivo basado en arquitectura neuro-simbolica.',
    'REGLAS ESTRICTAS DE RESPUESTA:',
    '1. PROHIBIDO alucinar o inventar platillos, ingredientes, calorias, rutinas o reglas que no aparezcan en el CONTEXTO SIMBOLICO RECUPERADO.',
    '2. No uses emojis en ninguna parte de la respuesta.',
    '3. Cita explicitamente las reglas activas del usuario (alergias, lesiones, presupuesto o meta calorica Mifflin-St Jeor) que fundamentan tu respuesta.',
    '4. Responde en espanol claro, amable, estructurado y breve.',
    '',
    '=== PERFIL Y BALANCE ACTIVO DEL USUARIO ===',
    JSON.stringify(profileSummary, null, 2),
    '',
    '=== REGLAS SIMBOLICAS ACTIVAS ===',
    activeRules.join('\n'),
    '',
    '=== OPCIONES VALIDAS Y FICHAS RECUPERADAS ===',
    JSON.stringify(documents, null, 2),
    '',
    '=== TRAZAS DE DESCARTE ACTIVADAS ===',
    JSON.stringify(discardTraces, null, 2),
  ].join('\n');
}

function generateLocalIntelligentFallback(userQuery, context) {
  const { intent, profileSummary, documents, discardTraces } = context;
  const firstName = String(profileSummary.name || 'usuario').split(' ')[0];
  const allergyText =
    profileSummary.allergies.length > 0
      ? profileSummary.allergies.map((a) => a.label).join(', ')
      : 'ninguna alergia declarada';
  const injuryText =
    profileSummary.injuries.length > 0
      ? profileSummary.injuries.map((i) => i.label).join(', ')
      : 'ninguna lesion activa';

  const sections = [];

  // Caso 1: Preguntas sobre correr, impacto o por que se descarto un ejercicio
  if (intent.mentionsRunning || (intent.mentionsWorkout && intent.mentionsWhyDiscard)) {
    const runningDiscard =
      discardTraces.workouts.find((d) =>
        d.title.toLowerCase().includes('correr') || d.id.includes('correr')
      ) || discardTraces.workouts[0];

    if (runningDiscard) {
      sections.push(
        `${firstName}, el motor simbolico activo la regla ${runningDiscard.rule} debido a tu restriccion registrada (${injuryText}).`
      );
      sections.push(
        `Motivo tecnico: ${runningDiscard.reason} En actividades de alto impacto como '${runningDiscard.title}' (${runningDiscard.impactLevel} impacto), la carga articular puede agravar tu zona vulnerable.`
      );
    } else {
      sections.push(
        `${firstName}, actualmente no tienes lesiones activas registradas en tu perfil, por lo que las rutinas de cardio de alto impacto estan habilitadas.`
      );
    }

    const safeAlt =
      documents.workouts.find((w) => w.id.includes('ciclismo') || w.id.includes('hipertrofia')) ||
      documents.workouts[0];
    if (safeAlt) {
      sections.push(
        `Alternativa segura recomendada: '${safeAlt.title}' (${safeAlt.durationMin} min, ${safeAlt.caloriesBurned} kcal, impacto ${safeAlt.impactLevel}). ${safeAlt.sheet}`
      );
    }
    return sections.join('\n\n');
  }

  // Caso 2: Preguntas sobre platillos, cena, presupuesto o alergias
  if (intent.mentionsMeal) {
    const mealLabel = intent.mealTime
      ? intent.mealTime.charAt(0).toUpperCase() + intent.mealTime.slice(1)
      : 'Platillos';
    const budgetLabel = intent.budgetTier ? `con presupuesto ${intent.budgetTier}` : 'disponibles';

    if (documents.meals.length > 0) {
      const topMeals = documents.meals.slice(0, 3);
      const listText = topMeals
        .map(
          (m) =>
            `- ${m.title} (${m.budgetLabel}, ~\$${m.estimatedCostUsd.toFixed(2)} USD): ${m.calories} kcal (${m.protein}g P / ${m.carbs}g C / ${m.fat}g G). Ingrediente principal: ${m.mainIngredient}${m.isFavorite ? ' [Favorito]' : ''}.`
        )
        .join('\n');

      sections.push(
        `${firstName}, segun tus reglas activas (${allergyText}) y validacion de precio consistente para ${mealLabel} ${budgetLabel}, estas son tus opciones auditadas:\n\n${listText}`
      );
    } else {
      sections.push(
        `${firstName}, no quedaron opciones dentro de ese filtro especifico tras aplicar tus restricciones de alergias (${allergyText}). Te sugiero ampliar el tiempo de comida o nivel de presupuesto.`
      );
    }

    if (discardTraces.meals.length > 0) {
      const sampleDiscards = discardTraces.meals
        .slice(0, 2)
        .map((d) => `${d.title} (${d.rule})`)
        .join('; ');
      sections.push(
        `Reglas de descarte aplicadas: se excluyeron ${discardTraces.meals.length} opciones incompatibles con tu perfil, por ejemplo: ${sampleDiscards}.`
      );
    }

    sections.push(
      `Balance diario Mifflin-St Jeor: llevas ${profileSummary.caloriesConsumedToday} de ${profileSummary.targetCalories} kcal (te restan ${profileSummary.caloriesRemainingToday} kcal hoy).`
    );
    return sections.join('\n\n');
  }

  // Caso 3: Preguntas sobre entrenamientos generales
  if (intent.mentionsWorkout) {
    const listWorkouts = documents.workouts
      .slice(0, 3)
      .map(
        (w) =>
          `- ${w.title} (${w.durationMin} min, ${w.caloriesBurned} kcal, impacto ${w.impactLevel}): ${w.mainBenefit}`
      )
      .join('\n');

    sections.push(
      `${firstName}, considerando tu objetivo '${profileSummary.goalLabel}' y proteccion ante (${injuryText}), estas rutinas superaron el filtro simbolico:\n\n${listWorkouts}`
    );

    if (discardTraces.workouts.length > 0) {
      sections.push(
        `Exclusiones activas (${discardTraces.workouts.length} rutinas descartadas): ${discardTraces.workouts
          .slice(0, 2)
          .map((d) => `${d.title} [${d.rule}]`)
          .join('; ')}.`
      );
    }
    return sections.join('\n\n');
  }

  // Caso 4: Resumen de calorias, macros, IMC o pregunta general
  const topMeal = documents.meals[0];
  const topWorkout = documents.workouts[0];
  sections.push(
    `Hola ${firstName}. Tu meta diaria calculada con Mifflin-St Jeor es de ${profileSummary.targetCalories} kcal (TMB ${profileSummary.bmr} kcal, TDEE ${profileSummary.tdee} kcal, IMC ${profileSummary.imc.bmi} kg/m2 - ${profileSummary.imc.category}).`
  );
  sections.push(
    `Progreso de hoy: ${profileSummary.caloriesConsumedToday} kcal consumidas, ${profileSummary.caloriesRemainingToday} kcal restantes. Objetivo de macros: ${profileSummary.macrosTarget.protein}g proteina, ${profileSummary.macrosTarget.carbs}g carbohidratos y ${profileSummary.macrosTarget.fat}g grasas.`
  );
  sections.push(
    `Filtros simbolicos activos: alergias [${allergyText}] (${discardTraces.meals.length} platillos descartados) y lesiones [${injuryText}] (${discardTraces.workouts.length} rutinas descartadas).`
  );
  if (topMeal || topWorkout) {
    sections.push(
      `Sugerencia inmediata verificada: ${topMeal ? `Platillo '${topMeal.title}' (${topMeal.calories} kcal)` : ''}${topMeal && topWorkout ? ' y ' : ''}${topWorkout ? `Rutina '${topWorkout.title}' (${topWorkout.durationMin} min)` : ''}.`
    );
  }
  return sections.join('\n\n');
}

async function callGeminiAPI({ apiKey, model, systemPrompt, userQuery }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userQuery }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 600,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API HTTP ${response.status}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini API devolvio respuesta vacia');
  return text.trim();
}

async function callOpenAIAPI({ apiKey, model, systemPrompt, userQuery }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API HTTP ${response.status}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI API devolvio respuesta vacia');
  return text.trim();
}

export async function generateGroundedResponse(userQuery, context) {
  const systemPrompt = buildAuditedSystemPrompt(context);
  const preferredProvider = (process.env.LLM_PROVIDER || 'auto').toLowerCase();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const shouldTryGemini =
    geminiKey && (preferredProvider === 'gemini' || preferredProvider === 'auto');
  const shouldTryOpenAI =
    openaiKey &&
    (preferredProvider === 'openai' || (preferredProvider === 'auto' && !shouldTryGemini));
  const shouldTryOllama =
    preferredProvider === 'ollama' ||
    (preferredProvider === 'auto' && !shouldTryGemini && !shouldTryOpenAI);

  if (preferredProvider !== 'fallback') {
    if (shouldTryGemini) {
      try {
        const answer = stripEmojis(
          await callGeminiAPI({
            apiKey: geminiKey,
            model: geminiModel,
            systemPrompt,
            userQuery,
          })
        );
        return {
          answer,
          providerUsed: 'gemini',
          modelUsed: geminiModel,
          systemPromptPreview: systemPrompt,
        };
      } catch {
        // Continua a siguiente proveedor disponible
      }
    }

    if (shouldTryOpenAI) {
      try {
        const answer = stripEmojis(
          await callOpenAIAPI({
            apiKey: openaiKey,
            model: openaiModel,
            systemPrompt,
            userQuery,
          })
        );
        return {
          answer,
          providerUsed: 'openai',
          modelUsed: openaiModel,
          systemPromptPreview: systemPrompt,
        };
      } catch {
        // Continua a Ollama o fallback local
      }
    }

    if (shouldTryOllama) {
      try {
        const ollamaResult = await ollamaChat({
          systemPrompt,
          userPrompt: userQuery,
          temperature: 0.2,
          timeoutMs: 90000,
        });
        return {
          answer: ollamaResult.content,
          providerUsed: 'ollama',
          modelUsed: ollamaResult.modelUsed,
          systemPromptPreview: systemPrompt,
        };
      } catch (err) {
        console.warn('[Samba RAG] Ollama fallback activated:', err?.message || err);
      }
    }
  }

  return {
    answer: stripEmojis(generateLocalIntelligentFallback(userQuery, context)),
    providerUsed: 'fallback_local',
    modelUsed: 'samba-symbolic-rag-v1',
    systemPromptPreview: systemPrompt,
  };
}
