# Contributing to Sproutpatch

Thanks for helping! Sproutpatch is small on purpose, so please keep changes focused.

## Ground rules

1. **Plugins and changes must not weaken safety.** The keyword check in `src/lib/safety.ts` runs first on the raw text and is independent of every provider and strategy. Risk mode must never call a model or a strategy, and must store only a mood score and a risk marker. You can add phrases (with tests); don't remove the check, don't make it optional or configurable, and don't let a provider's `risk_flag: false` override it.
2. **The model proposes, plain code decides.** Model output only ever goes through `src/lib/runCheckIn.ts`. Nudges stay grounded in real weather and daylight.
3. **Local-first.** No cloud database, analytics, accounts or tracking. The only network calls are the user's chosen model server and the Open-Meteo lookup (coordinates only).
4. **Not a therapist.** No medical, diagnostic or therapy advice anywhere in copy, prompts or templates.
5. **Write it yourself.** Contribute original code and docs.

## Development

```bash
npm install
npm run dev     # app at http://localhost:5173, /ollama proxied to localhost:11434
npm test        # Vitest; must pass without Ollama or any model
npm run build   # tsc (strict, no any) + vite build
```

`scripts/probe-model.mjs` sends the real check-in prompt to a local Ollama model a few times, which helps when tuning prompts: `node scripts/probe-model.mjs "your note" gemma3:1b 5` (Node 23.6+ for TypeScript imports).

To add a provider or nudge strategy, see [docs/ADDING_AN_AGENT.md](docs/ADDING_AN_AGENT.md).

## Pull requests

- Use a short feature branch and one focused PR.
- Add or update tests next to the code (`*.test.ts`).
- Make sure `npm run build` and `npm test` pass.
- Never commit `.env`, `.env.local` or any key.
