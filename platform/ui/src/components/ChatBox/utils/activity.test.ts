import { countTools, formatDuration, stepLabel, totalDuration } from './activity';
import { chatBoxLocales, setTestLocale, translate } from '../testUtils/chatBoxTranslation';
import type { ChatActivityStep } from '../types';

const step = (overrides: Partial<ChatActivityStep>): ChatActivityStep => ({
  id: 1,
  key: 'tool',
  kind: 'tool',
  label: 'Using a tool',
  model: null,
  status: 'done',
  ...overrides,
});

describe('chat activity labels', () => {
  afterEach(() => setTestLocale('en-US'));

  it('translates a step from its machine key and model name', () => {
    setTestLocale('fr');
    expect(
      stepLabel(
        step({
          key: 'model_result',
          model: 'DeepCORO-JEPA',
          label: 'Reading the stored DeepCORO-JEPA result',
        }),
        translate
      )
    ).toBe('Lecture du résultat DeepCORO-JEPA enregistré');
    expect(
      stepLabel(
        step({ key: 'run_model', model: 'DeepCORO-SCAD', label: 'Running DeepCORO-SCAD' }),
        translate
      )
    ).toBe('Exécution de DeepCORO-SCAD');
    expect(stepLabel(step({ key: 'web_search', label: 'Searching the web' }), translate)).toBe(
      'Recherche sur le Web'
    );
    expect(
      stepLabel(step({ key: 'delegate_angiogram', kind: 'delegation', label: 'x' }), translate)
    ).toBe('Consultation du spécialiste en angiographie');
  });

  it('labels a model registered tomorrow without a code change', () => {
    expect(
      stepLabel(
        step({ key: 'model_result', model: 'DeepCORO-FUTURE', label: 'backend label' }),
        translate
      )
    ).toBe('Reading the stored DeepCORO-FUTURE result');
  });

  it('uses the generic template when a model step has no model name', () => {
    expect(stepLabel(step({ key: 'model_result', label: 'backend' }), translate)).toBe(
      'Reading a stored model result'
    );
    expect(stepLabel(step({ key: 'run_model', model: '  ', label: 'backend' }), translate)).toBe(
      'Running a model'
    );
  });

  it('falls back to the backend label for a key it does not know', () => {
    setTestLocale('fr');
    expect(
      stepLabel(step({ key: 'brand_new_step', label: 'Measuring something new' }), translate)
    ).toBe('Measuring something new');
    // A template that needs a model, on a step without one.
    expect(
      stepLabel(step({ key: 'model_result_or_run', label: 'Getting a result' }), translate)
    ).toBe('Getting a result');
  });

  it('falls back to the backend label when the translation is missing', () => {
    const untranslated = (key: string) => key;
    expect(stepLabel(step({ key: 'web_read', label: 'Reading a source' }), untranslated)).toBe(
      'Reading a source'
    );
  });

  it('formats durations', () => {
    expect(formatDuration(140, translate)).toBe('<1 s');
    expect(formatDuration(1400, translate)).toBe('1 s');
    expect(formatDuration(58_200, translate)).toBe('58 s');
    expect(formatDuration(65_000, translate)).toBe('1 min 5 s');
    expect(formatDuration(null, translate)).toBe('');
    expect(formatDuration(undefined, translate)).toBe('');
    expect(formatDuration(-5, translate)).toBe('');
  });

  it('counts tool calls, not delegations', () => {
    const steps = [
      step({ id: 1, kind: 'delegation', key: 'delegate_angiogram' }),
      step({ id: 2 }),
      step({ id: 3 }),
    ];
    expect(countTools({ steps })).toBe(2);
    expect(countTools({ steps: steps.slice(0, 1) })).toBe(1);
  });

  it('reads the total time from the server or from the timestamps', () => {
    expect(totalDuration({ elapsed_ms: 58_000, steps: [] })).toBe(58_000);
    expect(
      totalDuration({
        started_at: '2026-11-14T22:27:20.000Z',
        ended_at: '2026-11-14T22:27:32.500Z',
        steps: [],
      })
    ).toBe(12_500);
    expect(totalDuration({ steps: [] })).toBeNull();
  });
});

describe('ChatBox locale files', () => {
  const placeholders = (text: string) => (text.match(/{{\s*\w+\s*}}/g) || []).sort().join(',');
  const reference = chatBoxLocales['en-US'];

  it.each(Object.keys(chatBoxLocales))('%s has every key with the same placeholders', locale => {
    const messages = chatBoxLocales[locale];
    expect(Object.keys(messages).sort()).toEqual(Object.keys(reference).sort());
    for (const key of Object.keys(reference)) {
      expect(messages[key].trim()).not.toBe('');
      expect(`${key}:${placeholders(messages[key])}`).toBe(
        `${key}:${placeholders(reference[key])}`
      );
    }
  });
});
