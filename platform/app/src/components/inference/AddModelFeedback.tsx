import React, { useCallback, useEffect, useState } from 'react';
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

interface AddModelFeedbackProps {
  title: string;
}

const diagnosisOptions = ['Monomorph', 'Regular', 'Sinusal'];

const AddModelFeedback: React.FC<AddModelFeedbackProps> = ({ title }) => {
  const { t } = useTranslation('AIModelButton');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCheckboxOptions, setSelectedCheckboxOptions] = useState<string[]>([]);
  const [selectedRadioOption, setSelectedRadioOption] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    // TODO: Wire up to feedback submission API if needed
    setIsModalOpen(false);
  }, []);

  const toggleCheckboxOption = useCallback((option: string) => {
    setSelectedCheckboxOptions(prev =>
      prev.includes(option) ? prev.filter(item => item !== option) : [...prev, option]
    );
  }, []);

  const handleRadioChange = useCallback((option: string) => {
    setSelectedRadioOption(option);
  }, []);

  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[13px] text-white">Rate this model</h1>
          <button
            type="button"
            className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-[#2C2F2C] transition-colors"
          >
            <img
              src={thumbsUp}
              alt="Thumbs up icon"
            />
          </button>
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-[#2C2F2C] transition-colors"
          >
            <img
              src={thumbsDown}
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
                  onSubmit={handleSubmit}
                  className="w-full space-y-4"
                >
                  <div>
                    <h1 className="text-[20px] font-semibold text-white">{t('Add Feedback')}</h1>
                    <p className="text-[14px] text-white/70">
                      {t('Your feedback helps us improve this model')}
                    </p>
                  </div>
                  <h3 className="text-xl font-semibold text-white">{title}</h3>

                  {/* Checkbox question */}
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-white">
                      {t('What diagnosis do you think the PACS AI has?')}
                    </p>
                    <div className="space-y-2">
                      {diagnosisOptions.map(option => {
                        const isChecked = selectedCheckboxOptions.includes(option);

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => toggleCheckboxOption(option)}
                            className="flex w-full items-center gap-2 text-left text-sm text-white"
                          >
                            <img
                              src={isChecked ? checkIcon : uncheckIcon}
                              alt={isChecked ? 'check' : 'uncheck'}
                              className="h-[18px] min-w-[18px]"
                            />
                            <span className={isChecked ? 'text-emerald-400' : ''}>{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Radio question */}
                  <div className="mt-6 space-y-2">
                    <p className="text-sm font-medium text-white">
                      {t('What diagnosis do you think the PACS AI has?')}
                    </p>
                    <div className="space-y-2">
                      {diagnosisOptions.map(option => {
                        const isSelected = selectedRadioOption === option;

                        return (
                          <button
                            key={`${option}-radio`}
                            type="button"
                            onClick={() => handleRadioChange(option)}
                            className="flex w-full items-center gap-2 text-left text-sm text-white"
                          >
                            <img
                              src={isSelected ? radioSelected : radioUnselect}
                              alt={isSelected ? 'selected' : 'unselected'}
                              className="h-[20px] min-w-[20px]"
                            />
                            <span className={isSelected ? 'text-emerald-400' : ''}>{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Free-text feedback question */}
                  <div className="mt-6 space-y-2">
                    <p className="text-sm font-medium text-white">
                      {t('Do you have any other feedback?')}
                    </p>
                    <textarea
                      value={feedbackText}
                      onChange={event => setFeedbackText(event.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-[#2A2E2A] bg-[#111311] p-2 text-sm text-white outline-none focus:border-emerald-500"
                      placeholder={t('Enter your answer here')}
                    />
                  </div>

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
};

export default AddModelFeedback;
