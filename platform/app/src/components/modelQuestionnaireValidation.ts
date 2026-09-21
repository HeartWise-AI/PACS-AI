export type ModelQuestionnaireAnswer = string | string[];

export type ModelQuestionnaireQuestion = {
  id: string;
  type: 'TEXT' | 'RADIO' | 'CHECKBOX';
  questionEn?: string;
  correctAnswerIds?: string[];
};

export type ModelQuestionnaireValidationResult = 'valid' | 'incomplete' | 'incorrect';

const hasQuestionText = (question: ModelQuestionnaireQuestion): boolean =>
  Boolean(question.questionEn?.trim());

const hasAnswer = (
  question: ModelQuestionnaireQuestion,
  answer: ModelQuestionnaireAnswer | undefined
): boolean => {
  if (question.type === 'TEXT') {
    return typeof answer === 'string' && Boolean(answer.trim());
  }

  if (question.type === 'RADIO') {
    return typeof answer === 'string' && Boolean(answer);
  }

  if (question.type === 'CHECKBOX') {
    return Array.isArray(answer) && answer.length > 0;
  }

  return true;
};

const hasAnswerKey = (question: ModelQuestionnaireQuestion): boolean =>
  Array.isArray(question.correctAnswerIds);

const hasSameAnswerIds = (selectedIds: string[], correctAnswerIds: string[]): boolean => {
  const selected = new Set(selectedIds);
  const correct = new Set(correctAnswerIds);

  return selected.size === correct.size && [...selected].every(answerId => correct.has(answerId));
};

const hasCorrectAnswer = (
  question: ModelQuestionnaireQuestion,
  answer: ModelQuestionnaireAnswer | undefined
): boolean => {
  const correctAnswerIds = question.correctAnswerIds;
  if (!Array.isArray(correctAnswerIds)) {
    return true;
  }

  if (question.type === 'RADIO') {
    return (
      correctAnswerIds.length === 1 && typeof answer === 'string' && answer === correctAnswerIds[0]
    );
  }

  if (question.type === 'CHECKBOX') {
    return Array.isArray(answer) && hasSameAnswerIds(answer, correctAnswerIds);
  }

  // Scored free-text questions are not supported by the model questionnaire contract.
  return false;
};

export const hasScoredModelQuestionnaire = (questions: ModelQuestionnaireQuestion[]): boolean =>
  questions.some(question => hasQuestionText(question) && hasAnswerKey(question));

export const validateModelQuestionnaireAnswers = (
  questions: ModelQuestionnaireQuestion[],
  answers: Record<string, ModelQuestionnaireAnswer>
): ModelQuestionnaireValidationResult => {
  const questionsWithText = questions.filter(hasQuestionText);

  if (questionsWithText.some(question => !hasAnswer(question, answers[question.id]))) {
    return 'incomplete';
  }

  if (
    questionsWithText.some(
      question => hasAnswerKey(question) && !hasCorrectAnswer(question, answers[question.id])
    )
  ) {
    return 'incorrect';
  }

  return 'valid';
};
