# Nova Voice 🚀🎙️

Voice-first AI assistant — PWA that uses browser Speech Recognition + Synthesis to have natural conversations with Nova (powered by DeepSeek).

## How it works

1. **Tap the mic** (or enable Auto mode) — browser listens via Web Speech API
2. **Nova thinks** — text is sent to DeepSeek via a Vercel serverless function
3. **Nova speaks back** — the reply is read aloud using browser speech synthesis (free, no API cost)
4. **Auto mode** — keeps listening after Nova finishes speaking for hands-free back-and-forth

## Deploy

1. Push to GitHub
2. Import in Vercel
3. Add `DEEPSEEK_API_KEY` as environment variable
4. Done!

## Tech

- Vanilla JS + HTML/CSS — no framework needed
- Web Speech API — STT (SpeechRecognition) + TTS (SpeechSynthesis)
- DeepSeek API — LLM backend
- Vercel serverless functions — API proxy
- PWA — install on phone home screen
