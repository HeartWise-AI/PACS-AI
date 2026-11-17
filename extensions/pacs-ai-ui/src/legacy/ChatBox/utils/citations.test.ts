import { chatBoxLocales, setTestLocale, translate } from '../testUtils/chatBoxTranslation';
import {
  citationDomain,
  citationLabel,
  citationName,
  formatCitationDate,
  safeExternalURL,
  toCitations,
} from './citations';

const MODEL = {
  index: 1,
  kind: 'model_result',
  modelName: 'DeepCORO-JEPA',
  modelVersion: '2.1.0',
  completedAt: '2026-11-13 09:00:00',
  studyInstanceUID: '2.25.9',
  studyServiceJobId: 'job-1',
  title: 'DeepCORO-JEPA',
  summary: 'Coronary reading: 2 significant stenosis segment(s)',
  outputMode: null,
};
const SOURCE = {
  index: 4,
  kind: 'web_source',
  title: '2024 ESC Guidelines',
  url: 'https://www.escardio.org/Guidelines/ccs',
};

describe('toCitations', () => {
  it('keeps the citations of the contract', () => {
    expect(toCitations([MODEL, SOURCE])).toEqual([MODEL, { ...SOURCE }]);
  });

  it('returns nothing for a response without citations', () => {
    expect(toCitations(undefined)).toBeUndefined();
    expect(toCitations(null)).toBeUndefined();
    expect(toCitations([])).toBeUndefined();
    expect(toCitations({ index: 1 })).toBeUndefined();
  });

  it('drops what it cannot use and tolerates missing and unknown fields', () => {
    expect(
      toCitations([
        null,
        'text',
        { index: 0, kind: 'web_source', title: 'zero' },
        { index: 1.5, kind: 'web_source', title: 'fraction' },
        { index: '2', kind: 'web_source', title: 'string index' },
        { index: 3, kind: 'a_future_kind', title: 'unknown kind' },
        { index: 4, kind: 'model_result' },
        { index: 5, kind: 'web_source' },
        { index: 6, kind: 'model_result', modelName: 'EchoPrime', a_future_field: true },
        { index: 6, kind: 'web_source', title: 'same index again' },
        { index: 7, kind: 'web_source', url: 'https://example.org/a' },
      ])
    ).toEqual([
      {
        index: 6,
        kind: 'model_result',
        modelName: 'EchoPrime',
        modelVersion: null,
        completedAt: null,
        studyInstanceUID: null,
        studyServiceJobId: null,
        title: null,
        summary: null,
        outputMode: null,
      },
      { index: 7, kind: 'web_source', title: null, url: 'https://example.org/a' },
    ]);
  });
});

describe('citation texts', () => {
  afterEach(() => setTestLocale('en-US'));

  it('names a model result by its title and version and a source by its title', () => {
    const [model, source] = toCitations([MODEL, SOURCE])!;
    expect(citationName(model)).toBe('DeepCORO-JEPA 2.1.0');
    expect(citationName(source)).toBe('2024 ESC Guidelines');
    expect(citationName(toCitations([{ ...SOURCE, title: undefined }])![0])).toBe('escardio.org');
    expect(citationLabel(model, translate)).toBe('Source 1: DeepCORO-JEPA 2.1.0');
    expect(citationLabel(source, translate)).toBe('Source 4: 2024 ESC Guidelines');
  });

  it('labels a chip in French', () => {
    setTestLocale('fr');
    const [model] = toCitations([MODEL])!;
    expect(citationLabel(model, translate)).toBe('Source 1 : DeepCORO-JEPA 2.1.0');
  });

  it('has the citation strings in French', () => {
    expect(chatBoxLocales.fr).toMatchObject({
      CitationOpenResult: 'Ouvrir le résultat',
      CitationRawResult: 'Résultat brut',
      CitationResultUnavailable: "Ce résultat n'est pas disponible dans la visionneuse",
      CitationWebSource: 'Source publiée',
      CitationCompletedAt: 'Terminé le {{date}}',
    });
  });

  it('shows the domain of a web link and refuses anything else', () => {
    expect(citationDomain('https://www.escardio.org/Guidelines/ccs')).toBe('escardio.org');
    expect(citationDomain('http://pubmed.ncbi.nlm.nih.gov/1')).toBe('pubmed.ncbi.nlm.nih.gov');
    expect(safeExternalURL('https://example.org/guideline')).toBe('https://example.org/guideline');
    expect(safeExternalURL('javascript:alert(1)')).toBeNull();
    expect(safeExternalURL('data:text/html,x')).toBeNull();
    expect(safeExternalURL('not a url')).toBeNull();
    expect(citationDomain('javascript:alert(1)')).toBeNull();
    expect(citationDomain(null)).toBeNull();
  });

  it('formats a completion time without guessing a missing time zone', () => {
    expect(formatCitationDate('2026-11-13 09:00:00')).toBe('2026-11-13 09:00');
    expect(formatCitationDate('2026-11-13T09:00:00.123')).toBe('2026-11-13 09:00');
    expect(formatCitationDate('2026-11-13T09:00:00-05:00')).toBe(
      new Date('2026-11-13T14:00:00Z').toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    );
    expect(formatCitationDate('2026-11-13T14:00:00Z')).toBe(
      formatCitationDate('2026-11-13T09:00:00-05:00')
    );
    expect(formatCitationDate('yesterday')).toBe('yesterday');
    expect(formatCitationDate(null)).toBe('');
  });
});
