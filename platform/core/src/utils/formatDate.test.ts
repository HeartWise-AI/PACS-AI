import 'moment/locale/fr';
import i18n from 'i18next';
import formatDate from './formatDate';

jest.mock('i18next', () => ({
  language: 'en',
  t: jest.fn(() => 'DD/MM/YYYY'),
}));

describe('formatDate OHIF 3.12 contract', () => {
  beforeEach(() => {
    (i18n as unknown as { language: string }).language = 'en';
  });

  it.each(['20240102', '2024.01.02'])('strictly parses the DICOM date %s', date => {
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2024-01-02');
  });

  it('formats a DICOM date with the active locale', () => {
    (i18n as unknown as { language: string }).language = 'fr';

    expect(formatDate('20240102', 'D MMMM YYYY')).toBe('2 janvier 2024');
  });

  it('uses the translated default format and keeps empty dates empty', () => {
    expect(formatDate('20240102')).toBe('02/01/2024');
    expect(formatDate('')).toBe('');
  });
});
