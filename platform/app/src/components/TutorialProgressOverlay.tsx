import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useShepherd } from 'react-shepherd';
import 'shepherd.js/dist/css/shepherd.css';
import type { StepOptions, TourOptions } from 'shepherd.js';
import userRepository from '../api/userRepository';
import tenantRepository from '../api/tenantRepository';
import { AddOnboardingQuestionnaireAnswersRequest, GetTenantInfoResponse } from '../api/tenantDTO';
import { UserResponse } from '../api/userDTO';
import inferenceRepository from '@ohif/app/src/api/inferenceRepository';
import {
  AddOnboardingModelQuestionnaireAnswersRequest,
  GetInferenceAvailableModelsResponse,
} from '@ohif/app/src/api/inferenceDTO';
import closeIcon from './../assets/pacs/icons/close-inactive.png';
import checkActive from './../assets/pacs/icons/check-active.png';
import checkInactive from './../assets/pacs/icons/check-inactive.png';
import radioSelected from './../assets/pacs/icons/radio-selected.png';
import radioUnselect from './../assets/pacs/icons/radio-unselect.png';
import chevronUpIcon from './../assets/pacs/icons/chevron-up.png';
import chevronRightIcon from './../assets/pacs/icons/chevron-right.png';
import arrowShrink from './../assets/pacs/icons/arrow-shrink.png';
import checkTick from './../assets/pacs/icons/check-tick-outline-primary.png';
import tutorialProgressHeaderBG from './../assets/pacs/bg/tutorial-progress-header-bg.png';
import { Typography } from '@ohif/ui';

type QuestionnaireAnswerOption = {
  id: string;
  answer: string;
};

type Questionnaire = {
  id: string;
  type: 'TEXT' | 'RADIO' | 'CHECKBOX';
  questionEn?: string;
  questionFr?: string;
  answerOptionsEn?: (QuestionnaireAnswerOption | string)[];
  answerOptionsFr?: (QuestionnaireAnswerOption | string)[];
};

/**
 * Represents a high-level tutorial step shown in the progress overlay card.
 * Each step can trigger a Shepherd.js tour when started.
 */
interface TutorialStepState {
  id: string;
  title: string;
  route?: string;
  completed: boolean;
  current: boolean;
}

const DEFAULT_STEPS: TutorialStepState[] = [
  {
    id: 'pre-survey',
    title: 'Pre-Survey Questionnaire',
    completed: false,
    current: true,
  },
  {
    id: 'view-models',
    title: 'View Available Models',
    completed: false,
    current: false,
  },
  {
    id: 'run-inference',
    title: 'Run Inference to Model',
    completed: false,
    current: false,
  },
  {
    id: 'model-questionnaire',
    title: 'Model Questionnaire',
    completed: false,
    current: false,
  },
  {
    id: 'post-survey',
    title: 'Post-Survey Questionnaire',
    completed: false,
    current: false,
  },
];

/**
 * Global tutorial progress overlay.
 *
 * Renders a bottom-right card showing high-level tutorial steps and
 * integrates with Shepherd.js to run contextual tours for each step.
 */
