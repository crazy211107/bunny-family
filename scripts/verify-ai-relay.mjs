import assert from 'node:assert/strict';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createRelay, upstreamConfig, validatePayload } from '../server/ai-relay.mjs';

// Every upstream request in this suite stays on loopback and uses fixed fake credentials.
const TOKEN = 'local-verification-token-123456789';
const KEY = 'fake-provider-secret-never-return';
const servers = [];
const seen = [];
let abortedUpstreams = 0;
let delayedUpstreamStarted = 0;
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
async function listen(server) {
  servers.push(server);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return 'http://127.0.0.1:' + server.address().port;
}
function body(content = 'hello', extra = {}) { return { messages: [{ role: 'user', content }], ...extra }; }
async function post(url, payload, token = TOKEN, extra = {}) {
  return fetch(url + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, ...extra.headers }, body: typeof payload === 'string' ? payload : JSON.stringify(payload), signal: extra.signal });
}
async function waitFor(test, description) {
  for (let count = 0; count < 80; count++) { if (test()) return; await delay(10); }
  assert.fail('Timed out waiting for ' + description);
}

try {
  const fake = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      seen.push({ data, authorization: req.headers.authorization, path: req.url });
      const command = typeof data.messages[0].content === 'string' ? data.messages[0].content : 'image';
      res.once('close', () => { if (!res.writableEnded) abortedUpstreams++; });
      if (command === 'upstream-error') { res.writeHead(401, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: KEY + ' private upstream detail' } })); return; }
      if (command === 'json-error') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ error: { message: KEY } })); return; }
      if (command === 'invalid-json') { res.setHeader('content-type', 'application/json'); res.end('private invalid response ' + KEY); return; }
      if (command === 'redirect') { res.writeHead(302, { location: 'https://untrusted.invalid/' }); res.end(); return; }
      if (command === 'delay') { delayedUpstreamStarted++; await delay(400); if (res.destroyed) return; }
      if (data.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: {"choices":[{"delta":{"content":"豆"}}]}\n\n');
        if (command === 'abort-stream') { delayedUpstreamStarted++; await delay(400); if (res.destroyed) return; }
        else await delay(45);
        res.write('data: {"choices":[{"delta":{"content":"米"}}]}\n\n');
        res.end('data: [DONE]\n\n');
      } else {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ id: 'fake-completion', model: data.model, choices: [{ message: { role: 'assistant', content: '豆米与豆糕的小故事' } }] }));
      }
    } catch { if (!res.destroyed) res.end(); }
  });
  const upstream = await listen(fake);
  const options = { apiKey: KEY, relayToken: TOKEN, baseUrl: upstream + '/v1', model: 'configured-test-model', allowInsecureLocalForTests: true, rateLimit: 100, timeoutMs: 1500 };
  const relay = await listen(createRelay(options));

  assert.throws(() => createRelay({ ...options, allowInsecureLocalForTests: false }), /HTTPS/); checks++;
  assert.throws(() => createRelay({ ...options, baseUrl: 'http://example.com', allowInsecureLocalForTests: true }), /HTTPS/); checks++;
  assert.throws(() => createRelay({ ...options, baseUrl: 'https://name:secret@example.com' }), /credentials/); checks++;
  assert.throws(() => createRelay({ ...options, relayToken: 'short' }), /24 to 256/); checks++;
  check(upstreamConfig({ ...options, baseUrl: 'https://api.deepseek.com/' }).url === 'https://api.deepseek.com/chat/completions', 'fixed provider path');
  check(upstreamConfig({ ...options, baseUrl: 'https://api.deepseek.com' }).reasoningEffort === 'none' && upstreamConfig(options).reasoningEffort === undefined, 'DeepSeek disables thinking without altering other providers');
  const health = await (await fetch(relay + '/health')).json();
  check(JSON.stringify(health) === JSON.stringify({ ok: true, model: 'configured-test-model' }), 'minimal health response');
  check((await post(relay, body(), '')).status === 401, 'missing access token');
  check((await post(relay, body(), 'wrong-token')).status === 401, 'incorrect access token');
  check((await fetch(relay + '/v1/chat/completions')).status === 405, 'method restriction');
  check((await post(relay, body(), TOKEN, { headers: { 'content-type': 'text/plain' } })).status === 415, 'JSON content-type required');
  check((await post(relay, '{malformed')).status === 400, 'malformed JSON rejected');
  check((await post(relay, body('x', { model: 'client-controlled-model' }))).status === 400, 'client model rejected');
  check((await post(relay, body('x', { baseUrl: 'https://untrusted.invalid' }))).status === 400, 'client upstream URL rejected');
  check((await post(relay, { messages: Array.from({ length: 33 }, () => ({ role: 'user', content: 'x' })) })).status === 400, 'message count limit');
  check((await post(relay, { messages: [{ role: 'tool', content: 'x' }] })).status === 400, 'unknown role rejected');
  check((await post(relay, { messages: [{ role: 'user', content: { text: 'x' } }] })).status === 400, 'content object rejected');
  check((await post(relay, body('x'.repeat(60001)))).status === 400, 'aggregate text limit');
  check((await post(relay, { messages: [{ role: 'user', content: 'x'.repeat(40000) }, { role: 'assistant', content: 'y'.repeat(20001) }] })).status === 400, 'text limit spans all messages');
  check((await post(relay, body('x'.repeat(270000)))).status === 413, '256 KB complete body limit');
  check((await post(relay, body('x', { max_tokens: 511 }))).status === 400, 'minimum output token limit');
  check((await post(relay, body('x', { max_tokens: 4097 }))).status === 400, 'maximum output token limit');
  check((await post(relay, body('x', { temperature: 2.1 }))).status === 400, 'temperature limit');
  check((await post(relay, body('x', { stream: 'true' }))).status === 400, 'stream boolean validation');

  const image = 'data:image/png;base64,' + Buffer.from('fixed-fake-image-data').toString('base64');
  const imageParts = [{ type: 'text', text: '整理这张兔兔照片的日记草稿' }, { type: 'image_url', image_url: { url: image } }];
  let response = await post(relay, body(imageParts, { max_tokens: 512 }));
  check(response.status === 200, 'one text plus one local base64 image accepted');
  await response.text();
  check(seen.at(-1).data.messages[0].content[1].image_url.url === image, 'local image content preserved');
  check((await post(relay, body([{ type: 'text', text: 'x' }, { type: 'image_url', image_url: { url: 'https://untrusted.invalid/image.png' } }]))).status === 400, 'remote image URLs rejected');
  check((await post(relay, body([{ type: 'text', text: 'x' }, { type: 'image_url', image_url: { url: 'data:image/svg+xml;base64,PHN2Zz4=' } }]))).status === 400, 'unsupported image media type rejected');
  check((await post(relay, body([{ type: 'text', text: 'x' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,' + 'A'.repeat(180000) } }]))).status === 400, 'image string size limit');
  check((await post(relay, body([{ type: 'image_url', image_url: { url: image } }]))).status === 400, 'image without text rejected');
  check((await post(relay, body([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]))).status === 400, 'two text parts rejected');
  check((await post(relay, body([{ type: 'text', text: 'a' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }]))).status === 400, 'invalid base64 rejected');

  response = await post(relay, body('hello', { stream: false, max_tokens: 4096, temperature: 0 }));
  const completion = await response.json();
  check(response.status === 200 && completion.choices[0].message.content.includes('豆米'), 'non-streaming completion');
  check(seen.at(-1).authorization === 'Bearer ' + KEY && seen.at(-1).data.model === 'configured-test-model' && seen.at(-1).path === '/v1/chat/completions', 'server controls upstream key, model, and endpoint');
  response = await post(relay, body('hello', { stream: true }));
  check(response.headers.get('content-type').includes('text/event-stream'), 'stream response content type');
  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  const firstText = new TextDecoder().decode(firstChunk.value);
  check(firstText.includes('豆') && !firstText.includes('[DONE]'), 'first SSE chunk arrives before completion');
  let stream = firstText;
  while (true) { const part = await reader.read(); if (part.done) break; stream += new TextDecoder().decode(part.value); }
  check(stream.includes('米') && stream.endsWith('data: [DONE]\n\n'), 'SSE chunks forwarded unchanged');

  for (const command of ['upstream-error', 'json-error', 'invalid-json', 'redirect']) {
    response = await post(relay, body(command));
    const error = await response.text();
    check(response.status === 502 && !error.includes(KEY) && !error.includes('private'), command + ' detail redacted');
  }
  const timeoutRelay = await listen(createRelay({ ...options, timeoutMs: 60 }));
  response = await post(timeoutRelay, body('delay'));
  check(response.status === 504 && (await response.json()).error.code === 'upstream_timeout', 'upstream timeout is a fixed safe response');
  const abortsBefore = abortedUpstreams;
  const cancel = new AbortController();
  const abortedResponse = await post(relay, body('abort-stream', { stream: true }), TOKEN, { signal: cancel.signal });
  await abortedResponse.body.getReader().read();
  cancel.abort();
  await waitFor(() => abortedUpstreams > abortsBefore, 'client disconnect aborts upstream');
  check(abortedUpstreams > abortsBefore, 'upstream aborted on client disconnect');

  const limited = await listen(createRelay({ ...options, rateLimit: 1 }));
  response = await post(limited, body()); await response.text();
  response = await post(limited, body());
  check(response.status === 429 && response.headers.has('retry-after'), 'token rate limit with retry hint');
  const serial = await listen(createRelay({ ...options, maxConcurrent: 1 }));
  const startedBefore = delayedUpstreamStarted;
  const held = post(serial, body('delay'));
  await waitFor(() => delayedUpstreamStarted > startedBefore, 'first concurrent request');
  response = await post(serial, body());
  check(response.status === 503 && (await response.json()).error.code === 'relay_busy', 'bounded concurrency rejects excess work');
  await (await held).text();
  response = await post(serial, body());
  check(response.status === 200, 'concurrency slot released after completion'); await response.text();
  assert.equal(validatePayload(body()).max_tokens, 1024); checks++;
  console.log('AI relay: ' + checks + ' loopback-only checks passed; no real provider contacted.');
} finally {
  await Promise.all(servers.reverse().map((server) => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); })));
}
