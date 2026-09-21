import {
  hasScoredModelQuestionnaire,
  validateModelQuestionnaireAnswers,
  type ModelQuestionnaireQuestion,
} from './modelQuestionnaireValidation';

const radioQuestion: ModelQuestionnaireQuestion = {
  id: 'generalizability',
  type: 'RADIO',
  questionEn: 'Which option affects generalizability?',
  correctAnswerIds: ['single-center'],
};

const checkboxQuestion: ModelQuestionnaireQuestion = {
  id: 'bias-limitations',
  type: 'CHECKBOX',
  questionEn: 'Which limitations could introduce bias?',
  correctAnswerIds: ['left-coronary-only', 'afib-underrepresented', 'reference-time-mismatch'],
};

describe('model questionnaire validation', () => {
  it('accepts the correct radio answer', () => {
    expect(
      validateModelQuestionnaireAnswers([radioQuestion], {
        generalizability: 'single-center',
      })
    ).toBe('valid');
  });

  it('rejects an incorrect radio answer', () => {
    expect(
      validateModelQuestionnaireAnswers([radioQuestion], {
        generalizability: 'video-architecture',
      })
    ).toBe('incorrect');
  });

  it('rejects an incomplete checkbox answer before scoring it', () => {
    expect(validateModelQuestionnaireAnswers([checkboxQuestion], {})).toBe('incomplete');
  });

  it.each<[string, string[]]>([
    ['missing a correct option', ['left-coronary-only', 'afib-underrepresented']],
    [
      'including an incorrect option',
      [
        'left-coronary-only',
        'afib-underrepresented',
        'reference-time-mismatch',
        'external-validation',
      ],
    ],
  ])('rejects a checkbox answer %s', (_description, selectedIds) => {
    expect(
      validateModelQuestionnaireAnswers([checkboxQuestion], {
        'bias-limitations': selectedIds,
      })
    ).toBe('incorrect');
  });

  it('accepts the exact checkbox answer regardless of selection order', () => {
    expect(
      validateModelQuestionnaireAnswers([checkboxQuestion], {
        'bias-limitations': [
          'reference-time-mismatch',
          'left-coronary-only',
          'afib-underrepresented',
        ],
      })
    ).toBe('valid');
  });

  it('keeps legacy unscored questionnaires backward compatible', () => {
    const legacyQuestion: ModelQuestionnaireQuestion = {
      id: 'legacy-question',
      type: 'RADIO',
      questionEn: 'Choose an option',
    };

    expect(
      validateModelQuestionnaireAnswers([legacyQuestion], {
        'legacy-question': 'any-non-empty-option',
      })
    ).toBe('valid');
    expect(hasScoredModelQuestionnaire([legacyQuestion])).toBe(false);
  });

  it('identifies questionnaires with an answer key as scored', () => {
    expect(hasScoredModelQuestionnaire([radioQuestion, checkboxQuestion])).toBe(true);
  });
});
