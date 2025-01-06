import React, { useState, useRef, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Error } from '../../../../app/src/api/dto';
import { logoutUser } from '../../../../app/src/service/userService';
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
import SelectSeriesModal from '../../../../app/src/components/inference/SelectSeriesModal';
import { AlertContext } from '../../../../app/src/AlertProvider';
import { useGlobalStateData } from '../../../../app/src/GlobalStateProvider';

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
  loading,
}) => {
  const { t } = useTranslation('AIModelButton');
  const tenantId = localStorage.getItem('tenantId') || '';
  const navigate = useNavigate();
  const showAlert = useContext(AlertContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openJSONOutputModeModal, setOpenJSONOutputModeModal] = useState(false);
  const [openWebappOutputModeModal, setOpenWebappOutputModeModal] = useState(false);
  const [openHTMLOutputModeModal, setOpenHTMLOutputModeModal] = useState(false);
  const [openPDFOutputModeModal, setOpenPDFOutputModeModal] = useState(false);
  const [openSelectSeriesModal, setOpenSelectSeriesModal] = useState(false);
  const [outputModeTitle, setOutputModeTitle] = useState('');
  const [outputModeData, setOutputModeData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lvef, setLvef] = useState(null);
  const [age, setAge] = useState(null);
  const [detectedVessel, setVessel] = useState(null);
  const ref = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [containerName, setContainerName] = useState<string>('');
  const { modalitiesInStudy } = useGlobalStateData();
  const [selectedInferenceModel, setSelectedInferenceModel] =
    useState<GetInferenceAvailableModelsResponse | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // handle dropdown close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // handle button click
  const handleButtonClick = e => {
    setIsOpen(!isOpen);
    const buttonRect = e.currentTarget.getBoundingClientRect();
    setDropdownPosition({
      top: buttonRect.bottom + window.scrollY,
      left: buttonRect.left + window.scrollX - 10,
    });
  };

  // apply inference model
  const applyPredictInferenceModel = async (
    containerID: string,
    seriesInstanceUIDs: string[],
    additionalMetadata: { [key: string]: string | null },
    outputMode: string
  ) => {
    setIsLoading(true);
    setIsOpen(false);
    setOpenSelectSeriesModal(false);

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

      const predictionResultResponse = await inferenceRepository.PredictInferenceModel({
        containerID,
        seriesInstanceUIDs,
        additionalMetadata,
        outputMode,
      });

      setOutputModeData(predictionResultResponse.data);
      setIsLoading(false);
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
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
        } ${loading ? 'opacity-50' : ''}`}
        type="button"
        onClick={handleButtonClick}
        disabled={loading}
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
      {isOpen &&
        mounted &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            className="absolute z-50 inline-block divide-y divide-gray-100 rounded-lg px-2 shadow"
            style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: 'auto' }}
          >
            {inferenceAvailableModels.some(
              // TODO: update this hardcoded modality
              model =>
                model.supportedDicomModalities?.some(modality => modality === modalitiesInStudy)
            ) ? (
              <ul className="flex flex-col gap-1 rounded-lg bg-[#4C504B] py-2 text-sm text-white">
                {inferenceAvailableModels.map((model, index) => (
                  <li
                    key={index}
                    className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black"
                    onClick={() => {
                      setOutputModeTitle(
                        `${model.modelName} (${model.version}-${model.outputMode})`
                      );
                      setOpenSelectSeriesModal(true);
                      setIsOpen(false);
                      setContainerName(model.containerName);
                      setSelectedInferenceModel(model);
                      return;
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
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-1 rounded-lg bg-[#4C504B] p-2 text-center text-sm text-white">
                <p className="opacity-50">No inference models found</p>
              </div>
            )}
          </div>,
          document.body
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
          containerName={containerName}
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
      {openSelectSeriesModal && (
        <SelectSeriesModal
          isOpen={openSelectSeriesModal}
          onClose={() => {
            setOpenSelectSeriesModal(false);
          }}
          applyPredictInferenceModel={applyPredictInferenceModel}
          title={outputModeTitle}
          loading={isLoading}
          selectedInferenceModel={selectedInferenceModel}
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
