export interface AddOnboardingQuestionnaireAnswersRequest {
  questionnaireType: string;
  onboardingQuestionnaireAnswers:
  | [
    {
      questionnaireId: string;
      questionnaireQuestion: string;
      questionnaireAnswerIds?: string[];
      questionnaireAnswers?: string[];
    },
  ]
  | null;
}
export interface GetPublicTenantByIDResponse {
  readonly id: string;
  readonly name: string;
  readonly address: string;
}

export interface GetTenantInfoResponse {
  readonly id: string;
  readonly name: string;
  readonly onboardingConsentLink?: string | null;
  readonly onboardingQuestionnaires: {
    POST_SURVEY: [
      {
        answerOptionsEn: [{ answer: string; id: string }] | null;
        answerOptionsFr: [{ answer: string; id: string }] | null;
        id: string;
        questionEn: string;
        questionFr: string;
        type: string;
      },
    ];
    PRE_SURVEY: [
      {
        answerOptionsEn: [{ answer: string; id: string }] | null;
        answerOptionsFr: [{ answer: string; id: string }] | null;
        id: string;
        questionEn: string;
        questionFr: string;
        type: string;
      },
    ];
  } | null;
  readonly address: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface GetPublicTenantByIDRequest {
  tenantId: string;
}

export interface GetOnboardingQuestionnaireAnswersRequest {
  questionnaireType: string;
}

export interface ModelDetails {
  Changelogs: { [key: string]: string } | string;
  Summary: { [key: string]: string };
  Mechanism: { [key: string]: string } | string;
  Validation_and_performance: { [key: string]: { [key: string]: string | number } } | string;
  Other_information: { [key: string]: string } | string;
  Other_results: { [key: string]: string } | string;
  Uses_and_directions: { [key: string]: string } | string;
  Warnings_and_limitations: { [key: string]: string };
}
