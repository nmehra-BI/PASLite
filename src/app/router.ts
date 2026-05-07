import { useEffect, useState } from 'react';

export type Route =
  | { name: 'listing' }
  | { name: 'pitch' }
  | { name: 'cockpit' }
  | { name: 'submission'; id: string }
  | { name: 'policy'; id: string }
  | { name: 'autonomy-admin' }
  | { name: 'exceptions' };

function parseHash(): Route {
  if (typeof window === 'undefined') return { name: 'listing' };
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (h === '' || h === '/') return { name: 'listing' };
  if (h === 'pitch') return { name: 'pitch' };
  if (h === 'cockpit') return { name: 'cockpit' };
  if (h === 'settings/autonomy') return { name: 'autonomy-admin' };
  if (h === 'exceptions') return { name: 'exceptions' };
  const sub = h.match(/^submission\/(.+)$/);
  if (sub) return { name: 'submission', id: sub[1]!.toUpperCase() };
  const pol = h.match(/^policy\/(.+)$/);
  if (pol) return { name: 'policy', id: pol[1]!.toUpperCase() };
  return { name: 'listing' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}

export function navigate(hash: string) {
  if (typeof window === 'undefined') return;
  window.location.hash = hash;
}
