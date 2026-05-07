import { useEffect } from 'react';
import { Cockpit } from './Cockpit';
import { Pitch } from './Pitch';
import { ListingPage } from '@/features/listing';
import { AutonomyPolicyAdmin, ExceptionQueuePage } from '@/features/autonomy';
import { LedgerPage, LedgerSectionDetail } from '@/features/ledger';
import { useRanBerri } from '@/store';
import { init as initSync } from '@/lib/sync';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  useSyncBootstrap();
  if (route.name === 'pitch') return <Pitch />;
  if (route.name === 'cockpit') return <Cockpit />;
  if (route.name === 'autonomy-admin') return <AutonomyPolicyAdmin />;
  if (route.name === 'exceptions') return <ExceptionQueuePage />;
  if (route.name === 'ledger') return <LedgerPage />;
  if (route.name === 'ledger-class')
    return <LedgerSectionDetail classId={route.classId} />;
  if (route.name === 'submission' || route.name === 'policy') {
    // Drilled into a specific submission/policy → show the cockpit
    // canvas. The canvas reads from the audit log; for MVP it shows
    // the current Greenline state regardless of which ref was clicked
    // (the listing fixture is decorative — only Greenline has live
    // audit-replay data).
    return <Cockpit />;
  }
  return <ListingPage />;
}

/** Initialise the sync orchestrator once on app mount. Wires the
 *  three callbacks the orchestrator needs (current submission id,
 *  current audit log, server-event applicator) and kicks off the
 *  initial health check + replay. No-op when VITE_SERVER_URL is
 *  unset — the cockpit runs in local-only mode. */
function useSyncBootstrap(): void {
  useEffect(() => {
    void initSync({
      getSubmissionId: () => useRanBerri.getState().submission?.id ?? null,
      getAuditLog: () => useRanBerri.getState().auditLog,
      applyServerEvents: (events) =>
        useRanBerri.getState().applyServerEvents(events),
    });
  }, []);
}
