import { useContext } from 'react';
import { ConfigContext } from './configContext';
import type { TenantConfig } from './types';

/** Type-safe access to the active tenant config from any component
 *  rendered under ConfigProvider. Throws if used outside the
 *  provider, which should never happen at runtime. */
export function useConfig(): TenantConfig {
  const cfg = useContext(ConfigContext);
  if (!cfg) {
    throw new Error(
      'useConfig: no ConfigProvider in tree. Wrap App in <ConfigProvider config={loadConfig()}>.',
    );
  }
  return cfg;
}
