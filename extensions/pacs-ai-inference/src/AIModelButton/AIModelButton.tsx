import React, { useState, useRef, useEffect, useContext } from 'react';
import { aiModelMenuSectionTitle, buildAIModelMenuSections } from './aiModelMenuSections';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Error } from '@pacs-ai/extension-core/src/api/dto';
import { logoutUser } from '@pacs-ai/extension-core/src/service/userService';
import { useTranslation } from 'react-i18next';
import aiModelsIcon from '../assets/icons/ai-models-white.png';
import playerPlayIcon from '../assets/icons/player-play-gradient.png';
import helpInactive from '../assets/icons/help-inactive.png';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import {
  GetInferenceAvailableModelsResponse,
  PredictInferenceModelHTMLResponse,
  PredictInferenceModelJSONResponse,
  PredictInferenceModelPDFResponse,
  PredictInferenceModelWebappResponse,
} from '@pacs-ai/extension-core/src/api/inferenceDTO';
import JSONOutputModeModal from '../JSONOutputModeModal';
import WebappOutputModeModal from '../WebappOutputModeModal';
import HTMLOutputModeModal from '../HTMLOutputModeModal';
import PDFOutputModeModal from '../PDFOutputModeModal';
import SelectSeriesModal from '@pacs-ai/ui/src/components/SelectSeriesModal';
import { AlertContext } from '@pacs-ai/extension-core/src/providers/AlertProvider';
import useStudyContext from '@pacs-ai/extension-core/src/hooks/useStudyContext';
import useAvailableModels from '@pacs-ai/extension-core/src/hooks/useAvailableModels';
import { pacsAiModelsService } from '@pacs-ai/extension-core/src/services/PacsAiModelsService';
import { addSegmentationFromLabelmap } from '../utils/addSegmentation';
import { useViewerModelResults } from '../viewerResults/ViewerModelResultsProvider';
import {
  formatRunDateTime,
  isSameResultRun,
  viewerModelKey,
} from '../viewerResults/viewerResultsModel';

const baseClasses = 'relative overflow-hidden rounded-lg p-1 ml-2';
const backgroundClass = 'bg-gradient-to-r from-[rgba(108,105,244,1)] to-[rgba(62,241,209,1)]';
const textColor = 'text-white';

type AIModelButtonProps = {
  // OHIF's services manager; typed loosely as before (the propTypes said object).
  servicesManager: any;
  className?: string;
  isShowBG?: boolean;
  isShowText?: boolean;
  inferenceAvailableModels: any[];
  loading?: boolean;
};

