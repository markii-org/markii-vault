import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // Project sites on GitHub Pages are served under /<repo>/, so CI sets
  // VITE_BASE=/markii-vault/; local dev/builds leave it unset and default
  // to '/'.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  // Component packs live with their example notes in ../examples (outside
  // the app root), so node resolution from there cannot find node_modules.
  // Pin the app's own copies for the bare specifiers the packs use; anchored
  // patterns so subpath imports (e.g. '@markii/react/components') keep their
  // normal resolution from src/.
  resolve: {
    alias: [
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(import.meta.dirname, 'node_modules/react/jsx-runtime') },
      { find: /^react$/, replacement: path.resolve(import.meta.dirname, 'node_modules/react') },
      { find: /^react-dom\/client$/, replacement: path.resolve(import.meta.dirname, 'node_modules/react-dom/client') },
      { find: /^react-dom$/, replacement: path.resolve(import.meta.dirname, 'node_modules/react-dom') },
      { find: /^@markii\/react$/, replacement: path.resolve(import.meta.dirname, 'node_modules/@markii/react') },
      { find: /^@markii\/lua$/, replacement: path.resolve(import.meta.dirname, 'node_modules/@markii/lua') },
    ],
  },
});