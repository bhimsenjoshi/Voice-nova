// Nova Voice - Vercel serverless API
// Races Hermes tunnel (real Nova) vs DeepSeek (clone) -- fastest wins within 10s

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, history = [], session_id } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  const tunnelUrl = process.env.TUNNEL_URL;

  // Build DeepSeek request (fallback)
  const systemPrompt = `You are Nova, a creative and versatile voice assistant. Keep responses concise for voice (2-4 sentences). No markdown. Be warm and friendly.`;

  const messages = [{ role: 'system', content: systemPrompt }];
  for (const msg of (history || []).slice(-20)) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: message });

  const deepseekPromise = (async () => {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.7, max_tokens: 1024 }),
    });
    if (!resp.ok) throw new Error(`DeepSeek ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || "...";
  })();

  // Race tunnel vs DeepSeek
  let reply;
  if (tunnelUrl) {
    const tunnelPromise = (async () => {
      const resp = await fetch(`${tunnelUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, session_id }),
      });
      if (!resp.ok) throw new Error(`Tunnel ${resp.status}`);
      const data = await resp.json();
      return data.reply;
    })();

    try {
      reply = await Promise.race([tunnelPromise, deepseekPromise]);
    } catch {
      try { reply = await deepseekPromise; }
      catch { return res.status(502).json({ reply: 'All backends unavailable.' }); }
    }
  } else {
    try { reply = await deepseekPromise; }
    catch { return res.status(502).json({ reply: 'Backend unavailable.' }); }
  }

  return res.status(200).json({ reply: reply || 'Nova here!', session_id });
}
