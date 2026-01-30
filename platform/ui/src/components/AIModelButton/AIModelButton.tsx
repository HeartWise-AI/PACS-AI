import React, { useState, useRef, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Error } from '@ohif/app/src/api/dto';
import { logoutUser } from '@ohif/app/src/service/userService';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import aiModelsIcon from './../../assets/pacs/icons/ai-models-white.png';
import playerPlayIcon from './../../assets/pacs/icons/player-play-gradient.png';
import helpInactive from './../../assets/pacs/icons/help-inactive.png';
import inferenceRepository from '@ohif/app/src/api/inferenceRepository';
import {
  GetInferenceAvailableModelsResponse,
  PredictInferenceModelHTMLResponse,
  PredictInferenceModelJSONResponse,
  PredictInferenceModelPDFResponse,
  PredictInferenceModelWebappResponse,
} from '@ohif/app/src/api/inferenceDTO';
import JSONOutputModeModal from '@ohif/app/src/components/inference/JSONOutputModeModal';
import WebappOutputModeModal from '@ohif/app/src/components/inference/WebappOutputModeModal';
import HTMLOutputModeModal from '@ohif/app/src/components/inference/HTMLOutputModeModal';
import PDFOutputModeModal from '@ohif/app/src/components/inference/PDFOutputModeModal';
import SelectSeriesModal from '@ohif/app/src/components/inference/SelectSeriesModal';
import { AlertContext } from '@ohif/app/src/AlertProvider';
import { useGlobalStateData } from '@ohif/app/src/GlobalStateProvider';
import { addSegmentationFromLabelmap } from '../../../../../extensions/cornerstone/src/utils/addSegmentation';

const baseClasses = 'relative overflow-hidden rounded-lg p-1 ml-2';
const backgroundClass = 'bg-gradient-to-r from-[rgba(108,105,244,1)] to-[rgba(62,241,209,1)]';
const textColor = 'text-white';

