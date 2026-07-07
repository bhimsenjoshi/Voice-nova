import http.server
import json
import subprocess
import os
import uuid
import re

HERMES = os.path.expanduser("~/.hermes/hermes-agent/venv/bin/hermes")
PROFILE = "nova"
PORT = 8700

# Map of session IDs to Hermes session titles
sessions = {}

class VoiceHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/voice":
            content_len = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_len))

            message = body.get("message", "").strip()
            session_id = body.get("session_id", "")

            if not message:
                self._json(400, {"error": "Message required"})
                return

            # Create or find Hermes session
            if session_id not in sessions:
                # Start a new named session
                result = subprocess.run(
                    [HERMES, "--profile", PROFILE, "chat", "-q",
                     f"[Voice session started] Hello Nova, the user is starting a voice conversation. "
                     f"This is session {session_id[:8]}. Respond warmly as Nova.",
                     "--source", "voice"],
                    capture_output=True, text=True, timeout=90,
                    env={**os.environ, "HERMES_TERMINAL": "1"}
                )
                # Grab the session ID from stderr or parse the output
                sessions[session_id] = True
                reply = self._extract_reply(result.stdout, result.stderr)
            else:
                # Continue existing session
                result = subprocess.run(
                    [HERMES, "--profile", PROFILE, "--continue", "voice",
                     "chat", "-q", message],
                    capture_output=True, text=True, timeout=90,
                    env={**os.environ, "HERMES_TERMINAL": "1"}
                )
                reply = self._extract_reply(result.stdout, result.stderr)

            self._json(200, {"reply": reply, "session_id": session_id})

        elif self.path == "/health":
            self._json(200, {"status": "ok"})
        else:
            self._json(404, {"error": "Not found"})

    def _extract_reply(self, stdout, stderr):
        """Extract Nova's reply from Hermes output."""
        # Look for content after the last "Nova:" or assistant marker
        lines = stdout.strip().split("\n")

        # Remove tool call lines (they start with ● or ─ or contain [[)
        clean_lines = []
        for line in lines:
            if line.startswith("●") or line.startswith("─") or line.startswith("│"):
                continue
            if "hermes_chat" in line or "read_file" in line or "web_search" in line:
                continue
            clean_lines.append(line)

        # Join and clean up
        text = "\n".join(clean_lines).strip()

        # Remove ANSI escape sequences
        text = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', text)
        text = re.sub(r'\x1b\][0-9;]*[^\x1b]*\x1b\\', '', text)

        # Find the assistant's response - look for text after "assistant" marker
        # or after the query line
        if not text:
            text = stdout.strip()

        # Limit length for voice responses
        if len(text) > 2000:
            text = text[:2000]

        # If still looks like raw output, try to find something meaningful
        if not text or text == message:
            text = "Hey! Nova here. Ready when you are. What's up?"

        return text

    def _json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")

if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), VoiceHandler)
    print(f"🎙️ Nova Voice Bridge running on port {PORT}")
    print(f"   Point cloudflared to http://localhost:{PORT}")
    server.serve_forever()
