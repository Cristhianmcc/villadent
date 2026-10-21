import { defineConfig } from 'vite';
// base relativa: el build funciona en cualquier carpeta o enlace
export default defineConfig({ base: './', build: { target: 'es2022', chunkSizeWarningLimit: 1500 } });
