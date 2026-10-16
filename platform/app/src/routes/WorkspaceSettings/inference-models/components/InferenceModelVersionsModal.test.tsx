import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import InferenceModelVersionsModal from './InferenceModelVersionsModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '@ohif/ui',
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
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  test('replaces deployment actions with an OK button after completion', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = TestRenderer.create(
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

    const buttons = renderer.root.findAllByType('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].children).toEqual(['OK']);

    act(() => buttons[0].props.onClick());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
