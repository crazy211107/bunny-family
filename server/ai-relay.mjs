import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const BODY_LIMIT = 256 * 1024;
const TEXT_LIMIT = 60000;
const IMAGE_LIMIT = 180000;
const RESPONSE_LIMIT = 2 * 1024 * 1024;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const digest = (value) => createHash('sha256').update(value).digest();
class RelayError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const bad = (code, message) => new RelayError(400, code, message);
const plainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function onlyKeys(value, names) { return Object.keys(value).every((key) => names.includes(key)); }
function isLoopbackAddress(address = '') {
  return address === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address) || /^::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i.test(address);
}
function checkedInteger(value, fallback, minimum, maximum, name) {
  const result = value === undefined ? fallback : value;
  if (!Number.isInteger(result) || result < minimum || result > maximum) throw new Error('Invalid relay configuration: ' + name);
  return result;
}

export function upstreamConfig(options = {}) {
  const apiKey = options.apiKey;
  const relayToken = options.relayToken;
  const model = options.model || 'deepseek-flash';
  if (typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n]/.test(apiKey)) throw new Error('AI_API_KEY is required');
  if (typeof relayToken !== 'string' || !/^[\x21-\x7e]{24,256}$/.test(relayToken)) throw new Error('BUNNY_RELAY_TOKEN must contain 24 to 256 printable non-space characters');
  if (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(model)) throw new Error('Invalid AI_MODEL');
  let base;
  try { base = new URL(options.baseUrl || 'https://api.deepseek.com'); }
  catch { throw new Error('Invalid AI_BASE_URL'); }
  if (base.username || base.password || base.search || base.hash) throw new Error('AI_BASE_URL must not contain credentials, query, or fragment');
  const localTest = options.allowInsecureLocalForTests === true && base.protocol === 'http:' && LOOPBACK_HOSTS.has(base.hostname.replace(/^\[|\]$/g, ''));
  if (base.protocol !== 'https:' && !localTest) throw new Error('AI_BASE_URL requires HTTPS');
  base.pathname = base.pathname.replace(/\/+$/, '') + '/chat/completions';
  return { apiKey, relayToken, model, url: base.href, reasoningEffort: base.hostname === 'api.deepseek.com' ? 'none' : undefined,
    timeoutMs: checkedInteger(options.timeoutMs, 90000, 10, 90000, 'timeoutMs'),
    maxConcurrent: checkedInteger(options.maxConcurrent, 3, 1, 10, 'maxConcurrent'),
    rateLimit: checkedInteger(options.rateLimit, 20, 1, 1000, 'rateLimit'),
    rateWindowMs: checkedInteger(options.rateWindowMs, 60000, 100, 3600000, 'rateWindowMs'),
  };
}

function readBody(req, signal) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAborted); signal.removeEventListener('abort', onSignalAbort);
      if (error) { req.resume(); reject(error); } else resolve(value);
    };
    const onData = (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) finish(new RelayError(413, 'body_too_large', 'Request body exceeds 256 KB.'));
      else chunks.push(chunk);
    };
    const onEnd = () => {
      try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { finish(bad('invalid_json', 'Request body must be valid JSON.')); }
    };
    const onError = () => finish(bad('invalid_request', 'Request body could not be read.'));
    const onAborted = () => finish(bad('request_aborted', 'Request was interrupted.'));
    const onSignalAbort = () => finish(new Error('Request interrupted'));
    req.on('data', onData); req.once('end', onEnd); req.once('error', onError); req.once('aborted', onAborted);
    signal.addEventListener('abort', onSignalAbort, { once: true });
    if (signal.aborted) onSignalAbort();
  });
}

