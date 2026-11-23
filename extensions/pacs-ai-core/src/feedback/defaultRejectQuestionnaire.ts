/**
 * The rejection questionnaire every model gets on thumbs down, before any
 * questions the model itself configures. Its answer ids are stable so the
 * Model Feedback dashboard can count reasons across models and languages.
 */
export const DEFAULT_REJECT_QUESTIONNAIRE_ID = 'default-reject-reason';

export const DEFAULT_REJECT_REASON_IDS = [
  'missed-finding',
  'measurement-disagrees',
  'text-unclear',
  'wrong-series-laterality',
  'too-slow',
  'other',
] as const;

export type DefaultRejectReasonId = (typeof DEFAULT_REJECT_REASON_IDS)[number];

/** English reason labels, in display order; also the i18n keys on the dashboard. */
export const DEFAULT_REJECT_REASON_LABELS: Record<DefaultRejectReasonId, string> = {
  'missed-finding': 'Missed a clinically relevant finding',
  'measurement-disagrees': 'Measurement disagrees with my read',
  'text-unclear': 'Report text unclear or verbose',
  'wrong-series-laterality': 'Wrong series or laterality',
  'too-slow': 'Took too long to return',
  other: 'Other',
};

const FRENCH_LABELS: Record<DefaultRejectReasonId, string> = {
  'missed-finding': 'Constatation cliniquement pertinente manquée',
  'measurement-disagrees': 'La mesure ne concorde pas avec ma lecture',
  'text-unclear': 'Texte du rapport peu clair ou trop long',
  'wrong-series-laterality': 'Mauvaise série ou mauvaise latéralité',
  'too-slow': 'Résultat trop long à obtenir',
  other: 'Autre',
};

export interface FeedbackQuestionnaire {
  answerOptionsEn: { answer: string; id: string }[] | null;
  answerOptionsFr: { answer: string; id: string }[] | null;
  id: string;
  questionEn: string;
  questionFr: string;
  type: string;
  // The question must be answered before the vote can be submitted.
  required?: boolean;
}

export const defaultRejectQuestionnaire: FeedbackQuestionnaire = {
  id: DEFAULT_REJECT_QUESTIONNAIRE_ID,
  type: 'RADIO',
  required: true,
  questionEn: 'Why did you reject this output?',
  questionFr: 'Pourquoi avez-vous rejeté ce résultat?',
  answerOptionsEn: DEFAULT_REJECT_REASON_IDS.map(id => ({
    id,
    answer: DEFAULT_REJECT_REASON_LABELS[id],
  })),
  answerOptionsFr: DEFAULT_REJECT_REASON_IDS.map(id => ({ id, answer: FRENCH_LABELS[id] })),
};

/** The default reason question followed by the model's own, without repeating its id. */
export function withDefaultRejectReason<T extends { id: string }>(
  configured: readonly T[] | null | undefined
): (T | FeedbackQuestionnaire)[] {
  const rest = (configured ?? []).filter(
    question => question?.id !== DEFAULT_REJECT_QUESTIONNAIRE_ID
  );
  return [defaultRejectQuestionnaire, ...rest];
}
