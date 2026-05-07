import { describe, expect, it, beforeEach } from 'vitest';
import { useListingStore } from './listingStore';

describe('listingStore — chase + drilled-from-listing receipts', () => {
  beforeEach(() => {
    useListingStore.setState({
      filter: 'all',
      query: '',
      searchOpen: false,
      drilledFromListing: null,
    });
  });

  it('recordChase stamps lastChaseAt on the matching entry', () => {
    const before = useListingStore.getState().entries.find((e) => e.ref === 'SUB-29487')!;
    expect(before.lastChaseAt).toBeNull();
    useListingStore.getState().recordChase('SUB-29487');
    const after = useListingStore.getState().entries.find((e) => e.ref === 'SUB-29487')!;
    expect(after.lastChaseAt).not.toBeNull();
    expect(new Date(after.lastChaseAt!).getTime()).toBeGreaterThan(0);
  });

  it('recordChase is idempotent and only touches the named entry', () => {
    const refs = useListingStore.getState().entries.map((e) => e.ref);
    useListingStore.getState().recordChase('SUB-29487');
    useListingStore.getState().recordChase('SUB-29487');
    const after = useListingStore.getState().entries;
    expect(after.map((e) => e.ref)).toEqual(refs);
    expect(after.filter((e) => e.lastChaseAt !== null)).toHaveLength(1);
  });

  it('setDrilledFromListing stores the ref and a timestamp; null clears', () => {
    useListingStore.getState().setDrilledFromListing({ ref: 'SUB-29503' });
    const stamped = useListingStore.getState().drilledFromListing;
    expect(stamped?.ref).toBe('SUB-29503');
    expect(stamped?.at).toMatch(/T/);
    useListingStore.getState().setDrilledFromListing(null);
    expect(useListingStore.getState().drilledFromListing).toBeNull();
  });
});
