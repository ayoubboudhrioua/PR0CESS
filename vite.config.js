import { defineConfig } from 'vite';

export default defineConfig({
  base: '/PR0CESS/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
