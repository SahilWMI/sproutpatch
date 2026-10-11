// Dev-only probe: sends the real check-in prompt to a local Ollama model a few times.
// Usage: node scripts/probe-model.mjs "note text" [model] [runs]
import { buildCheckInMessages } from '../src/lib/prompt.ts';

const [note = 'Ordinary day.', model = 'gemma3:1b', runs = '5'] = process.argv.slice(2);

for (let i = 0; i < Number(runs); i++) {
  const started = Date.now();
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: buildCheckInMessages(note),
      stream: false,
      format: 'json',
      options: { temperature: 0.6, num_predict: 220 },
    }),
  });
  const data = await res.json();
  console.log(`${Date.now() - started}ms`, data.message?.content);
}
