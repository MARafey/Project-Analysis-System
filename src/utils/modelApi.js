// AI provider layer: all calls go through the same-origin proxy (api/chat.js)
// so the browser never calls the Ollama server directly — that avoids CORS
// blocks (the Ollama server sends no Access-Control-Allow-Origin header) and
// keeps the API key server-side (set OLLAMA_API_KEY etc. on the Vercel
// project, NOT as a REACT_APP_ variable — those get baked into the public
// bundle and would make the browser call Ollama directly again).
//
// REACT_APP_MODEL_API_URL / _API_KEY / a stored Settings override are only
// honored on localhost, for local `npm start` testing where /api/chat isn't
// served. On any deployed origin the proxy path is used unconditionally,
// no matter what those variables are set to — this is deliberate so that
// misconfiguring a REACT_APP_ env var in Vercel can't reintroduce CORS.

const STORAGE_KEY = 'fyp_model_endpoint_config';

let endpointConfig = loadEndpointConfig();

function isLocalDevHost() {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function loadEndpointConfig() {
  if (isLocalDevHost()) {
    try {
      const stored = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.url) return parsed;
      }
    } catch (e) { /* ignore corrupt config */ }

    if (process.env.REACT_APP_MODEL_API_URL) {
      return {
        url: process.env.REACT_APP_MODEL_API_URL,
        apiKey: process.env.REACT_APP_MODEL_API_KEY || '',
        modelName: process.env.REACT_APP_MODEL_NAME || 'gemma4:cloud'
      };
    }
  }

  return {
    url: '/api/chat',
    apiKey: '',
    modelName: process.env.REACT_APP_MODEL_NAME || 'gemma4:cloud'
  };
}

// ---- Provider configuration ----

export function configureModelEndpoint({ url, apiKey = '', modelName = '' }) {
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    return { success: false, error: 'Endpoint URL must start with http(s)://' };
  }
  endpointConfig = { url: url.trim().replace(/\/$/, ''), apiKey: apiKey.trim(), modelName: modelName.trim() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(endpointConfig));
  } catch (e) { /* storage unavailable — config still active for this session */ }
  return { success: true };
}

export function clearModelEndpoint() {
  endpointConfig = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

export function getModelEndpointConfig() {
  return endpointConfig ? { ...endpointConfig } : null;
}

export function isModelEndpointAvailable() {
  return endpointConfig !== null;
}

// True when the deployed model endpoint is configured.
export function isAIAvailable() {
  return isModelEndpointAvailable();
}

export function getActiveProviderName() {
  return isModelEndpointAvailable() ? 'Deployed Model' : 'None';
}

// ---- Core generation ----

// Extract the first balanced JSON object/array from model output.
export function extractJSON(text) {
  let t = text.trim();
  if (t.includes('```')) {
    const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) t = fenced[1].trim();
  }
  const start = t.search(/[{[]/);
  if (start === -1) throw new Error('No JSON found in model response');
  const open = t[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(t.slice(start, i + 1));
    }
  }
  throw new Error('Unbalanced JSON in model response');
}

async function callDeployedEndpoint(prompt) {
  const cfg = endpointConfig;
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

  const isOllama = /\/api\/chat\b/.test(cfg.url);
  const openAICompatible = !isOllama && /\/v1\b|chat\/completions/.test(cfg.url);
  const url = openAICompatible && !cfg.url.includes('chat/completions')
    ? `${cfg.url}/chat/completions`
    : cfg.url;

  let body;
  if (isOllama) {
    body = {
      model: cfg.modelName || 'gemma4:cloud',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.2 }
    };
  } else if (openAICompatible) {
    body = {
      model: cfg.modelName || 'default',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    };
  } else {
    body = { prompt, temperature: 0.2 };
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Endpoint error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();

  // Accept common response shapes (Ollama, OpenAI-compatible, simple REST).
  const text =
    data.message?.content ??
    data.choices?.[0]?.message?.content ??
    data.choices?.[0]?.text ??
    data.response ?? data.output ?? data.text ?? data.result ??
    (typeof data === 'string' ? data : null);
  if (text == null) throw new Error('Unrecognized response shape from deployed endpoint');
  return text;
}

// Generate a JSON response from the deployed model, with retries.
export async function generateJSON(prompt, { retries = 1 } = {}) {
  if (!isModelEndpointAvailable()) throw new Error('AI model endpoint not configured');

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const text = await callDeployedEndpoint(prompt);
      return extractJSON(text);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function testConnection() {
  try {
    const result = await generateJSON(
      'Respond with only this JSON, nothing else: {"status":"ok"}'
    );
    if (result && result.status === 'ok') {
      return { success: true, provider: getActiveProviderName() };
    }
    return { success: true, provider: getActiveProviderName(), note: 'Connected (unexpected payload)' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
