import { aiModelMenuSectionTitle, buildAIModelMenuSections } from './aiModelMenuSections';

const echoModel = { modelName: 'PanEcho', supportedDicomModalities: ['US'] };
const angioModel = { modelName: 'DeepCORO-JEPA', supportedDicomModalities: ['XA'] };
const ctModel = { modelName: 'TotalSegmentator', supportedDicomModalities: ['CT'] };

test('one section per open exam, each with only the models of its modality', () => {
  const sections = buildAIModelMenuSections(
    {
      'US\\SR': {
        studies: [{ studyInstanceUID: 'tte', date: '2026-10-09', description: 'ECHO TTE' }],
      },
      XA: {
        studies: [{ studyInstanceUID: 'cath', date: '2026-11-17', description: 'CORONAROGRAPHIE' }],
      },
    },
    [echoModel, angioModel, ctModel]
  );

  expect(
    sections.map(section => [section.studyInstanceUID, section.models.map(m => m.modelName)])
  ).toEqual([
    ['tte', ['PanEcho']],
    ['cath', ['DeepCORO-JEPA']],
  ]);
  expect(aiModelMenuSectionTitle(sections[0])).toBe('US/SR · 2026-10-09 · ECHO TTE');
});

test('two exams of the same modality get a section each', () => {
  const sections = buildAIModelMenuSections(
    { XA: { studies: [{ studyInstanceUID: 'old' }, { studyInstanceUID: 'new' }] } },
    [angioModel]
  );
  expect(sections.map(section => section.studyInstanceUID)).toEqual(['old', 'new']);
});

test('falls back to the images when the study list has no entries, and skips modalities without models', () => {
  const sections = buildAIModelMenuSections(
    {
      XA: {
        displaySets: [
          { StudyInstanceUID: 'cath', studyDate: '2026-11-17' },
          { StudyInstanceUID: 'cath' },
        ],
      },
      MR: { studies: [{ studyInstanceUID: 'mr' }] },
      US: {},
    },
    [angioModel, echoModel]
  );
  expect(
    sections.map(section => [section.modality, section.studyInstanceUID, section.date])
  ).toEqual([
    ['XA', 'cath', '2026-11-17'],
    ['US', null, undefined],
  ]);
});

test('no open exam means no section', () => {
  expect(buildAIModelMenuSections({}, [angioModel])).toEqual([]);
  expect(buildAIModelMenuSections(null, [angioModel])).toEqual([]);
});
