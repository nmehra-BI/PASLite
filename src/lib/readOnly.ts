import { useRanBerri } from '@/store';

/**
 * Module 4 introduces terminal submission states (referred/declined).
 * Components that mutate submission state (correction, resolution,
 * override) should disable their save affordances when this returns
 * true. The store actions also enforce this server-side.
 */
export function useReadOnly(): boolean {
  return useRanBerri(
    (s) => s.submissionState === 'referred' || s.submissionState === 'declined',
  );
}
