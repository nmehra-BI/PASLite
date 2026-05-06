import { Cockpit } from './Cockpit';
import { Pitch } from './Pitch';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  return route === 'pitch' ? <Pitch /> : <Cockpit />;
}
