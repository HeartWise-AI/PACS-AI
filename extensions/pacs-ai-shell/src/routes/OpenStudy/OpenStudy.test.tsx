import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import OpenStudy from './OpenStudy';
import type { OpenStudyRepository } from '@pacs-ai/extension-inference/src/studyRefresh/openStudyRetrieve';
import { PENDING_RETRIEVE_STORAGE_KEY } from '@pacs-ai/extension-inference/src/studyRefresh/progressiveRetrieve';
import { takeViewerStudyToRetrieve, recordViewerStudyRequest } from '@pacs-ai/extension-core/src/utils/viewerUrl';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const UID = '1.2.840.113619.2.1';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderAt(path: string, repository: OpenStudyRepository) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/open-study"
          element={<OpenStudy repository={repository} />}
        />
        <Route
          path="*"
          element={<div>other page</div>}
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

function repo(overrides: Partial<OpenStudyRepository> = {}): OpenStudyRepository {
  return {
    loadModalities: jest.fn(async () => ({ PACS_QUERY: {} })),
    retrieveStudy: jest.fn(async () => []),
    loadJobs: jest.fn(async () => []),
    isStored: jest.fn(async () => false),
    ...overrides,
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

test('retrieves the study, then replaces itself with the viewer (no patient keys)', async () => {
  let release: (jobs: unknown[]) => void = () => undefined;
  const repository = repo({
    retrieveStudy: jest.fn(
      () =>
        new Promise(resolve => {
          release = resolve as (jobs: unknown[]) => void;
        })
    ) as OpenStudyRepository['retrieveStudy'],
    loadJobs: jest.fn(async () => [
      { id: 'a', progress: 100, state: 'Success' },
      { id: 'b', progress: 0, state: 'Pending' },
    ]),
  });
  renderAt(
    `/open-study?StudyInstanceUIDs=${UID}&modalitiesInStudy=XA&patientId=MRN1`,
    repository
  );
  // Loading state while the PACS answers.
  expect(screen.getByRole('status').textContent).toContain('OpenStudyRetrieving');
  await waitFor(() => expect(repository.retrieveStudy).toHaveBeenCalled());
  release([
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
  ]);
  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toBe(
      `/viewer?StudyInstanceUIDs=${UID}&modalitiesInStudy=XA`
    )
  );
  expect(repository.retrieveStudy).toHaveBeenCalledWith({
    modalityId: 'PACS_QUERY',
    studyInstanceUID: UID,
  });
  // The viewer follows the series still arriving.
  expect(JSON.parse(window.sessionStorage.getItem(PENDING_RETRIEVE_STORAGE_KEY) || '{}')[UID].jobIds).toEqual(['b']);
  // The not-found page will not retrieve it a second time.
  recordViewerStudyRequest('/viewer', `?StudyInstanceUIDs=${UID}`);
  expect(takeViewerStudyToRetrieve()).toBeNull();
});

test('shows why a study cannot be opened, with a retry and a way back', async () => {
  const repository = repo({
    retrieveStudy: jest.fn(async () => {
      throw new Error('C-MOVE refused');
    }),
  });
  renderAt(`/open-study?StudyInstanceUIDs=${UID}`, repository);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('OpenStudyRetrieveFailed'));
  expect(screen.getByRole('link', { name: 'OpenStudyBackToList' }).getAttribute('href')).toBe('/');

  (repository.retrieveStudy as jest.Mock).mockResolvedValueOnce([]);
  fireEvent.click(screen.getByRole('button', { name: 'OpenStudyTryAgain' }));
  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toBe(`/viewer?StudyInstanceUIDs=${UID}`)
  );
});

test('a link without a study UID says so and retrieves nothing', async () => {
  const repository = repo();
  renderAt('/open-study?patientId=MRN1', repository);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('OpenStudyMissing'));
  expect(screen.queryByRole('button', { name: 'OpenStudyTryAgain' })).toBeNull();
  expect(repository.loadModalities).not.toHaveBeenCalled();
});
