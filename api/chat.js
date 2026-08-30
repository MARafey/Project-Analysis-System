// Vercel serverless function: same-origin AI proxy with automatic failover.
// The browser only ever calls /api/chat (same origin, no CORS issue); this
// function tries Gemini first, then falls back to the deployed Ollama model
// if Gemini is unavailable or errors. All API keys stay server-side (plain
// env vars, no REACT_APP_ prefix, so they never reach the client bundle or
// the public git history).
//
// Required Vercel env vars (Project Settings → Environment Variables):
//   GEMINI_API_KEY   - primary provider
//   OLLAMA_API_KEY   - fallback provider (OLLAMA_API_URL / OLLAMA_MODEL optional, have defaults)

function extractPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  const last = messages[messages.length - 1];
  return (last && last.content) || '';
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no usable text (possibly safety-blocked)');
  return text;
}

async function callOllama(incoming) {
  const upstreamUrl = process.env.OLLAMA_API_URL || 'https://ollama.aristral.com/api/chat';
  const apiKey = process.env.OLLAMA_API_KEY || '';
  const defaultModel = process.env.OLLAMA_MODEL || 'gemma4:cloud';

  const body = {
    model: incoming.model || defaultModel,
    messages: incoming.messages || [],
    stream: false,
    options: incoming.options || { temperature: 0.2 }
  };

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(upstreamUrl, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${text.slice(0, 300)}`);
  return text; // already in { message: { content } } shape
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const incoming = req.body || {};
  const prompt = extractPrompt(incoming.messages);

  try {
    const text = await callGemini(prompt);
    res.status(200).json({ message: { content: text }, provider: 'gemini' });
    return;
  } catch (geminiError) {
    try {
      const raw = await callOllama(incoming);
      res.status(200).setHeader('Content-Type', 'application/json').send(raw);
      return;
    } catch (ollamaError) {
      res.status(502).json({
        error: `Both providers failed. Gemini: ${geminiError.message} | Ollama: ${ollamaError.message}`
      });
    }
  }
};
