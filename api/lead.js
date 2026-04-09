// api/lead.js — Vercel serverless function
// Receives form data and creates a new lead row in the Notion CRM database.

const NOTION_API = 'https://api.notion.com/v1/pages';
const NOTION_VERSION = '2022-06-28';

function richText(value) {
  return [{ text: { content: (value || '').slice(0, 2000) } }];
}

module.exports = async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token      = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!token || !databaseId) {
    console.error('[lead] Missing NOTION_TOKEN or NOTION_DATABASE_ID');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  // ── Parse & validate ──────────────────────────────────────────────────────
  const { nombre, whatsapp, email, servicio, mensaje } = req.body || {};

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  }
  if (!whatsapp || !whatsapp.trim()) {
    return res.status(400).json({ error: 'El número de WhatsApp es obligatorio.' });
  }
  if (!servicio) {
    return res.status(400).json({ error: 'El tipo de proyecto es obligatorio.' });
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // ── Build Notion page properties ─────────────────────────────────────────
  const properties = {
    Nombre: {
      title: richText(nombre.trim()),
    },
    WhatsApp: {
      rich_text: richText(whatsapp.trim()),
    },
    Sector: {
      select: { name: servicio },
    },
    Mensaje: {
      rich_text: richText((mensaje || '').trim()),
    },
    Fecha: {
      date: { start: today },
    },
    Estado: {
      select: { name: 'Nuevo' },
    },
    Prioridad: {
      select: { name: 'Media' },
    },
  };

  // Email is now required
  properties.Email = { email: email.trim() };

  const notionPayload = {
    parent:     { database_id: databaseId },
    properties,
  };

  // ── DEBUG: log exact payload ──────────────────────────────────────────────
  console.log('[lead] Sending to Notion. Database ID:', databaseId);
  console.log('[lead] Payload:', JSON.stringify(notionPayload, null, 2));

  // ── Call Notion API ───────────────────────────────────────────────────────
  try {
    const notionRes = await fetch(NOTION_API, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify(notionPayload),
    });

    const data = await notionRes.json();

    if (!notionRes.ok) {
      // Log full Notion error for debugging
      console.error('[lead] Notion HTTP status:', notionRes.status);
      console.error('[lead] Notion error code:', data.code);
      console.error('[lead] Notion error message:', data.message);
      console.error('[lead] Notion full response:', JSON.stringify(data, null, 2));

      // Return full error details temporarily for debugging
      return res.status(502).json({
        error:          'No se pudo registrar el lead en Notion.',
        notion_status:  notionRes.status,
        notion_code:    data.code    || null,
        notion_message: data.message || null,
        notion_full:    data,
        payload_sent:   notionPayload,
      });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('[lead] Fetch error:', err.message);
    return res.status(500).json({
      error:   'Error interno al contactar Notion.',
      detail:  err.message,
    });
  }
};
