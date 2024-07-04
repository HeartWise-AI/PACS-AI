import React from 'react';
import PropTypes from 'prop-types';
import ModelHistComponent from '../Histogram/Histogram';

const ResultModal = ({ isOpen, onClose, result, detectedVessel, age, isLoading }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div>
      <div className="bg-overlay fixed inset-0 z-50 flex items-center justify-center">
        <div
          style={{ backgroundColor: 'rgb(33, 36, 33)' }}
          className="rounded-lg p-6 text-center shadow-lg"
        >
          <h2 className="text-primary-light mb-4 text-xl font-bold">
            Résultats de la détection de la FEVG
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="border-white-900 h-8 w-8 animate-spin rounded-full border-t-2 border-b-2"></div>
            </div>
          ) : (
            <div>
              <p
                style={{ textAlign: 'left' }}
                className="text-primary-light text-lg"
              >
                Type de vaisseau:<span className="float-right">{detectedVessel}</span>
              </p>
              <p
                style={{ textAlign: 'left' }}
                className="text-primary-light text-lg"
              >
                Résultats:<span className="float-right">{result}%</span>
              </p>
              <hr className="my-4 border-gray-700" />
              <h2 className="text-primary-light mb-4 text-xl font-bold">
                Distribution de l&apos;âge dans l&apos;étude
              </h2>
              <div className="flex justify-center">
                <ModelHistComponent age={age} />
              </div>
            </div>
          )}
          <button
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

ResultModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  result: PropTypes.number,
  detectedVessel: PropTypes.string,
  age: PropTypes.number,
  isLoading: PropTypes.bool.isRequired,
};

export default ResultModal;
