import { useEffect, useState } from 'react';

export type Route = 'cockpit' | 'pitch';

function parseHash(): Route {
  if (typeof window === 'undefined') return 'cockpit';
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  return h === 'pitch' ? 'pitch' : 'cockpit';
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