const AIModelButton = ({
  servicesManager,
  className = '',
  isShowBG = false,
  isShowText = false,
  inferenceAvailableModels,
  loading,
}) => {
  const { t } = useTranslation('AIModelButton');
  const tenantId = localStorage.getItem('tenantId') || '';
  const navigate = useNavigate();
  const showAlert = useContext(AlertContext);
  const [isOpen, setIsOpen] = useState(false);
  const [openJSONOutputModeModal, setOpenJSONOutputModeModal] = useState(false);
  const [openWebappOutputModeModal, setOpenWebappOutputModeModal] = useState(false);
  const [openHTMLOutputModeModal, setOpenHTMLOutputModeModal] = useState(false);
  const [openPDFOutputModeModal, setOpenPDFOutputModeModal] = useState(false);
  const [openSelectSeriesModal, setOpenSelectSeriesModal] = useState(false);
  const [outputModeTitle, setOutputModeTitle] = useState('');
  const [outputModeData, setOutputModeData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [containerName, setContainerName] = useState<string>('');
  const { selectedModalities } = useGlobalStateData();
  const [selectedInferenceModel, setSelectedInferenceModel] =
    useState<GetInferenceAvailableModelsResponse | null>(null);
  const [sortedSeriesInstanceUIDs, setSortedSeriesInstanceUIDs] = useState<string>('');

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
    containerId: string,
    seriesInstanceUIDs: string[],
    studyInstanceUID: string,
    additionalMetadata: { [key: string]: string | null },
    outputMode: string
  ) => {
    console.log('==outputMode==', outputMode);
    setIsLoading(true);
    setIsOpen(false);

    try {
      const predictionResultResponse = await inferenceRepository.PredictInferenceModel(
        containerId,
        {
          studyInstanceUID,
          seriesInstanceUIDs,
          additionalMetadata,
        }
      );

      console.log('==predictionResultResponse==', predictionResultResponse);
      const responseData = predictionResultResponse.data;
      setOutputModeData(responseData);

      // stringify series instance uids
      setSortedSeriesInstanceUIDs(JSON.stringify(seriesInstanceUIDs));

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
        case 'OHIF_ANNOTATIONS':
          if (!responseData?.segmentation) {
            throw new Error('No segmentation data available in the response');
          }
          await addSegmentation(responseData);
          break;
        default:
          break;
      }

      setOpenSelectSeriesModal(false);
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

  // add segmentation
  const addSegmentation = async data => {
    try {
      if (!data?.segmentation) {
        throw new Error('No segmentation data available');
      }
      console.log('==data==', data);

      // Decompress start time
      const decompressStartTime = performance.now();
      // Convert base64 directly to binary array
      const binaryString = atob(data.segmentation.labelmap);
      // Decompress end time
      const decodedData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        decodedData[i] = binaryString.charCodeAt(i);
      }
      // Create a 3D array from the binary data
      const [depth, height, width] = data.segmentation.dimensions;
      const totalSize = depth * height * width;
      // Pre-allocate arrays for better performance
      const labelmap = new Array(depth);
      for (let z = 0; z < depth; z++) {
        labelmap[z] = new Array(height);
        for (let y = 0; y < height; y++) {
          labelmap[z][y] = new Array(width);
        }
      }
      // Fill the arrays in a single pass
      for (let i = 0; i < totalSize; i++) {
        const z = Math.floor(i / (width * height));
        const remainder = i % (width * height);
        const y = Math.floor(remainder / width);
        const x = remainder % width;
        labelmap[z][y][x] = decodedData[i];
      }

      // Decoding end time
      const decompressEndTime = performance.now();
      console.log(`Decoding time: ${(decompressEndTime - decompressStartTime).toFixed(2)}ms`);

      // Segmentation start time
      const segmentationStartTime = performance.now();
      const segmentationId = await addSegmentationFromLabelmap({
        servicesManager,
        labelmap,
        segmentationLabel: data.segmentation.label,
        segmentations: data.segmentation.segments,
      });

      console.log('segmentation id:', segmentationId);

      const segmentationEndTime = performance.now();
      console.log(
        `Segmentation processing time: ${(segmentationEndTime - segmentationStartTime).toFixed(2)}ms`
      );

      // Handle measurements if they exist
      if (data.measurements && data.measurements.length > 0) {
        // TODO: Process measurements when implemented
        console.log('Measurements received:', data.measurements);
      }

      showAlert('Successfully applied prediction annotations.', 'success');
    } catch (error) {
      console.error('Error occurred while adding segmentation', error);
      showAlert('Error occurred while adding segmentation', 'error');
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
          className="min-w-6 h-6"
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
            {inferenceAvailableModels.some(model =>
              model.supportedDicomModalities?.some(modality =>
                Object.keys(selectedModalities).some(selectedModality =>
                  selectedModality.includes(modality)
                )
              )
            ) ? (
              <ul className="flex flex-col gap-1 rounded-lg bg-[#4C504B] py-2 text-sm text-white">
                {inferenceAvailableModels
                  .filter(model =>
                    model.supportedDicomModalities?.some(modality =>
                      Object.keys(selectedModalities).some(selectedModality =>
                        selectedModality.includes(modality)
                      )
                    )
                  )
                  .map((model, index) => (
                    <li
                      key={index}
                      className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black"
                      onClick={() => {
                        setOutputModeTitle(
                          `${model.modelName} (${model.version}-${model.outputMode})`
                        );
                        setIsOpen(false);
                        setContainerName(model.containerName);
                        setSelectedInferenceModel(model);
                        setOpenSelectSeriesModal(true);
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
                <p className="opacity-50">{t('No inference models found')}</p>
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
          selectedInferenceModel={selectedInferenceModel}
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
          selectedInferenceModel={selectedInferenceModel}
        />
      )}
      {openHTMLOutputModeModal && (
        <HTMLOutputModeModal
          isOpen={openHTMLOutputModeModal}
          onClose={() => {
            setOpenHTMLOutputModeModal(false);
          }}
          data={outputModeData as PredictInferenceModelHTMLResponse}
          modelName={selectedInferenceModel?.modelName}
          modelVersion={selectedInferenceModel?.version}
          outputMode={selectedInferenceModel?.outputMode}
          seriesInstanceUIDs={sortedSeriesInstanceUIDs}
          title={outputModeTitle}
          loading={isLoading}
          selectedInferenceModel={selectedInferenceModel}
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
          selectedInferenceModel={selectedInferenceModel}
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

AIModelButton.propTypes = {
  servicesManager: PropTypes.object.isRequired,
  className: PropTypes.string,
  isShowBG: PropTypes.bool,
  isShowText: PropTypes.bool,
  inferenceAvailableModels: PropTypes.array.isRequired,
  loading: PropTypes.bool,
};

export default AIModelButton;
