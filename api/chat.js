// Vercel serverless function: same-origin proxy to the deployed Ollama model.
// The browser calls /api/chat (no CORS issue, same origin); this function
// holds the API key server-side (OLLAMA_API_KEY, no REACT_APP_ prefix so it
// never reaches the client bundle) and forwards to the real endpoint.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const upstreamUrl = process.env.OLLAMA_API_URL || 'https://ollama.aristral.com/api/chat';
  const apiKey = process.env.OLLAMA_API_KEY || '';
  const defaultModel = process.env.OLLAMA_MODEL || 'gemma4:cloud';

  const incoming = req.body || {};
  const body = {
    model: incoming.model || defaultModel,
    messages: incoming.messages || [],
    stream: false,
    options: incoming.options || { temperature: 0.2 }
  };

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const text = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (error) {
    res.status(502).json({ error: `Proxy error: ${error.message}` });
  }
};
