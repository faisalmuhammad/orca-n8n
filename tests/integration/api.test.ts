import { createServer } from 'node:http';
import { assert, test } from 'orca/testing';
import { apiTransport } from '../../src/worker/N8nClient';
test('HTTP transport sends the API key only to the configured loopback origin and refuses redirects', async () => {
  const requests: { path: string; key?: string; method?: string }[] = [];
  const server = createServer((req, res) => {
    requests.push({ path: req.url ?? '', key: req.headers['x-n8n-api-key'] as string | undefined, method: req.method });
    if (req.url?.includes('redirect')) { res.writeHead(302, { Location: 'http://169.254.169.254/' }); res.end(); }
    else if (req.url?.includes('denied')) { res.writeHead(403); res.end('private diagnostic payload'); }
    else { res.setHeader('Content-Type', 'application/json'); res.end('{"data":[]}'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No server address');
  const connection = { baseUrl: 'http://localhost:' + address.port + '/', connectionKind: 'local' as const };
  try {
    assert.deepEqual(await apiTransport(connection, 'private-key', 'api/v1/workflows', { limit: '25' }, new AbortController().signal), { data: [] });
    assert.deepEqual(requests[0], { path: '/api/v1/workflows?limit=25', key: 'private-key', method: 'GET' });
    await assert.rejects(() => apiTransport(connection, 'private-key', 'redirect', {}, new AbortController().signal), /redirected/);
    await assert.rejects(() => apiTransport(connection, 'private-key', 'denied', {}, new AbortController().signal), /denied API access/);
    assert.equal(requests.length, 3);
  } finally { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }); }
});
