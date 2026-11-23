import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

export function stripEmojis(text) {
  return String(text || '')
    .replace(EMOJI_REGEX, '')
    .replace(/\uFE0F/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function getOllamaConfig() {
  return {
    baseUrl: (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
    model: (process.env.OLLAMA_MODEL || 'qwen2.5:7b').trim(),
  };
}

export async function checkOllamaHealth() {
  const { baseUrl, model } = getOllamaConfig();
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      return { connected: false, baseUrl, activeModel: model, installedModels: [] };
    }
    const data = await res.json();
    const installedModels = (data.models || []).map((m) => m.name);
    const hasConfigured = installedModels.some(
      (name) => name === model || name.startsWith(`${model.split(':')[0]}:`)
    );
    return {
      connected: true,
      baseUrl,
      activeModel: hasConfigured ? model : installedModels[0] || model,
      installedModels,
    };
  } catch (err) {
    return {
      connected: false,
      baseUrl,
      activeModel: model,
      installedModels: [],
      error: err.message,
    };
  }
}

export async function ollamaChat({
  systemPrompt,
  userPrompt,
  formatSchema = undefined,
  temperature = 0.25,
  timeoutMs = 60000,
}) {
  const { baseUrl, model } = getOllamaConfig();

  const body = {
    model,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    options: {
      temperature,
      num_ctx: 4096,
    },
  };

  if (formatSchema) {
    body.format = formatSchema;
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawContent = data?.message?.content;
  if (!rawContent) {
    throw new Error('Ollama devolvio una respuesta vacia.');
  }

  return {
    content: stripEmojis(rawContent),
    modelUsed: data.model || model,
  };
}
