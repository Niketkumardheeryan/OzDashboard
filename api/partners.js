/** Vercel serverless: GET/PUT the full partner list as JSON in Vercel KV (Upstash).
 *  version 1 = legacy array of partners 24+ only.
 *  version 2 = full snapshot (creates, updates, and deletes).
 *  A partial write must not replace a full snapshot.
 */
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

export function normalizeStored(parsed) {
  if (Array.isArray(parsed)) return { version: 1, partners: parsed };
  if (parsed && Array.isArray(parsed.partners)) {
    return { version: Number(parsed.version) || 1, partners: parsed.partners };
  }
  return null;
}

function parseBody(body) {
  let value = body;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return { error: 'Invalid JSON' }; }
  }
  if (Array.isArray(value)) return { version: 1, partners: value };
  if (value && Array.isArray(value.partners)) {
    return { version: Number(value.version) || 2, partners: value.partners };
  }
  return { error: 'Body must be a partner list' };
}

export default async function handler(req, res) {
  storageHeader(res);

  if (req.method === 'GET') {
    if (!kvReady()) {
      return res.status(200).json({ storage: 'none', version: 1, partners: [] });
    }
    try {
      const raw = await redis('GET', KEY);
      if (!raw) return res.status(200).json({ storage: 'vercel-kv', version: 1, partners: [] });
      const stored = normalizeStored(JSON.parse(raw));
      if (!stored) return res.status(200).json({ storage: 'vercel-kv', version: 1, partners: [] });
      return res.status(200).json({
        storage: 'vercel-kv',
        version: stored.version,
        partners: stored.partners,
      });
    } catch {
      return res.status(500).json({ error: 'Could not read partner storage' });
    }
  }

  if (req.method === 'PUT') {
    if (!kvReady()) {
      return res.status(503).json({
        error: 'Server storage not configured. Link Vercel KV to this project (see README).',
      });
    }
    const incoming = parseBody(req.body);
    if (incoming.error) return res.status(400).json({ error: incoming.error });

    if (incoming.version < 2) {
      try {
        const raw = await redis('GET', KEY);
        const existing = raw ? normalizeStored(JSON.parse(raw)) : null;
        if (existing && existing.version >= 2) {
          return res.status(409).json({
            error: 'Refusing to replace the saved partner list with a partial update',
          });
        }
      } catch {
        return res.status(500).json({ error: 'Could not read partner storage' });
      }
    }

    const record = { version: incoming.version, partners: incoming.partners };
    await redis('SET', KEY, JSON.stringify(record));
    return res.status(200).json({ ok: true, version: record.version, count: record.partners.length });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Use GET or PUT' });
}
