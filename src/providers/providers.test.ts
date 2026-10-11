import { describe, expect, it, vi } from 'vitest';
import { runCheckIn } from '../lib/runCheckIn';
import { buildCheckInMessages } from '../lib/prompt';
import type { CheckInContext } from '../lib/types';
import { isLocalUrl, type FetchLike } from './http';
import { createOllamaProvider } from './ollama';
import { createOpenAICompatibleProvider } from './openaiCompatible';
import { discoverOllamaModels, formatSize, isGemma, listOllamaModels, parseTags, pickDefaultModel, rememberOllamaBase, resolvedOllamaBase } from './tags';

const ctx = (): CheckInContext => ({
  task: 'checkin',
  messages: buildCheckInMessages('hello'),
  signal: new AbortController().signal,
  attempt: 1,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const TAGS = {
  models: [
    { name: 'llama3.2:3b', model: 'llama3.2:3b', size: 2_019_393_189, details: { parameter_size: '3.2B', family: 'llama' } },
    { name: 'gemma3:1b', model: 'gemma3:1b', size: 815_319_791, details: { parameter_size: '999.89M', family: 'gemma3' } },
    { name: 'gemma3:4b', model: 'gemma3:4b', size: 3_338_801_804, details: null },
  ],
};

describe('/api/tags parsing', () => {
  it('lists installed models with details', () => {
    const models = parseTags(TAGS);
    expect(models?.map((m) => m.name)).toEqual(['llama3.2:3b', 'gemma3:1b', 'gemma3:4b']);
    expect(models?.[1]).toEqual({ name: 'gemma3:1b', sizeBytes: 815_319_791, parameterSize: '999.89M', family: 'gemma3' });
  });

  it('handles an empty install and junk', () => {
    expect(parseTags({ models: [] })).toEqual([]);
    expect(parseTags({ hello: 'world' })).toBeNull();
    expect(parseTags('nope')).toBeNull();
  });

  it('preselects a Gemma model, honouring an installed preference', () => {
    const models = parseTags(TAGS) ?? [];
    expect(pickDefaultModel(models)).toBe('gemma3:1b');
    expect(pickDefaultModel(models, 'gemma3:4b')).toBe('gemma3:4b');
    expect(pickDefaultModel(models, 'not-installed')).toBe('gemma3:1b');
    expect(pickDefaultModel([{ name: 'qwen2.5:0.5b' }])).toBe('qwen2.5:0.5b');
    expect(pickDefaultModel([])).toBe('');
    expect(isGemma('Gemma2:2b')).toBe(true);
    expect(formatSize(815_319_791)).toBe('778 MB');
    expect(formatSize(3_338_801_804)).toBe('3.1 GB');
  });

  it('calls GET /ollama/api/tags through the proxy', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json(TAGS));
    const result = await listOllamaModels('/ollama', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('/ollama/api/tags', expect.anything());
    expect(result.ok && result.models).toHaveLength(3);
  });

  it('reports unreachable Ollama (network error or proxy 502)', async () => {
    const down = await listOllamaModels('/ollama', async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(down).toMatchObject({ ok: false, reason: 'unreachable' });
    const proxy502 = await listOllamaModels('/ollama', async () => new Response('', { status: 502 }));
    expect(proxy502).toMatchObject({ ok: false, reason: 'unreachable' });
    const notOllama = await listOllamaModels('/ollama', async () => new Response('<html>', { status: 200 }));
    expect(notOllama).toMatchObject({ ok: false, reason: 'bad-response' });
  });

  it('falls through to localhost when the proxy is down', async () => {
    rememberOllamaBase(null);
    const fetchImpl = vi.fn<FetchLike>(async (url) => {
      if (String(url).startsWith('/ollama')) throw new TypeError('Failed to fetch');
      return json(TAGS);
    });
    const result = await discoverOllamaModels(fetchImpl);
    expect(result.ok && result.models).toHaveLength(3);
    expect(resolvedOllamaBase()).toBe('http://127.0.0.1:11434');
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags', expect.anything());
    rememberOllamaBase(null);
  });

  it('explains a 403 as Ollama blocking this page', async () => {
    rememberOllamaBase(null);
    const result = await discoverOllamaModels(async () => new Response('', { status: 403 }));
    expect(result).toMatchObject({ ok: false, reason: 'unreachable' });
    expect(result.ok === false && result.message).toMatch(/blocking this page/);
    rememberOllamaBase(null);
  });
});

describe('ollama provider', () => {
  it('POSTs /api/chat with stream:false and format:"json"', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json({ message: { role: 'assistant', content: '{"x":1}' } }));
    const provider = createOllamaProvider({ model: 'gemma3:1b', fetchImpl });
    const out = await provider.checkIn('hello', ctx());
    expect(out.raw).toBe('{"x":1}');
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('/ollama/api/chat');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ model: 'gemma3:1b', stream: false, format: 'json' });
  });

  it('throws on HTTP errors so runCheckIn falls back', async () => {
    const provider = createOllamaProvider({
      model: 'gemma3:1b',
      fetchImpl: async () => json({ error: 'model "gemma3:1b" not found' }, 404),
    });
    await expect(provider.checkIn('hello', ctx())).rejects.toThrow(/404/);
  });

  it('health check finds a missing model', async () => {
    const provider = createOllamaProvider({ model: 'gemma3:12b', fetchImpl: async () => json(TAGS) });
    expect(await provider.healthCheck?.()).toMatchObject({ ok: false });
    const ok = createOllamaProvider({ model: 'gemma3:1b', fetchImpl: async () => json(TAGS) });
    expect(await ok.healthCheck?.()).toEqual({ ok: true });
  });
});

