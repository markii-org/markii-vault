import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Project sites on GitHub Pages are served under /<repo>/, so CI sets
  // VITE_BASE=/markii-vault/; local dev/builds leave it unset and default
  // to '/'.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
});