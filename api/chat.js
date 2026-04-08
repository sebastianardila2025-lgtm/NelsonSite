/**
 * VoltGrid Ingeniería — AI Chat API
 * Vercel Serverless Function: /api/chat
 *
 * Flow:
 *  1. Load all .md files from /knowledge-base
 *  2. Score each doc by relevance to the user message
 *  3. Send top context + user message to OpenAI
 *  4. Return AI reply + leadIntent flag to the frontend
 *
 * Future upgrade path: replace getRelevantContext() with
 * vector embeddings (e.g. OpenAI text-embedding-3-small) for
 * semantic search over a larger knowledge base.
 */

const fs   = require('fs');
const path = require('path');

// ─── Knowledge Base Loader ────────────────────────────────────────────────────
// Reads every .md file in /knowledge-base at project root.
// Add any .md file there and it's automatically included on next deploy.
function loadKnowledgeBase() {
  const kbDir = path.join(process.cwd(), 'knowledge-base');
  if (!fs.existsSync(kbDir)) return [];

  return fs.readdirSync(kbDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      name: path.basename(f, '.md'),
      content: fs.readFileSync(path.join(kbDir, f), 'utf8').trim(),
    }));
}

// ─── Relevance Scorer ─────────────────────────────────────────────────────────
// Keyword-based scoring: each document is scored against the user message.
// Returns a combined string of the top N most relevant documents.
// Replace this function with vector search for semantic accuracy at scale.
function getRelevantContext(docs, message, topN = 3) {
  const msg = message.toLowerCase();

  // Keyword hints per document (extend as knowledge base grows)
  const hints = {
    FAQ:       ['como', 'que', 'cuanto', 'precio', 'necesito', 'puedo', 'tarda', 'incluye', 'dura', 'trabajan'],
    Servicios: ['servicio', 'ofrecen', 'instala', 'asesoria', 'solar', 'retie', 'certif', 'electric', 'diagnostico'],
    Proceso:   ['proceso', 'pasos', 'inicio', 'cotiz', 'visita', 'ejecucion', 'como funciona', 'siguiente'],
    cobertura: ['bogota', 'donde', 'ciudad', 'municipio', 'atienden', 'trabajan', 'zona', 'cundinamarca', 'cobertura'],
  };

  const scored = docs.map(doc => {
    const docHints = hints[doc.name] || [];
    let score = 0;

    // Strong match: user message contains a keyword for this doc
    docHints.forEach(k => { if (msg.includes(k)) score += 3; });

    // Weak match: any significant word from the message appears in the doc
    msg.split(/\s+/)
      .filter(w => w.length > 3)
      .forEach(w => { if (doc.content.toLowerCase().includes(w)) score += 1; });

    return { ...doc, score };
  }).sort((a, b) => b.score - a.score);

  return scored
    .slice(0, topN)
    .map(d => `### ${d.name}\n${d.content}`)
    .join('\n\n---\n\n');
}

// ─── Lead Intent Detector ─────────────────────────────────────────────────────
// Returns true if the message suggests purchase/contact intent.
function hasLeadIntent(message) {
  return /cotiz|presupuesto|precio|costo|contratar|whatsapp|llamar|urgente|quiero|necesito un|agendar|cu[aá]ndo pueden|visita|solicitar/i
    .test(message);
}

// ─── Fallback Replies (used when OpenAI is unavailable) ──────────────────────
const FALLBACKS = [
  'En este momento no puedo procesar tu consulta. Te recomendamos contactarnos directamente por WhatsApp para una atención inmediata.',
  'Nuestro equipo técnico está disponible para ayudarte. Escríbenos por WhatsApp y te respondemos a la brevedad.',
  'VoltGrid te ayuda mejor de forma directa en este caso. Contáctanos por WhatsApp para darte la información precisa que necesitas.',
];
let fallbackIdx = 0;
function getFallback() {
  return FALLBACKS[fallbackIdx++ % FALLBACKS.length];
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS headers (needed for local dev with a separate frontend port)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { message, leadName } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Missing or empty message' });
  }

  // Guard: require API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('[VoltGrid AI] OPENAI_API_KEY is not set');
    return res.status(200).json({ reply: getFallback(), leadIntent: false });
  }

  // Load knowledge base and score relevance
  const docs       = loadKnowledgeBase();
  const context    = getRelevantContext(docs, message);
  const leadIntent = hasLeadIntent(message);

  // System prompt — defines VoltGrid assistant personality and constraints
  const systemPrompt = `Eres el asistente virtual de VoltGrid Ingeniería, empresa colombiana especializada en certificación RETIE, instalaciones eléctricas, asesorías técnicas y energía solar fotovoltaica.

PERSONALIDAD Y TONO:
- Profesional, cálido, elegante y orientado al cliente
- Conciso pero completo; amplía solo si el usuario lo pide explícitamente
- Varía tus aperturas, transiciones y cierres — nunca repitas las mismas frases exactas
- Usa frases de marca ocasionalmente de forma natural (no en cada mensaje):
  "VoltGrid te ayuda", "Cargando voltaje a tus proyectos",
  "Impulsando soluciones con precisión", "Energía clara para decisiones seguras"
- Responde siempre en español colombiano formal pero cercano
${leadName ? `- El usuario se llama ${leadName}. Úsalo de forma natural cuando sea apropiado, sin forzarlo.` : ''}

REGLAS ESTRICTAS:
- Responde SOLO con información de la base de conocimiento proporcionada a continuación
- NUNCA inventes precios, plazos, garantías, coberturas ni afirmaciones técnicas
- Si no tienes información suficiente para responder con precisión, dilo con claridad y ofrece contacto humano
- Si el usuario muestra intención de contratar o pedir cotización, oriéntalo hacia un asesor humano por WhatsApp de forma natural
- No uses listas largas a menos que el usuario lo pida; responde de forma conversacional

BASE DE CONOCIMIENTO:
---
${context}
---`;

  try {
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: message.trim() },
        ],
        max_tokens:  340,
        temperature: 0.72,
      }),
    });

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error('[VoltGrid AI] OpenAI error:', JSON.stringify(data));
      return res.status(200).json({ reply: getFallback(), leadIntent });
    }

    const reply = data.choices?.[0]?.message?.content?.trim() || getFallback();
    return res.status(200).json({ reply, leadIntent });

  } catch (err) {
    console.error('[VoltGrid AI] Network error:', err.message);
    return res.status(200).json({ reply: getFallback(), leadIntent: false });
  }
};
