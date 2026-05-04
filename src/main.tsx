import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadStoredTheme } from './hooks/useTheme';
import './styles/global.css';

// Aplica o tema persistido ANTES do React montar pra evitar flash do dark
// (default) ao abrir a aba em light. O `useTheme` dentro do React continua
// dono do estado a partir daqui — esta linha apenas alinha o DOM no boot.
if (loadStoredTheme() === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root não encontrado em index.html');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
