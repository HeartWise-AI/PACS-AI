import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import NotFoundStudy from './NotFoundStudy';
import { recordViewerStudyRequest } from '@pacs-ai/extension-core/src/utils/viewerUrl';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notfoundstudy']}>
      <Routes>
        <Route
          path="/notfoundstudy"
          element={<NotFoundStudy />}
        />
        <Route
          path="*"
          element={<div>other</div>}
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

beforeEach(() => window.sessionStorage.clear());

test('a /viewer link to a study no longer cached is retrieved once through /open-study', async () => {
  recordViewerStudyRequest('/viewer', '?StudyInstanceUIDs=1.2.3&patientId=MRN1');
  renderPage();
  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toBe('/open-study?StudyInstanceUIDs=1.2.3')
  );
});

test('a failure after a /segmentation open does not reopen the earlier /viewer study', () => {
  recordViewerStudyRequest('/viewer', '?StudyInstanceUIDs=1.1');
  recordViewerStudyRequest('/segmentation', '?StudyInstanceUIDs=2.2');
  renderPage();
  expect(screen.getByTestId('location').textContent).toBe('/notfoundstudy');
});

test('after that attempt (or without a recent request) the message is shown', () => {
  recordViewerStudyRequest('/viewer', '?StudyInstanceUIDs=1.2.3');
  const first = renderPage();
  first.unmount();
  recordViewerStudyRequest('/viewer', '?StudyInstanceUIDs=1.2.3');
  renderPage();
  expect(screen.getByTestId('location').textContent).toBe('/notfoundstudy');
  expect(document.body.textContent).toContain(
    'One or more of the requested studies are not available at this time.'
  );
});
