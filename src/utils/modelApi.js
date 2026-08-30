import { GoogleGenerativeAI } from '@google/generative-ai';

// Unified AI provider layer.
// Primary: a custom deployed model endpoint (your hosted model), configured in
// Settings or via REACT_APP_MODEL_API_URL. Fallback: Gemini via API key.
// Both are consumed through a single generateJSON(prompt) call.

const STORAGE_KEY = 'fyp_model_endpoint_config';

let geminiModel = null;
let endpointConfig = loadEndpointConfig();

function loadEndpointConfig() {
  try {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.url) return parsed;
    }
  } catch (e) { /* ignore corrupt config */ }

  // Default: the deployed Aristral Ollama model. API key comes from .env.local
  // (REACT_APP_MODEL_API_KEY) or is entered once in Settings.
  return {
    url: process.env.REACT_APP_MODEL_API_URL || 'https://ollama.aristral.com/api/chat',
    apiKey: process.env.REACT_APP_MODEL_API_KEY || '',
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

export function initializeGemini(apiKey) {
  try {
    if (!apiKey) throw new Error('API key is required');
    const genAI = new GoogleGenerativeAI(apiKey);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    return true;
  } catch (error) {
    console.error('Failed to initialize Gemini:', error);
    return false;
  }
}

export function isGeminiInitialized() {
  return geminiModel !== null;
}

// True when any AI provider (deployed endpoint or Gemini) is ready.
export function isAIAvailable() {
  return isModelEndpointAvailable() || isGeminiInitialized();
}

export function getActiveProviderName() {
  if (isModelEndpointAvailable()) return 'Deployed Model';
  if (isGeminiInitialized()) return 'Gemini';
  return 'None';
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

async function callGemini(prompt) {
  if (!geminiModel) throw new Error('Gemini AI not initialized');
  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

// Generate a JSON response from whichever provider is active.
// Tries the deployed endpoint first, falls back to Gemini on failure.
export async function generateJSON(prompt, { retries = 1 } = {}) {
  const providers = [];
  if (isModelEndpointAvailable()) providers.push(callDeployedEndpoint);
  if (isGeminiInitialized()) providers.push(callGemini);
  if (providers.length === 0) throw new Error('No AI provider configured');

  let lastError = null;
  for (const provider of providers) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const text = await provider(prompt);
        return extractJSON(text);
      } catch (error) {
        lastError = error;
      }
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
