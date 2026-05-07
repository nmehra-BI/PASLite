import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import { App } from '@/app/App';
import { ConfigProvider, loadConfig } from '@/config';
import '@/styles/global.css';

// Allow immer drafts to mutate Set/Map (used by the intake sub-store).
enableMapSet();

// Load + validate the active tenant config at startup. Throws if the
// config file fails Zod validation — better to crash loudly than
// render against malformed config.
const tenantConfig = loadConfig();

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(
  <StrictMode>
    <ConfigProvider config={tenantConfig}>
      <App />
    </ConfigProvider>
  </StrictMode>,
);
