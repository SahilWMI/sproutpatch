# Sproutpatch 🌱

**A local-first daily check-in that nudges you outside. Bring your own Gemma (or any open model).**

You type a few lines about your day. A Gemma model that *you* installed (through Ollama) writes a short, warm reply. Plain TypeScript looks at the real weather and daylight where you are and suggests one concrete thing to do outside. A dim, nearly empty timer page counts the walk. When you press "I'm back" you rate how you feel, and a sprout appears in your history for every walk you finish.

The screen is meant to be the shortest part of the experience. Nudges are concrete (real weather, real sunset time, never a model's guess). And Sproutpatch is **not a therapist**.

## Quickstart

```bash
ollama pull gemma3:1b
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173), and pick your model in the setup wizard. That's it.

- Ollama not running? Start it with `ollama serve`. The wizard shows these steps too, with a "Check again" button.
- No model at all? Press **Continue without the model**. Everything still works using a keyword mood estimate and reply templates.
- Any Gemma size works. Smaller (`gemma3:1b`) is faster with weaker replies; larger (`gemma3:4b`, `gemma3:12b`) is the reverse.

Other scripts: `npm run build`, `npm test`, `npm run preview` (the `/ollama` proxy works in preview too). Requires Node 20.19+ (tested on Node 26).

## How it works: the model proposes, plain code decides

The model only ever produces a 1-2 sentence reply and a rough mood guess, as JSON:

```json
{ "mood_score": -1, "themes": ["work"], "risk_flag": false, "reply": "That sounds like a long one." }
```

Everything that matters is deterministic code:

| Step | Where | What it does |
| --- | --- | --- |
| 1. Safety check | `src/lib/safety.ts` | Keyword scan of the raw text. Runs first, before any model or plugin. |
| 2. Mood estimate | `src/lib/fallbackMood.ts` | Lexicon-based score and themes, used whenever the model isn't. |
| 3. Reply | `src/lib/runCheckIn.ts` | The one wrapper around every provider: strip code fences, parse, validate with zod, clamp `mood_score` to -3..3, cut the reply to 300 characters, drop sentences that sound like medical or therapy advice, retry once, then fall back to templates with a small "Running without the model" note. Timeout from `VITE_TIMEOUT_MS` (90 s default), a "Local models can take up to a minute" hint after 10 s, and a Cancel button. |
| 4. Model risk flag | `src/lib/checkInFlow.ts` | If the model says `risk_flag: true`, the app switches to risk mode. The model can raise the alarm, never lower it. |
| 5. Nudge | `src/lib/nudge/rules.ts` | First matching rule wins: rain ≥ 60% or storms → five minutes at the doorstep or balcony; ≥ 36°C → shade or after sunset; < 20 min of daylight → a lit street or a balcony stretch; mood ≤ -2 → an easy 15-20 minute walk, phone in pocket; mood ≤ 0 → 10-15 minutes to the nearest green space; otherwise a no-pressure "Quick 5-minute loop?". Three wordings per case. Without weather it uses the time of day only and says so. |

Weather comes from [Open-Meteo](https://open-meteo.com/) (no API key). Only your coordinates are sent, rounded to about 1 km. Location comes from the browser, or from `VITE_DEFAULT_LAT` / `VITE_DEFAULT_LON` if you decline.

### The safety path

Small local models are unreliable at spotting crisis language, so the **keyword check is the primary safety net**, not the model.

- `checkSafety()` runs on the raw note before anything else. On a match, or when the model returns `risk_flag: true`, Sproutpatch enters **risk mode**: it never calls the model or any nudge strategy, shows a compassionate message, says it can't help with this alone, and shows a support card: *"In India, you can call Tele-MANAS at 14416. If you're elsewhere, please contact your local emergency or crisis line. If you're in immediate danger, call your local emergency number."* It encourages reaching out to someone you trust.
- For that entry it stores **only** the mood score and a risk marker. Never the text.
- Plugins can't disable or override any of this; the safety check is not part of the plugin system. A plugin that throws, hangs or returns junk just results in a friendly fallback.
- Tests (`src/lib/checkInFlow.test.ts`) prove that a provider returning `risk_flag: false` can't suppress keyword risk mode, and that neither the model, the strategy, nor the weather lookup is ever called in risk mode.

## Bring your own model or agent

- **Any Ollama model:** type any tag in the wizard. `gemma*` models are preselected.
- **Any OpenAI-compatible server** (LM Studio, llama.cpp `llama-server`, vLLM): choose "OpenAI-compatible server" in Settings and enter the base URL (for example `http://localhost:1234/v1`) and an optional key. If the URL isn't localhost, Settings warns you: *"Your check-in text will be sent to this server."*
- **Your own code:** drop a file in `src/agents/` that default-exports a `Provider` or a `NudgeStrategy`. It's picked up automatically (`import.meta.glob`) and shows up in Settings. Start from [`src/agents/example-agent.ts`](src/agents/example-agent.ts) and read [docs/ADDING_AN_AGENT.md](docs/ADDING_AN_AGENT.md).

```ts
interface Provider {
  id: string;
  label: string;
  checkIn(note: string, ctx: CheckInContext): Promise<ProviderResult>;
  healthCheck?(): Promise<{ ok: boolean; message?: string }>;
}

interface NudgeStrategy {
  id: string;
  label: string;
  suggest(input: NudgeInput): Promise<Nudge> | Nudge;
}
```

Built in: providers `ollama` (default), `openai-compatible`, `mock` (deterministic, offline); strategies `rules` and `llm` (lets the model reword mood-based nudges, keeps the code-made reason, never overrides weather rules, and falls back to `rules` on any failure).

## Why open-weight and local

A daily check-in is about as personal as text gets. With an open-weight model running on your own machine, the words you type never leave it. There's no account, no server to breach, no analytics, and no bill. You can see exactly which model is answering, swap it for another, or run with no model at all. All storage is IndexedDB in your browser, with **Export my data (JSON)** and **Delete all my data** in History.

The only network requests are to your model server (Ollama on localhost by default) and the Open-Meteo lookup, unless you deliberately configure a remote endpoint.

## Try these four inputs

1. **A bad work day:** `Rough day at work. Meetings ran over, I skipped lunch, and my manager moved the deadline up. Pretty tired.` Expect a low mood and a short-walk nudge. Heads-up: in testing, `gemma3:1b` often set `risk_flag: true` on ordinary bad days, which shows the support card (with a note that the model flagged it). That is the cautious direction by design. With the Mock provider or "No model" you'll see the nudge.
2. **A calm day:** `Calm day. Read a book on the balcony, made tea, called my sister. Feeling pretty good.` Expect a warm reply and a light "Quick 5-minute loop?" (or a weather or daylight rule if those apply where you are).
3. **A rainy-day note:** `Rainy day, stuck indoors. A bit bored but okay.` The rain rule only fires if Open-Meteo says rain is likely where you are, because nudges come from real weather, not from your words.
4. **Crisis language (verifies the safety path):** `I can't go on like this anymore.` The support card appears immediately; the model is never called and only a mood score plus a risk marker are saved.

Or open History and press **Try a sample day** to see clearly labelled, made-up entries that are never saved.

## Configuration

Copy `.env.example` to `.env.local`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_MODEL` | empty | Model tag to preselect, e.g. `gemma3:1b` |
| `VITE_BASE_URL` | empty | Set to use an OpenAI-compatible server by default |
| `VITE_API_KEY` | empty | Optional bearer key for that server |
| `VITE_TIMEOUT_MS` | `90000` | How long to wait for the model |
| `VITE_DEFAULT_LAT` / `VITE_DEFAULT_LON` | `20.2961` / `85.8245` | Location when geolocation is denied |

> **Note:** every `VITE_` variable is bundled into the browser code and visible to anyone who can open DevTools. Don't put a secret there that you wouldn't put in a web page.

## Honest limitations

- Small models give short, generic replies, can misjudge tone (see the bad-work-day note above), and are slow on CPU. The first request after loading a model is the slowest.
- The keyword safety check is not exhaustive and is **English-only**. It deliberately over-triggers rather than under-triggers, but it will still miss things.
- The lexicon mood estimate is crude.
- Sproutpatch is not a therapist or a medical tool, and it can't respond to an emergency.
- OpenAI-compatible servers must allow requests from the page (CORS). Ollama goes through the Vite dev/preview proxy, so it doesn't need CORS settings, but a plain static deploy of `dist/` has no proxy.

## Tests

`npm test` runs everything with Vitest. No test needs Ollama or a model. The suite covers every nudge branch, the fallback mood estimator, zod validation, retry and fallback with deliberately bad answers (garbage text, wrong types, out-of-range scores, oversized replies, fenced JSON), `/api/tags` parsing, the OpenAI-compatible adapter (mocked fetch), plugin auto-registration with a fixture folder, timeout handling, the weekly summary, and the safety invariants.

## Credits

[Ollama](https://ollama.com/), [Gemma](https://ai.google.dev/gemma) by Google DeepMind, [Open-Meteo](https://open-meteo.com/), [React](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/). Also zod, idb and Vitest.

Licensed under the [MIT License](LICENSE).

Built during the DEV Hacktoberfest Open-Source AI Challenge Week 1 (Oct 5-11, 2026). Commits after the deadline are listed below:

<!-- none yet -->
