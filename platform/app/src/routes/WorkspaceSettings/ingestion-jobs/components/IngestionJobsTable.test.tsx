import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { GetInferenceIngestionJobsResponse } from '../../../../api/inferenceDTO';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./IngestionJobActionButton', () => ({
  __esModule: true,
  default: () => null,
}));

import IngestionJobsTable from './IngestionJobsTable';

const baseJob: GetInferenceIngestionJobsResponse = {
  id: 'job-1',
  tenantId: 'tenant-1',
  containerId: 'container-1',
  dicomModality: 'ORTHANC',
  stabilityMinutes: 15,
  modelId: 'model-1',
  modelName: 'Model',
  modelVersion: '1.0.0',
  modalities: ['XA'],
  status: 'RUNNING',
  scheduleStartTimestamp: 0,
  scheduleEndTimestamp: 0,
  createdAt: 1,
  updatedAt: 2,
  createdByUserId: 'user-a',
  notificationsEnabled: true,
};

describe('IngestionJobsTable notifications', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onToggleNotifications = jest.fn();

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  function render(jobs: GetInferenceIngestionJobsResponse[], togglingNotificationsJobId = '') {
    act(() => {
      root.render(
        <IngestionJobsTable
          jobs={jobs}
          loading={false}
          starting={false}
          stopping={false}
          selectedJobToStartStop=""
          onStartStop={jest.fn()}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          usersById={new Map([['user-a', { name: 'Synthetic Admin', email: 'a@example.invalid' }]])}
          togglingNotificationsJobId={togglingNotificationsJobId}
          onToggleNotifications={onToggleNotifications}
        />
      );
    });
  }

  beforeEach(() => {
    onToggleNotifications.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const toggle = (id: string) =>
    container.querySelector(
      `[data-testid="ingestion-job-notifications-${id}"]`
    ) as HTMLButtonElement;
  const creator = (id: string) =>
    container.querySelector(`[data-testid="ingestion-job-creator-${id}"]`)?.textContent;

  it('shows the creator and the switch of each job', () => {
    render([
      baseJob,
      { ...baseJob, id: 'job-2', createdByUserId: null, notificationsEnabled: false },
      { ...baseJob, id: 'job-3', createdByUserId: undefined, notificationsEnabled: undefined },
    ]);

    expect(creator('job-1')).toBe('Synthetic Admin');
    expect(creator('job-2')).toBe('—');
    expect(creator('job-3')).toBe('—');
    expect(toggle('job-1').getAttribute('aria-checked')).toBe('true');
    expect(toggle('job-2').getAttribute('aria-checked')).toBe('false');
    // An older gateway that does not report the switch: notifications are on.
    expect(toggle('job-3').getAttribute('aria-checked')).toBe('true');
  });

  it('turns a job notifications off through the callback', () => {
    render([baseJob]);
    act(() => toggle('job-1').click());
    expect(onToggleNotifications).toHaveBeenCalledWith(baseJob, false);
  });

  it('disables the switch while its update is saving', () => {
    render([baseJob], 'job-1');
    expect(toggle('job-1').disabled).toBe(true);
  });
});
