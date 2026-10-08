import assert from 'node:assert/strict';
import handler, { normalizeStored } from '../api/partners.js';

const store = new Map();

global.fetch = async (_url, opts) => {
  const args = JSON.parse(opts.body);
  const [cmd, key, value] = args;
  if (cmd === 'GET') return { json: async () => ({ result: store.has(key) ? store.get(key) : null }) };
  if (cmd === 'SET') {
    store.set(key, value);
    return { json: async () => ({ result: 'OK' }) };
  }
  return { json: async () => ({ error: 'bad command' }) };
};

process.env.KV_REST_API_URL = 'https://example.test';
process.env.KV_REST_API_TOKEN = 'token';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

const seed = { id: 'c1', sno: 1, firm: 'JET', status: 'Onboard' };
const created = { id: 'c99', sno: 24, firm: 'New Partner Firm', status: 'Lead' };

assert.deepEqual(normalizeStored([created]), { version: 1, partners: [created] });
assert.equal(normalizeStored({ version: 2, partners: [seed, created] }).version, 2);

store.set('infurnia-partners-extra', JSON.stringify([created]));
let res = mockRes();
await handler({ method: 'GET' }, res);
assert.equal(res.statusCode, 200);
assert.equal(res.body.version, 1);
assert.equal(res.body.partners.length, 1);
assert.equal(res.body.partners[0].id, 'c99');

const updated = { ...seed, status: 'Demo Trial', firm: 'JET updated' };
res = mockRes();
await handler({
  method: 'PUT',
  body: { version: 2, partners: [updated, created] },
}, res);
assert.equal(res.statusCode, 200);
assert.equal(res.body.count, 2);

res = mockRes();
await handler({ method: 'GET' }, res);
assert.equal(res.body.version, 2);
assert.equal(res.body.partners[0].firm, 'JET updated');
assert.equal(res.body.partners[1].id, 'c99');

res = mockRes();
await handler({ method: 'PUT', body: [created] }, res);
assert.equal(res.statusCode, 409);

res = mockRes();
await handler({ method: 'GET' }, res);
assert.equal(res.body.partners.length, 2);
assert.equal(res.body.partners[0].status, 'Demo Trial');

res = mockRes();
await handler({
  method: 'PUT',
  body: { version: 2, partners: [updated] },
}, res);
assert.equal(res.statusCode, 200);

res = mockRes();
await handler({ method: 'GET' }, res);
assert.equal(res.body.partners.length, 1);
assert.equal(res.body.partners[0].id, 'c1');

console.log('partners storage tests passed');
