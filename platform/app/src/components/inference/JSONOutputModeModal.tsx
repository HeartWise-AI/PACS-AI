import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import closeIcon from './../../assets/pacs/icons/close-inactive.png';
import { PredictInferenceModelJSONResponse } from '../../api/inferenceDTO';

interface JSONOutputModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PredictInferenceModelJSONResponse;
  loading: boolean;
  title: string;
}

const JSONOutputModeModal: React.FC<JSONOutputModeModalProps> = ({ isOpen, onClose, data, loading, title }) => {
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <React.Fragment>
      {isOpen && (
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
              className={`relative max-w-[800px] w-[800px] inline-block transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle`}
            >
              {/* close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-[999999999]"
              >
                <img src={closeIcon} alt="Close icon" />
              </button>
              {/* content */}
              <div className="w-full h-full">
                <h1 className="text-white text-xl font-bold mb-4">{title}</h1>
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                  </div>
                ) : (
                  <div className="text-white space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Diagnosis</h2>
                      <p className="text-gray-300">{data.diagnosis}</p>
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold mb-2">Predictions</h2>
                      {Object.entries(data.predictions).map(([key, prediction]) => (
                        <div key={key} className="ml-4 mb-3">
                          <h3 className="text-lg font-medium">{key}</h3>
                          <div className="ml-4 text-gray-300">
                            <p>Probability: {prediction.probability.toFixed(2)}%</p>
                            <p>Confidence: {prediction.confidence}</p>
                            <p>Display Result: {prediction.displayResult}</p>
                            <p>Presentable: {prediction.presentable ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold mb-2">Model Recommendations</h2>
                      <div className="ml-4 text-gray-300">
                        <p>{data.modelRecommendations.en}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
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
      }
    },
    modelRecommendations: {
      en: '',
      fr: '',
      presentable: false
    }
  },
  loading: false,
  title: ''
};

JSONOutputModeModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  data: PropTypes.object as PropTypes.Validator<PredictInferenceModelJSONResponse>,
  loading: PropTypes.bool,
  title: PropTypes.string
};

export default JSONOutputModeModal;
