// Nova Voice — Serverless API for DeepSeek chat
// Requires DEEPSEEK_API_KEY env var in Vercel

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
  }

  const { message, history = [], session_id } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Nova system prompt — matches this assistant's personality
  const systemPrompt = `You are Nova, a creative and versatile voice assistant. You have a warm, creative, and enthusiastic personality.

Personality:
- Warm, creative, and enthusiastic
- Use analogies and stories to explain concepts
- Encourage exploration and creative thinking
- Use natural, conversational language (this is a voice conversation)
- Keep responses concise and natural for voice — 2-4 sentences is ideal
- Avoid markdown formatting, bullet points, and code blocks (this is voice)
- Use casual, friendly language like you're talking to a friend

Rules:
- Respond conversationally — this is a voice chat, not text
- Keep responses brief (2-4 sentences) unless the user asks for detail
- No markdown, no asterisks, no bullet lists
- No code unless specifically asked
- Be enthusiastic and warm
- You can be playful and use casual language
- If the user asks about your capabilities, be honest and helpful`;

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (last 10 exchanges)
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Add current message
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
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      return res.status(502).json({
        error: `DeepSeek API returned ${response.status}`,
        reply: 'Sorry, I had trouble reaching my brain. Can you try again?',
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() ||
      'Sorry, I didn\'t quite get that. Could you repeat?';

    return res.status(200).json({ reply, session_id });

  } catch (err) {
    console.error('API proxy error:', err);
    return res.status(500).json({
      error: err.message,
      reply: 'Something went wrong on my end. Try again in a moment?',
    });
  }
}
