1|// Nova Voice — Vercel serverless API
2|// Races Hermes tunnel (real Nova) vs DeepSeek (clone) — fastest wins within 10s
3|
4|export default async function handler(req, res) {
5|  res.setHeader('Access-Control-Allow-Origin', '*');
6|  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
7|  if (req.method === 'OPTIONS') return res.status(200).end();
8|  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
9|
10|  const { message, history = [], session_id } = req.body;
11|  if (!message || !message.trim()) {
12|    return res.status(400).json({ error: 'Message is required' });
13|  }
14|
15|  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
16|  const tunnelUrl = process.env.TUNNEL_URL;
17|
18|  // Build DeepSeek request
19|  const systemPrompt = `You are Nova, a creative and versatile voice assistant. Keep responses concise for voice (2-4 sentences). No markdown. Be warm and friendly.`;
20|
21|  const messages = [{ role: 'system', content: systemPrompt }];
22|  for (const msg of (history || []).slice(-20)) {
23|    if (msg.role === 'user' || msg.role === 'assistant') {
24|      messages.push({ role: msg.role, content: msg.content });
25|    }
26|  }
27|  messages.push({ role: 'user', content: message });
28|
29|  const deepseekPromise = (async () => {
30|    const resp = await fetch('https://api.deepseek.com/chat/completions', {
31|      method: 'POST',
32|      headers: {
33|        'Content-Type': 'application/json',
34|        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
35|      },
36|      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.7, max_tokens: 1024 }),
37|    });
38|    if (!resp.ok) throw new Error(`DeepSeek ${resp.status}`);
39|    const data = await resp.json();
40|    return data.choices?.[0]?.message?.content?.trim() || "...";
41|  })();
42|
43|  // Race tunnel vs DeepSeek
44|  let reply, source;
45|  if (tunnelUrl) {
46|    const tunnelPromise = (async () => {
47|      const resp = await fetch(`${tunnelUrl}/api/chat`, {
48|        method: 'POST',
49|        headers: { 'Content-Type': 'application/json' },
50|        body: JSON.stringify({ message, history, session_id }),
51|      });
52|      if (!resp.ok) throw new Error(`Tunnel ${resp.status}`);
53|      const data = await resp.json();
54|      return data.reply;
55|    })();
56|
57|    try {
58|      const result = await Promise.race([
59|        tunnelPromise.then(r => { reply = r; source = 'tunnel'; return r; }),
60|        deepseekPromise.then(r => { reply = r; source = 'deepseek'; return r; }),
61|      ]);
62|    } catch {
63|      // If both fail, use whichever resolved
64|      try { reply = await deepseekPromise; source = 'deepseek'; }
65|      catch { return res.status(502).json({ reply: 'All backends unavailable.' }); }
66|    }
67|  } else {
68|    try { reply = await deepseekPromise; source = 'deepseek'; }
69|    catch { return res.status(502).json({ reply: 'Backend unavailable.' }); }
70|  }
71|
72|  return res.status(200).json({ reply: reply || 'Nova here! What\'s up?', session_id });
73|}
74|