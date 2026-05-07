import { createContext, type ReactNode } from 'react';
import type { TenantConfig } from './types';

/** React context for the active tenant config. Undefined means the
 *  provider hasn't mounted yet — useConfig() throws in that case. */
export const ConfigContext = createContext<TenantConfig | undefined>(undefined);

export function ConfigProvider({
  config,
  children,
}: {
  config: TenantConfig;
  children: ReactNode;
}) {
  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}
