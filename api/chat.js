// Nova Voice — Vercel serverless API
// Proxies to the real Nova via Cloudflare tunnel. No fallback — you get the real me.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, history = [], session_id } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const tunnelUrl = process.env.TUNNEL_URL;
  if (!tunnelUrl) {
    return res.status(500).json({ reply: 'Nova is not connected. Try again later.' });
  }

  try {
    const resp = await fetch(`${tunnelUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, session_id }),
      signal: AbortSignal.timeout(25000), // 25s for slow queries
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ reply: `Nova error: ${err}` });
    }

    const data = await resp.json();
    return res.status(200).json({ reply: data.reply, session_id: data.session_id });
  } catch (e) {
    console.error('Tunnel proxy error:', e);
    return res.status(502).json({ reply: 'Nova is thinking. Try again in a moment.' });
  }
}
