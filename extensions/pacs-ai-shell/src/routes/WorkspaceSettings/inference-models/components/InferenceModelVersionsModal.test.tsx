import React from 'react';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react';
import InferenceModelVersionsModal from './InferenceModelVersionsModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '@pacs-ai/ui',
  () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
    Typography: ({ children, ...props }) => <div {...props}>{children}</div>,
  }),
  { virtual: true }
);

jest.mock('../../../../components/Modal', () => ({ children, isOpen }) =>
  isOpen ? <div>{children}</div> : null
);

describe('InferenceModelVersionsModal', () => {
  let renderer: RenderResult;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  test('replaces deployment actions with an OK button after completion', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = render(
        <InferenceModelVersionsModal
          isOpen
          model={null}
          versions={[]}
          selectedVersionId=""
          loading={false}
          deploying={false}
          deployment={{
            modelId: 'model-1',
            connectionMode: 'live',
            progress: {
              deploymentId: 'deployment-1',
              status: 'COMPLETED',
              stage: 'activate_candidate',
              sequence: 10,
              timestamp: 2000,
              elapsedMilliseconds: 125_000,
              terminal: true,
            },
          }}
          onClose={onClose}
          onSelect={jest.fn()}
          onDeploy={jest.fn()}
        />
      );
    });

    const buttons = renderer.container.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(
      Array.from(buttons[0].childNodes).map(node =>
        node.nodeType === Node.TEXT_NODE ? node.textContent : node
      )
    ).toEqual(['OK']);

    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
