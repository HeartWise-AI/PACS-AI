import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ModelHistComponent from '../Histogram/Histogram';

const ResultModal = ({ isOpen, onClose, lvef, detectedVessel, age, isLoading }) => {
  const { t } = useTranslation('ResultModal');
  if (!isOpen) {
    return null;
  }

  return (
      <div className="bg-overlay !fixed !inset-0 z-50 flex items-center justify-center">
        <div
          style={{ backgroundColor: 'rgb(33, 36, 33)' }}
          className="rounded-lg p-6 text-center shadow-lg min-w-96"
        >
          <h2 className="mb-4 text-xl text-white">{ isLoading ?  t('ApplyingTitle') : t('ResultTitle')}</h2>
          {isLoading ?? (  <p className="text-md mb-4 text-white">{t('Subtext')}</p>)}
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="border-white-900 h-8 w-8 animate-spin rounded-full border-t-2 border-b-2"></div>
            </div>
          ) : (
            <div>
              <p
                style={{ textAlign: 'left' }}
                className="text-white text-lg"
              >
                {t('VesselType')}:<span className="float-right">{detectedVessel}</span>
              </p>
              <p
                style={{ textAlign: 'left' }}
                className="text-white text-lg"
              >
                {t('Results')}:<span className="float-right">{lvef}%</span>
              </p>
              <hr className="my-4 border-gray-700" />
              <h2 className="text-white mb-4 text-lg">
              {t('AgeDistributions')}
              </h2>
              <div className="flex justify-center">
                <ModelHistComponent age={age} />
              </div>
            </div>
          )}

          <button
            className="mt-4 rounded-lg bg-transparent border border-primary-light px-3 py-1 text-primary-light block ml-auto"
            onClick={onClose}
          >
            {isLoading ? t('Cancel') : t('Close')}
          </button>
        </div>
      </div>
  );
};

ResultModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  lvef: PropTypes.number,
  detectedVessel: PropTypes.string,
  age: PropTypes.number,
  isLoading: PropTypes.bool.isRequired,
};

export default ResultModal;
