import React from 'react';
import { act, render, type RenderResult } from '@testing-library/react';
import {
  isRunningJobsCardClosed,
  readRunningJobsCollapsed,
  RUNNING_JOBS_COLLAPSED_STORAGE_KEY,
  useRunningJobsCardState,
  writeRunningJobsCollapsed,
  type RunningJobsCardState,
} from './useRunningJobsCardState';

describe('running jobs card state', () => {
  let state: RunningJobsCardState | null = null;

  function Probe({ ids }: { ids: string[] }) {
    state = useRunningJobsCardState(ids.map(id => ({ id })));
    return null;
  }

  beforeEach(() => {
    window.localStorage.clear();
    state = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('remembers the collapsed state in the browser', () => {
    let renderer: RenderResult;
    renderer = render(<Probe ids={['a']} />);
    expect(state!.collapsed).toBe(false);

    act(() => state!.toggleCollapsed());
    expect(state!.collapsed).toBe(true);
    expect(window.localStorage.getItem(RUNNING_JOBS_COLLAPSED_STORAGE_KEY)).toBe('1');

    // A new page load starts collapsed.
    renderer!.unmount();
    renderer = render(<Probe ids={['a']} />);
    expect(state!.collapsed).toBe(true);

    act(() => state!.toggleCollapsed());
    expect(state!.collapsed).toBe(false);
    expect(window.localStorage.getItem(RUNNING_JOBS_COLLAPSED_STORAGE_KEY)).toBe('0');
    renderer!.unmount();
  });

  test('works without storage', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(readRunningJobsCollapsed()).toBe(false);
    expect(() => writeRunningJobsCollapsed(true)).not.toThrow();

    let renderer: RenderResult;
    renderer = render(<Probe ids={['a']} />);
    act(() => state!.toggleCollapsed());
    expect(state!.collapsed).toBe(true);
    renderer!.unmount();
  });

  test('stays closed until a new run starts', () => {
    let renderer: RenderResult;
    renderer = render(<Probe ids={['a', 'b']} />);
    expect(state!.closed).toBe(false);

    act(() => state!.close());
    expect(state!.closed).toBe(true);

    // The closed runs going on or ending do not bring the card back.
    renderer!.rerender(<Probe ids={['a']} />);
    expect(state!.closed).toBe(true);
    renderer!.rerender(<Probe ids={[]} />);
    expect(state!.closed).toBe(true);

    renderer!.rerender(<Probe ids={['a', 'c']} />);
    expect(state!.closed).toBe(false);
    // Closing is not persisted.
    expect(window.localStorage.getItem(RUNNING_JOBS_COLLAPSED_STORAGE_KEY)).toBeNull();
    renderer!.unmount();
  });

  test('isRunningJobsCardClosed', () => {
    expect(isRunningJobsCardClosed([{ id: 'a' }], null)).toBe(false);
    expect(isRunningJobsCardClosed([{ id: 'a' }], ['a', 'b'])).toBe(true);
    expect(isRunningJobsCardClosed([{ id: 'a' }, { id: 'c' }], ['a'])).toBe(false);
  });
});
