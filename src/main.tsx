import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import { App } from '@/app/App';
import '@/styles/global.css';

// Allow immer drafts to mutate Set/Map (used by the intake sub-store).
enableMapSet();

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
