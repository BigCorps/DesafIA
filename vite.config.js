import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// Site com várias páginas: o jogo (/), o portal dos pais (/pais/) e as páginas legais.
export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        jogo: r('./index.html'),
        pais: r('./pais/index.html'),
        privacidade: r('./privacidade/index.html'),
        termos: r('./termos/index.html')
      }
    }
  }
});
