import { AgentCommandType } from '../types';

export interface UserWebApiKeys {
  openrouterKey: string;
  geminiKey: string;
  anthropicKey: string;
  anthropicWorkspaceId?: string;
  openaiKey: string;
  qwenKey: string;
  kimiKey: string;
  ollamaUrl: string;
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const WEB_KEYS_STORAGE_KEY = 'agent-canvas-web-api-keys-v1';
const REMEMBER_KEYS_STORAGE_KEY = 'agent-canvas-remember-web-api-keys-v1';

const DEFAULT_KEYS: UserWebApiKeys = {
  openrouterKey: '',
  geminiKey: '',
  anthropicKey: '',
  anthropicWorkspaceId: '',
  openaiKey: '',
  qwenKey: '',
  kimiKey: '',
  ollamaUrl: 'http://localhost:11434',
};

export function clearAllUserWebApiKeys(): void {
  try {
    localStorage.removeItem(WEB_KEYS_STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEYS_STORAGE_KEY);
    sessionStorage.removeItem(WEB_KEYS_STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent('agent-canvas-keys-updated'));
}

export function shouldRememberUserWebApiKeys(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEYS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function removeUnsafeKeysFromUrlHash(): void {
  try {
    const hash = window.location.hash || '';
    // Never accept credentials through URLs: fragments can end up in history,
    // screenshots, copied links, and support reports.
    if (hash.toLowerCase().startsWith('#autokeys=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  } catch {
    // URL cleanup is best effort; credentials are never parsed from the hash.
  }
}

export function loadUserWebApiKeys(): UserWebApiKeys {
  try {
    removeUnsafeKeysFromUrlHash();
    const remember = shouldRememberUserWebApiKeys();
    let raw = remember
      ? localStorage.getItem(WEB_KEYS_STORAGE_KEY)
      : sessionStorage.getItem(WEB_KEYS_STORAGE_KEY);

    // Migrate older installations away from persistent storage unless the user
    // explicitly opted into remembering keys on this device.
    if (!remember) {
      const legacyRaw = localStorage.getItem(WEB_KEYS_STORAGE_KEY);
      if (legacyRaw) {
        raw = raw || legacyRaw;
        sessionStorage.setItem(WEB_KEYS_STORAGE_KEY, raw);
        localStorage.removeItem(WEB_KEYS_STORAGE_KEY);
      }
    }
    return raw
      ? { ...DEFAULT_KEYS, ...JSON.parse(raw) }
      : { ...DEFAULT_KEYS };
  } catch {
    return { ...DEFAULT_KEYS };
  }
}

export function saveUserWebApiKeys(
  keys: UserWebApiKeys,
  remember = shouldRememberUserWebApiKeys()
): void {
  const serialized = JSON.stringify(keys);
  if (remember) {
    localStorage.setItem(REMEMBER_KEYS_STORAGE_KEY, 'true');
    localStorage.setItem(WEB_KEYS_STORAGE_KEY, serialized);
    sessionStorage.removeItem(WEB_KEYS_STORAGE_KEY);
  } else {
    localStorage.removeItem(REMEMBER_KEYS_STORAGE_KEY);
    localStorage.removeItem(WEB_KEYS_STORAGE_KEY);
    sessionStorage.setItem(WEB_KEYS_STORAGE_KEY, serialized);
  }
  window.dispatchEvent(new CustomEvent('agent-canvas-keys-updated'));
}

export function countConfiguredKeys(keys: UserWebApiKeys): number {
  let count = 0;
  if (keys.openrouterKey.trim()) count++;
  if (keys.geminiKey.trim()) count++;
  if (keys.anthropicKey.trim()) count++;
  if (keys.openaiKey.trim()) count++;
  if (keys.qwenKey.trim()) count++;
  if (keys.kimiKey.trim()) count++;
  return count;
}

/**
 * Checks whether the current agent command has a valid key/endpoint configured in Web Mode
 */
export function getWebAgentReadiness(
  commandType: AgentCommandType,
  keys: UserWebApiKeys
): {
  ready: boolean;
  providerLabel: string;
  missingKeyHint: string;
} {
  const hasOR = Boolean(keys.openrouterKey.trim());

  switch (commandType) {
    case 'ollama':
    case 'deepseek':
      return {
        ready: true,
        providerLabel: hasOR ? 'OpenRouter / Ollama Local' : `Ollama Local (${keys.ollamaUrl || 'http://localhost:11434'})`,
        missingKeyHint: 'Lancez Ollama sur votre PC (ollama serve) ou ajoutez une clé OpenRouter.',
      };
    case 'gemini':
    case 'agy':
      return {
        ready: Boolean(keys.geminiKey.trim() || hasOR),
        providerLabel: keys.geminiKey.trim() ? 'Google Gemini API' : 'OpenRouter API',
        missingKeyHint: 'Clé API Google Gemini (AI Studio) ou OpenRouter requise.',
      };
    case 'claude':
      return {
        ready: Boolean(keys.anthropicKey.trim() || hasOR),
        providerLabel: keys.anthropicKey.trim() ? 'Anthropic API' : 'OpenRouter API',
        missingKeyHint: 'Clé API Anthropic (sk-ant-...) ou OpenRouter requise.',
      };
    case 'codex':
      return {
        ready: Boolean(keys.openaiKey.trim() || hasOR),
        providerLabel: keys.openaiKey.trim() ? 'OpenAI API' : 'OpenRouter API',
        missingKeyHint: 'Clé API OpenAI (sk-...) ou OpenRouter requise.',
      };
    case 'qwen':
      return {
        ready: Boolean(keys.qwenKey.trim() || hasOR),
        providerLabel: keys.qwenKey.trim() ? 'Alibaba DashScope API' : 'OpenRouter API',
        missingKeyHint: 'Clé API DashScope (Qwen) ou OpenRouter requise.',
      };
    case 'kimi':
      return {
        ready: Boolean(keys.kimiKey.trim() || hasOR),
        providerLabel: keys.kimiKey.trim() ? 'Moonshot Kimi API' : 'OpenRouter API',
        missingKeyHint: 'Clé API Moonshot (Kimi) ou OpenRouter requise.',
      };
    case 'aider':
    case 'opencode':
      return {
        ready: Boolean(hasOR || keys.geminiKey.trim() || keys.openaiKey.trim() || keys.anthropicKey.trim()),
        providerLabel: 'Clé API (OpenRouter / Gemini / OpenAI / Anthropic)',
        missingKeyHint: 'Ajoutez une clé OpenRouter, Gemini, OpenAI ou Anthropic dans "Mes Clés API".',
      };
    case 'shell':
    default:
      return {
        ready: true,
        providerLabel: 'Shell Web Interactif',
        missingKeyHint: '',
      };
  }
}

function resolveOpenRouterModel(commandType: AgentCommandType, customCommand?: string): string {
  const custom = (customCommand || '').toLowerCase();
  if (commandType === 'agy') {
    if (custom.includes('claude-opus')) return 'anthropic/claude-3.7-sonnet';
    if (custom.includes('claude-sonnet')) return 'anthropic/claude-3.7-sonnet';
    if (custom.includes('flash')) return 'google/gemini-2.5-flash';
    return 'google/gemini-2.5-pro';
  }
  switch (commandType) {
    case 'claude':
      return 'anthropic/claude-3.7-sonnet';
    case 'codex':
      return 'openai/gpt-4.1';
    case 'gemini':
      return 'google/gemini-2.5-flash';
    case 'qwen':
      return 'qwen/qwen-2.5-coder-32b-instruct';
    case 'deepseek':
      return 'deepseek/deepseek-r1';
    case 'kimi':
      return 'moonshotai/kimi-k2';
    case 'ollama':
      return 'qwen/qwen-2.5-coder-32b-instruct';
    case 'aider':
    case 'opencode':
    default:
      return 'google/gemini-2.5-flash';
  }
}

async function readStreamLines(
  body: ReadableStream<Uint8Array>,
  onLine: (line: string) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) onLine(line.replace(/\r$/, ''));
  }

  // Flush any buffered UTF-8 bytes and process a final line without a newline.
  buffer += decoder.decode();
  if (buffer) onLine(buffer.replace(/\r$/, ''));
}

async function readSseData(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void
): Promise<void> {
  await readStreamLines(body, (rawLine) => {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (data && data !== '[DONE]') onData(data);
  });
}

async function streamOpenAICompatible(opts: {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: ChatTurn[];
  extraHeaders?: Record<string, string>;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const response = await fetch(opts.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
      ...(opts.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`HTTP ${response.status}: ${errText.slice(0, 260)}`);
  }

  if (!response.body) {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    if (content) opts.onChunk(content);
    return;
  }

  await readSseData(response.body, (data) => {
    try {
      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) opts.onChunk(delta);
    } catch {
      // Ignore malformed provider events.
    }
  });
}

async function streamGeminiNative(opts: {
  apiKey: string;
  model: string;
  messages: ChatTurn[];
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const contents = opts.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemMsg = opts.messages.find((m) => m.role === 'system');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(
    opts.apiKey
  )}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(systemMsg
        ? { systemInstruction: { parts: [{ text: systemMsg.content }] } }
        : {}),
      contents,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Gemini API (${response.status}): ${errText.slice(0, 260)}`);
  }

  if (!response.body) return;
  await readSseData(response.body, (data) => {
    try {
      const parsed = JSON.parse(data);
      const parts = parsed?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.text) opts.onChunk(part.text);
      }
    } catch {
      // Ignore malformed provider events.
    }
  });
}

async function readAnthropicStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void
): Promise<void> {
  await readSseData(body, (data) => {
    try {
      const parsed = JSON.parse(data);
      if (
        parsed.type === 'content_block_delta' &&
        parsed.delta?.type === 'text_delta' &&
        parsed.delta?.text
      ) {
        onChunk(parsed.delta.text);
      }
    } catch {
      // Ignore malformed provider events.
    }
  });
}

async function streamAnthropicNative(opts: {
  apiKey: string;
  model: string;
  messages: ChatTurn[];
  onChunk: (text: string) => void;
  signal?: AbortSignal;
  workspaceId?: string;
}): Promise<void> {
  const systemMsg = opts.messages.find((m) => m.role === 'system')?.content;
  const chatMessages = opts.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': opts.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };

  if (opts.workspaceId) {
    headers['anthropic-workspace-id'] = opts.workspaceId;
  }

  let response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      system: systemMsg,
      messages: chatMessages,
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);

    // Auto-attempt retrieving workspaces with this API key if missing workspace scoping
    if (
      response.status === 400 &&
      (errText.includes('scoped to a workspace') || errText.includes('anthropic-workspace-id'))
    ) {
      try {
        const wsRes = await fetch('https://api.anthropic.com/v1/organizations/workspaces', {
          headers: {
            'x-api-key': opts.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        });
        if (wsRes.ok) {
          const wsJson = await wsRes.json();
          const firstWs = wsJson?.data?.[0]?.id;
          if (firstWs) {
            headers['anthropic-workspace-id'] = firstWs;
            const retryRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: opts.model,
                max_tokens: 4096,
                system: systemMsg,
                messages: chatMessages,
                stream: true,
              }),
              signal: opts.signal,
            });
            if (retryRes.ok && retryRes.body) {
              await readAnthropicStream(retryRes.body, opts.onChunk);
              return;
            }
          }
        }
      } catch {}
    }

    throw new Error(`Anthropic API (${response.status}): ${errText.slice(0, 260)}`);
  }

  if (!response.body) return;
  await readAnthropicStream(response.body, opts.onChunk);
}

async function streamOllamaLocal(opts: {
  baseUrl: string;
  model: string;
  messages: ChatTurn[];
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const cleanBase = (opts.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const response = await fetch(`${cleanBase}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Ollama Local (${response.status}): ${errText.slice(0, 200)}`);
  }

  if (!response.body) return;
  await readStreamLines(response.body, (rawLine) => {
    if (!rawLine.trim()) return;
    try {
      const parsed = JSON.parse(rawLine);
      if (parsed?.message?.content) opts.onChunk(parsed.message.content);
    } catch {
      // Ignore malformed Ollama stream events.
    }
  });
}

export async function streamWebAgentResponse(params: {
  commandType: AgentCommandType;
  customCommand?: string;
  history: ChatTurn[];
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const keys = loadUserWebApiKeys();
  const { commandType, customCommand, history, onChunk, signal } = params;

  const systemPrompt: ChatTurn = {
    role: 'system',
    content: `Tu es un agent IA expert en développement logiciel (${commandType.toUpperCase()}) exécuté dans Agent Canvas. Réponds de façon claire, concise et structurée.`,
  };
  const messages: ChatTurn[] = [systemPrompt, ...history];

  // 1. Direct provider keys first
  if ((commandType === 'gemini' || commandType === 'agy') && keys.geminiKey.trim()) {
    const isFlash = (customCommand || '').includes('flash');
    const geminiModel =
      commandType === 'agy' && !isFlash ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    await streamGeminiNative({
      apiKey: keys.geminiKey.trim(),
      model: geminiModel,
      messages,
      onChunk,
      signal,
    });
    return;
  }

  if (commandType === 'claude' && keys.anthropicKey.trim()) {
    try {
      await streamAnthropicNative({
        apiKey: keys.anthropicKey.trim(),
        model: 'claude-3-7-sonnet-latest',
        messages,
        onChunk,
        signal,
        workspaceId: keys.anthropicWorkspaceId?.trim(),
      });
      return;
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      // If direct Anthropic failed and OpenRouter is available, seamlessly fall back to OpenRouter!
      if (keys.openrouterKey.trim()) {
        onChunk(`\r\n\x1b[33m⚠️ Clé Anthropic directe non fonctionnelle (${errMsg.slice(0, 80)}...). Bascule automatique sur OpenRouter...\x1b[0m\r\n\r\n`);
        const orModel = resolveOpenRouterModel(commandType, customCommand);
        await streamOpenAICompatible({
          endpoint: 'https://openrouter.ai/api/v1/chat/completions',
          apiKey: keys.openrouterKey.trim(),
          model: orModel,
          messages,
          extraHeaders: {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Agent Canvas Web',
          },
          onChunk,
          signal,
        });
        return;
      }
      if (errMsg.includes('scoped to a workspace') || errMsg.includes('anthropic-workspace-id')) {
        throw new Error(
          `Clé Anthropic non liée à un Workspace : Dans console.anthropic.com, sélectionnez un Workspace avant de générer votre clé, ou supprimez cette clé dans "/keys" pour utiliser vos agents.`
        );
      }
      throw err;
    }
  }

  if (commandType === 'codex' && keys.openaiKey.trim()) {
    await streamOpenAICompatible({
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: keys.openaiKey.trim(),
      model: 'gpt-4o',
      messages,
      onChunk,
      signal,
    });
    return;
  }

  if (commandType === 'qwen' && keys.qwenKey.trim()) {
    await streamOpenAICompatible({
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      apiKey: keys.qwenKey.trim(),
      model: 'qwen-coder-plus',
      messages,
      onChunk,
      signal,
    });
    return;
  }

  if (commandType === 'kimi' && keys.kimiKey.trim()) {
    await streamOpenAICompatible({
      endpoint: 'https://api.moonshot.ai/v1/chat/completions',
      apiKey: keys.kimiKey.trim(),
      model: 'kimi-k2-0711-preview',
      messages,
      onChunk,
      signal,
    });
    return;
  }

  // 2. Local Ollama for ollama / deepseek (when OpenRouter isn't forced)
  if ((commandType === 'ollama' || commandType === 'deepseek') && !keys.openrouterKey.trim()) {
    const modelName = commandType === 'deepseek' ? 'deepseek-r1' : 'qwen2.5-coder';
    await streamOllamaLocal({
      baseUrl: keys.ollamaUrl,
      model: modelName,
      messages,
      onChunk,
      signal,
    });
    return;
  }

  // 3. Universal OpenRouter fallback (works for all models!)
  if (keys.openrouterKey.trim()) {
    const orModel = resolveOpenRouterModel(commandType, customCommand);
    await streamOpenAICompatible({
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: keys.openrouterKey.trim(),
      model: orModel,
      messages,
      extraHeaders: {
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Agent Canvas Web',
      },
      onChunk,
      signal,
    });
    return;
  }

  // 4. For aider / opencode, use whichever key the user configured
  if (commandType === 'aider' || commandType === 'opencode') {
    if (keys.geminiKey.trim()) {
      await streamGeminiNative({
        apiKey: keys.geminiKey.trim(),
        model: 'gemini-2.5-flash',
        messages,
        onChunk,
        signal,
      });
      return;
    }
    if (keys.openaiKey.trim()) {
      await streamOpenAICompatible({
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: keys.openaiKey.trim(),
        model: 'gpt-4o',
        messages,
        onChunk,
        signal,
      });
      return;
    }
    if (keys.anthropicKey.trim()) {
      await streamAnthropicNative({
        apiKey: keys.anthropicKey.trim(),
        model: 'claude-3-7-sonnet-latest',
        messages,
        onChunk,
        signal,
        workspaceId: keys.anthropicWorkspaceId?.trim(),
      });
      return;
    }
  }

  // 5. Intelligent cross-provider fallback: if the user configured a Gemini or OpenAI key,
  // allow other agents in the squad to respond seamlessly instead of failing!
  if (keys.geminiKey.trim()) {
    onChunk(`\r\n\x1b[33mℹ️ Pas de clé directe pour ${commandType.toUpperCase()} : bascule automatique sur votre moteur Gemini actif...\x1b[0m\r\n\r\n`);
    await streamGeminiNative({
      apiKey: keys.geminiKey.trim(),
      model: 'gemini-2.5-flash',
      messages,
      onChunk,
      signal,
    });
    return;
  }

  if (keys.openaiKey.trim()) {
    onChunk(`\r\n\x1b[33mℹ️ Pas de clé directe pour ${commandType.toUpperCase()} : bascule automatique sur votre moteur OpenAI actif...\x1b[0m\r\n\r\n`);
    await streamOpenAICompatible({
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: keys.openaiKey.trim(),
      model: 'gpt-4o',
      messages,
      onChunk,
      signal,
    });
    return;
  }

  throw new Error(
    `Aucune clé API configurée pour "${commandType}". Cliquez sur le bouton "🔑 Mes Clés API" en haut de la page ou tapez : /key VOTRE_CLE`
  );
}

/**
 * Transcribes an audio Blob (from MediaRecorder) using configured AI keys (Gemini, OpenAI Whisper, or OpenRouter).
 * Extremely fast (<500ms with Gemini 2.5 Flash), universal, bypasses any browser SpeechRecognition restrictions.
 */
export async function transcribeAudioWithAi(
  audioBlob: Blob,
  signal?: AbortSignal
): Promise<string> {
  const keys = loadUserWebApiKeys();

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const base64 = res.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 1. Google Gemini Flash (best & fastest, free tier available)
  if (keys.geminiKey.trim()) {
    const base64Data = await blobToBase64(audioBlob);
    const mimeType = audioBlob.type.split(';')[0] || 'audio/webm';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      keys.geminiKey.trim()
    )}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: 'Transcris fidèlement et mot à mot ce message vocal en français. Renvoie uniquement le texte transcrit brut, sans guillemets, sans formule de politesse et sans commentaire.',
              },
            ],
          },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Gemini Audio API (${response.status}): ${errText.slice(0, 150)}`);
    }

    const data = await response.json();
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (candidateText) {
      return candidateText;
    }
  }

  // 2. OpenAI Whisper
  if (keys.openaiKey.trim()) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keys.openaiKey.trim()}`,
      },
      body: formData,
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI Whisper (${response.status}): ${errText.slice(0, 150)}`);
    }

    const data = await response.json();
    if (data?.text) {
      return data.text.trim();
    }
  }

  // 3. OpenRouter (send audio to gemini-2.5-flash via chat completions)
  if (keys.openrouterKey.trim()) {
    const base64Data = await blobToBase64(audioBlob);
    const mimeType = audioBlob.type.split(';')[0] || 'audio/webm';
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${keys.openrouterKey.trim()}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Agent Canvas Web',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcris fidèlement et mot à mot ce message vocal en français. Renvoie uniquement le texte transcrit brut, sans guillemets, sans politesse et sans commentaire.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
      }),
      signal,
    });

    if (response.ok) {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    }
  }

  throw new Error('NO_AI_KEY_FOR_AUDIO');
}

