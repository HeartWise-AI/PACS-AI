import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import aiModelsIcon from './../../assets/pacs/icons/ai-models-white.png';
import playerPlayIcon from './../../assets/pacs/icons/player-play-gradient.png';
import helpInactive from './../../assets/pacs/icons/help-inactive.png';
import ResultModal from '../ResultModal/ResultModal';
import predictionRepository from '../../../../app/src/api/predictionRepository';
import orthancRepository from '../../../../app/src/api/orthancRepository';
import { getEnabledElement, metaData } from '@cornerstonejs/core';
const baseClasses = 'relative overflow-hidden rounded-lg p-1 ml-2';
const backgroundClass = 'bg-gradient-to-r from-[rgba(108,105,244,1)] to-[rgba(62,241,209,1)]';
const textColor = 'text-white';

const AIModelButton = ({
  children,
  className,
  disabled,
  onClick,
  isShowBG,
  isShowText,
  positionRight,
}) => {
  const { t } = useTranslation('AIModelButton');
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lvef, setLvef] = useState(null);
  const [age, setAge] = useState(null);
  const [detectedVessel, setVessel] = useState(null);
  const ref = useRef(null);

  /**
   * Get the SOPInstanceUID of the currently displayed image
   */
  function getSOPInstanceUID() {
    let element: HTMLDivElement | null = null;

    const foundElement = document.querySelector('[data-viewport-uid]');

    if (foundElement instanceof HTMLDivElement) {
      element = foundElement;
    }
    const enabledElement = getEnabledElement(element);
    const viewport = enabledElement.viewport;
    const imageId = viewport.getCurrentImageId();

    // Use cornerstone's metaData provider to get the SOPInstanceUID
    const sopInstanceUID = metaData.get('SOPInstanceUID', imageId);
    return sopInstanceUID;
  }

  /**
   * Apply prediction
   */
  const applyPrediction = async () => {
    setIsLoading(true);
    const sopInstanceUID = getSOPInstanceUID();

    if (!sopInstanceUID) {
      console.error('Failed to get SOPInstanceUID');
      setIsLoading(false);
      return;
    }

    try {
      const findInstanceResponse = await orthancRepository.GetLocalSOPInstance({
        sopInstanceUID,
      });
      const predictionResultResponse = await predictionRepository.ApplyPrediction({
        queryId: findInstanceResponse.data.queryIds[0],
      });

      const { vessel, LVEF, age } = predictionResultResponse.data;

      setAge(age ? parseInt(age.toString(), 10) : null);
      setVessel(vessel || null);
      setLvef(LVEF != null ? Number(LVEF) : null);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching prediction data:', error);
      setIsLoading(false);
    }
  };

  const handleOnClick = e => {
    if (!disabled) {
      setIsModalOpen(true);
      applyPrediction();
      onClick(e);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setLvef(null);
    setAge(null);
    setVessel(null);
  };

  return (
    <div className="relative flex w-full">
      <button
        className={`flex items-center gap-1 ${baseClasses} ${className} ${textColor} ${
          isShowBG ? backgroundClass : 'bg-transparent'
        }`}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <img
          src={aiModelsIcon}
          className="h-6 w-6"
          alt="AI Models icon"
        />
        {isShowText && (
          <span className="text-sm !text-white text-transparent">{t('AI Models')}</span>
        )}
      </button>
      {isOpen && (
        <div
          className="absolute z-10 min-w-[210px] divide-y divide-gray-100 rounded-lg bg-[#4C504B] px-2 shadow"
          style={{ top: ref.current ? ref.current.offsetHeight : 40, right: positionRight }}
        >
          <ul className="flex flex-col gap-1 py-2 text-sm text-white">
            <li
              className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black"
              onClick={handleOnClick}
            >
              <img
                src={playerPlayIcon}
                alt="Player play icon"
                className="w-5"
              />
              <h1 className="text-sm">{t('DetectButton')}</h1>
              <img
                src={helpInactive}
                alt="Player play icon"
                className="w-5"
              />
            </li>
          </ul>
        </div>
      )}
      <ResultModal
        isOpen={isModalOpen}
        onClose={closeModal}
        lvef={lvef}
        age={age}
        detectedVessel={detectedVessel}
        isLoading={isLoading}
      />
    </div>
  );
};

AIModelButton.defaultProps = {
  className: '',
  children: '',
  disabled: false,
  isShowBG: false,
  isShowText: false,
  positionRight: 0,
  onClick: () => {},
};

AIModelButton.propTypes = {
  /** Additional TailwindCSS classnames */
  className: PropTypes.string,
  /** What is inside the button, can be text or react component */
  children: PropTypes.node,

  /** Whether the button should be disabled  */
  disabled: PropTypes.bool,
  /** Whether to show the gradient background  */
  isShowBG: PropTypes.bool,
  /** Whether to show the text  */
  isShowText: PropTypes.bool,
  /** Set position right size  */
  positionRight: PropTypes.number,
  /** Callback to be called when the button is clicked  */
  onClick: PropTypes.func.isRequired,
};

export default AIModelButton;