export function validatePayload(body) {
  if (!plainObject(body) || !onlyKeys(body, ['messages', 'stream', 'max_tokens', 'temperature'])) throw bad('unsupported_field', 'Only messages, stream, max_tokens, and temperature are accepted.');
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 32) throw bad('invalid_messages', 'messages must contain 1 to 32 entries.');
  let textLength = 0;
  const messages = body.messages.map((message) => {
    if (!plainObject(message) || !onlyKeys(message, ['role', 'content']) || !['system', 'user', 'assistant'].includes(message.role)) throw bad('invalid_message', 'Each message needs a supported role and content.');
    const content = message.content;
    if (typeof content === 'string') textLength += content.length;
    else if (Array.isArray(content) && content.length >= 1 && content.length <= 2) {
      let texts = 0;
      let images = 0;
      for (const part of content) {
        if (!plainObject(part)) throw bad('invalid_content', 'Message content parts are invalid.');
        if (part.type === 'text' && onlyKeys(part, ['type', 'text']) && typeof part.text === 'string') {
          texts++; textLength += part.text.length;
        } else if (part.type === 'image_url' && onlyKeys(part, ['type', 'image_url']) && plainObject(part.image_url) && onlyKeys(part.image_url, ['url'])) {
          images++;
          const image = part.image_url.url;
          if (typeof image !== 'string' || image.length > IMAGE_LIMIT || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) throw bad('invalid_image', 'Images must be JPEG, PNG, or WebP base64 data URLs of at most 180000 characters.');
          const encoded = image.slice(image.indexOf(',') + 1);
          if (encoded.length % 4 !== 0 || Buffer.from(encoded, 'base64').toString('base64') !== encoded) throw bad('invalid_image', 'Image base64 encoding is invalid.');
        } else throw bad('invalid_content', 'Only text and image_url content parts are supported.');
      }
      if (texts !== 1 || images > 1) throw bad('invalid_content', 'A content array needs exactly one text part and at most one image.');
    } else throw bad('invalid_content', 'Message content must be a string or a supported content array.');
    return { role: message.role, content };
  });
  if (textLength > TEXT_LIMIT) throw bad('text_too_large', 'Message text exceeds 60000 characters.');
  if (body.stream !== undefined && typeof body.stream !== 'boolean') throw bad('invalid_stream', 'stream must be a boolean.');
  const tokens = body.max_tokens === undefined ? 1024 : body.max_tokens;
  if (!Number.isInteger(tokens) || tokens < 512 || tokens > 4096) throw bad('invalid_max_tokens', 'max_tokens must be an integer from 512 to 4096.');
  const temperature = body.temperature === undefined ? 0.7 : body.temperature;
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw bad('invalid_temperature', 'temperature must be a number from 0 to 2.');
  return { messages, stream: body.stream === true, max_tokens: tokens, temperature };
}

function sendError(res, error) {
  if (res.destroyed || res.writableEnded) return;
  const status = error instanceof RelayError ? error.status : 502;
  const code = error instanceof RelayError ? error.code : 'upstream_unavailable';
  const message = error instanceof RelayError ? error.message : 'The AI provider is temporarily unavailable.';
  if (res.headersSent) {
    // Terminate any partial SSE event before our fixed, credential-free error event.
    res.end('\n\nevent: error\ndata: ' + JSON.stringify({ error: { code, message } }) + '\n\n');
  } else {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    if (status === 413) res.setHeader('connection', 'close');
    res.end(JSON.stringify({ error: { code, message } }));
  }
}
function waitDrain(res, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => { res.off('drain', onDrain); res.off('close', onClose); res.off('error', onClose); signal.removeEventListener('abort', onAbort); };
    const onDrain = () => { cleanup(); resolve(); };
    const onClose = () => { cleanup(); reject(new Error('Client disconnected')); };
    const onAbort = () => { cleanup(); reject(new Error('Upstream aborted')); };
    res.once('drain', onDrain); res.once('close', onClose); res.once('error', onClose); signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted || res.destroyed) onAbort();
  });
}

