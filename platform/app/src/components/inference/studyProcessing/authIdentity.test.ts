import { getStudyProcessingAuthIdentity, shouldClearStudyProcessingState } from './authIdentity';

describe('study processing auth identity', () => {
  const firstIdentity = getStudyProcessingAuthIdentity({
    id: 'user-1',
    tenantId: 'tenant-1',
  });

  it('does not clear when the first authenticated identity is resolved', () => {
    expect(shouldClearStudyProcessingState(null, firstIdentity)).toBe(false);
  });

  it('does not clear when the authenticated identity is unchanged', () => {
    expect(shouldClearStudyProcessingState(firstIdentity, firstIdentity)).toBe(false);
  });

  it('clears when the authenticated user changes', () => {
    const nextIdentity = getStudyProcessingAuthIdentity({
      id: 'user-2',
      tenantId: 'tenant-1',
    });

    expect(shouldClearStudyProcessingState(firstIdentity, nextIdentity)).toBe(true);
  });

  it('clears when the authenticated tenant changes', () => {
    const nextIdentity = getStudyProcessingAuthIdentity({
      id: 'user-1',
      tenantId: 'tenant-2',
    });

    expect(shouldClearStudyProcessingState(firstIdentity, nextIdentity)).toBe(true);
  });

  it('clears when there is no authenticated identity', () => {
    expect(shouldClearStudyProcessingState(firstIdentity, null)).toBe(true);
  });
});
