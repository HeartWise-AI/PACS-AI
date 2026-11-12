import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import SelectSeriesModal from './SelectSeriesModal';
import { useGlobalStateData } from '../../GlobalStateProvider';
import { AlertContext } from '../../AlertProvider';
import type { GetInferenceAvailableModelsResponse } from '../../api/inferenceDTO';

jest.mock('../../GlobalStateProvider', () => ({ useGlobalStateData: jest.fn() }));
jest.mock('@ohif/ui-next', () => ({ Input: 'input' }));
jest.mock('react-dom', () => ({ createPortal: children => children }));

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
  let renderer: ReactTestRenderer;
  const predict = jest.fn();
  const alert = jest.fn();

  const button = (label: string) =>
    renderer.root.findAllByType('button').find(node => node.children.includes(label))!;
  const status = () => renderer.root.findByProps({ role: 'status' }).children.join('');
  const countInput = () => renderer.root.findByProps({ id: 'first-series-count' });
  const chooseCount = (value: string) => {
    act(() => countInput().props.onChange({ target: { value } }));
    act(() => button('Select').props.onClick());
  };
  const mount = (overrides = {}) => {
    act(() => {
      renderer = TestRenderer.create(
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
    (useGlobalStateData as jest.Mock).mockReturnValue({
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
    expect(countInput().props.max).toBe(2);
    expect(
      renderer.root.findAllByType('h4').filter(node => node.children.includes('third'))
    ).toHaveLength(1);

    chooseCount('100');
    expect(status()).toBe('2 selected · Maximum: 2 · 3 available');
    act(() => button('Apply').props.onClick());
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
    const bulk = renderer.root
      .findAllByType('button')
      .find(node =>
        node.findAllByType('span').some(span => span.children.includes('Select maximum'))
      )!;
    act(() => bulk.props.onClick());
    const lastRow = renderer.root.findAllByType('h4').find(node => node.children.includes('first'))!
      .parent!.parent!.parent!;
    act(() => lastRow.props.onClick());
    expect(status()).toBe('2 selected · Maximum: 2 · 3 available');
    expect(alert).toHaveBeenCalledWith('Please select no more than 2 series', 'error');
    act(() => bulk.props.onClick());
    expect(status()).toBe('0 selected · Maximum: 2 · 3 available');
  });

  test('first X replaces an initial selection and retains minimum validation', () => {
    mount({
      selectedInferenceModel: { ...model, dicomUploadMin: 2 },
      initialSeriesSelection: { selectedSeries: ['first'], studyInstanceUID: 'study-1' },
    });
    expect(status()).toBe('1 selected · Maximum: 2 · 3 available');
    chooseCount('1');
    act(() => button('Apply').props.onClick());
    expect(alert).toHaveBeenCalledWith('Please select at least 2 series to continue', 'error');
    expect(predict).not.toHaveBeenCalled();
    chooseCount('2');
    act(() => button('Apply').props.onClick());
    expect(predict.mock.calls[0][1]).toEqual(['third', 'second']);
  });

  test('disables invalid counts and caps selection to available series', () => {
    mount({ selectedInferenceModel: { ...model, dicomUploadMax: 10 } });
    expect(countInput().props.max).toBe(3);
    for (const value of ['', '0', '-1', '1.5']) {
      act(() => countInput().props.onChange({ target: { value } }));
      expect(button('Select').props.disabled).toBe(true);
    }
    chooseCount('10');
    expect(status()).toBe('3 selected · Maximum: 10 · 3 available');
  });
});
