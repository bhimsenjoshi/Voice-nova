// Nova Voice — Vercel serverless API
// First tries Hermes tunnel (real Nova), falls back to DeepSeek (clone)
// TUNNEL_URL env var points to the cloudflared tunnel on the VM

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, history = [], session_id } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Try Hermes tunnel first (the real Nova with memory & tools)
  const tunnelUrl = process.env.TUNNEL_URL;
  if (tunnelUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s for tunnel

      const tunnelResp = await fetch(`${tunnelUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, session_id }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (tunnelResp.ok) {
        const data = await tunnelResp.json();
        return res.status(200).json({ reply: data.reply, session_id: data.session_id || '' });
      }
      console.log('Tunnel returned non-ok:', tunnelResp.status);
    } catch (err) {
      console.log('Tunnel unavailable, falling back to DeepSeek:', err.message);
    }
  }

  // Fallback: direct DeepSeek API
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'No API backend available' });
  }

  const systemPrompt = `You are Nova, a creative and versatile voice assistant. You have a warm, creative, and enthusiastic personality.

Keep responses concise and natural for voice — 2-4 sentences is ideal.
Avoid markdown formatting, bullet points, and code blocks (this is voice).
Use casual, friendly language like you're talking to a friend.
Be enthusiastic and warm.`;

  const messages = [{ role: 'system', content: systemPrompt }];
  for (const msg of (history || []).slice(-20)) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ reply: 'Sorry, I had trouble reaching my brain. Try again?' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I didn't quite get that. Could you repeat?";

    return res.status(200).json({ reply, session_id });
  } catch (err) {
    console.error('DeepSeek error:', err);
    return res.status(500).json({ reply: 'Something went wrong. Try again in a moment?' });
  }
}
