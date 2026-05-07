/**
 * Module 14 — display names for the seeded exception queue refs.
 * Most exception refs are synthetic (don't appear in listingDemo).
 * Keep the human-readable label here so the queue page can render
 * "SUB-29512 · Larksbury Materials" rather than just the ref.
 */

const NAMES: Record<string, string> = {
  'SUB-29512': 'Larksbury Materials',
  'SUB-29509': 'Holsworth Recycling Ltd',
  'SUB-29498': 'Hartwell Materials',
  'SUB-29495': 'Brackthorne Industries',
  'SUB-29488': 'Vellaby Waste Services',
  'SUB-29476': 'Trevennon Recovery',
  'SUB-29472': 'Cromer Salvage Co',
  'SUB-29468': 'Findhorn Materials Ltd',
  'SUB-29455': 'Eastmoor Recycling',
  'SUB-29449': 'Pelham Materials',
  'SUB-29441': 'Smithwell Industries',
  'SUB-29435': 'Drayton Salvage Ltd',
};

export function lookupExceptionInsured(ref: string): string {
  return NAMES[ref] ?? '—';
}
