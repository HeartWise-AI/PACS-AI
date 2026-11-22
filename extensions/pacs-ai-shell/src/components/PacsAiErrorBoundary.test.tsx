import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import PacsAiErrorBoundary, { describeError, PacsAiErrorFallback } from './PacsAiErrorBoundary';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function Crashes(): React.ReactElement {
  throw new TypeError("Cannot read properties of undefined (reading 'length')");
}

describe('PacsAiErrorBoundary', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    consoleError.mockRestore();
  });

  test('renders its children when nothing fails', () => {
    act(() =>
      root.render(
        <PacsAiErrorBoundary context="Viewer layout">
          <p id="ok">viewer</p>
        </PacsAiErrorBoundary>
      )
    );
    expect(container.querySelector('#ok')?.textContent).toBe('viewer');
    expect(container.querySelector('[data-testid="pacs-ai-error-fallback"]')).toBeNull();
  });

  test('replaces a crashed viewer with a message instead of a blank page', () => {
    act(() =>
      root.render(
        <PacsAiErrorBoundary context="Viewer layout">
          <Crashes />
        </PacsAiErrorBoundary>
      )
    );
    const fallback = container.querySelector('[data-testid="pacs-ai-error-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.getAttribute('role')).toBe('alert');
    expect(fallback?.getAttribute('data-context')).toBe('Viewer layout');
    expect(container.textContent).toContain('This page could not be displayed');
    expect(
      container.querySelector('[data-testid="pacs-ai-error-fallback-detail"]')?.textContent
    ).toBe("TypeError: Cannot read properties of undefined (reading 'length')");
    // The error and its component stack reach the console for diagnosis.
    expect(
      consoleError.mock.calls.some(call => String(call[0]).includes('Viewer layout failed to render'))
    ).toBe(true);
  });

  test('offers reload and a way back to the studies', () => {
    const onReload = jest.fn();
    const onBackToStudies = jest.fn();
    act(() =>
      root.render(
        <PacsAiErrorFallback
          context="Route /settings"
          error={new Error('boom')}
          onReload={onReload}
          onBackToStudies={onBackToStudies}
        />
      )
    );
    act(() =>
      (
        container.querySelector('[data-testid="pacs-ai-error-fallback-reload"]') as HTMLButtonElement
      ).click()
    );
    act(() =>
      (
        container.querySelector('[data-testid="pacs-ai-error-fallback-studies"]') as HTMLButtonElement
      ).click()
    );
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onBackToStudies).toHaveBeenCalledTimes(1);
  });

  test('describes any thrown value', () => {
    expect(describeError(new RangeError('bad'))).toBe('RangeError: bad');
    expect(describeError(new Error(''))).toBe('Error');
    expect(describeError('plain text')).toBe('plain text');
    expect(describeError(undefined)).toBe('Unknown error');
  });
});
