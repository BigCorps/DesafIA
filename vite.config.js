import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ command }) => ({
  // Fail closed: production and unidentified builds never contain the QA panel.
  define: { __DESAFIA_QA_ALLOWED__: JSON.stringify(process.env.VERCEL_ENV !== 'production' && (command === 'serve' || process.env.VERCEL_ENV === 'preview')) },
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
}));
