import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Portal source lives in web/, builds into public/ which the Express API serves.
export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../public', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
