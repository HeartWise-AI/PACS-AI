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
import { InferenceAvailableAdditionalMetadata } from '../../api/inferenceDTO';

interface SelectSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  applyPredictInferenceModel: (
    containerId: string,
    seriesInstanceUIDs: string[],
    studyInstanceUID: string,
    additionalMetadata: { [key: string]: string | null },
    outputMode: string
  ) => void;
  loading: boolean;
  title: string;
  selectedInferenceModel: GetInferenceAvailableModelsResponse;
}

const SelectSeriesModal: React.FC<SelectSeriesModalProps> = ({
  isOpen = false,
  onClose = () => {},
  applyPredictInferenceModel,
  loading = false,
  title = '',
  selectedInferenceModel,
}) => {
  const [mounted, setMounted] = useState(false);
  const [stepper, setStepper] = useState(1);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [studyInstanceUID, setStudyInstanceUID] = useState<string>('');
  const [applyToStudy, setApplyToStudy] = useState(false);
  const { selectedModalities } = useGlobalStateData();
  const showAlert = useContext(AlertContext);
  const [additionalDetails, setAdditionalDetails] = useState<{ [key: string]: string | null }>({});

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    // set default values when component mounts
    if (selectedInferenceModel?.supportedAdditionalMetadata) {
      const defaultValues = selectedInferenceModel.supportedAdditionalMetadata.reduce(
        (acc, metadata) => {
          // set default values for boolean fields
          if (metadata.type === 'boolean') {
            acc[metadata.id] = 'true';
          } else if (metadata.type === 'string' || metadata.type === 'number') {
            // set default values for string and number fields
            acc[metadata.id] = null;
          }
          return acc;
        },
        {} as { [key: string]: string | null }
      );

      setAdditionalDetails(prev => ({
        ...prev,
        ...defaultValues,
      }));
    }
  }, [selectedInferenceModel?.supportedAdditionalMetadata]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // toggle series selection
  const toggleSeriesSelection = (SeriesInstanceUID: string) => {
    setSelectedSeries(prev => {
      if (prev.includes(SeriesInstanceUID)) {
        return prev.filter(id => id !== SeriesInstanceUID);
      } else {
        return [...prev, SeriesInstanceUID];
      }
    });
  };

  // handle additional details change
  const handleAdditionalDetailsChange = (
    metadata: InferenceAvailableAdditionalMetadata,
    value: string
  ) => {
    setAdditionalDetails(prev => {
      const newDetails = { ...prev };

      if (value.trim() === '' && !metadata.required) {
        // set to null if value is empty and field is not required
        newDetails[metadata.id] = null;
      } else {
        // add/update the value if it's either required or non-empty
        newDetails[metadata.id] = value;
      }

      return newDetails;
    });
  };

  if (!isOpen || !mounted) {
    return null;
  }

  // step 1 handler
  function stepOneHandler() {
    if (selectedSeries.length < selectedInferenceModel?.dicomUploadMin) {
      showAlert(
        'Please select at least ' + selectedInferenceModel?.dicomUploadMin + ' series to continue',
        'error'
      );
      return;
    }

    if (selectedSeries.length > selectedInferenceModel?.dicomUploadMax) {
      showAlert(
        'Please select no more than ' +
          selectedInferenceModel?.dicomUploadMax +
          ' series to continue',
        'error'
      );
      return;
    }

    if (!selectedInferenceModel?.supportedAdditionalMetadata?.length) {
      applyPredictInferenceModel(
        selectedInferenceModel.containerId,
        selectedSeries,
        studyInstanceUID,
        additionalDetails,
        selectedInferenceModel.outputMode
      );
      return;
    }

    setStepper(2);
  }

  // validate required fields
  const validateRequiredFields = () => {
    const missingRequired = selectedInferenceModel?.supportedAdditionalMetadata
      ?.filter(metadata => metadata.required)
      .filter(
        metadata =>
          !additionalDetails[metadata.id] ||
          additionalDetails[metadata.id] === null ||
          additionalDetails[metadata.id].trim() === ''
      );

    if (missingRequired && missingRequired.length > 0) {
      const missingFields = missingRequired.map(field => field.id).join(', ');
      showAlert(`Please fill in required fields: ${missingFields}`, 'error');
      return false;
    }
    return true;
  };

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
          className={`relative inline-block w-[640px] max-w-[640px] transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle`}
        >
          {/* content */}
          <div className="h-auto w-full">
            {/* title */}
            <h1 className="mb-4 text-[18px] font-bold text-white">{title}</h1>
            {/* stepper */}
            {!loading && selectedInferenceModel?.supportedAdditionalMetadata?.length > 0 && (
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
            )}
            {loading ? (
              <div className="flex h-[270px] items-center justify-center">
                <div>
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
                  <h1 className="max-w-[270px] text-center text-[14px] text-white">
                    Applying inference and generating results...
                  </h1>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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
                              setSelectedSeries(
                                Object.entries(selectedModalities)
                                  .filter(([_, value]) =>
                                    selectedInferenceModel.supportedDicomModalities?.includes(
                                      value.modality
                                    )
                                  )
                                  .flatMap(([_, value]) =>
                                    value.displaySets.map(
                                      displaySet => displaySet.SeriesInstanceUID
                                    )
                                  )
                              );
                              setStudyInstanceUID(
                                Object.entries(selectedModalities)
                                  .filter(([_, value]) =>
                                    selectedInferenceModel.supportedDicomModalities?.includes(
                                      value.modality
                                    )
                                  )
                                  .flatMap(([_, value]) =>
                                    value.displaySets.map(displaySet => displaySet.StudyInstanceUID)
                                  )[0] || ''
                              );
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
                        {Object.entries(selectedModalities)
                          .filter(([_, value]) => {
                            const modality = value.modality;
                            return selectedInferenceModel.supportedDicomModalities?.some(
                              supportedModality =>
                                modality.includes(supportedModality) ||
                                supportedModality.includes(modality)
                            );
                          })
                          .every(
                            ([_, value]) => !value.displaySets || value.displaySets.length === 0
                          ) ? (
                          <div className="flex h-[200px] items-center justify-center">
                            <p className="text-white opacity-70">No data found</p>
                          </div>
                        ) : (
                          <>
                            {Object.entries(selectedModalities)
                              .filter(([_, value]) => {
                                const modality = value.modality;
                                return selectedInferenceModel.supportedDicomModalities?.some(
                                  supportedModality =>
                                    modality.includes(supportedModality) ||
                                    supportedModality.includes(modality)
                                );
                              })
                              .flatMap(([_, value]) =>
                                value.displaySets
                                  .filter(displaySet =>
                                    selectedInferenceModel.supportedDicomModalities?.some(
                                      supportedModality =>
                                        displaySet.modality &&
                                        (displaySet.modality.includes(supportedModality) ||
                                          supportedModality.includes(displaySet.modality))
                                    )
                                  )
                                  .map((displaySet, index) => (
                                    <div
                                      key={index + '-' + displaySet.SeriesInstanceUID}
                                      className="flex cursor-pointer items-center justify-between rounded-xl bg-[#7A7A7A] bg-opacity-10 p-3"
                                      onClick={() => {
                                        toggleSeriesSelection(displaySet.SeriesInstanceUID);
                                        setStudyInstanceUID(displaySet.StudyInstanceUID);
                                      }}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className="h-[58px] w-[73px] rounded-lg border border-[#C8F469] bg-[#151815] bg-opacity-20">
                                          {displaySet.imageSrc ? (
                                            <img
                                              src={displaySet.imageSrc}
                                              alt="series"
                                              className="h-full w-full rounded-lg object-cover"
                                            />
                                          ) : (
                                            <p className="mt-3 text-center text-xs text-white opacity-70">
                                              No image available
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-[14px]">
                                          <h1 className="inline text-[#C8F469]">Series: </h1>
                                          <h2 className="mr-2 inline text-white">
                                            {displaySet.seriesNumber}
                                          </h2>
                                          <img
                                            src={copyWhiteIcon}
                                            alt="copy"
                                            className="ml-1 inline h-[16px] w-[16px]"
                                          />
                                          <h3 className="inline text-white">
                                            {' '}
                                            {displaySet.numInstances}
                                          </h3>
                                          <h4 className="block text-white opacity-70">
                                            {displaySet.description}
                                          </h4>
                                          <h4 className="mt-1 block text-[12px] text-white opacity-70">
                                            {displaySet.SeriesInstanceUID}
                                          </h4>
                                        </div>
                                      </div>
                                      <div>
                                        <img
                                          src={
                                            selectedSeries.includes(displaySet.SeriesInstanceUID)
                                              ? checkIcon
                                              : uncheckIcon
                                          }
                                          alt={
                                            selectedSeries.includes(displaySet.SeriesInstanceUID)
                                              ? 'check'
                                              : 'uncheck'
                                          }
                                          className="h-[18px] min-w-[18px]"
                                        />
                                      </div>
                                    </div>
                                  ))
                              )}
                          </>
                        )}
                      </div>
                      {/* actions */}
                      <div className="mt-4 flex flex-row justify-end gap-3">
                        <button
                          disabled={loading}
                          className="rounded-lg bg-[#ffffff] bg-opacity-10 px-4 py-2 text-white"
                          onClick={handleClose}
                        >
                          Cancel
                        </button>
                        <button
                          className={`min-w-[100px] rounded-lg px-4 py-2 ${
                            selectedSeries.length > 0
                              ? 'bg-[#C8F469] text-black'
                              : 'cursor-not-allowed bg-[#C8F469] bg-opacity-50 text-black'
                          }`}
                          onClick={() => {
                            if (selectedSeries.length > 0) {
                              stepOneHandler();
                            }
                          }}
                          disabled={selectedSeries.length === 0 || loading}
                        >
                          {loading && !selectedInferenceModel?.supportedAdditionalMetadata?.length
                            ? '...'
                            : selectedInferenceModel?.supportedAdditionalMetadata?.length
                              ? 'Continue'
                              : 'Apply'}
                        </button>
                      </div>
                    </div>
                  )}
                  {stepper === 2 && (
                    <div>
                      <h1 className="mt-4 block text-white">Additional Details (optional)</h1>
                      {selectedInferenceModel?.supportedAdditionalMetadata?.length > 0 ? (
                        <>
                          {selectedInferenceModel.supportedAdditionalMetadata.map(metadata => (
                            <div
                              key={metadata.id}
                              className="mt-4 flex gap-2"
                            >
                              <div className="flex h-[43px] w-[50%] items-center rounded-lg bg-[#323631] bg-opacity-10 px-4 text-[14px] text-white">
                                {metadata.name}{' '}
                                {metadata.required && <span className="ml-1 text-red-500">*</span>}
                              </div>
                              {metadata.type === 'boolean' ? (
                                <select
                                  className="h-[43px] w-[48%] rounded-lg bg-[#323631] px-4 text-white"
                                  required={metadata.required}
                                  id={metadata.id}
                                  value={additionalDetails[metadata.id] || 'true'}
                                  onChange={e =>
                                    handleAdditionalDetailsChange(metadata, e.target.value)
                                  }
                                >
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              ) : (
                                <Input
                                  className="h-[43px] w-full"
                                  type={metadata.type}
                                  required={metadata.required}
                                  id={metadata.id}
                                  value={additionalDetails[metadata.id] || ''}
                                  onChange={e =>
                                    handleAdditionalDetailsChange(metadata, e.target.value)
                                  }
                                  label=""
                                  onFocus={() => {}}
                                  autoFocus={false}
                                  onKeyPress={() => {}}
                                  disabled={false}
                                />
                              )}
                            </div>
                          ))}
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
                        </>
                      ) : (
                        <div className="my-7 text-center text-white opacity-50">
                          No additional details found
                        </div>
                      )}
                      {/* actions */}
                      <div className="mt-5 flex flex-row justify-end gap-3">
                        <button
                          disabled={loading}
                          className="rounded-lg bg-[#ffffff] bg-opacity-10 px-4 py-2 text-white"
                          onClick={() => {
                            setStepper(1);
                          }}
                        >
                          Back
                        </button>
                        <button
                          disabled={loading}
                          className="min-w-[100px] rounded-lg bg-[#C8F469] px-4 py-2 text-black disabled:opacity-50"
                          onClick={() => {
                            if (validateRequiredFields()) {
                              applyPredictInferenceModel(
                                selectedInferenceModel.containerId,
                                selectedSeries,
                                studyInstanceUID,
                                additionalDetails,
                                selectedInferenceModel.outputMode
                              );
                            }
                          }}
                        >
                          {loading ? '...' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return mounted ? ReactDOM.createPortal(modalContent, document.body) : null;
};

SelectSeriesModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  applyPredictInferenceModel: PropTypes.func,
  loading: PropTypes.bool,
  title: PropTypes.string,
  selectedInferenceModel:
    PropTypes.object as PropTypes.Validator<GetInferenceAvailableModelsResponse>,
};

export default SelectSeriesModal;