describe('openai-compatible provider', () => {
  const answer = '{"mood_score": 1, "themes": [], "risk_flag": false, "reply": "Nice."}';

  it('POSTs {baseUrl}/chat/completions with a bearer key and reads choices[0]', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json({ choices: [{ message: { role: 'assistant', content: answer } }] }));
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'http://localhost:1234/v1/',
      model: 'gemma-3-1b-it',
      apiKey: 'sk-local',
      fetchImpl,
    });
    const out = await provider.checkIn('hello', ctx());
    expect(out.raw).toBe(answer);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:1234/v1/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-local');
    const body = JSON.parse(String(init?.body)) as { model: string; messages: unknown[]; stream: boolean };
    expect(body.model).toBe('gemma-3-1b-it');
    expect(body.stream).toBe(false);
    expect(body.messages).toHaveLength(6);
  });

  it('omits Authorization without a key', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json({ choices: [{ message: { content: answer } }] }));
    await createOpenAICompatibleProvider({ baseUrl: 'http://127.0.0.1:8080/v1', model: '', fetchImpl }).checkIn('x', ctx());
    expect((fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('flows through the same validator: a malformed body ends in the fallback', async () => {
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'http://localhost:1234/v1',
      model: 'm',
      fetchImpl: async () => json({ choices: [] }),
    });
    const out = await runCheckIn({ provider, note: 'bad day', timeoutMs: 1000 });
    expect(out.source).toBe('fallback');
    expect(out.fallbackReason).toBe('invalid-output');
  });

  it('throws on HTTP 401', async () => {
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://example.com/v1',
      model: 'm',
      fetchImpl: async () => new Response('unauthorized', { status: 401 }),
    });
    await expect(provider.checkIn('x', ctx())).rejects.toThrow(/401/);
  });
});

describe('isLocalUrl', () => {
  it.each(['/ollama', '', 'http://localhost:1234/v1', 'http://127.0.0.1:8080', 'http://[::1]:11434', 'http://0.0.0.0:8000'])(
    '%s is local',
    (url) => expect(isLocalUrl(url)).toBe(true),
  );
  it.each(['https://api.example.com/v1', 'http://192.168.1.20:1234/v1', '//evil.com/x', 'not a url'])('%s is not local', (url) =>
    expect(isLocalUrl(url)).toBe(false),
  );
});
