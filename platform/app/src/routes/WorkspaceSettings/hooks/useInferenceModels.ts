import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertContext } from '../../../AlertProvider';
import inferenceRepository from '../../../api/inferenceRepository';
import {
  GetInferenceAvailableModelsResponse,
  GetInferenceModelInfoResponse,
  GetInferenceModelVersionResponse,
} from '../../../api/inferenceDTO';
import { ModelDetails } from '../../../api/tenantDTO';
import { EMPTY_INFERENCE_MODEL, POLLING_INTERVAL_MS } from '../constants';
import { getDefaultDeployableVersionId } from '../inference-models/modelVersions';
import type { InferenceModelView } from '../types';
import { formatEnvsForApi, handleUnauthorizedAccess, transformInferenceModels } from '../utils';
import { useModelDeploymentProgress } from './useModelDeploymentProgress';

export function useInferenceModels() {
  const showAlert = useContext(AlertContext);
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';

  const [models, setModels] = useState<InferenceModelView[]>([]);
  const [availableModels, setAvailableModels] = useState<GetInferenceAvailableModelsResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAIModel, setSelectedAIModel] = useState<ModelDetails>();
  const [selectedInferenceModelToRemove, setSelectedInferenceModelToRemove] = useState('');
  const [selectedInferenceModel, setSelectedInferenceModel] =
    useState<InferenceModelView>(EMPTY_INFERENCE_MODEL);
  const [selectedInferenceModelInfo, setSelectedInferenceModelInfo] =
    useState<GetInferenceModelInfoResponse>({} as GetInferenceModelInfoResponse);
  const [fetchingInferenceModelInfo, setFetchingInferenceModelInfo] = useState(false);
  const [environmentalVariableKey, setEnvironmentalVariableKey] = useState('');
  const [environmentalVariableValue, setEnvironmentalVariableValue] = useState('');
  const [isAddInferenceModel, setIsAddInferenceModel] = useState(true);
  const [isViewInferenceModel, setIsViewInferenceModel] = useState(false);
  const [isUpdatingInferenceModel, setIsUpdatingInferenceModel] = useState(false);
  const [isAddingInferenceModel, setIsAddingInferenceModel] = useState(false);
  const [isOpenModelFactsModal, setIsOpenModelFactsModal] = useState(false);
  const [isOpenAddEditInferenceModelModal, setIsOpenAddEditInferenceModelModal] = useState(false);
  const [isOpenRemoveInferenceModelModal, setIsOpenRemoveInferenceModelModal] = useState(false);
  const [startingInferenceModelContainer, setStartingInferenceModelContainer] = useState(false);
  const [stoppingInferenceModelContainer, setStoppingInferenceModelContainer] = useState(false);
  const [deletingInferenceModel, setDeletingInferenceModel] = useState(false);
  const [selectedContainerToStartStop, setSelectedContainerToStartStop] = useState('');
  const [isOpenModelVersionsModal, setIsOpenModelVersionsModal] = useState(false);
  const [versionModel, setVersionModel] = useState<InferenceModelView | null>(null);
  const [modelVersions, setModelVersions] = useState<GetInferenceModelVersionResponse[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [fetchingModelVersions, setFetchingModelVersions] = useState(false);
  const restoredDeploymentModalRef = useRef(false);

  const clearSelectedInferenceModel = useCallback(() => {
    setSelectedInferenceModel(EMPTY_INFERENCE_MODEL);
  }, []);

  const fetchInferenceModels = useCallback(async () => {
    try {
      const response = await inferenceRepository.GetInferenceModels();
      setModels(transformInferenceModels(response.data));
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error('Error fetching inference models:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showAlert from AlertContext is unstable
  }, []);

  const fetchAvailableInferenceModels = useCallback(async () => {
    try {
      const response = await inferenceRepository.GetInferenceAvailableModels();
      setAvailableModels(response.data);
    } catch (error) {
      console.error('Error fetching available inference models:', error);
    }
  }, []);

  const fetchInferenceModelsInfo = async (containerID: string) => {
    setFetchingInferenceModelInfo(true);
    try {
      const response = await inferenceRepository.GetInferenceModelInfo({ containerID });
      setSelectedInferenceModelInfo(response.data);
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error('Error fetching inference model info:', error);
      showAlert(error.message, 'error');
    }
    setFetchingInferenceModelInfo(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchInferenceModels().then(() => setLoading(false));
    fetchAvailableInferenceModels();

    const interval = setInterval(() => {
      fetchInferenceModels();
    }, POLLING_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [fetchInferenceModels, fetchAvailableInferenceModels]);

  const refreshInferenceModels = () => {
    setLoading(true);
    const run = async () => {
      await fetchInferenceModels();
      setLoading(false);
    };
    run();
  };

  const addInferenceModel = async () => {
    setIsAddingInferenceModel(true);
    try {
      if (/[^a-zA-Z0-9-.]/.test(selectedInferenceModel.name)) {
        showAlert('Model name can only contain letters, numbers, dashes, and periods', 'error');
        setIsAddingInferenceModel(false);
        return;
      }
      if (
        !selectedInferenceModel.dockerImage ||
        !selectedInferenceModel.outputMode ||
        !selectedInferenceModel.name
      ) {
        showAlert('Docker image, output mode, and name are required', 'error');
        setIsAddingInferenceModel(false);
        return;
      }

      const envs = formatEnvsForApi(selectedInferenceModel.envs);
      const response = await inferenceRepository.AddInferenceModel({
        name: selectedInferenceModel.name.trim(),
        dockerImage: selectedInferenceModel.dockerImage.replace(/\s+/g, ''),
        outputMode: selectedInferenceModel.outputMode,
        envs,
      });

      showAlert(response.message, 'success');
      setIsOpenAddEditInferenceModelModal(false);
      clearSelectedInferenceModel();
      fetchInferenceModels();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error adding inference model: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsAddingInferenceModel(false);
  };

  const updateInferenceModel = async () => {
    setIsUpdatingInferenceModel(true);
    try {
      const response = await inferenceRepository.UpdateInferenceModel(selectedInferenceModel.id, {
        disallowedDICOMTags: selectedInferenceModel.disallowedDICOMTags,
        outputMode: selectedInferenceModel.outputMode,
      });
      showAlert(response.message, 'success');
      setIsOpenAddEditInferenceModelModal(false);
      clearSelectedInferenceModel();
      fetchInferenceModels();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error updating inference model: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsUpdatingInferenceModel(false);
  };

  const deleteInferenceModel = async (inferenceModelId: string) => {
    setDeletingInferenceModel(true);
    try {
      const response = await inferenceRepository.DeleteInferenceModel({ id: inferenceModelId });
      showAlert(response.message, 'success');
      fetchInferenceModels();
      setIsOpenRemoveInferenceModelModal(false);
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error deleting inference model: ${error}`);
      showAlert(error.message, 'error');
    }
    setDeletingInferenceModel(false);
  };

  const startInferenceModelContainer = async (containerID: string) => {
    setStartingInferenceModelContainer(true);
    try {
      const response = await inferenceRepository.StartInferenceModelContainer({ containerID });
      showAlert(response.message, 'success');
      setSelectedContainerToStartStop('');
      fetchInferenceModels();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error starting inference model container: ${error}`);
      showAlert(error.message, 'error');
    }
    setStartingInferenceModelContainer(false);
  };

  const stopInferenceModelContainer = async (containerID: string) => {
    setStoppingInferenceModelContainer(true);
    try {
      const response = await inferenceRepository.StopInferenceModelContainer({ containerID });
      showAlert(response.message, 'success');
      setSelectedContainerToStartStop('');
      fetchInferenceModels();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error stopping inference model container: ${error}`);
      showAlert(error.message, 'error');
    }
    setStoppingInferenceModelContainer(false);
  };

  const handleViewModelFacts = async (containerID: string) => {
    setIsOpenModelFactsModal(true);
    try {
      const response = await inferenceRepository.GetInferenceModelFacts({
        containerID,
      });
      setSelectedAIModel(response.data.en);
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      setIsOpenModelFactsModal(false);
      console.error('Error fetching inference model facts:', error);
      showAlert(error.message, 'error');
    }
  };

  const fetchModelVersions = async (modelId: string) => {
    setFetchingModelVersions(true);
    try {
      const response = await inferenceRepository.GetInferenceModelVersions(modelId);
      setModelVersions(response.data);
      setSelectedVersionId(getDefaultDeployableVersionId(response.data));
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error('Error fetching inference model versions:', error);
      showAlert(error.message, 'error');
      setModelVersions([]);
      setSelectedVersionId('');
    }
    setFetchingModelVersions(false);
  };

  const openModelVersionsModal = (row: InferenceModelView) => {
    restoredDeploymentModalRef.current = true;
    setVersionModel(row);
    setModelVersions([]);
    setSelectedVersionId('');
    setIsOpenModelVersionsModal(true);
    fetchModelVersions(row.id);
  };

  const closeModelVersionsModal = () => {
    restoredDeploymentModalRef.current = true;
    setIsOpenModelVersionsModal(false);
    setVersionModel(null);
    setModelVersions([]);
    setSelectedVersionId('');
  };

  const modelDeploymentProgress = useModelDeploymentProgress({
    tenantId,
    onTerminal: (modelId, progress) => {
      if (progress.status === 'COMPLETED') {
        showAlert('Model deployment completed.', 'success');
        void fetchInferenceModels();
        if (versionModel?.id === modelId) {
          void fetchModelVersions(modelId);
        }
        return;
      }
      showAlert(
        progress.rollbackError || progress.errorMessage || 'The model deployment did not complete.',
        'error'
      );
    },
  });

  useEffect(() => {
    if (restoredDeploymentModalRef.current || isOpenModelVersionsModal) {
      return;
    }
    const activeDeployment = Object.values(modelDeploymentProgress.deployments).find(
      deployment => !deployment.progress.terminal
    );
    const model = activeDeployment
      ? models.find(candidate => candidate.id === activeDeployment.modelId)
      : undefined;
    if (!model) {
      return;
    }
    restoredDeploymentModalRef.current = true;
    setVersionModel(model);
    setModelVersions([]);
    setSelectedVersionId('');
    setIsOpenModelVersionsModal(true);
    void fetchModelVersions(model.id);
    // fetchModelVersions intentionally follows the restored model identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpenModelVersionsModal, modelDeploymentProgress.deployments, models]);

  const deployModelVersion = async () => {
    if (!versionModel || !selectedVersionId) {
      return;
    }
    try {
      await modelDeploymentProgress.deploy(versionModel.id, selectedVersionId);
      showAlert('Model deployment accepted.', 'success');
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error('Error deploying inference model version:', error);
      showAlert(error.message, 'error');
    }
  };

  const openAddModelModal = () => {
    setIsOpenAddEditInferenceModelModal(true);
  };

  const openEditModelModal = (row: InferenceModelView) => {
    fetchInferenceModelsInfo(row.container.id);
    setSelectedInferenceModel(row);
    setIsAddInferenceModel(false);
    setIsViewInferenceModel(false);
    setIsOpenAddEditInferenceModelModal(true);
  };

  const openViewModelModal = (row: InferenceModelView) => {
    setSelectedInferenceModel(row);
    setIsAddInferenceModel(false);
    setIsViewInferenceModel(true);
    setIsOpenAddEditInferenceModelModal(true);
  };

  const openRemoveModelModal = (modelId: string) => {
    setSelectedInferenceModelToRemove(modelId);
    setIsOpenRemoveInferenceModelModal(true);
  };

  const closeAddEditModelModal = () => {
    setIsAddInferenceModel(true);
    setIsOpenAddEditInferenceModelModal(false);
    setIsViewInferenceModel(false);
    clearSelectedInferenceModel();
  };

  const closeRemoveModelModal = () => {
    setIsOpenRemoveInferenceModelModal(false);
  };

  const closeModelFactsModal = () => {
    setIsOpenModelFactsModal(false);
  };

  const handleStartStop = (containerID: string, running: boolean) => {
    setSelectedContainerToStartStop(containerID);
    if (running) {
      stopInferenceModelContainer(containerID);
    } else {
      startInferenceModelContainer(containerID);
    }
  };

  return {
    models,
    availableModels,
    loading,
    selectedAIModel,
    selectedInferenceModelToRemove,
    selectedInferenceModel,
    setSelectedInferenceModel,
    selectedInferenceModelInfo,
    fetchingInferenceModelInfo,
    environmentalVariableKey,
    setEnvironmentalVariableKey,
    environmentalVariableValue,
    setEnvironmentalVariableValue,
    isAddInferenceModel,
    isViewInferenceModel,
    isUpdatingInferenceModel,
    isAddingInferenceModel,
    isOpenModelFactsModal,
    isOpenAddEditInferenceModelModal,
    isOpenRemoveInferenceModelModal,
    startingInferenceModelContainer,
    stoppingInferenceModelContainer,
    deletingInferenceModel,
    selectedContainerToStartStop,
    isOpenModelVersionsModal,
    versionModel,
    modelVersions,
    selectedVersionId,
    setSelectedVersionId,
    fetchingModelVersions,
    deployingModelVersion: modelDeploymentProgress.isDeploying(versionModel?.id),
    modelDeployment: versionModel
      ? modelDeploymentProgress.deployments[versionModel.id]
      : undefined,
    refreshInferenceModels,
    addInferenceModel,
    updateInferenceModel,
    deleteInferenceModel,
    handleViewModelFacts,
    openModelVersionsModal,
    closeModelVersionsModal,
    deployModelVersion,
    openAddModelModal,
    openEditModelModal,
    openViewModelModal,
    openRemoveModelModal,
    closeAddEditModelModal,
    closeRemoveModelModal,
    closeModelFactsModal,
    handleStartStop,
  };
}

export type UseInferenceModelsResult = ReturnType<typeof useInferenceModels>;
