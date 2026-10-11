/// <reference types="vitest/config" />
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The browser only ever talks to /ollama/*; Vite forwards it to the local Ollama daemon.
// Defined once and reused for `vite` (dev) and `vite preview` so both behave the same.
const proxy: Record<string, ProxyOptions> = {
  '/ollama': {
    target: 'http://localhost:11434',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/ollama/, ''),
    // Ollama rejects unknown browser origins (e.g. opening the app via a LAN IP). The request is
    // server-to-server at this point, so drop the header.
    configure: (proxyServer) => {
      proxyServer.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
    },
  },
};

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // Tailwind runs through its Vite plugin; an inline config stops Vite from picking up stray PostCSS configs in parent folders.
  css: { postcss: {} },
  server: { proxy },
  preview: { proxy },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