export function createRelay(options = {}) {
  const config = upstreamConfig(options);
  const tokenDigest = digest(config.relayToken);
  let active = 0;
  let accepted = [];
  const server = http.createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    if (!isLoopbackAddress(req.socket.remoteAddress)) { sendError(res, new RelayError(403, 'loopback_only', 'The relay must run behind a local authenticated gateway.')); return; }
    if (req.url === '/health' && req.method === 'GET') {
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: true, model: config.model })); return;
    }
    if (req.url !== '/v1/chat/completions') { sendError(res, new RelayError(404, 'not_found', 'Endpoint not found.')); return; }
    if (req.method !== 'POST') { res.setHeader('allow', 'POST'); sendError(res, new RelayError(405, 'method_not_allowed', 'Use POST for chat completions.')); return; }
    const authorization = req.headers.authorization || '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!timingSafeEqual(digest(supplied), tokenDigest)) { sendError(res, new RelayError(401, 'unauthorized', 'A valid relay access token is required.')); return; }
    const now = Date.now();
    accepted = accepted.filter((at) => now - at < config.rateWindowMs);
    if (accepted.length >= config.rateLimit) {
      res.setHeader('retry-after', String(Math.max(1, Math.ceil((config.rateWindowMs - (now - accepted[0])) / 1000))));
      sendError(res, new RelayError(429, 'rate_limited', 'Too many requests. Please try again later.')); return;
    }
    accepted.push(now);
    if (active >= config.maxConcurrent) { res.setHeader('retry-after', '1'); sendError(res, new RelayError(503, 'relay_busy', 'The relay is busy. Please try again shortly.')); return; }
    active++;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
    const abortClient = () => { if (!res.writableEnded) controller.abort(); };
    req.once('aborted', abortClient); res.once('close', abortClient);
    try {
      const length = Number(req.headers['content-length']);
      if (Number.isFinite(length) && length > BODY_LIMIT) throw new RelayError(413, 'body_too_large', 'Request body exceeds 256 KB.');
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new RelayError(415, 'unsupported_media_type', 'Use application/json.');
      const payload = validatePayload(await readBody(req, controller.signal));
      if (controller.signal.aborted) throw new Error('Request interrupted');
      const upstream = await fetch(config.url, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'content-type': 'application/json', accept: payload.stream ? 'text/event-stream' : 'application/json', authorization: 'Bearer ' + config.apiKey },
        body: JSON.stringify(Object.assign({ model: config.model }, config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}, payload)),
      });
      if (!upstream.ok) {
        await upstream.body?.cancel();
        throw new RelayError(502, 'upstream_error', 'The AI provider could not complete this request.');
      }
      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.body || (payload.stream ? !/^text\/event-stream(?:\s*;|$)/i.test(contentType) : !/^application\/json(?:\s*;|$)/i.test(contentType))) {
        await upstream.body?.cancel(); throw new RelayError(502, 'invalid_upstream_response', 'The AI provider returned an unsupported response.');
      }
      if (payload.stream) {
        res.setHeader('content-type', 'text/event-stream; charset=utf-8');
        res.setHeader('x-accel-buffering', 'no');
        res.flushHeaders();
      }
      const reader = upstream.body.getReader();
      const chunks = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > RESPONSE_LIMIT) throw new RelayError(502, 'upstream_response_too_large', 'The AI provider response is too large.');
          if (payload.stream) { if (!res.write(value)) await waitDrain(res, controller.signal); }
          else chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      if (payload.stream) res.end();
      else {
        const json = Buffer.concat(chunks).toString('utf8');
        let result;
        try { result = JSON.parse(json); } catch { throw new RelayError(502, 'invalid_upstream_response', 'The AI provider returned invalid JSON.'); }
        if (!plainObject(result) || result.error) throw new RelayError(502, 'upstream_error', 'The AI provider could not complete this request.');
        res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(json);
      }
    } catch (error) {
      if (!res.destroyed && !res.writableEnded) sendError(res, timedOut ? new RelayError(504, 'upstream_timeout', 'The AI request timed out. Please try again.') : error);
    } finally {
      clearTimeout(timer); controller.abort(); active--;
      req.off('aborted', abortClient); res.off('close', abortClient);
      if (!req.complete) req.resume();
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 95000;
  server.keepAliveTimeout = 5000;
  server.maxConnections = 32;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const host = process.env.HOST || '127.0.0.1';
    const port = Number(process.env.PORT || 8788);
    if (!LOOPBACK_HOSTS.has(host)) throw new Error('HOST must be 127.0.0.1, ::1, or localhost; use an authenticated HTTPS reverse proxy for remote access');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1 to 65535');
    const server = createRelay({ apiKey: process.env.AI_API_KEY, relayToken: process.env.BUNNY_RELAY_TOKEN, baseUrl: process.env.AI_BASE_URL, model: process.env.AI_MODEL });
    server.on('error', () => { console.error('AI relay could not listen. Check HOST, PORT, and local permissions.'); process.exitCode = 1; });
    server.listen(port, host, () => { console.log('Bunny AI relay is listening on loopback port ' + port + '. Prompts and credentials are not logged.'); });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
