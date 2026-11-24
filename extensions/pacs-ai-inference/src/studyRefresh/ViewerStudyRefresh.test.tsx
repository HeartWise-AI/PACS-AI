import React from 'react';
import { act, render } from '@testing-library/react';
import { ViewerStudyRefresh } from './ViewerStudyRefresh';
import { PENDING_RETRIEVE_STORAGE_KEY, rememberPendingRetrieve } from './progressiveRetrieve';

const mockLoadJobs = jest.fn();

jest.mock('./studyRefreshRepository', () => ({
  createStudyRefreshRepository: () => ({
    loadJobs: (ids: string[]) => mockLoadJobs(ids),
    refreshStudy: jest.fn(),
  }),
}));
jest.mock('./useStudyRefresh', () => ({
  useStudyRefresh: () => ({ state: { status: 'idle' }, refresh: jest.fn() }),
}));
jest.mock('./studyGrowingStore', () => ({ useStudyGrowing: () => false }));
jest.mock('./StudyRefreshButton', () => ({ StudyRefreshButton: () => null }));
jest.mock('./reloadStudySeries', () => ({
  canReloadStudySeries: () => true,
  reloadStudySeries: jest.fn(() => Promise.resolve()),
  snapshotStudySeries: () => [],
}));
jest.mock('@pacs-ai/extension-core/src/ohifCompat/studyMetadata', () => ({
  getStudyMetadata: () => null,
}));

const dataSource = {} as never;
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

describe('ViewerStudyRefresh: series still arriving', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockLoadJobs.mockReset();
    mockLoadJobs.mockResolvedValue([{ id: 'b', progress: 0, state: 'Running' }]);
  });

  it('hands the jobs back when the study panel closes, and resumes when it opens', async () => {
    rememberPendingRetrieve('1.2.3', ['b']);
    const first = render(
      <ViewerStudyRefresh
        studyInstanceUID="1.2.3"
        dataSource={dataSource}
      />
    );
    await flush();
    expect(mockLoadJobs).toHaveBeenCalledWith(['b']);
    expect(window.sessionStorage.getItem(PENDING_RETRIEVE_STORAGE_KEY)).toBe('{}');

    first.unmount();
    expect(JSON.parse(window.sessionStorage.getItem(PENDING_RETRIEVE_STORAGE_KEY)!)).toMatchObject({
      '1.2.3': { jobIds: ['b'] },
    });

    mockLoadJobs.mockClear();
    const second = render(
      <ViewerStudyRefresh
        studyInstanceUID="1.2.3"
        dataSource={dataSource}
      />
    );
    await flush();
    expect(mockLoadJobs).toHaveBeenCalledWith(['b']);
    second.unmount();
  });

  it('does not hand back jobs that already ended', async () => {
    mockLoadJobs.mockResolvedValue([{ id: 'b', progress: 100, state: 'Success' }]);
    rememberPendingRetrieve('1.2.3', ['b']);
    const view = render(
      <ViewerStudyRefresh
        studyInstanceUID="1.2.3"
        dataSource={dataSource}
      />
    );
    await flush();
    await flush();
    view.unmount();
    expect(window.sessionStorage.getItem(PENDING_RETRIEVE_STORAGE_KEY)).toBe('{}');
  });
});
