'use strict';

const { createServer, maxBody } = require('../server.cjs');
const { isAppUrl } = require('./security.cjs');

async function readBody(request, limit = maxBody) {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw Object.assign(new Error('Request body too large'), { status: 413 });
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, size);
  } finally {
    reader.releaseLock();
  }
}

async function startLocalService(dataDir) {
  const server = createServer({ dataDir, port: 0 });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let stopped = false;
  return {
    origin,
    async forward(request, fetcher) {
      if (stopped) return new Response('Local service is closed', { status: 503 });
      if (!isAppUrl(request.url))
        return new Response('Unknown application origin', { status: 403 });
      if (!['GET', 'POST'].includes(request.method))
        return new Response('Method not allowed', { status: 405 });
      try {
        const url = new URL(request.url);
        const headers = new Headers(request.headers);
        headers.delete('host');
        headers.delete('cookie');
        headers.set('origin', origin);
        headers.set('sec-fetch-site', 'same-origin');
        const body = request.method === 'GET' ? undefined : await readBody(request);
        return await fetcher(origin + url.pathname + url.search, {
          method: request.method,
          headers,
          body,
          redirect: 'error',
        });
      } catch (error) {
        return new Response(
          error.status === 413 ? 'Request body too large' : 'Local request failed',
          { status: error.status || 502 },
        );
      }
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

module.exports = { startLocalService, readBody };
