import { defineConfig } from 'vite';

// base './' gera caminhos relativos: o dist/ funciona no GitHub Pages
// (em subpasta) e no Netlify sem configuração extra.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000, // o Phaser sozinho tem ~1.2MB
    // duas versões no mesmo site: index.html (16-bit) e 3d.html (Armador 64)
    rollupOptions: {
      input: {
        main: 'index.html',
        v3d: '3d.html',
      },
    },
  },
  server: {
    port: 5173,
  },
});
