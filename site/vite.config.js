import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 1. CONFIGURAÇÃO FINAL: 
  // Omitir o 'build' e 'root' faz com que o Vite use a pasta atual como raiz, 
  // onde ele encontra o package.json e, consequentemente, o index.html.
  // Isso resolve o problema do localhost, desde que o caminho no index.html
  // esteja corrigido para '/site/src/main.jsx'
});