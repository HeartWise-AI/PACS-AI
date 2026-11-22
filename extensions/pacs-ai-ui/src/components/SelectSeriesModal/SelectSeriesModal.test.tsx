import React from 'react';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react';
import SelectSeriesModal from './SelectSeriesModal';
import useStudyContext from '@pacs-ai/extension-core/src/hooks/useStudyContext';
import { AlertContext } from '@pacs-ai/extension-core/src/providers/AlertProvider';
import type { GetInferenceAvailableModelsResponse } from '@pacs-ai/extension-core/src/api/inferenceDTO';

jest.mock('@pacs-ai/extension-core/src/hooks/useStudyContext', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@ohif/ui-next', () => ({ Input: 'input' }));
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: children => children,
}));

const series = (uid: string, modality = 'XA') => ({
  SeriesInstanceUID: uid,
  StudyInstanceUID: 'study-1',
  modality,
  seriesNumber: uid,
  numInstances: 1,
});
const model = {
  containerId: 'model-container',
  dicomUploadMin: 1,
  dicomUploadMax: 2,
  supportedDicomModalities: ['XA'],
  supportedAdditionalMetadata: [],
  outputMode: 'HTML',
} as GetInferenceAvailableModelsResponse;

describe('SelectSeriesModal series count selection', () => {
  let renderer: RenderResult;
  const predict = jest.fn();
  const alert = jest.fn();

  const single = <T extends Element>(nodes: NodeListOf<T>): T => {
    expect(nodes).toHaveLength(1);
    return nodes[0];
  };
  // True when `text` is one of the node's direct text children.
  const hasTextChild = (node: Element, text: string) =>
    Array.from(node.childNodes).some(
      child => child.nodeType === Node.TEXT_NODE && child.textContent === text
    );
  const all = (selector: string) => Array.from(renderer.container.querySelectorAll(selector));
  const button = (label: string) =>
    all('button').find(node => hasTextChild(node, label)) as HTMLButtonElement;
  const status = () => single(renderer.container.querySelectorAll('[role="status"]')).textContent;
  const countInput = () =>
    single(renderer.container.querySelectorAll<HTMLInputElement>('[id="first-series-count"]'));
  const chooseCount = (value: string) => {
    fireEvent.change(countInput(), { target: { value } });
    fireEvent.click(button('Select'));
  };
  const mount = (overrides = {}) => {
    act(() => {
      renderer = render(
        <AlertContext.Provider value={alert}>
          <SelectSeriesModal
            isOpen
            onClose={jest.fn()}
            applyPredictInferenceModel={predict}
            loading={false}
            title="JEPA"
            selectedInferenceModel={model}
            {...overrides}
          />
        </AlertContext.Provider>
      );
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useStudyContext as jest.Mock).mockReturnValue({
      selectedModalities: {
        CT: { modality: 'CT', displaySets: [series('excluded-group', 'CT')] },
        XA: {
          modality: 'XA',
          displaySets: [
            series('third'),
            series('third'),
            series('second'),
            series('excluded', 'CT'),
            series('first'),
          ],
        },
      },
    });
  });

  afterEach(() => act(() => renderer?.unmount()));

  test('selects unique supported series in displayed order and caps at the model maximum', () => {
    mount();
    expect(status()).toBe('0 selected · Maximum: 2 · 3 available');
    expect(countInput().getAttribute('max')).toBe('2');
    expect(
      all('h4').filter(node => hasTextChild(node, 'third'))
    ).toHaveLength(1);

    chooseCount('100');
    expect(status()).toBe('2 selected · Maximum: 2 · 3 available');
    fireEvent.click(button('Apply'));
    expect(predict).toHaveBeenCalledWith(
      'model-container',
      ['third', 'second'],
      'study-1',
      {},
      'HTML'
    );
  });

  test('bulk selection respects the maximum and manual clicks cannot exceed it', () => {
    mount();
    const bulk = all('button').find(node =>
      Array.from(node.querySelectorAll('span')).some(span => hasTextChild(span, 'Select maximum'))
    )!;
    fireEvent.click(bulk);
    const lastRow = all('h4').find(node => hasTextChild(node, 'first'))!
      .parentElement!.parentElement!.parentElement!;
    fireEvent.click(lastRow);
    expect(status()).toBe('2 selected · Maximum: 2 · 3 available');
    expect(alert).toHaveBeenCalledWith('Please select no more than 2 series', 'error');
    fireEvent.click(bulk);
    expect(status()).toBe('0 selected · Maximum: 2 · 3 available');
  });

  test('first X replaces an initial selection and retains minimum validation', () => {
    mount({
      selectedInferenceModel: { ...model, dicomUploadMin: 2 },
      initialSeriesSelection: { selectedSeries: ['first'], studyInstanceUID: 'study-1' },
    });
    expect(status()).toBe('1 selected · Maximum: 2 · 3 available');
    chooseCount('1');
    fireEvent.click(button('Apply'));
    expect(alert).toHaveBeenCalledWith('Please select at least 2 series to continue', 'error');
    expect(predict).not.toHaveBeenCalled();
    chooseCount('2');
    fireEvent.click(button('Apply'));
    expect(predict.mock.calls[0][1]).toEqual(['third', 'second']);
  });

  test('switches between exams without mixing series or retaining the previous selection', () => {
    (useStudyContext as jest.Mock).mockReturnValue({ selectedModalities: {
      exam1: { modality: 'XA', displaySets: [series('old-series')] },
      exam2: { modality: 'XA', displaySets: [{ ...series('new-series'), StudyInstanceUID: 'study-2', studyDate: '2026-11-12' }] },
    } });
    mount();
    chooseCount('1');
    const examPicker = () =>
      single(renderer.container.querySelectorAll<HTMLSelectElement>('[id="ai-exam-selection"]'));
    expect(examPicker().querySelectorAll('option')).toHaveLength(2);
    fireEvent.change(examPicker(), { target: { value: 'study-2' } });
    expect(status()).toBe('0 selected · Maximum: 2 · 1 available');
    expect(all('h4').some(node => hasTextChild(node, 'old-series'))).toBe(false);
    chooseCount('1');
    fireEvent.click(button('Apply'));
    expect(predict).toHaveBeenCalledWith('model-container', ['new-series'], 'study-2', {}, 'HTML');
  });

  test('preserves the chosen exam when bulk selection is cleared', () => {
    (useStudyContext as jest.Mock).mockReturnValue({ selectedModalities: {
      XA: { modality: 'XA', displaySets: [series('old'), { ...series('new'), StudyInstanceUID: 'study-2' }] },
    } });
    mount({ initialSeriesSelection: { selectedSeries: ['new'], studyInstanceUID: 'study-2' } });
    expect(status()).toBe('1 selected · Maximum: 2 · 1 available');
    const bulk = all('button').find(node =>
      Array.from(node.querySelectorAll('span')).some(span => hasTextChild(span, 'Select all')))!;
    fireEvent.click(bulk);
    expect(
      single(renderer.container.querySelectorAll<HTMLSelectElement>('[id="ai-exam-selection"]')).value
    ).toBe('study-2');
    expect(status()).toBe('0 selected · Maximum: 2 · 1 available');
    fireEvent.click(bulk);
    fireEvent.click(button('Apply'));
    expect(predict.mock.calls[0][2]).toBe('study-2');
  });

  test('skips report, PDF and still-image series in displayed rows and bulk requests', () => {
    (useStudyContext as jest.Mock).mockReturnValue({ selectedModalities: {
      XA: { modality: 'XA', displaySets: [
        { ...series('rapport'), description: 'RAPPORT', numImageFrames: 20 },
        { ...series('pdf'), SOPClassUID: '1.2.840.10008.5.1.4.1.1.104.1' },
        { ...series('still'), numImageFrames: 1 },
        { ...series('cine'), numInstances: 1, numImageFrames: 40, isMultiFrame: true },
      ] },
    } });
    mount();
    expect(status()).toBe('0 selected · Maximum: 2 · 1 available');
    chooseCount('2');
    fireEvent.click(button('Apply'));
    expect(predict).toHaveBeenCalledWith('model-container', ['cine'], 'study-1', {}, 'HTML');
  });

  test('disables invalid counts and caps selection to available series', () => {
    mount({ selectedInferenceModel: { ...model, dicomUploadMax: 10 } });
    expect(countInput().getAttribute('max')).toBe('3');
    for (const value of ['', '0', '-1', '1.5']) {
      fireEvent.change(countInput(), { target: { value } });
      expect(button('Select').disabled).toBe(true);
    }
    chooseCount('10');
    expect(status()).toBe('3 selected · Maximum: 10 · 3 available');
  });

  test('shows the default loading text without a dismiss button', () => {
    mount({ loading: true });

    expect(status()).toBe('Applying inference and generating results...');
    expect(renderer.container.querySelectorAll('button')).toHaveLength(0);
  });

  test('shows a custom loading message that can be dismissed', () => {
    const dismiss = jest.fn();
    mount({
      loading: true,
      loadingMessage: 'Running JEPA…',
      onDismissLoading: dismiss,
      dismissLoadingLabel: 'Continue in background',
    });

    expect(status()).toBe('Running JEPA…');
    fireEvent.click(button('Continue in background'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
