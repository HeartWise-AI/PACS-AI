import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useShepherd } from 'react-shepherd';
import type { StepOptions, TourOptions } from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import closeIcon from './../assets/pacs/icons/close-inactive.png';
import chevronUpIcon from './../assets/pacs/icons/chevron-up.png';
import chevronRightIcon from './../assets/pacs/icons/chevron-right.png';
import arrowShrink from './../assets/pacs/icons/arrow-shrink.png';
import checkTick from './../assets/pacs/icons/check-tick-outline-primary.png';
import tutorialProgressHeaderBG from './../assets/pacs/bg/tutorial-progress-header-bg.png';

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

const STORAGE_KEY = 'pacsai.tutorialProgress';

interface StoredProgress {
  steps: Array<Pick<TutorialStepState, 'id' | 'completed'>>;
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

const loadStoredProgress = (): TutorialStepState[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STEPS;
    }

    const parsed: StoredProgress = JSON.parse(raw);
    if (!parsed?.steps?.length) {
      return DEFAULT_STEPS;
    }

    // Merge stored completion flags back into the default steps definition.
    return DEFAULT_STEPS.map(step => {
      const stored = parsed.steps.find(s => s.id === step.id);
      return stored ? { ...step, completed: stored.completed } : step;
    });
  } catch {
    return DEFAULT_STEPS;
  }
};

const persistProgress = (steps: TutorialStepState[]) => {
  const toStore: StoredProgress = {
    steps: steps.map(step => ({ id: step.id, completed: step.completed })),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Best-effort only; ignore storage errors.
  }
};

/**
 * Global tutorial progress overlay.
 *
 * Renders a bottom-right card showing high-level tutorial steps and
 * integrates with Shepherd.js to run contextual tours for each step.
 */
const TutorialProgressOverlay: React.FC = () => {
  const Shepherd = useShepherd();

  const [expanded, setExpanded] = useState<boolean>(false);
  const [steps, setSteps] = useState<TutorialStepState[]>(() => loadStoredProgress());
  const [isPreSurveyOpen, setIsPreSurveyOpen] = useState<boolean>(false);
  const [preSurveySymptoms, setPreSurveySymptoms] = useState<string[]>([]);
  const [preSurveyCondition, setPreSurveyCondition] = useState<string>('');

  const handleClosePreSurvey = useCallback(() => {
    setIsPreSurveyOpen(false);
  }, []);

  useEffect(() => {
    persistProgress(steps);
  }, [steps]);

  const completedCount = useMemo(() => steps.filter(step => step.completed).length, [steps]);

  const totalCount = steps.length || 1;
  const progress = Math.round((completedCount / totalCount) * 100);

  const markStepCompleted = (id: string) => {
    setSteps(prev => {
      const updated = prev.map(step => (step.id === id ? { ...step, completed: true } : step));

      // Move "current" flag to the next incomplete step, if any.
      const nextIndex = updated.findIndex(step => !step.completed);
      return updated.map((step, index) => ({
        ...step,
        current: index === nextIndex,
      }));
    });
  };

  const resetTutorial = () => {
    setSteps(DEFAULT_STEPS);
  };

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
              text: 'Got it',
              action: () => tour.complete(),
            },
          ],
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
      setIsPreSurveyOpen(true);
      return;
    }

    startTourForStep(stepId);
  };

  if (!steps.length) {
    return null;
  }

  return (
    <>
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
                  <h2 className="text-lg font-semibold">Keep going</h2>
                  <p className="mt-1 text-sm text-white/70">
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
                <button
                  type="button"
                  className="rounded-md bg-white/10 px-3 py-1 font-medium text-white hover:bg-white/20"
                  onClick={resetTutorial}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md bg-white/10 px-3 py-2 text-white"
                >
                  <span>Skip Tutorial</span>
                </button>
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
                // only allow clicking if all previous steps are completed
                const isClickable = steps.slice(0, index).every(s => s.completed);

                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`group flex w-full rounded-xl px-3 text-left transition-colors ${
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

      {/* Pre-survey questionnaire modal (inline implementation similar to ModelFactsModal) */}
      {isPreSurveyOpen && (
        <div
          id="modal"
          className="fixed inset-0 z-[99999] overflow-y-auto"
          aria-labelledby="pre-survey-title"
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
              {/* close button */}
              <button
                onClick={handleClosePreSurvey}
                className="absolute top-4 right-4 z-[999999999]"
              >
                <img
                  src={closeIcon}
                  alt="Close icon"
                />
              </button>

              {/* content */}
              <h2
                id="pre-survey-title"
                className="mb-1 text-base font-semibold text-white"
              >
                Pre-Survey Questionnaire
              </h2>
              <p className="mb-6 text-xs text-white/60">
                Please complete this short questionnaire to continue.
              </p>

              <div className="space-y-6 text-xs text-white">
                <div>
                  <p className="mb-2 font-medium">
                    1. Are you currently experiencing any of the following symptoms?
                  </p>
                  <div className="space-y-1">
                    {[
                      'Chest pain or discomfort',
                      'Shortness of breath',
                      'Dizziness or lightheadedness',
                    ].map(option => {
                      const id = `symptom-${option}`;
                      const checked = preSurveySymptoms.includes(option);
                      return (
                        <label
                          key={option}
                          htmlFor={id}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <input
                            id={id}
                            type="checkbox"
                            className="h-3 w-3 rounded border border-white/40 bg-transparent text-[#C8F469]"
                            checked={checked}
                            onChange={e => {
                              setPreSurveySymptoms(prev => {
                                if (e.target.checked) {
                                  return prev.includes(option) ? prev : [...prev, option];
                                }
                                return prev.filter(item => item !== option);
                              });
                            }}
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-medium">
                    2. Do you have any medical conditions or factors we should be aware of before
                    the health procedure?
                  </p>
                  <div className="space-y-1">
                    {['History of heart disease', 'High blood pressure', 'Diabetes'].map(option => {
                      const id = `condition-${option}`;
                      return (
                        <label
                          key={option}
                          htmlFor={id}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <input
                            id={id}
                            type="radio"
                            name="pre-survey-condition"
                            className="h-3 w-3 rounded-full border border-white/40 bg-transparent text-[#C8F469]"
                            checked={preSurveyCondition === option}
                            onChange={() => setPreSurveyCondition(option)}
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-md bg-transparent px-4 py-2 text-sm text-white/70 hover:bg-white/10"
                  onClick={() => {
                    setIsPreSurveyOpen(false);
                    setPreSurveySymptoms([]);
                    setPreSurveyCondition('');
                    markStepCompleted('pre-survey');
                  }}
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  className="rounded-md bg-gradient-to-r from-[#C8F469] to-[#05905E] px-4 py-2 text-sm font-medium text-black"
                  onClick={() => {
                    setIsPreSurveyOpen(false);
                    // Placeholder: capture answers locally; wire to API as needed
                    setPreSurveySymptoms([]);
                    setPreSurveyCondition('');
                    markStepCompleted('pre-survey');
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TutorialProgressOverlay;
