import { useEffect, useState } from 'react';
import { getStatus, subscribe } from './syncOrchestrator';
import type { SyncStatus } from './types';

/** React hook returning the live sync status. Components that render
 *  a connection indicator subscribe via this. */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => getStatus());
  useEffect(() => subscribe(setStatus), []);
  return status;
}
