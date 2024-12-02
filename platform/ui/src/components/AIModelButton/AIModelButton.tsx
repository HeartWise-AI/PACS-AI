import React, { useState, useRef, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { getEnabledElement, metaData } from '@cornerstonejs/core';
import aiModelsIcon from './../../assets/pacs/icons/ai-models-white.png';
import playerPlayIcon from './../../assets/pacs/icons/player-play-gradient.png';
import helpInactive from './../../assets/pacs/icons/help-inactive.png';
import ResultModal from '../ResultModal/ResultModal';
import predictionRepository from '../../../../app/src/api/predictionRepository';
import orthancRepository from '../../../../app/src/api/orthancRepository';
import inferenceRepository from '../../../../app/src/api/inferenceRepository';
import {
  GetInferenceAvailableModelsResponse,
  PredictInferenceModelHTMLResponse,
  PredictInferenceModelJSONResponse,
  PredictInferenceModelPDFResponse,
  PredictInferenceModelWebappResponse,
} from '../../../../app/src/api/inferenceDTO';
import JSONOutputModeModal from '../../../../app/src/components/inference/JSONOutputModeModal';
import WebappOutputModeModal from '../../../../app/src/components/inference/WebappOutputModeModal';
import HTMLOutputModeModal from '../../../../app/src/components/inference/HTMLOutputModeModal';
import PDFOutputModeModal from '../../../../app/src/components/inference/PDFOutputModeModal';
import { AlertContext } from '../../../../app/src/AlertProvider';

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
  inferenceAvailableModels,
  modalities,
}) => {
  const { t } = useTranslation('AIModelButton');
  const showAlert = useContext(AlertContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openJSONOutputModeModal, setOpenJSONOutputModeModal] = useState(false);
  const [openWebappOutputModeModal, setOpenWebappOutputModeModal] = useState(false);
  const [openHTMLOutputModeModal, setOpenHTMLOutputModeModal] = useState(false);
  const [openPDFOutputModeModal, setOpenPDFOutputModeModal] = useState(false);
  const [outputModeTitle, setOutputModeTitle] = useState('');
  const [outputModeData, setOutputModeData] = useState<unknown>(null);
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

  // TODO: to be depricated
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

  const applyPredictInferenceModel = async (containerID: string, outputMode: string) => {
    setIsLoading(true);
    const sopInstanceUID = getSOPInstanceUID();

    if (!sopInstanceUID) {
      console.error('Failed to get SOPInstanceUID');
      setIsLoading(false);
      return;
    }

    try {
      switch (outputMode) {
        case 'JSON':
          setOpenJSONOutputModeModal(true);
          break;
        case 'WEB_APP':
          setOpenWebappOutputModeModal(true);
          break;
        case 'HTML':
          setOpenHTMLOutputModeModal(true);
          break;
        case 'PDF':
          setOpenPDFOutputModeModal(true);
          break;
        default:
          break;
      }

      const findInstanceResponse = await orthancRepository.GetLocalSOPInstance({
        sopInstanceUID,
      });

      const predictionResultResponse = await inferenceRepository.PredictInferenceModel({
        containerID,
        queryIDs: [findInstanceResponse.data.queryIds[0]],
        outputMode,
      });

      setOutputModeData(predictionResultResponse.data);
      setIsLoading(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Error fetching prediction data:', error);
      showAlert(error.message, 'error');
      setOpenJSONOutputModeModal(false);
      setOpenWebappOutputModeModal(false);
      setOpenHTMLOutputModeModal(false);
      setOpenPDFOutputModeModal(false);
      setIsLoading(false);
    }
  };
  return (
    <div className="relative flex w-full">
      <button
        className={`flex items-center gap-1 ${baseClasses} ${className} ${textColor} ${
          isShowBG ? backgroundClass : 'bg-transparent'
        } ${!inferenceAvailableModels?.length ? 'opacity-50' : ''}`}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!inferenceAvailableModels?.length}
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
          className="absolute z-10 inline-block divide-y divide-gray-100 rounded-lg px-2 shadow"
          style={{ top: ref.current ? ref.current.offsetHeight : 40, right: positionRight }}
        >
          <ul className="flex min-w-[120%] flex-col gap-1 rounded-lg bg-[#4C504B] py-2 text-sm text-white">
            {inferenceAvailableModels.map((model, index) =>
              model.supportedDicomModalities.includes(modalities) ? null : (
                <li
                  key={index}
                  className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black"
                  onClick={() => {
                    applyPredictInferenceModel(model.containerId, model.outputMode);
                    setOutputModeTitle(`${model.modelName} (${model.version}-${model.outputMode})`);
                  }}
                >
                  <img
                    src={playerPlayIcon}
                    alt="Player play icon"
                    className="w-5"
                  />
                  <h1 className="whitespace-nowrap text-sm">
                    Apply {t(model.modelName)} ({model.version}-{model.outputMode})
                  </h1>
                  <img
                    src={helpInactive}
                    alt="Player play icon"
                    className="mr-2 w-5"
                  />
                </li>
              )
            )}
            {/* <li
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
            </li> */}
          </ul>
        </div>
      )}
      {openJSONOutputModeModal && (
        <JSONOutputModeModal
          isOpen={openJSONOutputModeModal}
          onClose={() => {
            setOpenJSONOutputModeModal(false);
          }}
          data={outputModeData as PredictInferenceModelJSONResponse}
          title={outputModeTitle}
          loading={isLoading}
        />
      )}
      {openWebappOutputModeModal && (
        <WebappOutputModeModal
          isOpen={openWebappOutputModeModal}
          onClose={() => {
            setOpenWebappOutputModeModal(false);
          }}
          data={outputModeData as PredictInferenceModelWebappResponse}
          title={outputModeTitle}
          loading={isLoading}
        />
      )}
      {openHTMLOutputModeModal && (
        <HTMLOutputModeModal
          isOpen={openHTMLOutputModeModal}
          onClose={() => {
            setOpenHTMLOutputModeModal(false);
          }}
          data={outputModeData as PredictInferenceModelHTMLResponse}
          title={outputModeTitle}
          loading={isLoading}
        />
      )}
      {openPDFOutputModeModal && (
        <PDFOutputModeModal
          isOpen={openPDFOutputModeModal}
          onClose={() => {
            setOpenPDFOutputModeModal(false);
          }}
          data={outputModeData as PredictInferenceModelPDFResponse}
          title={outputModeTitle}
          loading={isLoading}
        />
      )}
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
