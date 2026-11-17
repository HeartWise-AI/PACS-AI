import type { GetInferenceIngestionJobsResponse } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import {
  buildIngestionJobNotificationsUpdate,
  formatIngestionJobCreator,
  isIngestionJobNotificationsEnabled,
  UNKNOWN_JOB_CREATOR,
} from './ingestionJobNotifications';
import englishCommon from '@pacs-ai/extension-core/src/locales/en-US/Common.json';
import frenchCommon from '@pacs-ai/extension-core/src/locales/fr/Common.json';

const job: GetInferenceIngestionJobsResponse = {
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
  recentWindowMinutes: 300,
  missingPollsThreshold: 4,
  studyTimeStart: '07:00',
  studyTimeEnd: '19:00',
  createdAt: 1,
  updatedAt: 2,
  createdByUserId: 'user-a',
  notificationsEnabled: true,
};

describe('ingestion job notifications', () => {
  test('a job notifies unless the gateway says otherwise', () => {
    expect(isIngestionJobNotificationsEnabled(job)).toBe(true);
    expect(isIngestionJobNotificationsEnabled({ notificationsEnabled: false })).toBe(false);
    expect(isIngestionJobNotificationsEnabled({})).toBe(true);
  });

  test('the switch update sends every other setting back unchanged', () => {
    expect(buildIngestionJobNotificationsUpdate(job, false)).toEqual({
      id: 'job-1',
      modalities: ['XA'],
      intervalInMinutes: 15,
      scheduleStartTimestamp: 0,
      scheduleEndTimestamp: 0,
      recentWindowMinutes: 300,
      missingPollsThreshold: 4,
      studyTimeStart: '07:00',
      studyTimeEnd: '19:00',
      notificationsEnabled: false,
    });
  });

  test('refuses an update that could not preserve the job timing', () => {
    expect(
      buildIngestionJobNotificationsUpdate({ ...job, stabilityMinutes: undefined }, true)
    ).toBeNull();
  });

  test('names the creator when the member is known', () => {
    const users = new Map([
      ['user-a', { name: 'Synthetic Admin', email: 'admin@example.invalid' }],
      ['user-b', { name: '', email: 'member@example.invalid' }],
    ]);
    expect(formatIngestionJobCreator(job, users)).toBe('Synthetic Admin');
    expect(formatIngestionJobCreator({ createdByUserId: 'user-b' }, users)).toBe(
      'member@example.invalid'
    );
    expect(formatIngestionJobCreator({ createdByUserId: 'user-gone' }, users)).toBe(
      UNKNOWN_JOB_CREATOR
    );
    expect(formatIngestionJobCreator({ createdByUserId: null }, users)).toBe(UNKNOWN_JOB_CREATOR);
    expect(formatIngestionJobCreator({}, users)).toBe(UNKNOWN_JOB_CREATOR);
  });

  test.each([
    ['English', englishCommon],
    ['French', frenchCommon],
  ])('%s names the new columns', (_language, common) => {
    expect(common['Created by' as keyof typeof common]).toBeTruthy();
    expect(common['Notifications' as keyof typeof common]).toBeTruthy();
  });
});
