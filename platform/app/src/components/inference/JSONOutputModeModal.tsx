import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import closeIcon from './../../assets/pacs/icons/close-inactive.png';
import { PredictInferenceModelJSONResponse } from '../../api/inferenceDTO';
import ReactSpeedometer from 'react-d3-speedometer';

interface JSONOutputModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PredictInferenceModelJSONResponse;
  loading: boolean;
  title: string;
}

const InferenceDetails = {
  normal: {
    label: 'Normal',
    color: 'success',
  },
  limit: {
    label: 'Limit',
    color: 'yellow',
  },
  pathological: {
    label: 'Pathological',
    color: 'error',
  },
};

const JSONOutputModeModal: React.FC<JSONOutputModeModalProps> = ({
  isOpen,
  onClose,
  data,
  loading,
  title,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const getInferenceDiagnosisColor = (diagnosis: string) => {
    const diagnosisDetails = InferenceDetails[diagnosis.toLowerCase()];
    if (!diagnosisDetails) return 'text-[#6ED47C] bg-[#6ED47C]'; // default color

    switch (diagnosisDetails.color) {
      case 'success':
        return 'text-[#6ED47C] bg-[#6ED47C]';
      case 'yellow':
        return 'text-yellow-400 bg-yellow-400';
      case 'error':
        return 'text-red-500 bg-red-500';
      default:
        return 'text-[#6ED47C] bg-[#6ED47C]'; // fallback color
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
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

        <div
          className={`relative inline-block w-[800px] max-w-[800px] transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle`}
        >
          {/* close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-[999999999]"
          >
            <img
              src={closeIcon}
              alt="Close icon"
            />
          </button>
          {/* content */}
          <div className="h-full w-full">
            <div className="mb-4 flex items-center gap-2">
              <h1 className="text-[18px] font-bold text-white">{title}</h1>
              {data?.diagnosis && (
                <div
                  className={`${getInferenceDiagnosisColor(
                    data.diagnosis
                  )} rounded-full bg-opacity-10 px-3 py-1 text-base`}
                >
                  {InferenceDetails[data.diagnosis.toLowerCase()].label}
                </div>
              )}
            </div>
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
              </div>
            ) : (
              <div className="space-y-4 text-white">
                <div>
                  <h2 className="text-[16px] font-semibold">Recommendation</h2>
                  <p className="text-[14px] text-white text-opacity-50">
                    {data.modelRecommendations.en}
                  </p>
                </div>

                <div>
                  {Object.entries(data.predictions).map(
                    ([key, prediction]) =>
                      prediction.presentable && (
                        <div
                          key={key}
                          className="mb-5"
                        >
                          <h3 className="mb-1 text-lg font-medium">{key}</h3>
                          <div className="flex flex-col gap-2 text-white">
                            <p className="flex justify-between rounded-md bg-white bg-opacity-[5%] px-3 py-2">
                              <span className="opacity-50">Result</span>
                              <span className="text-[14px]">{prediction.displayResult}</span>
                            </p>
                            <p className="flex justify-between rounded-md bg-transparent px-3 py-2">
                              <span className="opacity-50">Probability</span>
                              <span className="text-[14px]">
                                {prediction.probability}%
                              </span>
                            </p>
                            <p className="flex items-center justify-between rounded-md bg-white bg-opacity-[5%] px-3 py-2">
                              <span className="opacity-50">Confidence</span>
                              <div className="relative flex items-center gap-2 rounded-full bg-white bg-opacity-10 px-3 py-1">
                                <span className="mr-9 text-[14px] capitalize">
                                  {prediction.confidence}
                                </span>
                                <div className="absolute right-[-8px] top-[-12px]">
                                  <ReactSpeedometer
                                    width={70}
                                    height={40}
                                    ringWidth={5}
                                    needleHeightRatio={0.4}
                                    maxValue={100}
                                    customSegmentStops={[0, 25, 75, 100]}
                                    value={prediction.probability}
                                    segmentColors={['#6ad72d', '#FFD700', '#F64343']}
                                    currentValueText=""
                                    customSegmentLabels={[{}, {}, {}]}
                                    needleTransitionDuration={3333}
                                    needleColor={'#2A7DED'}
                                  />
                                </div>
                              </div>
                            </p>
                          </div>
                        </div>
                      )
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

JSONOutputModeModal.defaultProps = {
  onClose: () => {},
  isOpen: false,
  data: {
    diagnosis: '',
    predictions: {} as {
      [key: string]: {
        probability: number;
        confidence: string;
        presentable: boolean;
        displayResult: string;
      };
    },
    modelRecommendations: {
      en: '',
      fr: '',
      presentable: false,
    },
  },
  loading: false,
  title: '',
};

JSONOutputModeModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  data: PropTypes.object as PropTypes.Validator<PredictInferenceModelJSONResponse>,
  loading: PropTypes.bool,
  title: PropTypes.string,
};

export default JSONOutputModeModal;
