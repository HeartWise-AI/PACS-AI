import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const mockResetViewerTour = jest.fn();

jest.mock('@pacs-ai/extension-core/src/service/viewerTourService', () => ({
  resetViewerTour: (...args: unknown[]) => mockResetViewerTour(...args),
}));

import ViewerTourPreference from './ViewerTourPreference';

describe('ViewerTourPreference', () => {
  let container: HTMLDivElement;
  let root: Root;
  const showAlert = jest.fn();
  const t = (key: string) => key;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ViewerTourPreference
          t={t}
          showAlert={showAlert}
        />
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const button = () =>
    container.querySelector('[data-testid="show-viewer-tour-again"]') as HTMLButtonElement;

  it('renders the "Show the viewer tour again" control', () => {
    expect(button().textContent).toBe('Show the viewer tour again');
  });

  it('resets the viewer tour and confirms', async () => {
    mockResetViewerTour.mockResolvedValue(undefined);

    await act(async () => {
      button().click();
    });

    expect(mockResetViewerTour).toHaveBeenCalledTimes(1);
    expect(showAlert).toHaveBeenCalledWith(
      'The viewer tour will show the next time you open a study',
      'success'
    );
    expect(button().disabled).toBe(false);
  });

  it('reports a failed reset', async () => {
    mockResetViewerTour.mockRejectedValue({ message: 'Service unavailable' });

    await act(async () => {
      button().click();
    });

    expect(showAlert).toHaveBeenCalledWith('Service unavailable', 'error');
  });
});
