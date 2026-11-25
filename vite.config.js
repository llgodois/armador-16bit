import { defineConfig } from 'vite';

// base './' gera caminhos relativos: o dist/ funciona no GitHub Pages
// (em subpasta) e no Netlify sem configuração extra.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000, // o Phaser sozinho tem ~1.2MB
  },
  server: {
    port: 5173,
  },
});
