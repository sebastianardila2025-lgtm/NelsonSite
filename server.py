#!/usr/bin/env python3
"""
Servidor de desarrollo con soporte HTTP Range + endpoint /api/chat.
Chrome requiere respuestas 206 Partial Content para hacer scrubbing de video.
Crear un archivo .env en la raíz con: OPENAI_API_KEY=sk-...
"""
import http.server, os, json, re, urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Load API key from .env or environment ─────────────────────────────────────
def _load_api_key():
    key = os.environ.get('OPENAI_API_KEY', '')
    if key:
        return key
    for fname in ('.env', '.env.local'):
        env_path = os.path.join(BASE_DIR, fname)
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('OPENAI_API_KEY='):
                        return line.split('=', 1)[1].strip().strip('"\'')
    return ''

# ── Load knowledge base .md files ────────────────────────────────────────────
def _load_knowledge_base():
    kb_dir = os.path.join(BASE_DIR, 'knowledge-base')
    docs = []
    if os.path.isdir(kb_dir):
        for fname in os.listdir(kb_dir):
            if fname.endswith('.md'):
                with open(os.path.join(kb_dir, fname), encoding='utf-8') as f:
                    docs.append({'name': fname.replace('.md', ''), 'content': f.read().strip()})
    return docs

# ── Score relevance and return top context string ─────────────────────────────
def _get_context(docs, message):
    msg = message.lower()
    def score(doc):
        s = 0
        for w in msg.split():
            if len(w) > 3 and w in doc['content'].lower():
                s += 1
        return s
    docs_sorted = sorted(docs, key=score, reverse=True)
    return '\n\n---\n\n'.join(f"### {d['name']}\n{d['content']}" for d in docs_sorted[:3])

# ── Detect lead/contact intent ────────────────────────────────────────────────
def _has_lead_intent(message):
    return bool(re.search(
        r'cotiz|presupuesto|precio|costo|contratar|whatsapp|llamar|urgente|quiero contratar|necesito un|agendar',
        message, re.I))

# ── Build system prompt ───────────────────────────────────────────────────────
def _build_system_prompt(name, lead_name, context):
    lead_line = f'\n- El usuario se llama {lead_name}. Úsalo de forma natural cuando sea apropiado.' if lead_name else ''
    return f"""Eres {name}, el asistente virtual de VoltGrid Ingeniería, empresa colombiana especializada en certificación RETIE, instalaciones eléctricas, asesorías técnicas y energía solar fotovoltaica.

IDENTIDAD:
- Tu nombre es {name}. Si alguien te pregunta cómo te llamas, responde con tu nombre de forma breve y natural.
- Mantén tu nombre consistente durante toda la conversación.

PERSONALIDAD Y TONO:
- Profesional, cálido, elegante y orientado al cliente
- Conciso pero completo; amplía solo si el usuario lo pide
- Varía tus aperturas y cierres — nunca repitas las mismas frases exactas
- Usa frases de marca ocasionalmente: "VoltGrid te ayuda", "Energía clara para decisiones seguras"
- Responde siempre en español colombiano formal pero cercano{lead_line}

REGLAS ESTRICTAS:
- Responde SOLO con información de la base de conocimiento
- NUNCA inventes precios, plazos, garantías o datos técnicos
- Si no tienes información suficiente, dilo claramente y ofrece contacto humano

BASE DE CONOCIMIENTO:
---
{context}
---"""

class RangeHandler(http.server.SimpleHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/chat':
            self._handle_chat()
        else:
            self.send_error(404, 'Not found')

    def _handle_chat(self):
        # Parse request body
        length = int(self.headers.get('Content-Length', 0))
        body   = json.loads(self.rfile.read(length) or b'{}')

        message        = (body.get('message') or '').strip()
        lead_name      = body.get('leadName') or ''
        assistant_name = body.get('assistantName') or 'Carlos'

        if not message:
            self._json({'error': 'Missing message'}, 400)
            return

        api_key     = _load_api_key()
        docs        = _load_knowledge_base()
        context     = _get_context(docs, message)
        lead_intent = _has_lead_intent(message)

        if not api_key:
            print('[VoltGrid AI] ⚠️  Sin OPENAI_API_KEY — crea un archivo .env con OPENAI_API_KEY=sk-...')
            self._json({'reply': 'En este momento no puedo responder. Por favor contáctanos por WhatsApp.', 'leadIntent': False})
            return

        system_prompt = _build_system_prompt(assistant_name, lead_name, context)
        payload = json.dumps({
            'model': 'gpt-4o-mini',
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user',   'content': message},
            ],
            'max_tokens': 340,
            'temperature': 0.72,
        }).encode('utf-8')

        req = urllib.request.Request(
            'https://api.openai.com/v1/chat/completions',
            data=payload,
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data  = json.loads(r.read())
            reply = data['choices'][0]['message']['content'].strip()
        except Exception as e:
            print(f'[VoltGrid AI] Error OpenAI: {e}')
            reply = 'En este momento no puedo procesar tu consulta. Contáctanos directamente por WhatsApp.'

        self._json({'reply': reply, 'leadIntent': lead_intent})

    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type',   'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._serve(head=False)

    def do_HEAD(self):
        self._serve(head=True)

    def _serve(self, head=False):
        path = self.translate_path(self.path.split("?")[0])

        if os.path.isdir(path):
            super().do_GET()
            return

        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return

        size  = os.path.getsize(path)
        ctype = self.guess_type(path)

        start, end = 0, size - 1
        partial = False
        rng = self.headers.get("Range", "")
        if rng.startswith("bytes="):
            partial = True
            parts = rng[6:].split("-")
            start = int(parts[0]) if parts[0] else 0
            end   = int(parts[1]) if len(parts) > 1 and parts[1] else size - 1
            end   = min(end, size - 1)

        length = end - start + 1

        if partial:
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)

        self.send_header("Content-Type",   ctype)
        self.send_header("Accept-Ranges",  "bytes")
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control",  "no-store, no-cache")
        self.end_headers()

        if not head:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)
        f.close()

    def log_message(self, format, *args):
        pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.test(HandlerClass=RangeHandler, port=3000, bind="")
