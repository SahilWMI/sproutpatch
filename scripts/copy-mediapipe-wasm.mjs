// Copies MediaPipe's GenAI WebAssembly runtime into public/ so the on-device Gemma provider is
// served from this site (no CDN), and works offline once the browser has cached it.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-genai', 'wasm');
const to = join(root, 'public', 'mediapipe');
const files = ['genai_wasm_internal.js', 'genai_wasm_internal.wasm'];

mkdirSync(to, { recursive: true });
for (const file of files) {
  const src = join(from, file);
  const dest = join(to, file);
  if (!existsSync(src)) throw new Error(`Missing ${src}. Run npm install.`);
  if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
  copyFileSync(src, dest);
}
