import { FetchAdapter, GenericProgramAdapter, getAdapter } from '../src/background/adapters';

describe('adapter class hierarchy', () => {
  it('returns FetchAdapter for fetch and GenericProgramAdapter for miles programs', () => {
    const fetchAdapter = getAdapter('fetch');
    const unitedAdapter = getAdapter('united-shopping');

    expect(fetchAdapter).toBeInstanceOf(FetchAdapter);
    expect(fetchAdapter).toBeInstanceOf(GenericProgramAdapter);
    expect(unitedAdapter).toBeInstanceOf(GenericProgramAdapter);
    expect(unitedAdapter).not.toBeInstanceOf(FetchAdapter);
  });

  it('preserves program metadata through inheritance', () => {
    const unitedAdapter = new GenericProgramAdapter('united-shopping');
    const fetchAdapter = new FetchAdapter();

    expect(unitedAdapter.id).toBe('united-shopping');
    expect(unitedAdapter.displayName).toBe('United MileagePlus Shopping');
    expect(unitedAdapter.programType).toBe('airline');

    expect(fetchAdapter.id).toBe('fetch');
    expect(fetchAdapter.programType).toBe('receipt_app');
  });

  it('provides alternate earning methods only for Fetch adapter', async () => {
    const fetchAdapter = new FetchAdapter();
    const methods = await fetchAdapter.getAlternateEarningMethods();

    expect(methods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'receipt_scanning', actionUrl: 'https://fetch.com/app' }),
      ])
    );
  });
});
