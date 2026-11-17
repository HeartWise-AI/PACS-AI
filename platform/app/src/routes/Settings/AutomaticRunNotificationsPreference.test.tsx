import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const mockLoad = jest.fn();
const mockSave = jest.fn();

jest.mock('@pacs-ai/extension-core/src/inferenceProcessing/notificationPreferences', () => ({
  loadNotifyAutomaticRuns: (...args: unknown[]) => mockLoad(...args),
  saveNotifyAutomaticRuns: (...args: unknown[]) => mockSave(...args),
}));

import AutomaticRunNotificationsPreference from './AutomaticRunNotificationsPreference';
import englishSettings from '../../../../i18n/src/locales/en-US/Settings.json';
import frenchSettings from '../../../../i18n/src/locales/fr/Settings.json';

describe('AutomaticRunNotificationsPreference', () => {
  let container: HTMLDivElement;
  let root: Root;
  const showAlert = jest.fn();
  const t = (key: string) => key;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  async function render() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <AutomaticRunNotificationsPreference
          t={t}
          showAlert={showAlert}
        />
      );
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const toggle = () =>
    container.querySelector('[data-testid="notify-automatic-runs"]') as HTMLButtonElement;

  it('shows the stored preference, on by default', async () => {
    mockLoad.mockResolvedValue(true);
    await render();
    expect(container.textContent).toContain('Notify me about automatic analyses');
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    expect(toggle().disabled).toBe(false);
  });

  it('mutes automatic analyses and saves the choice', async () => {
    mockLoad.mockResolvedValue(true);
    mockSave.mockResolvedValue(undefined);
    await render();

    await act(async () => {
      toggle().click();
    });

    expect(mockSave).toHaveBeenCalledWith(false);
    expect(toggle().getAttribute('aria-checked')).toBe('false');
  });

  it('restores the switch when saving fails', async () => {
    mockLoad.mockResolvedValue(false);
    mockSave.mockRejectedValue(new Error('network'));
    await render();
    expect(toggle().getAttribute('aria-checked')).toBe('false');

    await act(async () => {
      toggle().click();
    });

    expect(mockSave).toHaveBeenCalledWith(true);
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect(showAlert).toHaveBeenCalledWith('network', 'error');
  });

  it.each([
    ['English', englishSettings],
    ['French', frenchSettings],
  ])('%s defines every string of the preference', (_language, settings) => {
    [
      'Notify me about automatic analyses',
      'Bell and pop-up notifications when an automatic analysis finishes',
      'Failed to save the notification preference',
    ].forEach(key => {
      expect(settings[key as keyof typeof settings]).toBeTruthy();
    });
  });
});
