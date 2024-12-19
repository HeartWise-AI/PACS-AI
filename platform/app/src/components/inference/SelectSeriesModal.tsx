import React, { useCallback, useContext, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import closeIcon from './../../assets/pacs/icons/close-inactive.png';
import uncheckIcon from './../../assets/pacs/icons/check-inactive.png';
import checkIcon from './../../assets/pacs/icons/check-active.png';
import informationIcon from './../../assets/pacs/icons/information-circle.png';
import copyWhiteIcon from './../../assets/pacs/icons/copy-white.png';
import { Input } from '@ohif/ui';
import { useGlobalStateData } from '../../GlobalStateProvider';
import { GetInferenceAvailableModelsResponse } from '../../api/inferenceDTO';
import { AlertContext } from '../../AlertProvider';

interface SelectSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  title: string;
  selectedInferenceModel: GetInferenceAvailableModelsResponse;
}

const SelectSeriesModal: React.FC<SelectSeriesModalProps> = ({
  isOpen,
  onClose,
  loading,
  title,
  selectedInferenceModel,
}) => {
  const [mounted, setMounted] = useState(false);
  const [stepper, setStepper] = useState(1);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [applyToStudy, setApplyToStudy] = useState(false);
  const { displaySets } = useGlobalStateData();
  const showAlert = useContext(AlertContext);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const toggleSeriesSelection = (displaySetInstanceUID: string) => {
    setSelectedSeries(prev => {
      if (prev.includes(displaySetInstanceUID)) {
        return prev.filter(id => id !== displaySetInstanceUID);
      } else {
        return [...prev, displaySetInstanceUID];
      }
    });
  };

  if (!isOpen || !mounted) return null;

  // step 1 handler
  function stepOneHandler() {
    if (selectedSeries.length >= selectedInferenceModel?.dicomUploadMin) {
      setStepper(2);
      return
    }

    showAlert('Please select at least ' + selectedInferenceModel?.dicomUploadMin + ' series to continue', 'error');
  }


  const modalContent = (
    <div
      id="modal"
      className="fixed inset-0 z-[99999] overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-auto items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
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

        <div
          className={`relative inline-block w-[480px] max-w-[480px] transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle`}
        >
          {/* content */}
          <div className="h-auto w-full">
            {/* title */}
            <h1 className="mb-4 text-[18px] font-bold text-white">{title}</h1>
            {/* stepper */}
            <div className="flex items-center gap-2">
              <div
                className={`h-[5px] w-full rounded-full ${
                  stepper >= 1 ? 'bg-[#C8F469]' : 'bg-[#1F221F]'
                }`}
              ></div>
              <div
                className={`h-[5px] w-full rounded-full ${
                  stepper >= 2 ? 'bg-[#C8F469]' : 'bg-[#1F221F]'
                }`}
              ></div>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="flex h-[calc(100vh-200px)] items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
                </div>
              ) : (
                <div>
                  {stepper === 1 && (
                    <div>
                      {/* header */}
                      <div className="align-center mt-4 flex flex-row justify-between text-[14px]">
                        <h1 className="text-white">Select Series</h1>
                        <div
                          className="flex cursor-pointer items-center gap-2"
                          onClick={() => {
                            setApplyToStudy(!applyToStudy);
                            if (!applyToStudy) {
                              // select all series
                              setSelectedSeries(displaySets.map(series => series.displaySetInstanceUID));
                            } else {
                              // deselect all series
                              setSelectedSeries([]);
                            }
                          }}
                        >
                          <h2 className="text-[14px] text-white">Apply to Study</h2>
                          <img
                            src={applyToStudy ? checkIcon : uncheckIcon}
                            alt={applyToStudy ? 'check' : 'uncheck'}
                            className="h-[18px] w-[18px]"
                          />
                        </div>
                      </div>

                      {/* list of series */}
                      <div className="ml-0 mt-4 max-h-[450px] space-y-3 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#ffffff] [&::-webkit-scrollbar-thumb]:bg-opacity-30 [&::-webkit-scrollbar-track]:bg-transparent">
                        {displaySets.map(series => (
                          <div
                            key={series.displaySetInstanceUID}
                            className="flex cursor-pointer items-center justify-between rounded-xl bg-[#7A7A7A] bg-opacity-10 p-3"
                            onClick={() => toggleSeriesSelection(series.displaySetInstanceUID)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-[58px] w-[73px] rounded-lg border border-[#C8F469] bg-white bg-opacity-20">
                                <img
                                  src={series.imageSrc}
                                  alt="series"
                                  className="h-full w-full rounded-lg object-cover"
                                />
                              </div>
                              <div className="text-[14px]">
                                <h1 className="inline text-[#C8F469]">Series: </h1>
                                <h2 className="mr-2 inline text-white">{series.seriesNumber}</h2>
                                <img src={copyWhiteIcon} alt="copy" className="h-[16px] w-[16px] ml-1 inline" />
                                <h3 className="inline text-white">  {series.numInstances}</h3>
                                <h4 className="block text-white opacity-70">
                                  {series.description}
                                </h4>
                              </div>
                            </div>
                            <div>
                              <img
                                src={
                                  selectedSeries.includes(series.displaySetInstanceUID)
                                    ? checkIcon
                                    : uncheckIcon
                                }
                                alt={
                                  selectedSeries.includes(series.displaySetInstanceUID)
                                    ? 'check'
                                    : 'uncheck'
                                }
                                className="h-[18px] w-[18px]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* actions */}
                      <div className="mt-4 flex flex-row justify-end gap-3">
                        <button
                          className="rounded-lg bg-[#ffffff] bg-opacity-10 px-4 py-2 text-white"
                          onClick={handleClose}
                        >
                          Cancel
                        </button>
                        <button
                          className={`rounded-lg px-4 py-2 ${
                            selectedSeries.length > 0
                              ? 'bg-[#C8F469] text-black'
                              : 'cursor-not-allowed bg-[#C8F469] bg-opacity-50 text-black'
                          }`}
                          onClick={() => {
                            if (selectedSeries.length > 0) {
                              stepOneHandler();
                            }
                          }}
                          disabled={selectedSeries.length === 0}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}
                  {stepper === 2 && (
                    <div>
                      <h1 className="mt-4 block text-white">Additional Details (optional)</h1>
                      <div className="mt-4 flex gap-2">
                        <div className="flex h-[43px] w-[50%] items-center rounded-lg bg-[#323631] bg-opacity-10 px-4 text-[14px] text-white">
                          Siblings
                        </div>
                        <Input
                          className="h-[43px] w-full"
                          type="text"
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <div className="flex h-[43px] w-[50%] items-center rounded-lg bg-[#323631] bg-opacity-10 px-4 text-[14px] text-white">
                          Siblings
                        </div>
                        <Input
                          className="h-[43px] w-full"
                          type="text"
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <img
                          src={informationIcon}
                          alt="information"
                          className="h-[15px] w-[15px]"
                        />
                        <h1 className="text-[12px] text-white opacity-50">
                          Additional details required fields should be answered.
                        </h1>
                      </div>
                      {/* actions */}
                      <div className="mt-5 flex flex-row justify-end gap-3">
                        <button
                          className="rounded-lg bg-[#ffffff] bg-opacity-10 px-4 py-2 text-white"
                          onClick={() => {
                            setStepper(1);
                          }}
                        >
                          Back
                        </button>
                        <button
                          className="rounded-lg bg-[#C8F469] px-4 py-2 text-black"
                          onClick={() => {}}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return mounted ? ReactDOM.createPortal(modalContent, document.body) : null;
};

SelectSeriesModal.defaultProps = {
  onClose: () => {},
  isOpen: false,
  loading: false,
  title: '',
};

SelectSeriesModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  loading: PropTypes.bool,
  title: PropTypes.string,
  selectedInferenceModel: PropTypes.object as PropTypes.Validator<GetInferenceAvailableModelsResponse>,
};

export default SelectSeriesModal;
