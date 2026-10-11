# Adding an agent

Sproutpatch has two plugin slots:

- a **Provider** writes the short reply (and a rough mood guess);
- a **NudgeStrategy** picks the outdoor suggestion.

Any file in `src/agents/*.ts` whose **default export** is either one is registered automatically at startup (`import.meta.glob`, eager) and appears in **Settings**. No other wiring is needed.

What plugins can't do: switch off or override the safety check. It runs on the raw note before any plugin is called, and if it matches, no provider or strategy runs at all. A provider's `risk_flag: true` turns risk mode on; `false` can't turn it off. Errors are contained: throwing, hanging or returning junk ends in the built-in fallback with a friendly note, never a crash.

## The interfaces

From `src/lib/types.ts`:

```ts
interface CheckInContext {
  task: 'checkin' | 'nudge' | 'test';
  messages: ChatMessage[];   // system prompt + 2 few-shot examples + the note
  signal: AbortSignal;       // aborted on timeout or Cancel; pass it to fetch
  attempt: number;           // 1, or 2 on the single retry after invalid output
}

interface ProviderResult {
  raw: unknown;              // a JSON string from the model, or the object itself
}

interface Provider {
  id: string;
  label: string;
  checkIn(note: string, ctx: CheckInContext): Promise<ProviderResult>;
  healthCheck?(): Promise<{ ok: boolean; message?: string }>;
}

interface NudgeInput {
  moodScore: number;                 // -3..3
  weather: WeatherSnapshot | null;   // null if Open-Meteo couldn't be reached
  now: Date;
  seed: number;                      // pick wording deterministically
  provider: Provider | null;
  signal?: AbortSignal;
}

interface Nudge {
  strategyId: string;
  rule: 'rain' | 'heat' | 'dark' | 'low-mood' | 'meh-mood' | 'light';
  suggestion: string;
  minutes: number;   // clamped to 1..60
  reason: string;
}

interface NudgeStrategy {
  id: string;
  label: string;
  suggest(input: NudgeInput): Promise<Nudge> | Nudge;
}
```

`raw` must validate against this shape (checked with zod in `src/lib/runCheckIn.ts`):

```json
{ "mood_score": 0, "themes": ["work"], "risk_flag": false, "reply": "One or two warm sentences." }
```

Ids `ollama`, `openai-compatible`, `mock`, `none`, `rules` and `llm` are reserved. Files with a duplicate id, or a default export that isn't a Provider or NudgeStrategy, are skipped and listed under Settings → Nudge strategy.

## Example: a provider for LM Studio or llama.cpp

For most local servers you don't need a plugin at all: choose **OpenAI-compatible server** in Settings. But if you want a fixed, named entry (for example to ship a preset), wrap the built-in adapter. Save as `src/agents/lm-studio.ts`:

```ts
import { createOpenAICompatibleProvider } from '../providers/openaiCompatible';
import type { Provider } from '../lib/types';

// LM Studio: Developer tab → Start server (default port 1234), enable CORS.
// llama.cpp:  llama-server -m gemma-3-1b-it-Q4_K_M.gguf --port 8080   (use http://localhost:8080/v1)
const inner = createOpenAICompatibleProvider({
  baseUrl: 'http://localhost:1234/v1',
  model: 'gemma-3-1b-it',
});

const lmStudio: Provider = {
  ...inner,
  id: 'lm-studio-gemma',
  label: 'LM Studio · Gemma 3 1B (local)',
};

export default lmStudio;
```

Restart `npm run dev` if the new file doesn't show up, then select it in Settings and press **Test model**.

If your agent talks to a server that isn't on your machine, say so in the `label` (for example `"My agent (sends text to example.com)"`).

## Example: a custom NudgeStrategy

Strategies should respect the weather. The easiest way is to start from the rules and only change what you care about. Save as `src/agents/plant-nudges.ts`:

```ts
import { suggestByRules } from '../lib/nudge/rules';
import type { Nudge, NudgeInput, NudgeStrategy } from '../lib/types';

const PLANT_IDEAS = [
  'Step outside and find three different kinds of leaves.',
  'Walk to the nearest tree and look at it properly for a minute.',
  'Check on a plant outside: a balcony pot, a hedge, a weed in a crack.',
];

const plantNudges: NudgeStrategy = {
  id: 'plant-nudges',
  label: 'Plant-spotting nudges',
  suggest(input: NudgeInput): Nudge {
    const base = suggestByRules(input);
    // Weather and daylight rules stay in charge.
    if (base.rule === 'rain' || base.rule === 'heat' || base.rule === 'dark') return base;
    return {
      ...base,
      strategyId: 'plant-nudges',
      suggestion: PLANT_IDEAS[Math.abs(input.seed) % PLANT_IDEAS.length] ?? base.suggestion,
    };
  },
};

export default plantNudges;
```

## Testing with the mock provider

The `mock` provider (`src/providers/mock.ts`) is deterministic and needs no model. Use it, or a tiny inline provider, to test the full flow:

```ts
import { describe, expect, it } from 'vitest';
import { performCheckIn } from '../lib/checkInFlow';
import { mockProvider } from '../providers/mock';
import plantNudges from './plant-nudges';

describe('plant nudges', () => {
  it('suggests a plant idea on a mild day', async () => {
    const result = await performCheckIn({
      note: 'An okay day.',
      provider: mockProvider,
      strategy: plantNudges,
      getWeather: async () => ({
        temperatureC: 22,
        precipitationProbability: 0,
        weatherCode: 0,
        sunrise: new Date(2026, 9, 12, 6, 0),
        sunset: new Date(2026, 9, 12, 18, 0),
      }),
      timeoutMs: 1000,
      now: new Date(2026, 9, 12, 14, 0),
      seed: 0,
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.nudge.strategyId).toBe('plant-nudges');
  });
});
```

Put test files next to the agent (`src/agents/plant-nudges.test.ts`); `*.test.ts` files are excluded from auto-registration.

## Contributor checklist

- [ ] The default export is a `Provider` or `NudgeStrategy` with a unique `id` and a clear `label`.
- [ ] It doesn't import, wrap, patch or bypass `src/lib/safety.ts`, `src/lib/runCheckIn.ts` or `src/lib/checkInFlow.ts`.
- [ ] It passes `ctx.signal` to any `fetch` so timeouts and Cancel work.
- [ ] It works offline, or fails cleanly (throws) so the fallback can take over.
- [ ] It never gives medical, diagnostic or therapy advice.
- [ ] Network use is obvious in the label, and nothing is sent anywhere without the user choosing it.
- [ ] `npm run build` and `npm test` pass, and tests don't need a real model.