const AIModelButton = ({
  servicesManager,
  className = '',
  isShowBG = false,
  isShowText = false,
  inferenceAvailableModels,
  loading,
}: AIModelButtonProps) => {
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
  const { selectedModalities } = useStudyContext();
  // A background refresh runs each time the menu opens (see handleButtonClick).
  const { refreshingAvailableModels } = useAvailableModels();
  const [selectedInferenceModel, setSelectedInferenceModel] =
    useState<GetInferenceAvailableModelsResponse | null>(null);
  const [sortedSeriesInstanceUIDs, setSortedSeriesInstanceUIDs] = useState<string>('');
  // Previous results / managed runs (absent outside the viewer provider).
  const viewerResults = useViewerModelResults();
  const [confirmRunModelKey, setConfirmRunModelKey] = useState<string | null>(null);
  // Name of the model whose managed run the series pop-up is waiting on.
  const [foregroundRunModelName, setForegroundRunModelName] = useState<string | null>(null);

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
    if (!isOpen) {
      setConfirmRunModelKey(null);
      void viewerResults?.refreshLatestResults();
      // api-pacs leaves out a model whose container is busy at that moment, so
      // the list loaded with the viewer can miss one; ask again on every open.
      void pacsAiModelsService.refreshAvailableModels();
    }
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

  const openRunFlow = (model: GetInferenceAvailableModelsResponse) => {
    setOutputModeTitle(`${model.modelName} (${model.version}-${model.outputMode})`);
    setIsOpen(false);
    setConfirmRunModelKey(null);
    setContainerName(model.containerName);
    setSelectedInferenceModel(model);
    setOpenSelectSeriesModal(true);
  };

  // Managed runs are recorded in run history and stored as the study's
  // result. Models that need additional metadata keep the direct predict
  // path because a managed run cannot carry it. Segmentation models
  // (OHIF_ANNOTATIONS, e.g. TotalSegmentator on CT) also keep it: their
  // result is a labelmap the viewer loads itself, and the managed pipeline
  // has no CT/MR support.
  const canQueueModel = (model: GetInferenceAvailableModelsResponse) =>
    !!viewerResults?.canRunManaged &&
    !!(model.containerId?.trim() || model.modelId?.trim()) &&
    !model.supportedAdditionalMetadata?.length &&
    model.outputMode !== 'OHIF_ANNOTATIONS';

  const managedRunModality = (model: GetInferenceAvailableModelsResponse) =>
    (model.supportedDicomModalities?.length ?? 0) > 1
      ? (model.supportedDicomModalities.find(modality =>
          Object.keys(selectedModalities).some(selected => selected.includes(modality))
        ) ?? null)
      : null;

  // Confirmed series selection: a managed run the pop-up waits on when the
  // model supports it, the direct predict call otherwise.
  const applySelectedSeries = async (
    containerId: string,
    seriesInstanceUIDs: string[],
    studyInstanceUID: string,
    additionalMetadata: { [key: string]: string | null },
    outputMode: string
  ) => {
    const model = selectedInferenceModel;
    const applyPredict = () =>
      applyPredictInferenceModel(
        containerId,
        seriesInstanceUIDs,
        studyInstanceUID,
        additionalMetadata,
        outputMode
      );
    if (!model || !canQueueModel(model)) {
      return applyPredict();
    }

    setIsOpen(false);
    setForegroundRunModelName(t(model.modelName));
    try {
      const outcome = await viewerResults.startForegroundRun({
        model,
        modality: managedRunModality(model),
        seriesInstanceUIDs,
        studyInstanceUID,
      });
      if (outcome.status === 'fallback') {
        // Older api-pacs without managed runs: direct predict.
        setForegroundRunModelName(null);
        return applyPredict();
      }
      if (outcome.status === 'completed') {
        // The provider has opened the result.
        setOpenSelectSeriesModal(false);
      }
      // Failed or timed out: the provider has reported it and the pop-up
      // stays usable. Dismissed: the pop-up is already closed.
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      setForegroundRunModelName(null);
    }
  };

  const dismissForegroundRun = () => {
    // The run continues; its result is offered through the ready notice.
    viewerResults?.dismissForegroundRun();
    setOpenSelectSeriesModal(false);
  };

  const renderRerunConfirmation = (model: GetInferenceAvailableModelsResponse) => (
    <div className="flex flex-col gap-1 rounded bg-black/20 p-2 text-xs">
      <p>{t('ViewerRerunConfirm')}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded px-2 py-1 hover:bg-white/10"
          onClick={() => setConfirmRunModelKey(null)}
        >
          {t('ViewerRerunCancel')}
        </button>
        <button
          type="button"
          className={`rounded px-2 py-1 font-semibold ${backgroundClass}`}
          onClick={() => openRunFlow(model)}
        >
          {t('ViewerRerunConfirmAction')}
        </button>
      </div>
    </div>
  );

  // Date and time: a study often has several runs of a model on the same day.
  const formatResultDate = (completedAt: string | null) => formatRunDateTime(completedAt);

  // With several exams open, one block per exam, each offering only the
  // models of its modality and showing that exam's results.
  const menuSections = buildAIModelMenuSections(
    selectedModalities as Parameters<typeof buildAIModelMenuSections>[0],
    inferenceAvailableModels as GetInferenceAvailableModelsResponse[]
  );

  // One model row of the menu, for one open exam (studyUID; the primary
  // exam when null).
  const renderModelRow = (
    model: GetInferenceAvailableModelsResponse,
    index: number,
    studyUID: string | null
  ) => {
    const latestResult = viewerResults?.getLatestResult(model, studyUID) ?? null;
    const pendingRun = viewerResults?.getPendingRun(model, studyUID) ?? null;
    const latestScope = latestResult
      ? (viewerResults?.getResultSeriesScope?.(latestResult) ?? null)
      : null;
    // "View result" opens the default (best) run. When a newer run exists,
    // typically the user's own rerun on fewer series, it gets its own button.
    const newestRun = viewerResults?.getResultRuns?.(model, studyUID)?.[0] ?? null;
    const newerRun =
      latestResult && newestRun && !isSameResultRun(newestRun, latestResult) ? newestRun : null;
    const modelKey = `${studyUID ?? ''}|${viewerModelKey(model)}`;
    const modelLabel = `${t(model.modelName)} (${model.version}-${model.outputMode})`;

    if (!latestResult && !pendingRun) {
      return (
        <li
          key={`${studyUID ?? ''}-${index}`}
          className="hover:bg-primary flex cursor-pointer items-center gap-2 p-1 hover:text-black"
          onClick={() => openRunFlow(model)}
        >
          <img
            src={playerPlayIcon}
            alt="Player play icon"
            className="w-5"
          />
          <h1 className="whitespace-nowrap text-sm">Apply {modelLabel}</h1>
          <img
            src={helpInactive}
            alt="Player play icon"
            className="mr-2 w-5"
          />
        </li>
      );
    }

    return (
      <li
        key={`${studyUID ?? ''}-${index}`}
        className="flex flex-col gap-1 p-1"
        data-testid="ai-model-previous-result"
      >
        <h1 className="whitespace-nowrap px-1 text-sm">{modelLabel}</h1>
        {confirmRunModelKey === modelKey ? (
          renderRerunConfirmation(model)
        ) : (
          <div className="flex items-center gap-2 px-1">
            {latestResult && (
              <button
                type="button"
                className="hover:bg-primary whitespace-nowrap rounded bg-white/10 px-2 py-1 text-xs hover:text-black"
                onClick={() => {
                  setIsOpen(false);
                  viewerResults?.openResult(latestResult);
                }}
              >
                {t('ViewerViewResult', {
                  date: formatResultDate(latestResult.completedAt),
                })}
                {latestScope?.kind === 'subset' && (
                  <span
                    className="font-semibold"
                    data-testid="ai-model-result-subset"
                  >
                    {` · ${t('ViewerResultSeriesCount', { used: latestScope.used })}`}
                  </span>
                )}
              </button>
            )}
            {newerRun && (
              <button
                type="button"
                className="hover:bg-primary whitespace-nowrap rounded bg-white/10 px-2 py-1 text-xs hover:text-black"
                onClick={() => {
                  setIsOpen(false);
                  viewerResults?.openResult(newerRun);
                }}
                data-testid="ai-model-latest-run"
              >
                {t('ViewerViewLatestRun', {
                  date: formatResultDate(newerRun.completedAt),
                })}
              </button>
            )}
            {pendingRun ? (
              <span
                className="whitespace-nowrap px-2 py-1 text-xs opacity-70"
                role="status"
              >
                {t('ViewerRunInProgress')}
              </span>
            ) : (
              <button
                type="button"
                className="hover:bg-primary flex items-center gap-1 whitespace-nowrap rounded bg-white/10 px-2 py-1 text-xs hover:text-black"
                onClick={() => setConfirmRunModelKey(modelKey)}
              >
                <img
                  src={playerPlayIcon}
                  alt=""
                  className="w-4"
                />
                {t('ViewerRerun')}
              </button>
            )}
          </div>
        )}
      </li>
    );
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
        data-tour-id="ai-model-button"
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
            {menuSections.length ? (
              <ul className="flex flex-col gap-1 rounded-lg bg-[#4C504B] py-2 text-sm text-white">
                {menuSections.map(section => (
                  <React.Fragment key={`${section.studyInstanceUID ?? ''}|${section.modality}`}>
                    {menuSections.length > 1 && (
                      <li
                        className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide opacity-70"
                        data-testid="ai-model-menu-exam"
                      >
                        {aiModelMenuSectionTitle(section)}
                      </li>
                    )}
                    {section.models.map((model, index) =>
                      renderModelRow(model, index, section.studyInstanceUID)
                    )}
                  </React.Fragment>
                ))}
              </ul>
            ) : (
              <div
                className="flex flex-col gap-1 rounded-lg bg-[#4C504B] p-2 text-center text-sm text-white"
                data-testid="ai-model-menu-empty"
              >
                {refreshingAvailableModels ? (
                  <p className="opacity-50">{t('LookingForModels')}</p>
                ) : (
                  <>
                    <p className="opacity-50">{t('No inference models found')}</p>
                    <p className="max-w-[16rem] text-xs opacity-50">{t('ModelsMayBeBusy')}</p>
                    <button
                      type="button"
                      className="mx-auto mt-1 rounded px-2 py-0.5 text-xs underline hover:opacity-80"
                      onClick={() => void pacsAiModelsService.refreshAvailableModels()}
                    >
                      {t('TryAgain')}
                    </button>
                  </>
                )}
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
          applyPredictInferenceModel={applySelectedSeries}
          title={outputModeTitle}
          loading={isLoading || !!foregroundRunModelName}
          loadingMessage={
            foregroundRunModelName
              ? t('ViewerRunForeground', { modelName: foregroundRunModelName })
              : undefined
          }
          onDismissLoading={foregroundRunModelName ? dismissForegroundRun : undefined}
          dismissLoadingLabel={t('ViewerRunForegroundDismiss')}
          selectedInferenceModel={selectedInferenceModel}
        />
      )}
    </div>
  );
};

export default AIModelButton;
