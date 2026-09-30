/** Vercel serverless: GET/PUT extra partners (24+) as JSON in Vercel KV (Upstash). */
const KEY = 'infurnia-partners-extra';

function kvReady() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function redis(...args) {
  const res = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function storageHeader(res) {
  res.setHeader('X-Storage', kvReady() ? 'vercel-kv' : 'none');
}

export default async function handler(req, res) {
  storageHeader(res);

  if (req.method === 'GET') {
    if (!kvReady()) return res.status(200).json([]);
    try {
      const raw = await redis('GET', KEY);
      if (!raw) return res.status(200).json([]);
      const parsed = JSON.parse(raw);
      return res.status(200).json(Array.isArray(parsed) ? parsed : []);
    } catch {
      return res.status(200).json([]);
    }
  }

  if (req.method === 'PUT') {
    if (!kvReady()) {
      return res.status(503).json({
        error: 'Server storage not configured. Link Vercel KV to this project (see README).',
      });
    }
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }
    if (!Array.isArray(body)) return res.status(400).json({ error: 'Body must be a JSON array' });
    await redis('SET', KEY, JSON.stringify(body));
    return res.status(200).json({ ok: true, count: body.length });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Use GET or PUT' });
}
