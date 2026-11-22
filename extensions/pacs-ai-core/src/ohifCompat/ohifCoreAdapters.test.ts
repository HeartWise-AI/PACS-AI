import { renderHook } from '@testing-library/react';
import useSafeCustomization from './useSafeCustomization';
import useViewportElement from './viewportElement';
import { formatDICOMDate, formatPatientName } from './dates';
import { getStudyMetadata } from './studyMetadata';

const mockCustomizationService = { getCustomization: jest.fn(() => 'value') };
const mockViewportRef = { current: null };

jest.mock(
  '@ohif/core',
  () => ({
    useSystem: () => ({ servicesManager: { services: { customizationService: mockCustomizationService } } }),
    useViewportRef: jest.fn(() => mockViewportRef),
    utils: {
      formatDate: jest.fn((date: string) => `formatted ${date}`),
      formatPN: jest.fn((name: string) => (name ? name.replace('^', ', ') : undefined)),
    },
    DicomMetadataStore: { getStudy: jest.fn(uid => ({ StudyInstanceUID: uid })) },
  }),
  { virtual: true }
);

describe('ohifCompat adapters over @ohif/core', () => {
  test('useSafeCustomization reads through the customization service', () => {
    const { result } = renderHook(() => useSafeCustomization('ohif.tours'));
    expect(result.current).toBe('value');
    expect(mockCustomizationService.getCustomization).toHaveBeenCalledWith('ohif.tours');
  });

  test('useViewportElement returns the viewport ref', () => {
    const { result } = renderHook(() => useViewportElement('viewport-1'));
    expect(result.current).toBe(mockViewportRef);
  });

  test('dates and names are formatted with OHIF utils', () => {
    expect(formatDICOMDate('20260101')).toBe('formatted 20260101');
    expect(formatPatientName('Doe^Jane')).toBe('Doe, Jane');
    expect(formatPatientName(undefined)).toBe('');
  });

  test('getStudyMetadata reads the metadata store', () => {
    expect(getStudyMetadata('1.2.3')).toEqual({ StudyInstanceUID: '1.2.3' });
  });
});
