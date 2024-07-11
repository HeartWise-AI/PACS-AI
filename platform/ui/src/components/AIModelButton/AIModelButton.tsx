import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes, { func } from 'prop-types';
import aiModelsIcon from './../../assets/pacs/icons/ai-models-white.png';
import playerPlayIcon from './../../assets/pacs/icons/player-play-gradient.png';
import helpInactive from './../../assets/pacs/icons/help-inactive.png';
import ResultModal from '../ResultModal/ResultModal';
import predictionRepository from '/home/corelab/Downloads/Adam/PACS-AI/platform/app/src/api/predictionRepository';
import { set } from '@kitware/vtk.js/macros';

const baseClasses = 'relative overflow-hidden rounded-lg p-1 ml-2';
const baseFontTextClasses = 'relative z-10 text-lg font-bold';
const backgroundClass = 'bg-gradient-to-r from-[rgba(108,105,244,1)] to-[rgba(62,241,209,1)]';
const textColor = 'text-white';

const AIModelButton = ({ children, className, disabled, onClick, isShowBG }) => {
  const buttonElement = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [age, setAge] = useState(null);
  const [detectedVessel, setVessel] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    getPredictionData();
  }, [predictionRepository]);

  /**
   * Get prediction  data
   */
  const getPredictionData = async () => {
    try {
      const response = await predictionRepository.GetPredictionResult();

      setAge(response.data.age);
      setVessel(response.data.detectedVessel);
      setResult(response.data.prediction);
    } catch (error) {
      console.error(error);
    }
  };

  const handleOnClick = e => {
    if (!disabled) {
      setIsModalOpen(true);
      setIsLoading(true);
      setTimeout(() => {
        setResult(47); // This should be replaced with the actual result
        setAge(80); // This should be replaced with the actual result
        setVessel('Coronaire Gauche'); // This should be replaced with the actual result
        // setResult(result);
        // setAge(age);
        // setVessel(detectedVessel);
        setIsLoading(false);
      }, 3000);
      onClick(e);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setResult(null);
    setAge(null);
    setVessel(null);
  };

  return (
    <div className="flex w-full">
      <button
        className={`${baseClasses} ${className} ${textColor} ${
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
      </button>
      {isOpen && (
        <div
          className="absolute z-10 w-[225px] divide-y divide-gray-100 rounded-lg bg-[#4C504B] shadow "
          style={{ top: ref.current ? ref.current.offsetHeight : 40 }}
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
              <h1 className="text-sm">Détection de la FEVG</h1>
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
        result={result}
        age={age}
        detectedVessel={detectedVessel}
        isLoading={isLoading}
      />
    </div>
  );
};

AIModelButton.defaultProps = {
  children: '',
  className: '',
  disabled: false,
  isShowBG: false,
  onClick: () => {},
};

AIModelButton.propTypes = {
  /** What is inside the button, can be text or react component */
  children: PropTypes.node,
  /** Callback to be called when the button is clicked  */
  onClick: PropTypes.func.isRequired,
  /** Whether the button should be disabled  */
  disabled: PropTypes.bool,
  /** Whether to show the gradient background  */
  isShowBG: PropTypes.bool,
  /** Additional TailwindCSS classnames */
  className: PropTypes.string,
};

export default AIModelButton;