const TutorialProgressOverlay: React.FC = () => {
  const { t, i18n } = useTranslation('AIModelButton');
  const [userLoading, setUserLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Partial<UserResponse>>({});
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [inferenceAvailableModels, setInferenceAvailableModels] = useState<
    GetInferenceAvailableModelsResponse[]
  >([]);
  // Utility to get last completed step index
  const getLastCompletedStepIndex = (steps: TutorialStepState[]) => {
    let lastCompleted = -1;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].completed) {
        lastCompleted = i;
      }
    }
    return lastCompleted;
  };

  const location = useLocation();
  useEffect(() => {
    const fetchCurrentUser = async () => {
      setUserLoading(true);
      try {
        const response = await userRepository.GetCurrentUser();
        setCurrentUser(response.data);
      } catch (error) {
        setCurrentUser({});
      }
      setUserLoading(false);
    };

    const fetchTenantInfo = async () => {
      try {
        const response = await tenantRepository.GetTenantInfo();
        setTenantInfo(response.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchTenantInfo();
    fetchCurrentUser();
  }, [location.pathname]);

  // Heuristic to detect whether the user is currently in a viewer/study context.
  const isInViewer = useMemo(() => {
    const path = (location && location.pathname) || '';
    return (
      /\/viewer(\/|$)/.test(path) || /\/study(\/|$)/.test(path) || /\/display(\/|$)/.test(path)
    );
  }, [location.pathname]);

  // Fetch available models and check which ones have already been answered.
  // Only runs when the user is in a viewer context — fetching outside the viewer
  useEffect(() => {
    if (!isInViewer) {
      return;
    }

    const fetchModelsData = async () => {
      try {
        const response = await inferenceRepository.GetInferenceAvailableModels();
        const models = response.data || [];
        setInferenceAvailableModels(models);

        // Deduplicate by modelId and keep only models that actually have questionnaires.
        const seen = new Set<string>();
        const uniqueModelsWithQuestionnaires = models.filter(m => {
          if (!m.modelId || seen.has(m.modelId)) {
            return false;
          }
          seen.add(m.modelId);
          return (
            Array.isArray(m.onboardingModelQuestionnaires) &&
            m.onboardingModelQuestionnaires.length > 0
          );
        });

        // For each unique model, fetch its answered questionnaires in parallel.
        const results = await Promise.allSettled(
          uniqueModelsWithQuestionnaires.map(m =>
            inferenceRepository.GetOnboardingModelQuestionnaireAnswers({ modelId: m.modelId })
          )
        );

        // A model is considered answered if the API returned at least one answer record.
        const answered = new Set<string>();
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            const data = Array.isArray(result.value?.data) ? result.value.data : [];
            if (data.length > 0) {
              answered.add(uniqueModelsWithQuestionnaires[idx].modelId);
            }
          }
        });
        setAnsweredModelIds(answered);
      } catch (error) {
        console.error('Error fetching models data:', error);
      }
    };

    fetchModelsData();
  }, [isInViewer]);

  // Load progress from API on mount
  useEffect(() => {
    const loadProgressFromAPI = async () => {
      try {
        const metaResp = await userRepository.GetUserMetadata();
        // support multiple possible response shapes from GetUserMetadata
        const respData = (metaResp && (metaResp.data ?? metaResp)) || {};
        const rawProgress =
          respData.tutorialProgressStep ??
          respData.metadata?.tutorialProgressStep ??
          respData.data?.tutorialProgressStep ??
          undefined;
        let completedStepNum = -1; // 0-based index of last completed step
        if (rawProgress !== undefined && rawProgress !== null && rawProgress !== '') {
          const parsed = parseInt(String(rawProgress), 10);
          if (!isNaN(parsed)) {
            // stored value is 1-based (1 => first step completed), -1 means reset/no progress
            if (parsed === -1) {
              completedStepNum = -1;
            } else {
              completedStepNum = parsed - 1;
            }
          }
        }
        const normalized = DEFAULT_STEPS.map((step, idx) => ({
          ...step,
          completed: idx <= completedStepNum,
          current: idx === completedStepNum + 1,
        }));
        // if every step is already completed on load, hide the overlay on refresh.
        if (normalized.every(s => s.completed)) {
          setLoadedAsCompleted(true);
        }
        setSteps(normalized);
      } catch {
        setSteps(DEFAULT_STEPS);
      }
    };
    loadProgressFromAPI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Shepherd = useShepherd();

  const [expanded, setExpanded] = useState<boolean>(false);
  const [steps, setSteps] = useState<TutorialStepState[]>(DEFAULT_STEPS);
  const [loadedAsCompleted, setLoadedAsCompleted] = useState<boolean>(false);
  const [activeSurvey, setActiveSurvey] = useState<null | 'pre' | 'post'>(null);
  // use string for TEXT/RADIO, string[] for CHECKBOX
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string | string[]>>({});
  const [isSurveySubmitting, setIsSurveySubmitting] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [viewerModalOpen, setViewerModalOpen] = useState(false);
  const [viewerModalStepId, setViewerModalStepId] = useState<string | null>(null);
  // Model questionnaire state
  const [answeredModelIds, setAnsweredModelIds] = useState<Set<string>>(new Set());
  const [modelQuestionnaireQueue, setModelQuestionnaireQueue] = useState<
    GetInferenceAvailableModelsResponse[]
  >([]);
  const [modelQuestionnaireQueueIndex, setModelQuestionnaireQueueIndex] = useState<number>(0);
  const [modelQuestionnaireAnswers, setModelQuestionnaireAnswers] = useState<
    Record<string, string | string[]>
  >({});
  const [isModelQuestionnaireSubmitting, setIsModelQuestionnaireSubmitting] = useState(false);

  // Deduplicated models (by modelId) that have onboardingModelQuestionnaires and haven't been
  // answered yet by the current user. Models without questionnaires (old versions) are excluded.
  const pendingModelQuestionnaires = useMemo(() => {
    const seen = new Set<string>();
    const deduped = (inferenceAvailableModels || []).filter(m => {
      if (!m.modelId || seen.has(m.modelId)) {
        return false;
      }
      seen.add(m.modelId);
      return true;
    });
    return deduped.filter(
      m =>
        Array.isArray(m.onboardingModelQuestionnaires) &&
        m.onboardingModelQuestionnaires.length > 0 &&
        !answeredModelIds.has(m.modelId)
    );
  }, [inferenceAvailableModels, answeredModelIds]);

  const markStepCompleted = useCallback(
    async (id: string) => {
      // build updated steps synchronously from current `steps` state
      const updated = steps.map(step => (step.id === id ? { ...step, completed: true } : step));
      const nextIndex = updated.findIndex(step => !step.completed);
      const normalized = updated.map((step, index) => ({ ...step, current: index === nextIndex }));

      // apply update
      setSteps(normalized);

      // compute completed index from the updated array and persist
      let completedIdx = normalized.findIndex(s => s.id === id);
      if (completedIdx < 0) {
        completedIdx = getLastCompletedStepIndex(normalized);
      }

      try {
        // persist as 1-based value: store (completedIdx + 1). Use -1 to indicate reset/no progress.
        await userRepository.UpdateUserMetadata({
          metadata: { tutorialProgressStep: completedIdx >= 0 ? completedIdx + 1 : -1 },
        });
      } catch (error) {
        console.error(error);
      }
    },
    [steps]
  );

  const handleSurveyClose = useCallback(() => {
    setActiveSurvey(null);
    setSurveyAnswers({});
  }, []);

  const handleSurveySubmit = useCallback(
    (stepId: string, questions: Questionnaire[]) => async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSurveySubmitting(true);

      const questionnaireType = stepId === 'pre-survey' ? 'PRE_SURVEY' : 'POST_SURVEY';

      try {
        const onboardingQuestionnaireAnswers = questions.reduce(
          (
            acc: {
              questionnaireId: string;
              questionnaireQuestion: string;
              questionnaireAnswerIds?: string[];
              questionnaireAnswers?: string[];
            }[],
            q
          ) => {
            // prefer English text for payload
            const questionTextEn = q.questionEn || '';
            if (!questionTextEn || !questionTextEn.trim()) {
              return acc;
            }

            let questionnaireAnswerIds: string[] = [];
            let questionnaireAnswers: string[] = [];

            const rawAns = surveyAnswers[q.id];

            if (q.type === 'TEXT') {
              const value = typeof rawAns === 'string' ? rawAns.trim() : '';
              if (value) {
                questionnaireAnswerIds = ['text'];
                questionnaireAnswers = [value];
              }
            } else if (q.type === 'RADIO') {
              const selected = typeof rawAns === 'string' ? rawAns : '';
              if (selected) {
                questionnaireAnswerIds = [selected];
                const option = (q.answerOptionsEn || []).find(o => o.id === selected);
                questionnaireAnswers = [option ? option.answer : selected];
              }
            } else if (q.type === 'CHECKBOX') {
              const selectedArr = Array.isArray(rawAns) ? rawAns : [];
              if (selectedArr.length) {
                questionnaireAnswerIds = selectedArr as string[];
                const options = q.answerOptionsEn || [];
                questionnaireAnswers = selectedArr
                  .map(id => options.find(o => o.id === id)?.answer)
                  .filter((v): v is string => Boolean(v));
              }
            }

            // if there are no selected answer ids and no textual answers,
            // skip adding this question entirely (do not submit empty question entries).
            if (questionnaireAnswerIds.length === 0 && questionnaireAnswers.length === 0) {
              return acc;
            }

            const questionObj: {
              questionnaireId: string;
              questionnaireQuestion: string;
              questionnaireAnswerIds?: string[];
              questionnaireAnswers?: string[];
            } = {
              questionnaireId: q.id,
              questionnaireQuestion: questionTextEn,
            };

            if (questionnaireAnswerIds.length) {
              questionObj.questionnaireAnswerIds = questionnaireAnswerIds;
            }
            if (questionnaireAnswers.length) {
              questionObj.questionnaireAnswers = questionnaireAnswers;
            }

            acc.push(questionObj);

            return acc;
          },
          []
        );

        // if there are no answers to submit, send `onboardingQuestionnaireAnswers: null`
        // to indicate the questionnaire was submitted with no answers.
        const payloadAnswers =
          onboardingQuestionnaireAnswers.length > 0 ? onboardingQuestionnaireAnswers : null;

        await tenantRepository.AddOnboardingQuestionnaireAnswers({
          questionnaireType,
          onboardingQuestionnaireAnswers:
            payloadAnswers as AddOnboardingQuestionnaireAnswersRequest['onboardingQuestionnaireAnswers'],
        });
      } catch (err) {
        // swallow errors for now but log for debugging
        // eslint-disable-next-line no-console
        console.error('Failed to submit onboarding questionnaire answers', err);
      } finally {
        setIsSurveySubmitting(false);
      }

      setActiveSurvey(null);
      setSurveyAnswers({});
      markStepCompleted(stepId);
    },
    [markStepCompleted, surveyAnswers]
  );

  const handleSurveySkip = useCallback(
    (stepId: string) => () => {
      setActiveSurvey(null);
      setSurveyAnswers({});
      markStepCompleted(stepId);
    },
    [markStepCompleted]
  );

  /** Close the model questionnaire modal without completing the step. */
  const handleModelQuestionnaireClose = useCallback(() => {
    setModelQuestionnaireQueue([]);
    setModelQuestionnaireQueueIndex(0);
    setModelQuestionnaireAnswers({});
  }, []);

  /**
   * Skip the current model's questionnaire and advance to the next one in the
   * queue, or complete the step when the queue is exhausted.
   */
  const handleModelQuestionnaireSkip = useCallback(() => {
    const nextIdx = modelQuestionnaireQueueIndex + 1;
    if (nextIdx < modelQuestionnaireQueue.length) {
      setModelQuestionnaireQueueIndex(nextIdx);
      setModelQuestionnaireAnswers({});
    } else {
      setModelQuestionnaireQueue([]);
      setModelQuestionnaireQueueIndex(0);
      setModelQuestionnaireAnswers({});
      markStepCompleted('model-questionnaire');
    }
  }, [modelQuestionnaireQueueIndex, modelQuestionnaireQueue, markStepCompleted]);

  /**
   * Submit answers for the current model in the queue, then advance or complete.
   * The queue is captured at the time the modal was opened so it is stable even
   * as `answeredModelIds` changes during the session.
   */
  const handleModelQuestionnaireSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const currentModel = modelQuestionnaireQueue[modelQuestionnaireQueueIndex];
      if (!currentModel) {
        return;
      }

      setIsModelQuestionnaireSubmitting(true);
      const questions = (currentModel.onboardingModelQuestionnaires || []) as Questionnaire[];

      try {
        const onboardingModelQuestionnaireAnswers = questions.reduce(
          (
            acc: {
              questionnaireId: string;
              questionnaireQuestion: string;
              questionnaireAnswerIds?: string[];
              questionnaireAnswers?: string[];
            }[],
            q
          ) => {
            const questionTextEn = q.questionEn || '';
            if (!questionTextEn.trim()) {
              return acc;
            }

            let questionnaireAnswerIds: string[] = [];
            let questionnaireAnswers: string[] = [];
            const rawAns = modelQuestionnaireAnswers[q.id];

            if (q.type === 'TEXT') {
              const value = typeof rawAns === 'string' ? rawAns.trim() : '';
              if (value) {
                questionnaireAnswerIds = ['text'];
                questionnaireAnswers = [value];
              }
            } else if (q.type === 'RADIO') {
              const selected = typeof rawAns === 'string' ? rawAns : '';
              if (selected) {
                questionnaireAnswerIds = [selected];
                const option = (q.answerOptionsEn || []).find(o => o.id === selected);
                questionnaireAnswers = [option ? option.answer : selected];
              }
            } else if (q.type === 'CHECKBOX') {
              const selectedArr = Array.isArray(rawAns) ? rawAns : [];
              if (selectedArr.length) {
                questionnaireAnswerIds = selectedArr as string[];
                const options = q.answerOptionsEn || [];
                questionnaireAnswers = selectedArr
                  .map(id => options.find(o => o.id === id)?.answer)
                  .filter((v): v is string => Boolean(v));
              }
            }

            if (questionnaireAnswerIds.length === 0 && questionnaireAnswers.length === 0) {
              return acc;
            }

            const questionObj: {
              questionnaireId: string;
              questionnaireQuestion: string;
              questionnaireAnswerIds?: string[];
              questionnaireAnswers?: string[];
            } = { questionnaireId: q.id, questionnaireQuestion: questionTextEn };
            if (questionnaireAnswerIds.length) {
              questionObj.questionnaireAnswerIds = questionnaireAnswerIds;
            }
            if (questionnaireAnswers.length) {
              questionObj.questionnaireAnswers = questionnaireAnswers;
            }

            acc.push(questionObj);
            return acc;
          },
          []
        );

        await inferenceRepository.AddOnboardingModelQuestionnaireAnswers({
          modelId: currentModel.modelId,
          onboardingModelQuestionnaireAnswers:
            onboardingModelQuestionnaireAnswers.length > 0
              ? (onboardingModelQuestionnaireAnswers as AddOnboardingModelQuestionnaireAnswersRequest['onboardingModelQuestionnaireAnswers'])
              : null,
        });

        // Record locally so pendingModelQuestionnaires reflects the change immediately.
        setAnsweredModelIds(prev => new Set([...prev, currentModel.modelId]));
      } catch (err) {
        console.error('Failed to submit model questionnaire answers', err);
      } finally {
        setIsModelQuestionnaireSubmitting(false);
      }

      // Advance to next model in queue (pre-captured list — stable across renders).
      const nextIdx = modelQuestionnaireQueueIndex + 1;
      if (nextIdx < modelQuestionnaireQueue.length) {
        setModelQuestionnaireQueueIndex(nextIdx);
        setModelQuestionnaireAnswers({});
      } else {
        setModelQuestionnaireQueue([]);
        setModelQuestionnaireQueueIndex(0);
        setModelQuestionnaireAnswers({});
        markStepCompleted('model-questionnaire');
      }
    },
    [
      modelQuestionnaireQueue,
      modelQuestionnaireQueueIndex,
      modelQuestionnaireAnswers,
      markStepCompleted,
    ]
  );

  const completedCount = useMemo(() => steps.filter(step => step.completed).length, [steps]);

  const totalCount = steps.length || 1;
  const progress = Math.round((completedCount / totalCount) * 100);

  const resetTutorial = async () => {
    setSteps(DEFAULT_STEPS);
    try {
      await userRepository.ResetTutorial();
      await userRepository.UpdateUserMetadata({ metadata: { tutorialProgressStep: 0 } });
    } catch (error) {
      console.error(error);
    }
  };

  // Listen for a reset event dispatched by the Settings page so the overlay
  // reappears expanded even when it was hidden due to load-time 100% progress.
  useEffect(() => {
    const handleTutorialReset = () => {
      setSteps(DEFAULT_STEPS);
      setLoadedAsCompleted(false);
      setExpanded(true);
    };
    window.addEventListener('tutorial-reset', handleTutorialReset);
    return () => window.removeEventListener('tutorial-reset', handleTutorialReset);
  }, []);

  const handleSkipClick = useCallback((e?: React.MouseEvent) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    console.debug('handleSkipClick: opening skip modal');
    setSkipModalOpen(true);
  }, []);

  const cancelSkip = useCallback(() => {
    setSkipModalOpen(false);
  }, []);

  const confirmSkip = useCallback(async () => {
    // persist as the total number of steps (1-based semantics)
    try {
      await userRepository.UpdateUserMetadata({
        metadata: { tutorialProgressStep: steps.length },
      });
    } catch (error) {
      console.error(error);
    }

    // update UI: mark all steps completed and clear current flags
    const allCompleted = DEFAULT_STEPS.map(s => ({ ...s, completed: true, current: false }));
    setSteps(allCompleted);
    setExpanded(false);
    setSkipModalOpen(false);
  }, [steps.length]);

  const startTourForStep = (stepId: string) => {
    if (!Shepherd) {
      return;
    }

    const step = steps.find(s => s.id === stepId);
    if (!step) {
      return;
    }

    const tourOptions: TourOptions = {
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'shepherd-theme-arrows shepherd-theme-pacsai',
        scrollTo: true,
      },
    };

    const tour = new Shepherd.Tour(tourOptions);

    // NOTE: The actual target selectors and copy should be refined per-step.
    // For now we support a special guided navigation for "View Available Models"
    // and a generic intro step for other tour-based items.
    let stepDefinitions: StepOptions[];

    if (stepId === 'view-models') {
      let ctaClicked = false;
      const handleCtaClick = () => {
        if (!ctaClicked) {
          ctaClicked = true;
          // complete the tour
          tour.complete();
        }
      };
      stepDefinitions = [
        {
          id: 'view-models-nav',
          title: 'AI Models',
          text: 'Use this navigation item to explore available AI models. Click it any time to view models supported in PACS AI.',
          attachTo: {
            element: '[data-tour-id="nav-ai-models"]',
            on: 'right',
          },
          buttons: [
            {
              text: 'Skip',
              action: () => {
                // complete the tour
                tour.complete();
              },
            },
          ],
          when: {
            show: () => {
              const cta = document.querySelector('[data-tour-id="nav-ai-models"]');
              if (cta) {
                cta.addEventListener('click', handleCtaClick, { once: true });
              }
            },
            hide: () => {
              const cta = document.querySelector('[data-tour-id="nav-ai-models"]');
              if (cta) {
                cta.removeEventListener('click', handleCtaClick);
              }
            },
          },
        },
      ];
    } else if (stepId === 'run-inference') {
      let ctaClicked = false;
      const handleCtaClick = () => {
        if (!ctaClicked) {
          ctaClicked = true;
          tour.complete();
        }
      };
      stepDefinitions = [
        {
          id: 'run-inference-nav',
          title: 'Run Inference',
          text: 'Open the AI Models menu to apply a model to the current study.',
          attachTo: {
            element: '[data-tour-id="ai-model-button"]',
            on: 'bottom',
          },
          buttons: [
            {
              text: 'Skip',
              classes: 'bg-[#C8F469] !text-black px-3 py-1 rounded-md',
              action: () => {
                tour.complete();
              },
            },
          ],
          when: {
            show: () => {
              const cta = document.querySelector('[data-tour-id="ai-model-button"]');
              if (cta) {
                cta.addEventListener('click', handleCtaClick, { once: true });
              }
            },
            hide: () => {
              const cta = document.querySelector('[data-tour-id="ai-model-button"]');
              if (cta) {
                cta.removeEventListener('click', handleCtaClick);
              }
            },
          },
        },
      ];
    } else {
      stepDefinitions = [
        {
          id: `${stepId}-intro`,
          title: step.title,
          buttons: [
            {
              text: 'Close',
              action: () => tour.complete(),
            },
          ],
        },
      ];
    }

    stepDefinitions.forEach(def => tour.addStep(def));

    tour.on('complete', () => markStepCompleted(stepId));
    tour.on('cancel', () => markStepCompleted(stepId));

    tour.start();
  };

  const handleStepClick = (stepId: string) => {
    if (stepId === 'pre-survey') {
      setActiveSurvey('pre');
      return;
    }
    if (stepId === 'post-survey') {
      setActiveSurvey('post');
      return;
    }
    if (stepId === 'model-questionnaire') {
      // must be in a viewer context to access model questionnaires
      if (!isInViewer) {
        setViewerModalStepId(stepId);
        setViewerModalOpen(true);
        return;
      }
      if (pendingModelQuestionnaires.length === 0) {
        // All models already answered (or none have questionnaires) — mark complete immediately.
        markStepCompleted('model-questionnaire');
        return;
      }
      // Snapshot the pending list into a stable queue for this modal session.
      setModelQuestionnaireQueue([...pendingModelQuestionnaires]);
      setModelQuestionnaireQueueIndex(0);
      setModelQuestionnaireAnswers({});
      return;
    }
    // for run-inference the user must be on a viewer page or have a study selected.
    // only show the modal when we are NOT already in a viewer context.
    if (stepId === 'run-inference' && !isInViewer) {
      setViewerModalStepId(stepId);
      setViewerModalOpen(true);
      return;
    }

    startTourForStep(stepId);
  };

  const closeViewerModal = useCallback(() => {
    setViewerModalOpen(false);
    setViewerModalStepId(null);
  }, []);

  const skipViewerStep = useCallback(async () => {
    const id = viewerModalStepId;
    closeViewerModal();
    if (!id) {
      return;
    }
    try {
      await markStepCompleted(id);
    } catch (error) {
      console.error(error);
    }
  }, [viewerModalStepId, closeViewerModal, markStepCompleted]);

  // only show tutorial if user is logged in or user response exists
  if (userLoading || !currentUser || (!currentUser.id && !currentUser.email)) {
    return null;
  }
  if (!steps.length) {
    return null;
  }
  // Hide after a page refresh when the stored progress was already 100%
  if (loadedAsCompleted && progress === 100) {
    return null;
  }

  return (
    <>
      {/* Ensure Shepherd buttons use black text regardless of external styles */}
      <style>{`.shepherd-theme-pacsai .shepherd-button { color: #000 !important; }`}</style>
      {/* Tutorial progress toggle and card */}
      <div className="tutorial-overlay-container pointer-events-none fixed bottom-20 right-5 z-[999] flex flex-col items-end">
        {expanded && (
          <div className="tutorial-card pointer-events-auto mb-2 w-[360px] max-w-full rounded-2xl bg-[#151815] text-white shadow-2xl">
            <div className="tutorial-card-header relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-[#1F2C1F] to-[#151815] px-5 py-4">
              <img
                src={tutorialProgressHeaderBG}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60"
              />
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Keep going, {currentUser.name}!</h2>
                  <p className="mt-1 pr-5 text-sm text-white/70">
                    Follow these steps to get started with PACS AI.
                  </p>
                </div>
                <div className="relative flex h-[60px] w-[60px] items-center justify-center">
                  <svg
                    width="60"
                    height="60"
                    viewBox="0 0 60 60"
                    className="-rotate-90"
                  >
                    <circle
                      cx="30"
                      cy="30"
                      r="25"
                      className="text-gray-700"
                      stroke="currentColor"
                      strokeWidth="7"
                      fill="transparent"
                    />
                    <circle
                      cx="30"
                      cy="30"
                      r="25"
                      stroke="#C8F469"
                      strokeWidth="7"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 25}
                      strokeDashoffset={(2 * Math.PI * 25 * (100 - progress)) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-xs font-semibold">{progress}%</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2 text-xs">
                {/* TODO: For testing purposes (Reset button) */}
                {/* <button
                  type="button"
                  className="rounded-md bg-white/10 px-3 py-1 font-medium text-white hover:bg-white/20"
                  onClick={resetTutorial}
                >
                  Reset
                </button> */}
                {progress < 100 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md bg-white/10 px-3 py-2 text-white"
                    onClick={e => handleSkipClick(e)}
                  >
                    <span>Skip Tutorial</span>
                  </button>
                )}
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md bg-white/10 px-3 py-2 text-white"
                  onClick={() => setExpanded(false)}
                >
                  <img
                    src={arrowShrink}
                    alt="Arrow shrink icon"
                    className="h-4 w-4"
                  />
                  <span>Minimize</span>
                </button>
              </div>
            </div>

            <div className="pacs-scroll max-h-[340px] overflow-y-auto px-5 py-4">
              {steps.map((step, index) => {
                const isCompleted = step.completed;
                const isCurrent = step.current || (!step.completed && index === 0);
                // only allow clicking if this step is NOT already completed and
                // all previous steps are completed
                const isClickable = !isCompleted && steps.slice(0, index).every(s => s.completed);

                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`group flex w-full rounded-xl px-3 text-left transition-colors disabled:opacity-100 ${
                      isCompleted ? '' : isCurrent ? 'bg-white/10' : 'bg-transparent'
                    } ${index === 0 ? 'pt-3' : ''} ${index === steps.length - 1 ? 'items-end pb-3' : ''} ${index !== 0 && index !== steps.length - 1 ? 'items-center' : ''} ${!isClickable ? 'cursor-not-allowed opacity-60' : ''}`}
                    onClick={() => isClickable && handleStepClick(step.id)}
                    disabled={!isClickable}
                  >
                    <div className="relative mr-3 flex flex-col items-center">
                      {/* Top line: hidden if current step, but space retained */}
                      {index !== 0 && (
                        <div
                          className={`h-3 w-[4px] ${
                            isCurrent
                              ? 'invisible'
                              : steps[index].completed && steps[index - 1].completed
                                ? 'bg-[#C8F469]'
                                : 'bg-white/30'
                          }`}
                        />
                      )}
                      {isCurrent ? (
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/30 bg-transparent`}
                        ></div>
                      ) : (
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                            isCompleted ? 'border-[#C8F469] bg-transparent' : 'border-white/30'
                          }`}
                        >
                          {isCompleted && (
                            <img
                              src={checkTick}
                              alt="Check tick icon"
                              className="h-3 w-3"
                            />
                          )}
                        </div>
                      )}
                      {/* Bottom line: hidden if current step, but space retained */}
                      {index < steps.length - 1 && (
                        <div
                          className={`h-3 w-[4px] ${
                            isCurrent
                              ? 'invisible'
                              : steps[index].completed && steps[index + 1].completed
                                ? 'bg-[#C8F469]'
                                : 'bg-white/30'
                          }`}
                        />
                      )}
                    </div>

                    <div
                      className={`flex-1 ${index === 0 ? 'pt-1' : ''} ${index === steps.length - 1 ? 'pb-1' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{step.title}</span>
                      </div>
                    </div>

                    <img
                      src={chevronRightIcon}
                      alt={'Chevron right icon'}
                      className={`h-4 w-5 ${index === 0 ? 'mt-1' : ''} ${index === steps.length - 1 ? 'mb-1' : ''}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button
          type="button"
          className="tutorial-toggle pointer-events-auto mb-3 flex h-12 items-center rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-sm text-white shadow-lg backdrop-blur"
          onClick={() => setExpanded(prev => !prev)}
        >
          <div className="mr-2 flex h-6 w-6 items-center justify-center">
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              className="-rotate-90"
            >
              <circle
                cx="11"
                cy="11"
                r="9"
                className="text-gray-700"
                stroke="currentColor"
                strokeWidth="3"
                fill="transparent"
              />
              <circle
                cx="11"
                cy="11"
                r="9"
                stroke="#C8F469"
                strokeWidth="3"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 9}
                strokeDashoffset={(2 * Math.PI * 9 * (100 - progress)) / 100}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="mr-4 font-medium">Tutorials {progress}%</span>
          <img
            src={chevronUpIcon}
            alt={'Chevron up icon'}
            className="w-5"
          />
        </button>
      </div>

      {/* Dynamic survey modal for PRE_SURVEY and POST_SURVEY using tenantInfo.onboardingQuestionnaires */}
      {(['pre', 'post'] as const).map(type => {
        const isOpen = activeSurvey === type;
        const questions: Questionnaire[] =
          type === 'pre'
            ? (tenantInfo?.onboardingQuestionnaires?.PRE_SURVEY as Questionnaire[]) || []
            : (tenantInfo?.onboardingQuestionnaires?.POST_SURVEY as Questionnaire[]) || [];
        if (!isOpen || !questions.length) {
          return null;
        }
        return ReactDOM.createPortal(
          <div
            id="modal"
            className="fixed inset-0 z-[99999] overflow-y-auto"
            aria-labelledby="survey-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"
                aria-hidden="true"
              ></div>
              <span
                className="hidden sm:inline-block sm:h-screen sm:align-middle"
                aria-hidden="true"
              >
                &#8203;
              </span>
              <div className="relative inline-block w-[520px] max-w-full transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle">
                <button
                  onClick={handleSurveyClose}
                  className="absolute top-4 right-4 z-[999999999]"
                >
                  <img
                    src={closeIcon}
                    alt="Close icon"
                  />
                </button>
                <h2
                  id="survey-title"
                  className="mb-1 text-[20px] font-semibold text-white"
                >
                  {type === 'pre' ? 'Pre-Survey Questionnaire' : 'Post-Survey Questionnaire'}
                </h2>
                <form
                  onSubmit={handleSurveySubmit(
                    type === 'pre' ? 'pre-survey' : 'post-survey',
                    questions
                  )}
                  className="space-y-6 text-xs text-white"
                >
                  {questions.map((q: Questionnaire) => {
                    const isFrench = i18n.language?.toLowerCase().startsWith('fr');
                    const questionText = isFrench
                      ? q.questionFr || q.questionEn
                      : q.questionEn || q.questionFr;
                    if (!questionText) {
                      return null;
                    }
                    if (q.type === 'TEXT') {
                      return (
                        <div
                          key={q.id}
                          className="mt-6 space-y-2"
                        >
                          <p className="text-sm font-medium text-white">{questionText}</p>
                          <textarea
                            rows={4}
                            className="w-full rounded-md border border-[#2A2E2A] bg-[#111311] p-2 text-sm text-white outline-none focus:border-emerald-500"
                            value={
                              typeof surveyAnswers[q.id] === 'string' ? surveyAnswers[q.id] : ''
                            }
                            onChange={e =>
                              setSurveyAnswers(a => ({ ...a, [q.id]: e.target.value }))
                            }
                            placeholder={t('Enter your answer here')}
                          />
                        </div>
                      );
                    }
                    // always iterate over English options so IDs stored in state
                    const enOptions = (q.answerOptionsEn || []) as (
                      | QuestionnaireAnswerOption
                      | string
                    )[];
                    const frOptions = (q.answerOptionsFr || []) as (
                      | QuestionnaireAnswerOption
                      | string
                    )[];
                    // returns the localised display label for an option at a given index.
                    const getOptionLabel = (
                      opt: QuestionnaireAnswerOption | string,
                      idx: number
                    ): string => {
                      const isStr = typeof opt === 'string';
                      const enLabel = isStr ? opt : opt.answer || opt.id || String(idx);
                      if (!isFrench) {
                        return enLabel;
                      }
                      if (isStr) {
                        // plain string array — use same index in French array
                        const frEntry = frOptions[idx];
                        return (typeof frEntry === 'string' ? frEntry : undefined) ?? enLabel;
                      }
                      // object array — look up by id
                      const frObj = frOptions.find(
                        f => typeof f !== 'string' && f.id === (opt as QuestionnaireAnswerOption).id
                      ) as QuestionnaireAnswerOption | undefined;
                      return frObj?.answer ?? enLabel;
                    };
                    if (q.type === 'RADIO') {
                      return (
                        <div
                          key={q.id}
                          className="mt-6 space-y-2"
                        >
                          <p className="text-sm font-medium text-white">{questionText}</p>
                          <div className="space-y-2">
                            {enOptions.map((opt, idx) => {
                              const isStr = typeof opt === 'string';
                              const value = isStr ? opt : opt.id || String(idx);
                              const label = getOptionLabel(opt, idx);
                              const isSelected = surveyAnswers[q.id] === value;
                              return (
                                <button
                                  key={value || idx}
                                  type="button"
                                  onClick={() => setSurveyAnswers(a => ({ ...a, [q.id]: value }))}
                                  className="flex w-full items-center gap-2 text-left text-sm text-white"
                                >
                                  <img
                                    src={isSelected ? radioSelected : radioUnselect}
                                    alt={isSelected ? 'selected' : 'unselected'}
                                    className="h-[20px] min-w-[20px]"
                                  />
                                  <span className={isSelected ? 'text-emerald-400' : ''}>
                                    {label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    if (q.type === 'CHECKBOX') {
                      const checkedArr = Array.isArray(surveyAnswers[q.id])
                        ? (surveyAnswers[q.id] as string[])
                        : [];
                      return (
                        <div
                          key={q.id}
                          className="mt-6 space-y-2"
                        >
                          <p className="text-sm font-medium text-white">{questionText}</p>
                          <div className="space-y-2">
                            {enOptions.map((opt, idx) => {
                              const isStr = typeof opt === 'string';
                              const value = isStr ? opt : opt.id || String(idx);
                              const label = getOptionLabel(opt, idx);
                              const isChecked = checkedArr.includes(value);
                              return (
                                <button
                                  key={value || idx}
                                  type="button"
                                  onClick={() => {
                                    setSurveyAnswers(a => {
                                      const prevArr = Array.isArray(a[q.id])
                                        ? (a[q.id] as string[])
                                        : [];
                                      const updated = prevArr.includes(value)
                                        ? prevArr.filter((v: string) => v !== value)
                                        : [...prevArr, value];
                                      return { ...a, [q.id]: updated };
                                    });
                                  }}
                                  className="flex w-full items-center gap-2 text-left text-sm text-white"
                                >
                                  <img
                                    src={isChecked ? checkActive : checkInactive}
                                    alt={isChecked ? 'check' : 'uncheck'}
                                    className="h-[18px] min-w-[18px]"
                                  />
                                  <span className={isChecked ? 'text-emerald-400' : ''}>
                                    {label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                  <div className="mt-6 flex justify-end gap-2 text-xs">
                    <button
                      type="button"
                      className="rounded-md bg-transparent px-4 py-2 text-sm text-white/70 hover:bg-white/10"
                      onClick={handleSurveySkip(type === 'pre' ? 'pre-survey' : 'post-survey')}
                    >
                      Skip
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-gradient-to-r from-[#C8F469] to-[#05905E] px-4 py-2 text-sm font-medium text-black"
                      disabled={isSurveySubmitting}
                      aria-busy={isSurveySubmitting}
                    >
                      {isSurveySubmitting ? '...' : 'Submit'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        );
      })}

      {/* Model questionnaire modal */}
      {modelQuestionnaireQueue.length > 0 &&
        (() => {
          const mqModel = modelQuestionnaireQueue[modelQuestionnaireQueueIndex];
          if (!mqModel) {
            return null;
          }
          const mqQuestions = (mqModel.onboardingModelQuestionnaires || []) as Questionnaire[];
          const mqIsFrench = i18n.language?.toLowerCase().startsWith('fr');
          const mqTotal = modelQuestionnaireQueue.length;
          const mqProgressLabel =
            mqTotal > 1 ? ` (${modelQuestionnaireQueueIndex + 1} of ${mqTotal})` : '';
          return ReactDOM.createPortal(
            <div
              id="model-questionnaire-modal"
              className="fixed inset-0 z-[99999] overflow-y-auto"
              aria-labelledby="model-questionnaire-title"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div
                  className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"
                  aria-hidden="true"
                ></div>
                <span
                  className="hidden sm:inline-block sm:h-screen sm:align-middle"
                  aria-hidden="true"
                >
                  &#8203;
                </span>
                <div className="relative inline-block w-[520px] max-w-full transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle">
                  <button
                    onClick={handleModelQuestionnaireClose}
                    className="absolute top-4 right-4 z-[999999999]"
                  >
                    <img
                      src={closeIcon}
                      alt="Close icon"
                    />
                  </button>
                  <h2
                    id="model-questionnaire-title"
                    className="mb-1 text-[20px] font-semibold text-white"
                  >
                    Model Questionnaire ({mqModel.modelName})
                  </h2>
                  <form
                    onSubmit={handleModelQuestionnaireSubmit}
                    className="space-y-6 text-xs text-white"
                  >
                    {mqQuestions.map((q: Questionnaire) => {
                      const questionText = mqIsFrench
                        ? q.questionFr || q.questionEn
                        : q.questionEn || q.questionFr;
                      if (!questionText) {
                        return null;
                      }

                      if (q.type === 'TEXT') {
                        return (
                          <div
                            key={q.id}
                            className="mt-6 space-y-2"
                          >
                            <p className="text-sm font-medium text-white">{questionText}</p>
                            <textarea
                              rows={4}
                              className="w-full rounded-md border border-[#2A2E2A] bg-[#111311] p-2 text-sm text-white outline-none focus:border-emerald-500"
                              value={
                                typeof modelQuestionnaireAnswers[q.id] === 'string'
                                  ? (modelQuestionnaireAnswers[q.id] as string)
                                  : ''
                              }
                              onChange={e =>
                                setModelQuestionnaireAnswers(a => ({
                                  ...a,
                                  [q.id]: e.target.value,
                                }))
                              }
                              placeholder={t('Enter your answer here')}
                            />
                          </div>
                        );
                      }

                      // always iterate over English options so IDs stored in state
                      const mqEnOptions = (q.answerOptionsEn || []) as (
                        | QuestionnaireAnswerOption
                        | string
                      )[];
                      const mqFrOptions = (q.answerOptionsFr || []) as (
                        | QuestionnaireAnswerOption
                        | string
                      )[];
                      // returns the localised display label for an option at a given index.
                      const getMqOptionLabel = (
                        opt: QuestionnaireAnswerOption | string,
                        idx: number
                      ): string => {
                        const isStr = typeof opt === 'string';
                        const enLabel = isStr ? opt : opt.answer || opt.id || String(idx);
                        if (!mqIsFrench) {
                          return enLabel;
                        }
                        if (isStr) {
                          const frEntry = mqFrOptions[idx];
                          return (typeof frEntry === 'string' ? frEntry : undefined) ?? enLabel;
                        }
                        const frObj = mqFrOptions.find(
                          f =>
                            typeof f !== 'string' && f.id === (opt as QuestionnaireAnswerOption).id
                        ) as QuestionnaireAnswerOption | undefined;
                        return frObj?.answer ?? enLabel;
                      };

                      if (q.type === 'RADIO') {
                        return (
                          <div
                            key={q.id}
                            className="mt-6 space-y-2"
                          >
                            <p className="text-sm font-medium text-white">{questionText}</p>
                            <div className="space-y-2">
                              {mqEnOptions.map((opt, idx) => {
                                const isStr = typeof opt === 'string';
                                const value = isStr ? opt : opt.id || String(idx);
                                const label = getMqOptionLabel(opt, idx);
                                const isSelected = modelQuestionnaireAnswers[q.id] === value;
                                return (
                                  <button
                                    key={value || idx}
                                    type="button"
                                    onClick={() =>
                                      setModelQuestionnaireAnswers(a => ({
                                        ...a,
                                        [q.id]: value,
                                      }))
                                    }
                                    className="flex w-full items-center gap-2 text-left text-sm text-white"
                                  >
                                    <img
                                      src={isSelected ? radioSelected : radioUnselect}
                                      alt={isSelected ? 'selected' : 'unselected'}
                                      className="h-[20px] min-w-[20px]"
                                    />
                                    <span className={isSelected ? 'text-emerald-400' : ''}>
                                      {label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      if (q.type === 'CHECKBOX') {
                        const checkedArr = Array.isArray(modelQuestionnaireAnswers[q.id])
                          ? (modelQuestionnaireAnswers[q.id] as string[])
                          : [];
                        return (
                          <div
                            key={q.id}
                            className="mt-6 space-y-2"
                          >
                            <p className="text-sm font-medium text-white">{questionText}</p>
                            <div className="space-y-2">
                              {mqEnOptions.map((opt, idx) => {
                                const isStr = typeof opt === 'string';
                                const value = isStr ? opt : opt.id || String(idx);
                                const label = getMqOptionLabel(opt, idx);
                                const isChecked = checkedArr.includes(value);
                                return (
                                  <button
                                    key={value || idx}
                                    type="button"
                                    onClick={() => {
                                      setModelQuestionnaireAnswers(a => {
                                        const prev = Array.isArray(a[q.id])
                                          ? (a[q.id] as string[])
                                          : [];
                                        const next = prev.includes(value)
                                          ? prev.filter((v: string) => v !== value)
                                          : [...prev, value];
                                        return { ...a, [q.id]: next };
                                      });
                                    }}
                                    className="flex w-full items-center gap-2 text-left text-sm text-white"
                                  >
                                    <img
                                      src={isChecked ? checkActive : checkInactive}
                                      alt={isChecked ? 'check' : 'uncheck'}
                                      className="h-[18px] min-w-[18px]"
                                    />
                                    <span className={isChecked ? 'text-emerald-400' : ''}>
                                      {label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}

                    <div className="mt-6 flex justify-end gap-2 text-xs">
                      <button
                        type="button"
                        className="rounded-md bg-transparent px-4 py-2 text-sm text-white/70 hover:bg-white/10"
                        onClick={handleModelQuestionnaireSkip}
                      >
                        Skip
                      </button>
                      <button
                        type="submit"
                        className="rounded-md bg-gradient-to-r from-[#C8F469] to-[#05905E] px-4 py-2 text-sm font-medium text-black"
                        disabled={isModelQuestionnaireSubmitting}
                        aria-busy={isModelQuestionnaireSubmitting}
                      >
                        {isModelQuestionnaireSubmitting
                          ? '...'
                          : mqTotal > 1 && modelQuestionnaireQueueIndex < mqTotal - 1
                            ? 'Next'
                            : 'Submit'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>,
            document.body
          );
        })()}

      {skipModalOpen &&
        ReactDOM.createPortal(
          <div
            id="skip-modal"
            className="fixed inset-0 z-[100000] overflow-y-auto"
            aria-labelledby="skip-modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"
                aria-hidden="true"
              ></div>
              <span
                className="hidden sm:inline-block sm:h-screen sm:align-middle"
                aria-hidden="true"
              >
                &#8203;
              </span>
              <div className="relative inline-block w-[420px] max-w-full transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle">
                <Typography
                  variant="h6"
                  className="font-light text-white"
                >
                  Skip Tutorial
                </Typography>
                <Typography
                  variant="body"
                  className="mt-2 font-light text-white text-opacity-70"
                >
                  Do you want to skip the entire tutorial?
                </Typography>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-transparent px-4 py-2 text-sm text-white/70 hover:bg-white/10"
                    onClick={cancelSkip}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-gradient-to-r from-[#C8F469] to-[#05905E] px-4 py-2 text-sm font-medium text-black"
                    onClick={confirmSkip}
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      {viewerModalOpen &&
        ReactDOM.createPortal(
          <div
            id="viewer-required-modal"
            className="fixed inset-0 z-[100001] overflow-y-auto"
            aria-labelledby="viewer-required-modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"
                aria-hidden="true"
              ></div>
              <span
                className="hidden sm:inline-block sm:h-screen sm:align-middle"
                aria-hidden="true"
              >
                &#8203;
              </span>
              <div className="relative inline-block w-[420px] max-w-full transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle">
                <h2
                  id="viewer-required-modal-title"
                  className="mb-2 text-base font-semibold text-white"
                >
                  Viewer Required
                </h2>
                <p className="mb-4 text-sm text-white/80">
                  You need to be on a viewer page or have a study selected to continue with this
                  action.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-transparent px-4 py-2 text-sm text-white/70 hover:bg-white/10"
                    onClick={skipViewerStep}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-gradient-to-r from-[#C8F469] to-[#05905E] px-4 py-2 text-sm font-medium text-black"
                    onClick={closeViewerModal}
                  >
                    Ok
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default TutorialProgressOverlay;
