import React, { useCallback, useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import closeIcon from './../../assets/pacs/icons/close-inactive.png';
import thumbsUp from './../../assets/pacs/icons/thumbs-up-outline.png';
import thumbsUpChecked from './../../assets/pacs/icons/thumbs-up-solid.png';
import thumbsDown from './../../assets/pacs/icons/thumbs-down-outline.png';
import thumbsDownChecked from './../../assets/pacs/icons/thumbs-down-solid.png';
import uncheckIcon from './../../assets/pacs/icons/check-inactive.png';
import checkIcon from './../../assets/pacs/icons/check-active.png';
import radioSelected from './../../assets/pacs/icons/radio-selected.png';
import radioUnselect from './../../assets/pacs/icons/radio-unselect.png';
import { Button } from '@ohif/ui';
import { useTranslation } from 'react-i18next';
import inferenceRepository from '../../api/inferenceRepository';
import { GetInferenceAvailableModelsResponse } from '../../api/inferenceDTO';
import { logoutUser } from '../../service/userService';
import { Error } from '../../api/dto';
import { AlertContext } from '../../AlertProvider';

interface AddModelFeedbackProps {
  title: string;
  // full inference model descriptor used by the feedback API and for questions
  selectedInferenceModel?: GetInferenceAvailableModelsResponse | null;
}

type FeedbackType = 'APPROVE' | 'REJECT' | null;

const AddModelFeedback: React.FC<AddModelFeedbackProps> = ({ title, selectedInferenceModel }) => {
  const { t, i18n } = useTranslation('AIModelButton');
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';
  const showAlert = useContext(AlertContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFeedbackType, setCurrentFeedbackType] = useState<FeedbackType>(null);
  const [existingFeedbackId, setExistingFeedbackId] = useState<string>('');
  const [questionTextAnswers, setQuestionTextAnswers] = useState<Record<string, string>>({});
  const [questionCheckboxAnswers, setQuestionCheckboxAnswers] = useState<Record<string, string[]>>(
    {}
  );
  const [questionRadioAnswers, setQuestionRadioAnswers] = useState<Record<string, string>>({});
  const [pendingFeedbackType, setPendingFeedbackType] = useState<Exclude<
    FeedbackType,
    null
  > | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // build the formatted model ID expected by the feedback API: `{modelId}-{version}`
  // treat null, empty, or whitespace-only modelId as "no model".
  const baseModelId = selectedInferenceModel?.modelId?.trim() || '';
  const modelVersion = selectedInferenceModel?.version || '';
  const feedbackModelId =
    baseModelId && modelVersion ? `${baseModelId}-${modelVersion}` : baseModelId;

  const currentLanguage = i18n.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';

  // Refresh existing feedback from API
  const refreshExistingFeedback = useCallback(async () => {
    if (!feedbackModelId) {
      setExistingFeedbackId('');
      setCurrentFeedbackType(null);
      return;
    }

    try {
      const apiResponse = await inferenceRepository.GetModelFeedbackByModelID({
        modelId: feedbackModelId,
      });
      console.log('Existing model feedback:', apiResponse);

      const firstFeedback = apiResponse.data;
      if (firstFeedback?.id) {
        setExistingFeedbackId(firstFeedback.id);
        const feedbackTypeUpper = firstFeedback.feedbackType
          ? firstFeedback.feedbackType.toUpperCase()
          : '';

        let initialType: FeedbackType = null;
        if (feedbackTypeUpper === 'APPROVE' || feedbackTypeUpper === 'REJECT') {
          initialType = feedbackTypeUpper as FeedbackType;
        }

        setCurrentFeedbackType(initialType);
      } else {
        setExistingFeedbackId('');
        setCurrentFeedbackType(null);
      }
    } catch (error) {
      console.error('Error getting existing model feedback:', error);
      setExistingFeedbackId('');
      setCurrentFeedbackType(null);
    }
  }, [feedbackModelId]);

  // Submit feedback without questions (used when there are no questionnaires)
  const submitFeedbackWithoutQuestions = useCallback(
    async (nextType: Exclude<FeedbackType, null>) => {
      if (!feedbackModelId) {
        setCurrentFeedbackType(nextType);
        return;
      }

      setIsSubmitting(true);
      try {
        await inferenceRepository.UpdateModelFeedback({
          id: existingFeedbackId || null,
          inferenceModelId: selectedInferenceModel?.modelId,
          modelId: feedbackModelId,
          feedbackType: nextType,
          modelFeedbackAnswers: null,
        });

        await refreshExistingFeedback();
      } catch (error) {
        if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
          setTimeout(() => {
            logoutUser(navigate, tenantId);
          }, 3000);
        }

        showAlert(error.message, 'error');
        console.error('Error updating model feedback without questions:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [existingFeedbackId, feedbackModelId, refreshExistingFeedback, selectedInferenceModel?.modelId]
  );

  // Handle opening the modal
  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
    setQuestionTextAnswers({});
    setQuestionCheckboxAnswers({});
    setQuestionRadioAnswers({});
  }, []);

  // Handle closing the modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setPendingFeedbackType(null);
  }, []);

  // Handle thumb up (approve) click
  const handleThumbUpClick = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    // if current feedback is already APPROVE, clicking again removes the feedback.
    if (currentFeedbackType === 'APPROVE') {
      if (!feedbackModelId) {
        // no modelId provided – just clear local state.
        setCurrentFeedbackType(null);
        return;
      }

      setIsSubmitting(true);
      try {
        await inferenceRepository.RemoveModelFeedback({ modelId: feedbackModelId });
        await refreshExistingFeedback();
      } catch (error) {
        console.error('Error removing model feedback (APPROVE):', error);
        if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
          setTimeout(() => {
            logoutUser(navigate, tenantId);
          }, 3000);
        }

        showAlert(error.message, 'error');
        setCurrentFeedbackType(null);
        setExistingFeedbackId('');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // otherwise, if there are no approve questionnaires, bypass modal and call API directly.
    const approveQuestionnaires = selectedInferenceModel?.approveFeedbackQuestionnaires;
    const hasApproveQuestions =
      Array.isArray(approveQuestionnaires) && approveQuestionnaires.length > 0;

    if (!hasApproveQuestions) {
      await submitFeedbackWithoutQuestions('APPROVE');
      return;
    }

    // fallback: open the feedback modal with an APPROVE intent.
    setPendingFeedbackType('APPROVE');
    handleOpenModal();
  }, [
    currentFeedbackType,
    feedbackModelId,
    handleOpenModal,
    isSubmitting,
    refreshExistingFeedback,
    selectedInferenceModel?.approveFeedbackQuestionnaires,
    submitFeedbackWithoutQuestions,
  ]);

  // Handle submitting feedback
  const handleSubmitFeedback = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }
      // use the pending intent (APPROVE / REJECT). Default to REJECT if somehow unset.
      const nextType: Exclude<FeedbackType, null> = pendingFeedbackType || 'REJECT';

      if (!feedbackModelId) {
        // no modelId provided – just update local state.
        setCurrentFeedbackType(nextType);
        setIsModalOpen(false);
        setPendingFeedbackType(null);
        return;
      }

      setIsSubmitting(true);
      try {
        type FeedbackQuestionnaire =
          GetInferenceAvailableModelsResponse['approveFeedbackQuestionnaires'][number];

        const rawQuestionnaires =
          nextType === 'APPROVE'
            ? selectedInferenceModel?.approveFeedbackQuestionnaires
            : selectedInferenceModel?.rejectFeedbackQuestionnaires;

        const questionnaires: FeedbackQuestionnaire[] = rawQuestionnaires
          ? [...rawQuestionnaires]
          : [];

        const modelFeedbackAnswersArray = questionnaires.reduce(
          (
            acc: {
              questionnaireId: string;
              questionnaireQuestion: string;
              questionnaireAnswerIds: string[];
              questionnaireAnswers: string[];
            }[],
            question
          ) => {
            // always use the English text for payload
            const questionTextEn = question.questionEn;

            // skip questions that have no English text.
            if (!questionTextEn || !questionTextEn.trim()) {
              return acc;
            }

            let questionnaireAnswerIds: string[] = [];
            let questionnaireAnswers: string[] = [];

            const upperType = question.type.toUpperCase();

            if (upperType === 'TEXT') {
              const value = questionTextAnswers[question.id];
              if (value && value.trim()) {
                // for TEXT questions, backend expects a dummy id even though
                // there are no answerOptions; use a constant id "text".
                questionnaireAnswerIds = ['text'];
                questionnaireAnswers = [value.trim()];
              }
            } else if (upperType === 'CHECKBOX') {
              const selectedIds = questionCheckboxAnswers[question.id] || [];
              questionnaireAnswerIds = selectedIds;

              const options = (question.answerOptionsEn || [] || []) as {
                answer: string;
                id: string;
              }[];

              questionnaireAnswers = selectedIds
                .map(selectedId => options.find(option => option.id === selectedId)?.answer)
                .filter((answer): answer is string => Boolean(answer));
            } else if (upperType === 'RADIO') {
              const selectedId = questionRadioAnswers[question.id];
              if (selectedId) {
                questionnaireAnswerIds = [selectedId];

                const options = (question.answerOptionsEn || [] || []) as {
                  answer: string;
                  id: string;
                }[];

                const selectedOption = options.find(option => option.id === selectedId);
                if (selectedOption) {
                  questionnaireAnswers = [selectedOption.answer];
                }
              }
            }

            // if there are no selected answer ids and no textual answers,
            // skip adding this question entirely.
            if (questionnaireAnswerIds.length === 0 && questionnaireAnswers.length === 0) {
              return acc;
            }

            acc.push({
              questionnaireId: question.id,
              questionnaireQuestion: questionTextEn,
              questionnaireAnswerIds,
              questionnaireAnswers,
            });

            return acc;
          },
          []
        );

        await inferenceRepository.UpdateModelFeedback({
          id: existingFeedbackId || null,
          inferenceModelId: selectedInferenceModel?.modelId,
          modelId: feedbackModelId,
          feedbackType: nextType,
          modelFeedbackAnswers:
            modelFeedbackAnswersArray.length > 0
              ? (modelFeedbackAnswersArray as [
                  {
                    questionnaireId: string;
                    questionnaireQuestion: string;
                    questionnaireAnswerIds: string[];
                    questionnaireAnswers: string[];
                  },
                ])
              : null,
        });

        await refreshExistingFeedback();
      } catch (error) {
        console.error('Error updating model feedback:', error);
        if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
          setTimeout(() => {
            logoutUser(navigate, tenantId);
          }, 3000);
        }

        showAlert(error.message, 'error');
      } finally {
        setIsSubmitting(false);
      }

      setPendingFeedbackType(null);
      setIsModalOpen(false);
    },
    [
      feedbackModelId,
      isSubmitting,
      pendingFeedbackType,
      questionCheckboxAnswers,
      questionRadioAnswers,
      questionTextAnswers,
      existingFeedbackId,
      refreshExistingFeedback,
      selectedInferenceModel?.modelId,
      selectedInferenceModel?.approveFeedbackQuestionnaires,
      selectedInferenceModel?.rejectFeedbackQuestionnaires,
    ]
  );

  // Handle thumb down (reject) click
  const handleThumbDownClick = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    // if current feedback is already REJECT, clicking again removes the feedback
    // and does NOT show the modal.
    if (currentFeedbackType === 'REJECT') {
      if (!feedbackModelId) {
        // no modelId provided – just clear local state.
        setCurrentFeedbackType(null);
        return;
      }

      setIsSubmitting(true);
      try {
        await inferenceRepository.RemoveModelFeedback({ modelId: feedbackModelId });
        await refreshExistingFeedback();
      } catch (error) {
        console.error('Error removing model feedback (REJECT):', error);
        if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
          setTimeout(() => {
            logoutUser(navigate, tenantId);
          }, 3000);
        }

        showAlert(error.message, 'error');
        setCurrentFeedbackType(null);
        setExistingFeedbackId('');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // otherwise, if there are no reject questionnaires, bypass modal and call API directly.
    const rejectQuestionnaires = selectedInferenceModel?.rejectFeedbackQuestionnaires;
    const hasRejectQuestions =
      Array.isArray(rejectQuestionnaires) && rejectQuestionnaires.length > 0;

    if (!hasRejectQuestions) {
      await submitFeedbackWithoutQuestions('REJECT');
      return;
    }

    // fallback: open the modal with a REJECT intent; submit will create/update REJECT feedback.
    setPendingFeedbackType('REJECT');
    handleOpenModal();
  }, [
    currentFeedbackType,
    feedbackModelId,
    handleOpenModal,
    isSubmitting,
    refreshExistingFeedback,
    selectedInferenceModel?.rejectFeedbackQuestionnaires,
    submitFeedbackWithoutQuestions,
  ]);

  // Handle text answer change
  const handleTextChange = useCallback((questionId: string, value: string) => {
    setQuestionTextAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  // Toggle checkbox option
  const toggleCheckboxOption = useCallback((questionId: string, answerId: string) => {
    setQuestionCheckboxAnswers(prev => {
      const existing = prev[questionId] || [];
      const updated = existing.includes(answerId)
        ? existing.filter(id => id !== answerId)
        : [...existing, answerId];
      return { ...prev, [questionId]: updated };
    });
  }, []);

  // Handle radio option change
  const handleRadioChange = useCallback((questionId: string, answerId: string) => {
    setQuestionRadioAnswers(prev => ({ ...prev, [questionId]: answerId }));
  }, []);

  useEffect(() => {
    refreshExistingFeedback();
  }, [feedbackModelId, refreshExistingFeedback]);

  // if there is no underlying modelId, do not render feedback UI at all.
  if (!baseModelId) {
    return null;
  }

  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[13px] text-white">{t('Rate this model')}</h1>
          <button
            type="button"
            onClick={handleThumbUpClick}
            className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-[#2C2F2C] transition-colors"
          >
            <img
              src={currentFeedbackType === 'APPROVE' ? thumbsUpChecked : thumbsUp}
              alt="Thumbs up icon"
            />
          </button>
          <button
            type="button"
            onClick={handleThumbDownClick}
            className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-[#2C2F2C] transition-colors"
          >
            <img
              src={currentFeedbackType === 'REJECT' ? thumbsDownChecked : thumbsDown}
              alt="Thumbs down icon"
            />
          </button>
        </div>
      </div>

      {mounted &&
        isModalOpen &&
        ReactDOM.createPortal(
          <div
            id="modal"
            className="fixed inset-0 z-[99999] overflow-y-auto"
            aria-labelledby="modal-title"
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

              <div className="relative inline-block w-full max-w-xl transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle">
                <button
                  onClick={handleCloseModal}
                  className="absolute top-4 right-4 z-[999999999]"
                  type="button"
                >
                  <img
                    src={closeIcon}
                    alt="Close icon"
                  />
                </button>

                <form
                  onSubmit={handleSubmitFeedback}
                  className="w-full space-y-4"
                >
                  <div>
                    <h1 className="text-[20px] font-semibold text-white">{t('Add Feedback')}</h1>
                    <p className="text-[14px] text-white/70">
                      {t('Your feedback helps us improve this model')}
                    </p>
                  </div>
                  <h3 className="text-xl font-semibold text-white">{title}</h3>

                  {(
                    (pendingFeedbackType === 'APPROVE'
                      ? selectedInferenceModel?.approveFeedbackQuestionnaires
                      : selectedInferenceModel?.rejectFeedbackQuestionnaires) || []
                  ).map(question => {
                    const isFrench = currentLanguage === 'fr';
                    const questionText = isFrench
                      ? question.questionFr || question.questionEn
                      : question.questionEn || question.questionFr;
                    const upperType = question.type.toUpperCase();

                    // do not render questions that have no text in either language.
                    if (!questionText || !questionText.trim()) {
                      return null;
                    }

                    if (upperType === 'TEXT') {
                      const value = questionTextAnswers[question.id] || '';
                      return (
                        <div
                          key={question.id}
                          className="mt-6 space-y-2"
                        >
                          <p className="text-sm font-medium text-white">{questionText}</p>
                          <textarea
                            value={value}
                            onChange={event => handleTextChange(question.id, event.target.value)}
                            rows={4}
                            className="w-full rounded-md border border-[#2A2E2A] bg-[#111311] p-2 text-sm text-white outline-none focus:border-emerald-500"
                            placeholder={t('Enter your answer here')}
                          />
                        </div>
                      );
                    }

                    const options = ((isFrench
                      ? question.answerOptionsFr || []
                      : question.answerOptionsEn || []) || []) as { answer: string; id: string }[];

                    if (upperType === 'CHECKBOX') {
                      const selectedIds = questionCheckboxAnswers[question.id] || [];

                      return (
                        <div
                          key={question.id}
                          className="mt-6 space-y-2"
                        >
                          <p className="text-sm font-medium text-white">{questionText}</p>
                          <div className="space-y-2">
                            {options.map(option => {
                              const isChecked = selectedIds.includes(option.id);

                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => toggleCheckboxOption(question.id, option.id)}
                                  className="flex w-full items-center gap-2 text-left text-sm text-white"
                                >
                                  <img
                                    src={isChecked ? checkIcon : uncheckIcon}
                                    alt={isChecked ? 'check' : 'uncheck'}
                                    className="h-[18px] min-w-[18px]"
                                  />
                                  <span className={isChecked ? 'text-emerald-400' : ''}>
                                    {option.answer}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    if (upperType === 'RADIO') {
                      const selectedId = questionRadioAnswers[question.id];

                      return (
                        <div
                          key={question.id}
                          className="mt-6 space-y-2"
                        >
                          <p className="text-sm font-medium text-white">{questionText}</p>
                          <div className="space-y-2">
                            {options.map(option => {
                              const isSelected = selectedId === option.id;

                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => handleRadioChange(question.id, option.id)}
                                  className="flex w-full items-center gap-2 text-left text-sm text-white"
                                >
                                  <img
                                    src={isSelected ? radioSelected : radioUnselect}
                                    alt={isSelected ? 'selected' : 'unselected'}
                                    className="h-[20px] min-w-[20px]"
                                  />
                                  <span className={isSelected ? 'text-emerald-400' : ''}>
                                    {option.answer}
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

                  <div className="mt-7 flex justify-end gap-2">
                    <Button className="h-[41px] rounded-lg">
                      {isSubmitting ? '...' : t('Submit')}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

AddModelFeedback.propTypes = {
  title: PropTypes.string.isRequired,
  selectedInferenceModel: PropTypes.any,
};

export default AddModelFeedback;
