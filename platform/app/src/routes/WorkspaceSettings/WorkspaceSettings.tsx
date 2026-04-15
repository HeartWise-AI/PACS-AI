import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DateRangePicker } from 'react-dates';
import moment from 'moment';
import { Input } from '@ohif/ui-next';
import { Button, Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import { AlertContext } from '../../AlertProvider';
import copyIcon from './../../assets/pacs/icons/copy-gradient.png';
import refreshIcon from './../../assets/pacs/icons/refresh.png';
import dotsVertical from './../../assets/pacs/icons/dots-vertical-inactive.png';
import playIcon from './../../assets/pacs/icons/play.png';
import stopIcon from './../../assets/pacs/icons/stop.png';
import tenantRepository from '../../api/tenantRepository';
import orthancRepository from '../../api/orthancRepository';
import inferenceRepository from '../../api/inferenceRepository';
import { GetTenantInfoResponse, ModelDetails } from '../../api/tenantDTO';
import {
  GetInferenceAvailableModelsResponse,
  GetInferenceIngestionJobsResponse,
  GetInferenceModelInfoResponse,
  GetInferenceModelResponse,
} from '../../api/inferenceDTO';
import Modal from '../../components/Modal';
import Table from '../../components/Table';
import ModelFactsModal from '../../components/ModelFactsModal';
import { logoutUser } from '../../service/userService';
import { Error } from '../../api/dto';
import { DataElementDictionary } from 'dicom-data-dictionary';

interface DICOMModalities {
  id: string;
  aet: string;
  host: string;
  port: number;
  status: string;
  targetCFindEnabled: boolean;
  targetCMoveEnabled: boolean;
  targetCStoreEnabled: boolean;
}

enum InferenceContainerStatus {
  CREATED = 'created',
  RUNNING = 'running',
  PAUSED = 'paused',
  RESTARTING = 'restarting',
  EXITED = 'exited',
  REMOVING = 'removing',
  DEAD = 'dead',
  STOPPED = 'stopped',
}

const containerStatusColors = {
  [InferenceContainerStatus.CREATED]: {
    bg: 'bg-blue-300',
    bgOpacity: 'bg-opacity-20',
    text: 'text-blue-300',
    dot: 'bg-blue-300',
  },
  [InferenceContainerStatus.RUNNING]: {
    bg: 'bg-[#6ED47C]',
    bgOpacity: 'bg-opacity-20',
    text: 'text-[#6ED47C]',
    dot: 'bg-[#6ED47C]',
  },
  [InferenceContainerStatus.PAUSED]: {
    bg: 'bg-yellow-300',
    bgOpacity: 'bg-opacity-20',
    text: 'text-yellow-300',
    dot: 'bg-yellow-300',
  },
  [InferenceContainerStatus.RESTARTING]: {
    bg: 'bg-purple-300',
    bgOpacity: 'bg-opacity-20',
    text: 'text-purple-300',
    dot: 'bg-purple-300',
  },
  [InferenceContainerStatus.EXITED]: {
    bg: 'bg-red-300',
    bgOpacity: 'bg-opacity-10',
    text: 'text-red-500',
    dot: 'bg-red-500',
  },
  [InferenceContainerStatus.REMOVING]: {
    bg: 'bg-orange-300',
    bgOpacity: 'bg-opacity-20',
    text: 'text-orange-300',
    dot: 'bg-orange-300',
  },
  [InferenceContainerStatus.DEAD]: {
    bg: 'bg-red-500',
    bgOpacity: 'bg-opacity-20',
    text: 'text-red-500',
    dot: 'bg-red-500',
  },
  [InferenceContainerStatus.STOPPED]: {
    bg: 'bg-red-300',
    bgOpacity: 'bg-opacity-10',
    text: 'text-red-500',
    dot: 'bg-red-500',
  },
};

const minIngestionJobIntervalMinutes = 5;

const WorkspaceSettingsPage = () => {
  const { t } = useTranslation('Common');
  const showAlert = useContext(AlertContext);
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';
  const [dicomModalities, setDICOMModalities] = useState<DICOMModalities[]>([]);
  const [inferenceModels, setInferenceModels] = useState<GetInferenceModelResponse[]>([]);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [informedConsentEnabled, setInformedConsentEnabled] = useState(false);
  const [isUpdatingOnboardingRegistration, setIsUpdatingOnboardingRegistration] = useState(false);
  const [isUpdatingOnboardingConsent, setIsUpdatingOnboardingConsent] = useState(false);
  const [selectedAIModel, setSelectedAIModel] = useState<ModelDetails>();
  const [selectedModalityToRemove, setSelectedModalityToRemove] = useState<string>('');
  const [selectedModality, setSelectedModality] = useState({
    id: '',
    aet: '',
    host: '',
    port: '',
    status: '',
    targetCFindEnabled: false,
    targetCMoveEnabled: false,
    targetCStoreEnabled: false,
  });
  const [selectedInferenceModelToRemove, setSelectedInferenceModelToRemove] = useState<string>('');
  const [selectedInferenceModel, setSelectedInferenceModel] = useState<GetInferenceModelResponse>({
    id: '',
    name: '',
    dockerImage: '',
    tenantId: '',
    outputMode: '',
    envs: [],
    createdAt: 0,
    updatedAt: 0,
    container: {
      id: '',
      name: '',
      status: '',
      running: false,
      startedAt: 0,
      finishedAt: 0,
      cpuPercentUsage: 0,
      memoryInBytes: 0,
    },
    disallowedDICOMTags: [],
  });
  const [selectedInferenceModelInfo, setSelectedInferenceModelInfo] =
    useState<GetInferenceModelInfoResponse>({} as GetInferenceModelInfoResponse);
  const [fetchingInferenceModelInfo, setFetchingInferenceModelInfo] = useState<boolean>(false);
  const [environmentalVariableKey, setEnvironmentalVariableKey] = useState<string>('');
  const [environmentalVariableValue, setEnvironmentalVariableValue] = useState<string>('');
  const [loadingModalities, setLoadingModalities] = useState(true);
  const [loadingInferenceModels, setLoadingInferenceModels] = useState(true);
  const [isAddModality, setIsAddModality] = useState<boolean>(true);
  const [isAddInferenceModel, setIsAddInferenceModel] = useState<boolean>(true);
  const [isViewInferenceModel, setIsViewInferenceModel] = useState<boolean>(false);
  const [isUpdatingModality, setIsUpdatingModality] = useState<boolean>(false);
  const [isAddingModality, setIsAddingModality] = useState<boolean>(false);
  const [isUpdatingInferenceModel, setIsUpdatingInferenceModel] = useState<boolean>(false);
  const [isAddingInferenceModel, setIsAddingInferenceModel] = useState<boolean>(false);
  const [isOpenModelFactsModal, setIsOpenModelFactsModal] = useState<boolean>(false);
  const [isOpenAddEditModalityModal, setIsOpenAddEditModalityModal] = useState<boolean>(false);
  const [isOpenAddEditInferenceModelModal, setIsOpenAddEditInferenceModelModal] =
    useState<boolean>(false);
  const [isOpenRemoveModalityModal, setIsOpenRemoveModalityModal] = useState<boolean>(false);
  const [isOpenRemoveInferenceModelModal, setIsOpenRemoveInferenceModelModal] =
    useState<boolean>(false);
  const [isRefreshingDICOMModalities, setIsRefreshingDICOMModalities] = useState<boolean>(false);
  const [isRemovingModality, setIsRemovingModality] = useState<boolean>(false);
  const [startingInferenceModelContainer, setStartingInferenceModelContainer] =
    useState<boolean>(false);
  const [stoppingInferenceModelContainer, setStoppingInferenceModelContainer] =
    useState<boolean>(false);
  const [deletingInferenceModel, setDeletingInferenceModel] = useState<boolean>(false);
  const [selectedContainerToStartStop, setSelectedContainerToStartStop] = useState<string>('');
  const [startingIngestionJob, setStartingIngestionJob] = useState<boolean>(false);
  const [stoppingIngestionJob, setStoppingIngestionJob] = useState<boolean>(false);
  const [selectedIngestionJobToStartStop, setSelectedIngestionJobToStartStop] =
    useState<string>('');
  const [ingestionJobs, setIngestionJobs] = useState<GetInferenceIngestionJobsResponse[]>([]);
  const [loadingIngestionJobs, setLoadingIngestionJobs] = useState(true);
  const [isOpenAddEditIngestionJobModal, setIsOpenAddEditIngestionJobModal] = useState(false);
  const [newJobModel, setNewJobModel] = useState<{ value: string; label: string } | null>(null);
  const [newJobModalities, setNewJobModalities] = useState<{ value: string; label: string }[]>([]);
  const [newJobInterval, setNewJobInterval] = useState<string>(
    String(minIngestionJobIntervalMinutes)
  );
  const [newJobScheduleType, setNewJobScheduleType] = useState<'always' | 'dateRange'>('always');
  const [newJobStartDate, setNewJobStartDate] = useState(null);
  const [newJobEndDate, setNewJobEndDate] = useState(null);
  const [newJobFocusedInput, setNewJobFocusedInput] = useState(null);
  const [isAddIngestionJob, setIsAddIngestionJob] = useState<boolean>(true);
  const [selectedIngestionJobId, setSelectedIngestionJobId] = useState<string>('');
  const [isOpenRemoveIngestionJobModal, setIsOpenRemoveIngestionJobModal] =
    useState<boolean>(false);
  const [availableInferenceModels, setAvailableInferenceModels] = useState<
    GetInferenceAvailableModelsResponse[]
  >([]);
  const [newJobDicomModality, setNewJobDicomModality] = useState<string>('');
  const [newJobStartTime, setNewJobStartTime] = useState<string>('00:00');
  const [newJobEndTime, setNewJobEndTime] = useState<string>('23:59');
  const [isSavingIngestionJob, setIsSavingIngestionJob] = useState<boolean>(false);
  const [isDeletingIngestionJob, setIsDeletingIngestionJob] = useState<boolean>(false);
  const [isImportingIngestionJobs, setIsImportingIngestionJobs] = useState<boolean>(false);
  const ingestionJobsCsvInputRef = useRef<HTMLInputElement>(null);

  const dicomHeaders = [
    { text: t('ID'), value: 'id', align: 'left' },
    { text: t('Target AET'), value: 'aet', align: 'left' },
    { text: t('Host'), value: 'host', align: 'left' },
    { text: t('Port'), value: 'port', align: 'left' },
    { text: t('C-Find'), value: 'targetCFindEnabled', align: 'left' },
    { text: t('C-Move'), value: 'targetCMoveEnabled', align: 'left' },
    { text: t('C-Store'), value: 'targetCStoreEnabled', align: 'left' },
    { text: t('Status'), value: 'status', align: 'left' },
    { text: t('Action'), value: 'action', align: 'center' },
  ];
  const inferenceModelHeaders = [
    { text: t('Container ID'), value: 'containerId', align: 'left' },
    { text: t('Name'), value: 'name', align: 'left' },
    { text: t('Version'), value: 'version', align: 'left' },
    { text: t('Image'), value: 'dockerImage', align: 'left' },
    { text: t('Status'), value: 'status', align: 'left' },
    { text: t('CPU %'), value: 'cpu', align: 'left' },
    { text: t('Action'), value: 'action', align: 'center' },
  ];
  const inferenceIngestionServiceHeaders = [
    { text: t('Job ID'), value: 'jobId', align: 'left' },
    { text: t('Model'), value: 'model', align: 'left' },
    { text: t('DICOM Modality'), value: 'dicomModality', align: 'left' },
    { text: t('Modalities'), value: 'modalities', align: 'left' },
    { text: t('Interval'), value: 'interval', align: 'left' },
    { text: t('Schedule'), value: 'schedule', align: 'left' },
    { text: t('Status'), value: 'status', align: 'left' },
    { text: t('Action'), value: 'action', align: 'center' },
  ];
  const outputModeOptions = ['JSON', 'OHIF_ANNOTATIONS', 'HTML', 'WEB_APP', 'PDF'];

  // add polling interval state
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Set page title
  useEffect(() => {
    document.title = 'Admin Workspace Settings - PACS AI';
  }, []);

  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await tenantRepository.GetTenantInfo();
        setTenantInfo(response.data);
      } catch (error) {
        console.error(`Can't fetch tenant info: ${error}`);
      }
    };
    fetchTenantInfo();
  }, [tenantRepository]);

  useEffect(() => {
    if (!tenantInfo.id) {
      return;
    }
    setRegistrationEnabled(Boolean(tenantInfo.onboardingEnableRegistration));
    setInformedConsentEnabled(Boolean(tenantInfo.onboardingEnableConsent));
  }, [tenantInfo.id, tenantInfo.onboardingEnableRegistration, tenantInfo.onboardingEnableConsent]);

  /**
   * Handle toggle onboarding registration
   *
   * @param next
   */
  const handleToggleOnboardingRegistration = async (next: boolean) => {
    setIsUpdatingOnboardingRegistration(true);
    try {
      const response = await tenantRepository.UpdateOnboardingRegistrationConfig({
        onboardingEnableRegistration: next,
      });
      showAlert(response.message, 'success');
      setRegistrationEnabled(next);
      setTenantInfo(prev => ({ ...prev, onboardingEnableRegistration: next }));
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error updating onboarding registration config: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsUpdatingOnboardingRegistration(false);
  };

  /**
   * Handle toggle onboarding consent
   *
   * @param next
   */
  const handleToggleOnboardingConsent = async (next: boolean) => {
    setIsUpdatingOnboardingConsent(true);
    try {
      const response = await tenantRepository.UpdateOnboardingConsentConfig({
        onboardingEnableConsent: next,
      });
      showAlert(response.message, 'success');
      setInformedConsentEnabled(next);
      setTenantInfo(prev => ({ ...prev, onboardingEnableConsent: next }));
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error updating onboarding consent config: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsUpdatingOnboardingConsent(false);
  };

  /**
   * Onboarding toggle button
   *
   * @param checked
   * @param onToggle
   * @param id
   * @param disabled
   */
  const onboardingToggleButton = (
    checked: boolean,
    onToggle: (next: boolean) => void,
    id: string,
    disabled = false
  ) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={disabled}
      id={id}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onToggle(!checked);
        }
      }}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6ED47C] disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-gradient-to-r from-[#C8F469] to-[#05905E]' : 'bg-white bg-opacity-20'
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );

  /**
   * Fetch DICOM modalities
   */
  const fetchDICOMModalities = useCallback(async () => {
    setLoadingModalities(true);
    setDICOMModalities([]);
    try {
      const response = await orthancRepository.GetDICOMModalities();
      const modalities = Object.entries(response.data.modalities).map(
        ([id, modality]: [string, any]) => ({
          id,
          aet: modality.aet,
          host: modality.host,
          port: modality.port,
          status: 'Connecting',
          targetCFindEnabled: modality.targetCFindEnabled,
          targetCMoveEnabled: modality.targetCMoveEnabled,
          targetCStoreEnabled: modality.targetCStoreEnabled,
        })
      );
      setDICOMModalities(modalities);
      updateModalitiesStatus(modalities);
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }

      console.error('Error fetching DICOM modalities:', error);
    } finally {
      setLoadingModalities(false);
    }
  }, [orthancRepository]);

  /**
   * Update modalities status
   *
   * @param modalities
   */
  const updateModalitiesStatus = async (modalities: DICOMModalities[]) => {
    const updatedModalities = [...modalities];
    const modalityPromises = modalities.map(async (modality, index) => {
      try {
        await orthancRepository.TriggerDICOMEchoSCU({ modalityId: modality.id });
        updatedModalities[index] = { ...modality, status: 'Connected' };
      } catch (error) {
        if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
          showAlert(error.message, 'error');

          setTimeout(() => {
            logoutUser(navigate, tenantId);
          }, 3000);
        }
        console.error(`Error triggering DICOM Echo for modality ${modality.id}:`, error);
        updatedModalities[index] = { ...modality, status: 'Disconnected' };
      }
      setDICOMModalities([...updatedModalities]);
    });

    await Promise.all(modalityPromises);
  };

  /**
   * Fetch inference models
   */
  const fetchInferenceModels = useCallback(async () => {
    try {
      const response = await inferenceRepository.GetInferenceModels();

      // transform the data without modifying the original response and sort by createdAt
      const transformedData = response.data
        .map(model => ({
          ...model,
          envs: model.envs.map(env => ({ key: env.split('=')[0], value: env.split('=')[1] })),
        }))
        .sort(
          (a, b) =>
            new Date(b.container.startedAt).getTime() - new Date(a.container.startedAt).getTime()
        );

      setInferenceModels(transformedData);
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error('Error fetching inference models:', error);
    }
  }, [inferenceRepository]);

  /**
   * Fetch inference model info
   *
   * @param containerID
   */
  const fetchInferenceModelsInfo = async (containerID: string) => {
    setFetchingInferenceModelInfo(true);
    try {
      const response = await inferenceRepository.GetInferenceModelInfo({ containerID });
      setSelectedInferenceModelInfo(response.data);
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error('Error fetching inference model info:', error);
      showAlert(error.message, 'error');
    }
    setFetchingInferenceModelInfo(false);
  };

  /**
   * Fetch available inference models
   */
  const fetchAvailableInferenceModels = useCallback(async () => {
    try {
      const response = await inferenceRepository.GetInferenceAvailableModels();
      setAvailableInferenceModels(response.data);
    } catch (error) {
      console.error('Error fetching available inference models:', error);
    }
  }, [inferenceRepository]);

  /**
   * Fetch ingestion jobs
   */
  const fetchIngestionJobs = useCallback(async () => {
    try {
      const response = await inferenceRepository.GetInferenceIngestionJobs();
      setIngestionJobs(response.data);
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error('Error fetching inference ingestion jobs:', error);
    }
  }, [inferenceRepository]);

  useEffect(() => {
    // initial fetch
    fetchDICOMModalities();
    setLoadingInferenceModels(true);

    const fetchInitialData = async () => {
      // run independently so each loading state clears as soon as its own fetch resolves
      fetchInferenceModels().then(() => setLoadingInferenceModels(false));
      fetchIngestionJobs().then(() => setLoadingIngestionJobs(false));
      fetchAvailableInferenceModels();
    };
    fetchInitialData();

    // setup polling interval
    const interval = setInterval(() => {
      fetchInferenceModels();
      fetchIngestionJobs();
    }, 15000); // poll every 15 seconds

    setPollingInterval(interval);

    // cleanup function to clear interval when component unmounts
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [
    fetchDICOMModalities,
    fetchInferenceModels,
    fetchAvailableInferenceModels,
    fetchIngestionJobs,
  ]);

  /**
   * Update modality status
   *
   * @param modalityId
   */
  const updateModalityStatus = async (modalityId: string) => {
    setIsRefreshingDICOMModalities(true);
    setDICOMModalities(prevModalities =>
      prevModalities.map(modality =>
        modality.id === modalityId ? { ...modality, status: 'Connecting' } : modality
      )
    );
    try {
      await orthancRepository.TriggerDICOMEchoSCU({ modalityId: modalityId });
      setDICOMModalities(prevModalities =>
        prevModalities.map(modality =>
          modality.id === modalityId ? { ...modality, status: 'Connected' } : modality
        )
      );
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error triggering DICOM Echo for modality ${modalityId}:`, error);
      setDICOMModalities(prevModalities =>
        prevModalities.map(modality =>
          modality.id === modalityId ? { ...modality, status: 'Disconnected' } : modality
        )
      );
    }
    setIsRefreshingDICOMModalities(false);
  };

  /**
   * Add modality
   */
  const addModality = async () => {
    // check if at least one of the targetCFindEnabled, targetCMoveEnabled, or targetCStoreEnabled is true
    if (
      !selectedModality.targetCFindEnabled &&
      !selectedModality.targetCMoveEnabled &&
      !selectedModality.targetCStoreEnabled
    ) {
      showAlert('At least one of C-Find, C-Move, or C-Store must be enabled', 'error');
      return;
    }

    setIsAddingModality(true);
    try {
      const response = await orthancRepository.UpdateDICOMModality({
        modalityId: selectedModality.id,
        aet: selectedModality.aet,
        host: selectedModality.host,
        port: +selectedModality.port,
        cFindEnabled: selectedModality.targetCFindEnabled,
        cMoveEnabled: selectedModality.targetCMoveEnabled,
        cStoreEnabled: selectedModality.targetCStoreEnabled,
      });
      showAlert(response.message, 'success');
      setIsOpenAddEditModalityModal(false);
      clearSelectedModality();
      // fetch updated modalities after successful addition
      fetchDICOMModalities();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error adding modality: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsAddingModality(false);
  };

  /**
   * Add inference model
   */
  const addInferenceModel = async () => {
    setIsAddingInferenceModel(true);
    try {
      // check if name contains special characters except dash
      if (/[^a-zA-Z0-9-.]/.test(selectedInferenceModel.name)) {
        showAlert('Model name can only contain letters, numbers, dashes, and periods', 'error');
        setIsAddingInferenceModel(false);
        return;
      }
      // Check if required fields are empty
      if (
        !selectedInferenceModel.dockerImage ||
        !selectedInferenceModel.outputMode ||
        !selectedInferenceModel.name
      ) {
        showAlert('Docker image, output mode, and name are required', 'error');
        setIsAddingInferenceModel(false);
        return;
      }

      const envs = selectedInferenceModel.envs.map(env => `${env.key}=${env.value}`);
      const response = await inferenceRepository.AddInferenceModel({
        name: selectedInferenceModel.name.trim(), // remove the leading and trailing spaces
        dockerImage: selectedInferenceModel.dockerImage.replace(/\s+/g, ''), // remove all the spaces
        outputMode: selectedInferenceModel.outputMode,
        envs,
      });

      showAlert(response.message, 'success');
      setIsOpenAddEditInferenceModelModal(false);
      clearSelectedInferenceModel();
      fetchInferenceModels();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error adding inference model: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsAddingInferenceModel(false);
  };

  /**
   * Update inference model
   */
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
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error updating inference model: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsUpdatingInferenceModel(false);
  };

  /**
   * Delete inference model
   *
   * @param inferenceModelId
   */
  const deleteInferenceModel = async (inferenceModelId: string) => {
    setDeletingInferenceModel(true);
    try {
      const response = await inferenceRepository.DeleteInferenceModel({ id: inferenceModelId });
      showAlert(response.message, 'success');
      fetchInferenceModels();
      setIsOpenRemoveInferenceModelModal(false);
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error deleting inference model: ${error}`);
      showAlert(error.message, 'error');
    }
    setDeletingInferenceModel(false);
  };

  /**
   * Refresh inference models
   */
  const refreshInferenceModels = () => {
    setLoadingInferenceModels(true);
    const fetchInitialData = async () => {
      await fetchInferenceModels();
      setLoadingInferenceModels(false);
    };
    fetchInitialData();
  };

  /**
   * Refresh ingestion jobs
   */
  const refreshIngestionJobs = () => {
    setLoadingIngestionJobs(true);
    const fetchInitialData = async () => {
      await fetchIngestionJobs();
      setLoadingIngestionJobs(false);
    };
    fetchInitialData();
  };

  /**
   * Start inference model container
   *
   * @param containerID
   */
  const startInferenceModelContainer = async (containerID: string) => {
    setStartingInferenceModelContainer(true);
    try {
      const response = await inferenceRepository.StartInferenceModelContainer({ containerID });
      showAlert(response.message, 'success');
      setSelectedContainerToStartStop('');
      fetchInferenceModels();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error starting inference model container: ${error}`);
      showAlert(error.message, 'error');
    }
    setStartingInferenceModelContainer(false);
  };

  /**
   * Stop inference model container
   *
   * @param containerID
   */
  const stopInferenceModelContainer = async (containerID: string) => {
    setStoppingInferenceModelContainer(true);
    try {
      const response = await inferenceRepository.StopInferenceModelContainer({ containerID });
      showAlert(response.message, 'success');
      setSelectedContainerToStartStop('');
      fetchInferenceModels();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error stopping inference model container: ${error}`);
      showAlert(error.message, 'error');
    }
    setStoppingInferenceModelContainer(false);
  };

  /**
   * Start ingestion job
   *
   * @param id
   */
  const startIngestionJob = async (id: string) => {
    setStartingIngestionJob(true);
    try {
      const response = await inferenceRepository.StartInferenceIngestionJob({ id });
      showAlert(response.message, 'success');
      setSelectedIngestionJobToStartStop('');
      fetchIngestionJobs();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error starting ingestion job: ${error}`);
      showAlert(error.message, 'error');
    }
    setStartingIngestionJob(false);
  };

  /**
   * Stop ingestion job
   *
   * @param id
   */
  const stopIngestionJob = async (id: string) => {
    setStoppingIngestionJob(true);
    try {
      const response = await inferenceRepository.StopInferenceIngestionJob({ id });
      showAlert(response.message, 'success');
      setSelectedIngestionJobToStartStop('');
      fetchIngestionJobs();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error stopping ingestion job: ${error}`);
      showAlert(error.message, 'error');
    }
    setStoppingIngestionJob(false);
  };

  /**
   * Delete ingestion job
   */
  const deleteIngestionJob = async () => {
    setIsDeletingIngestionJob(true);
    try {
      const response = await inferenceRepository.DeleteInferenceIngestionJob({
        id: selectedIngestionJobId,
      });
      showAlert(response.message, 'success');
      setIsOpenRemoveIngestionJobModal(false);
      setSelectedIngestionJobId('');
      fetchIngestionJobs();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error deleting ingestion job: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsDeletingIngestionJob(false);
  };

  /**
   * Check if the file is a CSV file
   *
   * @param file
   * @returns
   */
  const isCSVFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv')) {
      return false;
    }
    const type = file.type.toLowerCase();
    if (!type) {
      return true;
    }
    return type === 'text/csv' || type === 'application/csv' || type === 'text/plain';
  };

  /**
   * Handle import ingestion jobs CSV
   *
   * @param event
   */
  const handleImportIngestionJobsCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!isCSVFile(file)) {
      showAlert('Only CSV files are allowed.', 'error');
      return;
    }

    setIsImportingIngestionJobs(true);
    try {
      const response = await inferenceRepository.ImportInferenceIngestionJobs({ file });
      showAlert(response.message, 'success');
      fetchIngestionJobs();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error importing ingestion jobs CSV: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsImportingIngestionJobs(false);
  };

  /**
   * Update modality
   *
   * @param modalityId
   */
  const updateModality = async () => {
    // check if at least one of the targetCFindEnabled, targetCMoveEnabled, or targetCStoreEnabled is true
    if (
      !selectedModality.targetCFindEnabled &&
      !selectedModality.targetCMoveEnabled &&
      !selectedModality.targetCStoreEnabled
    ) {
      showAlert('At least one of C-Find, C-Move, or C-Store must be enabled', 'error');
      return;
    }

    setIsUpdatingModality(true);
    try {
      const response = await orthancRepository.UpdateDICOMModality({
        modalityId: selectedModality.id,
        aet: selectedModality.aet,
        host: selectedModality.host,
        port: +selectedModality.port,
        cFindEnabled: selectedModality.targetCFindEnabled,
        cMoveEnabled: selectedModality.targetCMoveEnabled,
        cStoreEnabled: selectedModality.targetCStoreEnabled,
      });
      showAlert(response.message, 'success');
      setIsOpenAddEditModalityModal(false);
      clearSelectedModality();
      setIsAddModality(true);
      // fetch updated modalities after successful update
      fetchDICOMModalities();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error updating modality: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsUpdatingModality(false);
  };

  /**
   * Remove modality
   *
   * @param modalityId
   */
  const removeModality = async () => {
    setIsRemovingModality(true);
    try {
      const response = await orthancRepository.RemoveDICOMModality({
        modalityId: selectedModalityToRemove,
      });
      showAlert(response.message, 'success');
      setIsOpenRemoveModalityModal(false);
      fetchDICOMModalities();

      // check if the deleted modality is the same as the one in localStorage
      const storedDICOMModality = localStorage.getItem('selectedDICOMModality');
      if (storedDICOMModality === selectedModalityToRemove) {
        localStorage.removeItem('selectedDICOMModality');
      }
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error removing modality: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsRemovingModality(false);
  };

  /**
   * Reset ingestion job form
   */
  const resetIngestionJobForm = () => {
    setNewJobModel(null);
    setNewJobModalities([]);
    setNewJobInterval(String(minIngestionJobIntervalMinutes));
    setNewJobScheduleType('always');
    setNewJobStartDate(null);
    setNewJobEndDate(null);
    setNewJobFocusedInput(null);
    setNewJobDicomModality('');
    setNewJobStartTime('00:00');
    setNewJobEndTime('23:59');
  };

  /**
   * Build timestamp from date and time
   *
   * @param date
   * @param time
   * @returns
   */
  const buildTimestampFromDateAndTime = (date: moment.Moment | null, time: string): number => {
    if (!date) {
      return 0;
    }
    const [hours, minutes] = time.split(':').map(Number);
    return date.clone().startOf('day').hours(hours).minutes(minutes).unix();
  };

  /**
   * Handle save ingestion job
   */
  const handleSaveIngestionJob = async () => {
    if (!newJobDicomModality) {
      showAlert('DICOM Modality is required', 'error');
      return;
    }
    if (!newJobModel) {
      showAlert('Model is required', 'error');
      return;
    }
    if (newJobModalities.length === 0) {
      showAlert('At least one modality must be selected', 'error');
      return;
    }
    const parsedInterval = parseInt(newJobInterval.trim(), 10);
    if (
      newJobInterval.trim() === '' ||
      isNaN(parsedInterval) ||
      parsedInterval < minIngestionJobIntervalMinutes
    ) {
      showAlert(
        `Interval is required and must be at least ${minIngestionJobIntervalMinutes} minutes`,
        'error'
      );
      return;
    }
    if (newJobScheduleType === 'dateRange' && (!newJobStartDate || !newJobEndDate)) {
      showAlert('Both start and end dates are required for a date range schedule', 'error');
      return;
    }

    const selectedModel = availableInferenceModels.find(m => m.containerId === newJobModel.value);

    if (isAddIngestionJob && !selectedModel) {
      showAlert('Selected model not found. Please try again.', 'error');
      return;
    }

    const scheduleStartTimestamp =
      newJobScheduleType === 'dateRange'
        ? buildTimestampFromDateAndTime(newJobStartDate, newJobStartTime)
        : 0;
    const scheduleEndTimestamp =
      newJobScheduleType === 'dateRange'
        ? buildTimestampFromDateAndTime(newJobEndDate, newJobEndTime)
        : 0;

    if (newJobScheduleType === 'dateRange' && scheduleStartTimestamp >= scheduleEndTimestamp) {
      showAlert('Start date/time must be before end date/time', 'error');
      return;
    }

    setIsSavingIngestionJob(true);
    try {
      if (isAddIngestionJob) {
        const response = await inferenceRepository.CreateInferenceIngestionJob({
          dicomModality: newJobDicomModality,
          containerId: selectedModel.containerId,
          modelId: selectedModel.modelId,
          modelName: selectedModel.modelName,
          modelVersion: selectedModel.version,
          modalities: newJobModalities.map(m => m.value),
          intervalInMinutes: parsedInterval,
          scheduleStartTimestamp,
          scheduleEndTimestamp,
        });
        showAlert(response.message, 'success');
      } else {
        const response = await inferenceRepository.UpdateInferenceIngestionJob({
          id: selectedIngestionJobId,
          modalities: newJobModalities.map(m => m.value),
          intervalInMinutes: parsedInterval,
          scheduleStartTimestamp,
          scheduleEndTimestamp,
        });
        showAlert(response.message, 'success');
      }
      setIsOpenAddEditIngestionJobModal(false);
      setIsAddIngestionJob(true);
      setSelectedIngestionJobId('');
      resetIngestionJobForm();
      fetchIngestionJobs();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error saving ingestion job: ${error}`);
      showAlert(error.message, 'error');
    } finally {
      setIsSavingIngestionJob(false);
    }
  };

  /**
   * Modality badges
   *
   * @param modalities
   * @returns
   */
  const ModalityBadges = ({ modalities }: { modalities: string[] }) => {
    const visible = modalities.slice(0, 3);
    const overflow = modalities.slice(3);
    const [tooltipVisible, setTooltipVisible] = React.useState(false);
    const badgeRef = React.useRef<HTMLSpanElement>(null);

    const getTooltipPosition = () => {
      if (badgeRef.current) {
        const rect = badgeRef.current.getBoundingClientRect();
        return {
          top: `${rect.top - 8}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
        };
      }
      return {};
    };

    return (
      <div className="flex flex-wrap items-center gap-1">
        {visible.map(mod => (
          <span
            key={mod}
            className="rounded-full bg-white bg-opacity-10 px-2 py-0.5 text-xs text-white"
          >
            {mod}
          </span>
        ))}
        {overflow.length > 0 && (
          <>
            <span
              ref={badgeRef}
              className="cursor-default rounded-full bg-white bg-opacity-10 px-2 py-0.5 text-xs text-white"
              onMouseEnter={() => setTooltipVisible(true)}
              onMouseLeave={() => setTooltipVisible(false)}
            >
              {overflow.length + 3}+
            </span>
            {tooltipVisible &&
              createPortal(
                <div
                  className="fixed z-[9999] rounded-lg border border-white border-opacity-10 bg-[#1e2320] p-2 shadow-lg"
                  style={getTooltipPosition()}
                >
                  <div className="flex flex-wrap gap-1">
                    {overflow.map(mod => (
                      <span
                        key={mod}
                        className="rounded-full bg-white bg-opacity-10 px-2 py-0.5 text-xs text-white"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>,
                document.body
              )}
          </>
        )}
      </div>
    );
  };

  /**
   * Clear selected modality
   */
  const clearSelectedModality = () => {
    setSelectedModality({
      id: '',
      aet: '',
      host: '',
      port: '',
      status: '',
      targetCFindEnabled: false,
      targetCMoveEnabled: false,
      targetCStoreEnabled: false,
    });
  };

  /**
   * Clear selected modality
   */
  const clearSelectedInferenceModel = () => {
    setSelectedInferenceModel({
      id: '',
      name: '',
      dockerImage: '',
      tenantId: '',
      outputMode: '',
      envs: [],
      createdAt: 0,
      updatedAt: 0,
      container: {
        id: '',
        name: '',
        status: '',
        running: false,
        startedAt: 0,
        finishedAt: 0,
        cpuPercentUsage: 0,
        memoryInBytes: 0,
      },
      disallowedDICOMTags: [],
    });
  };

  /**
   * Table action button
   *
   * @param param0 row
   * @returns
   */
  const DICOMActionButton = ({ row }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = event => {
        if (
          buttonRef.current &&
          !buttonRef.current.contains(event.target) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    const getDropdownPosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        return {
          top: `${rect.top - 10}px`,
          right: `${window.innerWidth - rect.left}px`,
        };
      }
      return {};
    };

    return (
      <div className="relative flex items-center justify-center">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
        >
          <img
            src={dotsVertical}
            alt="Dots vertical icon"
          />
        </button>
        {isOpen &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-50 w-28 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
              style={getDropdownPosition()}
            >
              <ul className="py-2 text-sm text-white">
                <li>
                  <button
                    className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
                    onClick={() => {
                      setSelectedModality(row);
                      setIsAddModality(false);
                      setIsOpenAddEditModalityModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {t('Edit')}
                  </button>
                </li>
                <li>
                  <button
                    className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
                    onClick={() => {
                      setSelectedModalityToRemove(row.id);
                      setIsOpenRemoveModalityModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {t('Delete')}
                  </button>
                </li>
              </ul>
            </div>,
            document.body
          )}
      </div>
    );
  };

  /**
   * Get DICOM tags name
   *
   * @param tag
   * @returns
   */
  const getDICOMTagsName = tag => {
    // create a dictionary instance
    const dictionary = new DataElementDictionary();
    // lookup the element by tag
    const element = dictionary.lookup(tag);

    // return the name or a fallback value if the tag is not found
    return element ? element.name : 'Unknown Tag';
  };

  /**
   * Inference model action button
   *
   * @param row
   * @returns
   */
  const InferenceModelActionButton = ({ row }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = event => {
        if (
          buttonRef.current &&
          !buttonRef.current.contains(event.target) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    const getDropdownPosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        return {
          top: `${rect.top - 10}px`,
          right: `${window.innerWidth - rect.left}px`,
        };
      }
      return {};
    };

    return (
      <div className="relative flex items-center justify-center">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
        >
          <img
            src={dotsVertical}
            alt="Dots vertical icon"
          />
        </button>
        {isOpen &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-50 w-36 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
              style={getDropdownPosition()}
            >
              <ul className="py-2 text-sm text-white">
                <li>
                  <button
                    className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
                    onClick={() => {
                      fetchInferenceModelsInfo(row.container.id);
                      setSelectedInferenceModel(row);
                      setIsAddInferenceModel(false);
                      setIsViewInferenceModel(false);
                      setIsOpenAddEditInferenceModelModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {t('Edit')}
                  </button>
                </li>
                <li>
                  <button
                    className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
                    onClick={() => {
                      setSelectedInferenceModel(row);
                      setIsAddInferenceModel(false);
                      setIsViewInferenceModel(true);
                      setIsOpenAddEditInferenceModelModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {t('View Instance')}
                  </button>
                </li>
                {row.container.status === InferenceContainerStatus.RUNNING && (
                  <li>
                    <button
                      className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
                      onClick={() => {
                        handleViewModelFacts(row.container.id);
                      }}
                    >
                      {t('View Model Facts')}
                    </button>
                  </li>
                )}
                <li>
                  {deletingInferenceModel ? (
                    <img
                      src={refreshIcon}
                      alt="Refresh icon"
                      className="mx-2 h-5 w-5 animate-spin"
                    />
                  ) : (
                    <button
                      className="block w-full cursor-pointer px-4 py-2 text-left text-red-500 hover:bg-gray-700"
                      onClick={() => {
                        setSelectedInferenceModelToRemove(row.id);
                        setIsOpenRemoveInferenceModelModal(true);
                        setIsOpen(false);
                      }}
                    >
                      {t('Delete')}
                    </button>
                  )}
                </li>
              </ul>
            </div>,
            document.body
          )}
      </div>
    );
  };

  /**
   * Inhestion job action
   */
  const IngestionJobActionButton = ({ row }: { row: GetInferenceIngestionJobsResponse }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = event => {
        if (
          buttonRef.current &&
          !buttonRef.current.contains(event.target) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getDropdownPosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        return {
          top: `${rect.top - 10}px`,
          right: `${window.innerWidth - rect.left}px`,
        };
      }
      return {};
    };

    return (
      <div className="relative flex items-center justify-center">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
        >
          <img
            src={dotsVertical}
            alt="Dots vertical icon"
            className="h-4 w-4"
          />
        </button>
        {isOpen &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-50 w-28 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
              style={getDropdownPosition()}
            >
              <ul className="py-2 text-sm text-white">
                <li>
                  <button
                    className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
                    onClick={() => {
                      // Populate form for editing
                      const matchedModel = availableInferenceModels.find(
                        m => m.containerId === row.containerId
                      );
                      setNewJobModel(
                        matchedModel
                          ? {
                              value: matchedModel.containerId,
                              label: `${matchedModel.modelName} - ${matchedModel.version}`,
                            }
                          : {
                              value: row.modelName,
                              label: `${row.modelName} - ${row.modelVersion}`,
                            }
                      );
                      setNewJobDicomModality(row.dicomModality || '');
                      setNewJobModalities(row.modalities.map(m => ({ value: m, label: m })));
                      const existingInterval = Number(row.intervalInMinutes);
                      setNewJobInterval(
                        String(
                          !Number.isFinite(existingInterval) || existingInterval <= 0
                            ? minIngestionJobIntervalMinutes
                            : existingInterval
                        )
                      );
                      if (!row.scheduleStartTimestamp && !row.scheduleEndTimestamp) {
                        setNewJobScheduleType('always');
                        setNewJobStartDate(null);
                        setNewJobEndDate(null);
                        setNewJobStartTime('00:00');
                        setNewJobEndTime('23:59');
                      } else {
                        setNewJobScheduleType('dateRange');
                        const startMoment = row.scheduleStartTimestamp
                          ? moment.unix(row.scheduleStartTimestamp)
                          : null;
                        const endMoment = row.scheduleEndTimestamp
                          ? moment.unix(row.scheduleEndTimestamp)
                          : null;
                        setNewJobStartDate(startMoment);
                        setNewJobEndDate(endMoment);
                        setNewJobStartTime(startMoment ? startMoment.format('HH:mm') : '00:00');
                        setNewJobEndTime(endMoment ? endMoment.format('HH:mm') : '23:59');
                      }
                      setSelectedIngestionJobId(row.id);
                      setIsAddIngestionJob(false);
                      setIsOpenAddEditIngestionJobModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {t('Edit')}
                  </button>
                </li>
                <li>
                  <button
                    className="block w-full cursor-pointer px-4 py-2 text-left text-red-500 hover:bg-gray-700"
                    onClick={() => {
                      setSelectedIngestionJobId(row.id);
                      setIsOpenRemoveIngestionJobModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {t('Delete')}
                  </button>
                </li>
              </ul>
            </div>,
            document.body
          )}
      </div>
    );
  };

  /**
   * Copy to clipboard button
   *
   * @param text
   */
  const CopyToClipboardButton = ({ text }) => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(text).then(() => {
        showAlert('Copy to clipboard success', 'success');
      });
    };

    return (
      <button className="p-0 focus:ring-0">
        <img
          src={copyIcon}
          alt="Copy icon"
          className="ml-2 h-5 w-5 cursor-pointer"
          onClick={copyToClipboard}
        />
      </button>
    );
  };

  /**
   * Handle select model
   *
   * @param model
   */
  const handleViewModelFacts = async (containerID: string) => {
    setIsOpenModelFactsModal(true);
    try {
      const response = await inferenceRepository.GetInferenceModelFacts({
        containerID,
      });
      setSelectedAIModel(response.data.en);
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      setIsOpenModelFactsModal(false);
      console.error('Error fetching inference model facts:', error);
      showAlert(error.message, 'error');
    }
  };

  const handleInferenceModelTableRowClick = rowData => {
    setSelectedInferenceModel(rowData);
    setIsAddInferenceModel(false);
    setIsViewInferenceModel(true);
    setIsOpenAddEditInferenceModelModal(true);
  };

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815]">
        <SidebarAdmin />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Workspace Settings" />
          <div className="mb-5 rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            {tenantInfo.name ? (
              <div>
                <h1 className="text-2xl text-white">{tenantInfo.name}</h1>
                <div className="flex flex-col text-sm font-light text-white text-opacity-70 sm:flex-row sm:items-center">
                  <div className="flex items-center sm:ml-1">
                    {tenantInfo.id}
                    <CopyToClipboardButton text={tenantInfo.id} />
                  </div>
                </div>
              </div>
            ) : (
              <div
                role="tenantInfo"
                className={`grid max-w-full animate-pulse grid-cols-9 gap-4`}
              >
                <div>
                  <div className='className="mb-2 mb-2 h-7 w-[250px] rounded-lg bg-gray-200 bg-opacity-30'></div>
                  <div className='className="mb-2 mb-2 h-2 w-[150px] rounded-lg bg-gray-200 bg-opacity-30'></div>
                </div>
              </div>
            )}
            {/* divider */}
            <div className="my-5 h-px w-full bg-white bg-opacity-10"></div>
            {/* user onboarding */}
            <div className="mb-6">
              <Typography
                variant="h6"
                component="h2"
                className="mb-3 font-semibold text-white"
              >
                {t('User Onboarding')}
              </Typography>
              <div className="rounded-xl border border-white border-opacity-10 bg-[#1a1c1a] p-5">
                <div className="flex flex-col border-b border-white border-opacity-10 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white">{t('Registration')}</div>
                    <p className="mt-1 text-sm text-white text-opacity-70">
                      {t('Enable registration for new users')}
                    </p>
                  </div>
                  <div className="mt-3 flex shrink-0 justify-end sm:mt-0">
                    {onboardingToggleButton(
                      registrationEnabled,
                      handleToggleOnboardingRegistration,
                      'toggle-registration',
                      isUpdatingOnboardingRegistration
                    )}
                  </div>
                </div>
                <div className="flex flex-col pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white">{t('Informed Consent')}</div>
                    <p className="mt-1 text-sm text-white text-opacity-70">
                      {t('Enable informed consent for new users')}
                    </p>
                  </div>
                  <div className="mt-3 flex shrink-0 justify-end sm:mt-0">
                    {onboardingToggleButton(
                      informedConsentEnabled,
                      handleToggleOnboardingConsent,
                      'toggle-informed-consent',
                      isUpdatingOnboardingConsent
                    )}
                  </div>
                </div>
                {informedConsentEnabled && (
                  <div className="mt-4 flex w-full flex-col gap-2 rounded-lg border border-white/10 bg-[#2a2f2a] px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                    <span
                      className="text-opacity-85 min-w-0 flex-1 truncate text-sm text-white"
                      title={tenantInfo.onboardingConsentLink || undefined}
                    >
                      {tenantInfo.onboardingConsentLink?.trim() || t('No consent URL configured')}
                    </span>
                    <button
                      type="button"
                      disabled={!tenantInfo.onboardingConsentLink?.trim()}
                      onClick={() => {
                        const url = tenantInfo.onboardingConsentLink?.trim();
                        if (url) {
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#2f4d2f] bg-[#3f523f] px-4 py-2 text-sm font-semibold text-[#a5e06f] transition-colors hover:bg-[#4a5e4a] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('DocuSign Preview')}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* DICOM modality data */}
            <div>
              <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                <h1 className="text-xl text-white">{t('DICOM (Orthanc)')}</h1>
                <Button
                  className="h-[35px] rounded-lg"
                  onClick={() => setIsOpenAddEditModalityModal(true)}
                >
                  {t('New Modality')}
                </Button>
              </div>
            </div>
            {/* DICOM table container */}
            <div className="bg-transparent py-5">
              {loadingModalities ? (
                <div
                  role="status"
                  className={`grid max-w-full animate-pulse grid-cols-5 gap-4`}
                >
                  {Array.from({ length: 5 }, (_, c) => (
                    <div key={c}>
                      {Array.from({ length: 3 }, (_, r) => (
                        <div key={r}>
                          <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                          <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                          <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                          <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : dicomModalities.length > 0 ? (
                <Table
                  headers={dicomHeaders}
                  data={dicomModalities}
                  className={'max-w-[170px]'}
                >
                  {(cell, header, row) => {
                    // aet
                    if (header.value === 'aet') {
                      return <div className="w-[250px] text-white">{cell}</div>;
                    }
                    // host
                    if (header.value === 'host') {
                      return <div className="w-[200px] text-white">{cell}</div>;
                    }
                    // port
                    if (header.value === 'port') {
                      return <div className="w-[200px] text-white">{cell}</div>;
                    }
                    // status
                    if (header.value === 'status') {
                      return (
                        <div className="flex min-w-[100px] items-center gap-2">
                          <div
                            className={`inline-flex h-[27px] items-center justify-center rounded-full px-2 ${
                              cell === 'Connected'
                                ? 'bg-[#6ED47C] bg-opacity-20 text-[#6ED47C]'
                                : cell === 'Disconnected'
                                  ? 'bg-red-300 bg-opacity-10 text-red-500'
                                  : 'bg-yellow-300 bg-opacity-10 text-yellow-500'
                            }`}
                          >
                            <span>{cell}</span>
                          </div>
                          {cell !== 'Connecting' && (
                            <button
                              className="h-[27px] w-[27px] rounded-full bg-white bg-opacity-10 p-1.5 focus:ring-0"
                              onClick={() => updateModalityStatus(row.id)}
                            >
                              <img
                                src={refreshIcon}
                                alt="refresh icon"
                                className={`${isRefreshingDICOMModalities ? '' : ''}`}
                              />
                            </button>
                          )}
                        </div>
                      );
                    }
                    // targetCFindEnabled
                    if (header.value === 'targetCFindEnabled') {
                      return (
                        <div className="w-[100px] text-white">{cell ? 'Enabled' : 'Disabled'}</div>
                      );
                    }
                    // targetCMoveEnabled
                    if (header.value === 'targetCMoveEnabled') {
                      return (
                        <div className="w-[100px] text-white">{cell ? 'Enabled' : 'Disabled'}</div>
                      );
                    }
                    // targetCStoreEnabled
                    if (header.value === 'targetCStoreEnabled') {
                      return (
                        <div className="w-[100px] text-white">{cell ? 'Enabled' : 'Disabled'}</div>
                      );
                    }
                    // action
                    if (header.value === 'action') {
                      return <DICOMActionButton row={row} />;
                    }
                    return cell;
                  }}
                </Table>
              ) : (
                <p className="text-center text-white opacity-60">{t('No Data Found')}</p>
              )}
            </div>
            {/* divider */}
            <div className="my-5 h-px w-full bg-white bg-opacity-10"></div>
            {/* Inference models data */}
            <div>
              <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                <h1 className="text-xl text-white">{t('Inference Models')}</h1>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingInferenceModels}
                    className="flex h-[35px] items-center gap-2 rounded-full bg-white bg-opacity-10 px-3"
                    onClick={() => refreshInferenceModels()}
                  >
                    <img
                      src={refreshIcon}
                      alt="Refresh icon"
                      className={`${loadingInferenceModels ? 'animate-spin' : ''} h-4 w-4`}
                    />
                    <span
                      className={`text-white ${
                        loadingInferenceModels ? 'opacity-40' : ''
                      } text-[14px]`}
                    >
                      {t('Refresh')}
                    </span>
                  </button>
                  <Button
                    className="h-[35px] rounded-lg"
                    onClick={() => setIsOpenAddEditInferenceModelModal(true)}
                  >
                    {t('New Model')}
                  </Button>
                </div>
              </div>
            </div>
            {/* Inference models table container */}
            <div className="bg-transparent py-5">
              {loadingInferenceModels ? (
                <div
                  role="status"
                  className={`grid max-w-full animate-pulse grid-cols-5 gap-4`}
                >
                  {Array.from({ length: 5 }, (_, c) => (
                    <div key={c}>
                      {Array.from({ length: 3 }, (_, r) => (
                        <div key={r}>
                          <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                          <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                          <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                          <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : inferenceModels.length > 0 ? (
                <Table
                  headers={inferenceModelHeaders}
                  data={inferenceModels}
                  className={'max-w-[170px]'}
                >
                  {(cell, header, row) => {
                    if (header.value === 'containerId') {
                      return (
                        <div className="w-[250px] text-white">
                          {row.container.id?.substring(0, 12) || ''}
                        </div>
                      );
                    }
                    if (header.value === 'name') {
                      return <div className="w-[250px] text-white">{cell}</div>;
                    }
                    if (header.value === 'version') {
                      return (
                        <div className="w-[200px] text-white">
                          {row.dockerImage?.split(':')[1] || ''}
                        </div>
                      );
                    }
                    if (header.value === 'dockerImage') {
                      return <div className="w-[200px] text-white">{cell}</div>;
                    }
                    // status
                    if (header.value === 'status') {
                      const statusColor = containerStatusColors[
                        row.container.status.toLowerCase()
                      ] || {
                        bg: 'bg-gray-300',
                        bgOpacity: 'bg-opacity-20',
                        text: 'text-gray-300',
                        dot: 'bg-gray-300',
                      };

                      return (
                        <div className="flex min-w-[100px] items-center gap-2">
                          <div
                            className={`inline-flex h-[27px] items-center justify-center gap-1 rounded-full px-2 ${statusColor.bg} ${statusColor.bgOpacity} ${statusColor.text}`}
                          >
                            <span className="capitalize">{row.container.status}</span>
                            <div className={`h-1 w-1 rounded-full ${statusColor.dot}`}></div>
                          </div>
                        </div>
                      );
                    }
                    if (header.value === 'cpu') {
                      return (
                        <div className="w-[200px] text-white">
                          {row.container.cpuPercentUsage
                            ? `${row.container.cpuPercentUsage.toFixed(3)}%`
                            : '-'}
                        </div>
                      );
                    }
                    // action
                    if (header.value === 'action') {
                      return (
                        <div
                          className="flex items-center justify-center gap-2"
                          onClick={e => e.stopPropagation()}
                        >
                          {row.container.status === InferenceContainerStatus.RUNNING ? (
                            <button
                              onClick={() => {
                                stopInferenceModelContainer(row.container.id);
                                setSelectedContainerToStartStop(row.container.id);
                              }}
                            >
                              {stoppingInferenceModelContainer &&
                              selectedContainerToStartStop === row.container.id ? (
                                <img
                                  src={refreshIcon}
                                  alt="Refresh icon"
                                  className="h-4 w-4 animate-spin"
                                />
                              ) : (
                                <img
                                  src={stopIcon}
                                  alt="Stop icon"
                                />
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                startInferenceModelContainer(row.container.id);
                                setSelectedContainerToStartStop(row.container.id);
                              }}
                            >
                              {startingInferenceModelContainer &&
                              selectedContainerToStartStop === row.container.id ? (
                                <img
                                  src={refreshIcon}
                                  alt="Refresh icon"
                                  className="h-4 w-4 animate-spin"
                                />
                              ) : (
                                <img
                                  src={playIcon}
                                  alt="Play icon"
                                />
                              )}
                            </button>
                          )}
                          <InferenceModelActionButton row={row} />
                        </div>
                      );
                    }
                    return cell;
                  }}
                </Table>
              ) : (
                <p className="text-center text-white opacity-60">{t('No Data Found')}</p>
              )}
            </div>
            {/* divider */}
            <div className="my-5 h-px w-full bg-white bg-opacity-10"></div>
            {/* Inference ingestion service data */}
            <div>
              <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                <h1 className="text-xl text-white">{t('Inference Ingestion Service')}</h1>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingIngestionJobs}
                    className="flex h-[35px] items-center gap-2 rounded-full bg-white bg-opacity-10 px-3"
                    onClick={() => refreshIngestionJobs()}
                  >
                    <img
                      src={refreshIcon}
                      alt="Refresh icon"
                      className={`${loadingIngestionJobs ? 'animate-spin' : ''} h-4 w-4`}
                    />
                    <span
                      className={`text-white ${loadingIngestionJobs ? 'opacity-40' : ''} text-[14px]`}
                    >
                      {t('Refresh')}
                    </span>
                  </button>
                  <input
                    ref={ingestionJobsCsvInputRef}
                    type="file"
                    accept=".csv,text/csv,application/csv,text/plain"
                    className="hidden"
                    onChange={handleImportIngestionJobsCsv}
                  />
                  <button
                    type="button"
                    disabled={loadingIngestionJobs || isImportingIngestionJobs}
                    className="border-primary text-primary h-[35px] rounded-lg border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => ingestionJobsCsvInputRef.current?.click()}
                  >
                    {isImportingIngestionJobs ? '...' : t('Import CSV')}
                  </button>
                  <Button
                    className="h-[35px] rounded-lg px-6"
                    onClick={() => setIsOpenAddEditIngestionJobModal(true)}
                  >
                    {t('Add Job')}
                  </Button>
                </div>
              </div>
            </div>
            {/* Inference ingestion service table container */}
            <div className="bg-transparent py-5">
              {loadingIngestionJobs ? (
                <div
                  role="status"
                  className={`grid max-w-full animate-pulse grid-cols-5 gap-4`}
                >
                  {Array.from({ length: 5 }, (_, c) => (
                    <div key={c}>
                      {Array.from({ length: 3 }, (_, r) => (
                        <div key={r}>
                          <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                          <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                          <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                          <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : ingestionJobs.length > 0 ? (
                <Table
                  headers={inferenceIngestionServiceHeaders}
                  data={ingestionJobs}
                  className={'max-w-[170px]'}
                >
                  {(cell, header, row) => {
                    if (header.value === 'jobId') {
                      return <div className="w-[120px] font-mono text-sm text-white">{row.id}</div>;
                    }
                    if (header.value === 'model') {
                      return (
                        <div className="w-[260px] space-x-1 text-white">
                          <span>{row.modelName}</span>
                          <span>-</span>
                          <span>{row.modelVersion}</span>
                        </div>
                      );
                    }
                    if (header.value === 'dicomModality') {
                      return <div className="w-[140px] text-white">{row.dicomModality || '-'}</div>;
                    }
                    if (header.value === 'modalities') {
                      return (
                        <div className="w-[200px]">
                          <ModalityBadges modalities={row.modalities} />
                        </div>
                      );
                    }
                    if (header.value === 'interval') {
                      return (
                        <div className="w-[80px] text-white">{row.intervalInMinutes} minutes</div>
                      );
                    }
                    if (header.value === 'schedule') {
                      const hasRange = row.scheduleStartTimestamp || row.scheduleEndTimestamp;
                      return (
                        <div className="w-[160px] text-sm text-white">
                          {hasRange ? (
                            <div>
                              <div>
                                {moment
                                  .unix(row.scheduleStartTimestamp)
                                  .format('MMM D, YYYY HH:mm')}{' '}
                                -{' '}
                                {moment.unix(row.scheduleEndTimestamp).format('MMM D, YYYY HH:mm')}
                              </div>
                            </div>
                          ) : (
                            'Always'
                          )}
                        </div>
                      );
                    }
                    if (header.value === 'status') {
                      const statusColor = containerStatusColors[row.status?.toLowerCase()] || {
                        bg: 'bg-gray-300',
                        bgOpacity: 'bg-opacity-20',
                        text: 'text-gray-300',
                        dot: 'bg-gray-300',
                      };
                      return (
                        <div className="flex min-w-[100px] items-center gap-2">
                          <div
                            className={`inline-flex h-[27px] items-center justify-center gap-1 rounded-full px-2 ${statusColor.bg} ${statusColor.bgOpacity} ${statusColor.text}`}
                          >
                            <span className="capitalize">{row.status?.toLowerCase() || '-'}</span>
                            <div className={`h-1 w-1 rounded-full ${statusColor.dot}`}></div>
                          </div>
                        </div>
                      );
                    }
                    // action
                    if (header.value === 'action') {
                      return (
                        <div
                          className="flex items-center justify-center gap-2"
                          onClick={e => e.stopPropagation()}
                        >
                          {row.status?.toLowerCase() === InferenceContainerStatus.RUNNING ? (
                            <button
                              onClick={() => {
                                setSelectedIngestionJobToStartStop(row.id);
                                stopIngestionJob(row.id);
                              }}
                            >
                              {stoppingIngestionJob &&
                              selectedIngestionJobToStartStop === row.id ? (
                                <img
                                  src={refreshIcon}
                                  alt="Refresh icon"
                                  className="h-4 w-4 animate-spin"
                                />
                              ) : (
                                <img
                                  src={stopIcon}
                                  alt="Stop icon"
                                />
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedIngestionJobToStartStop(row.id);
                                startIngestionJob(row.id);
                              }}
                            >
                              {startingIngestionJob &&
                              selectedIngestionJobToStartStop === row.id ? (
                                <img
                                  src={refreshIcon}
                                  alt="Refresh icon"
                                  className="h-4 w-4 animate-spin"
                                />
                              ) : (
                                <img
                                  src={playIcon}
                                  alt="Play icon"
                                />
                              )}
                            </button>
                          )}
                          <IngestionJobActionButton row={row} />
                        </div>
                      );
                    }
                    return cell;
                  }}
                </Table>
              ) : (
                <p className="text-center text-white opacity-60">{t('No Data Found')}</p>
              )}
            </div>
          </div>
        </div>
        {/* add and edit modality modal */}
        {isOpenAddEditModalityModal && (
          <Modal
            isOpen={isOpenAddEditModalityModal}
            size="w-[520px] max-w-[520px]"
            isCloseable={true}
            onClose={() => {
              setIsAddModality(true);
              setIsOpenAddEditModalityModal(false);
              clearSelectedModality();
            }}
          >
            <div className="relative">
              <Typography
                variant="h6"
                className="font-light text-white"
              >
                {t(isAddModality ? 'New Modality' : 'Edit Modality')}
              </Typography>
              <Typography
                variant="body"
                className="mt-2 font-light text-white text-opacity-70"
              >
                {t(isAddModality ? 'Add a new DICOM modality.' : 'Update modality information.')}
              </Typography>

              <div className="mt-4">
                <div className="flex flex-col gap-4">
                  <Input
                    id="modalityId"
                    disabled={!isAddModality}
                    placeholder={t('Modality ID')}
                    className="w-full disabled:opacity-50"
                    type="text"
                    autoFocus
                    value={selectedModality.id}
                    onChange={e => {
                      setSelectedModality({ ...selectedModality, id: e.target.value });
                    }}
                  />
                  <Input
                    id="targetAET"
                    placeholder={t('Target AET')}
                    className="w-full"
                    type="text"
                    value={selectedModality.aet}
                    onChange={e => {
                      setSelectedModality({ ...selectedModality, aet: e.target.value });
                    }}
                  />
                  <Input
                    id="host"
                    placeholder={t('Host')}
                    className="w-full"
                    type="text"
                    value={selectedModality.host}
                    onChange={e => {
                      setSelectedModality({ ...selectedModality, host: e.target.value });
                    }}
                  />
                  <Input
                    id="port"
                    placeholder={t('Port')}
                    className="w-full"
                    type="number"
                    value={selectedModality.port}
                    onChange={e => {
                      setSelectedModality({ ...selectedModality, port: e.target.value });
                    }}
                  />
                  {/* Enabled SCUs */}
                  <div>
                    <Typography
                      variant="body"
                      className="mb-2 text-white"
                    >
                      {t('Enabled SCUs')}
                    </Typography>
                    <div className="my-2 flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        id="tag-c-find"
                        checked={selectedModality.targetCFindEnabled}
                        onChange={e => {
                          const isChecked = e.target.checked;
                          setSelectedModality(prev => ({
                            ...prev,
                            targetCFindEnabled: isChecked,
                          }));
                        }}
                        className="accent-primary-light h-4 w-4 cursor-pointer rounded"
                      />
                      <Typography
                        variant="body"
                        component="label"
                        htmlFor="tag-c-find"
                        className="cursor-pointer text-white"
                      >
                        {t('C-Find')}
                      </Typography>
                    </div>
                    <div className="my-2 flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        id="tag-c-move"
                        checked={selectedModality.targetCMoveEnabled}
                        onChange={e => {
                          const isChecked = e.target.checked;
                          setSelectedModality(prev => ({
                            ...prev,
                            targetCMoveEnabled: isChecked,
                          }));
                        }}
                        className="accent-primary-light h-4 w-4 cursor-pointer rounded"
                      />
                      <Typography
                        variant="body"
                        component="label"
                        htmlFor="tag-c-move"
                        className="cursor-pointer text-white"
                      >
                        {t('C-Move')}
                      </Typography>
                    </div>
                    <div className="my-2 flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        id="tag-c-store"
                        checked={selectedModality.targetCStoreEnabled}
                        onChange={e => {
                          const isChecked = e.target.checked;
                          setSelectedModality(prev => ({
                            ...prev,
                            targetCStoreEnabled: isChecked,
                          }));
                        }}
                        className="accent-primary-light h-4 w-4 cursor-pointer rounded"
                      />
                      <Typography
                        variant="body"
                        component="label"
                        htmlFor="tag-c-store"
                        className="cursor-pointer text-white"
                      >
                        {t('C-Store')}
                      </Typography>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex w-full justify-end">
                <Button
                  disabled={isAddingModality || isUpdatingModality}
                  className="h-[41px] w-[111px] rounded-lg"
                  onClick={isAddModality ? addModality : updateModality}
                >
                  {isAddingModality || isUpdatingModality ? '...' : t('Save')}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* add and edit inference model modal */}
        {isOpenAddEditInferenceModelModal && (
          <Modal
            isOpen={isOpenAddEditInferenceModelModal}
            size="w-[520px] max-w-[520px]"
            isCloseable={true}
            onClose={() => {
              setIsAddInferenceModel(true);
              setIsOpenAddEditInferenceModelModal(false);
              setIsViewInferenceModel(false);
              clearSelectedInferenceModel();
            }}
          >
            <div className="relative">
              <Typography
                variant="h6"
                className="font-light text-white"
              >
                {t(
                  isAddInferenceModel
                    ? 'New Inference Model'
                    : isViewInferenceModel
                      ? 'View Inference Model'
                      : 'Edit Inference Model'
                )}
              </Typography>
              <Typography
                variant="body"
                className="mt-2 font-light text-white text-opacity-70"
              >
                {t(
                  isAddInferenceModel
                    ? 'Add a new inference model.'
                    : isViewInferenceModel
                      ? 'View inference model information.'
                      : 'Update inference model information.'
                )}
              </Typography>

              <div className="mt-4">
                <div className="flex flex-col gap-4">
                  {(isViewInferenceModel || !isAddInferenceModel) && (
                    <Input
                      id="inferenceModelId"
                      disabled={true}
                      placeholder={t('Container ID')}
                      className="w-full disabled:opacity-50"
                      type="text"
                      autoFocus
                      value={selectedInferenceModel.container.id}
                      onChange={e => {
                        setSelectedInferenceModel({
                          ...selectedInferenceModel,
                          id: e.target.value,
                        });
                      }}
                    />
                  )}

                  <Input
                    id="inferenceModelName"
                    placeholder={t('Name')}
                    className="w-full disabled:opacity-50"
                    disabled={isViewInferenceModel || !isAddInferenceModel}
                    type="text"
                    value={selectedInferenceModel.name.toLowerCase()}
                    onChange={e => {
                      setSelectedInferenceModel({
                        ...selectedInferenceModel,
                        name: e.target.value.toLowerCase(),
                      });
                    }}
                  />
                  <Input
                    id="inferenceModelImage"
                    placeholder={t('Image')}
                    className="w-full disabled:opacity-50"
                    disabled={isViewInferenceModel || !isAddInferenceModel}
                    type="text"
                    value={selectedInferenceModel.dockerImage}
                    onChange={e => {
                      const sanitizedValue = e.target.value.replace(/\s+/g, ''); // remove all spaces
                      setSelectedInferenceModel({
                        ...selectedInferenceModel,
                        dockerImage: sanitizedValue,
                      });
                    }}
                  />

                  {/* environment variables */}
                  <div className="border-b border-white border-opacity-10 pb-4">
                    <Typography
                      variant="body"
                      className="mb-2 text-white"
                    >
                      {t('Environmental Variables')}
                    </Typography>
                    {isAddInferenceModel && (
                      <div className="flex items-center gap-2">
                        <Input
                          id="environmentalVariablesKey"
                          placeholder={t('Key')}
                          className="h-[43px] w-full disabled:opacity-50"
                          disabled={!isAddInferenceModel}
                          type="text"
                          value={environmentalVariableKey}
                          onChange={e => {
                            setEnvironmentalVariableKey(e.target.value);
                          }}
                        />
                        <Input
                          id="environmentalVariablesValue"
                          placeholder={t('Value')}
                          className="h-[43px] w-full disabled:opacity-50"
                          disabled={!isAddInferenceModel}
                          type="text"
                          value={environmentalVariableValue}
                          onChange={e => {
                            setEnvironmentalVariableValue(e.target.value);
                          }}
                        />
                        <button
                          disabled={isAddingInferenceModel || isUpdatingInferenceModel}
                          className="h-[43px] min-w-[60px] rounded-lg bg-[#C8F469] bg-opacity-10 px-4 text-center"
                          onClick={() => {
                            setSelectedInferenceModel({
                              ...selectedInferenceModel,
                              envs: [
                                ...(selectedInferenceModel.envs?.filter(
                                  env => typeof env === 'object' && 'key' in env
                                ) ?? []),
                                {
                                  key: environmentalVariableKey,
                                  value: environmentalVariableValue,
                                },
                              ],
                            });
                            setEnvironmentalVariableKey('');
                            setEnvironmentalVariableValue('');
                          }}
                        >
                          <span className="text-[#C8F469]"> {t('Add')}</span>
                        </button>
                      </div>
                    )}
                    {/* added environment variables */}
                    <div className="mt-4 flex flex-col gap-2">
                      {isAddInferenceModel ? (
                        selectedInferenceModel.envs?.map((variable, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2"
                          >
                            <Input
                              id={`env-key-${index}`}
                              label=""
                              value={variable.key}
                              className="h-[43px] w-full disabled:opacity-50"
                              disabled={true}
                              type="text"
                            />
                            <Input
                              id={`env-value-${index}`}
                              label=""
                              value={variable.value}
                              className="h-[43px] w-full disabled:opacity-50"
                              disabled={true}
                              type="text"
                            />
                            <button
                              disabled={isAddingInferenceModel || isUpdatingInferenceModel}
                              className="flex h-[43px] w-[60px] items-center justify-center rounded-lg bg-red-500 bg-opacity-10"
                              onClick={() => {
                                setSelectedInferenceModel({
                                  ...selectedInferenceModel,
                                  envs: selectedInferenceModel.envs
                                    .filter(env => typeof env === 'object' && 'key' in env)
                                    .filter((_, i) => i !== index),
                                });
                              }}
                            >
                              <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-red-500 text-red-500">
                                <span className="-mt-[1px] text-xl">{t('-')}</span>
                              </div>
                            </button>
                          </div>
                        ))
                      ) : selectedInferenceModel.envs?.length === 0 ? (
                        <div className="flex h-[50px] items-center justify-center">
                          <Typography className="mb-2 text-white text-opacity-50">
                            {t('No environment variables added')}
                          </Typography>
                        </div>
                      ) : (
                        selectedInferenceModel.envs?.map((variable, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2"
                          >
                            <Input
                              id={`env-key-${index}`}
                              label=""
                              value={variable.key}
                              className="h-[43px] w-full disabled:opacity-50"
                              disabled={true}
                              type="text"
                            />
                            <Input
                              id={`env-value-${index}`}
                              label=""
                              value={variable.value}
                              className="h-[43px] w-full disabled:opacity-50"
                              disabled={true}
                              type="text"
                            />
                          </div>
                        ))
                      )}
                    </div>
                    {isAddInferenceModel && (
                      <Typography
                        variant="body"
                        className="mt-1 text-white text-opacity-50"
                      >
                        <span className="text-red-500">*</span>{' '}
                        {t('Environment Variable should contain at least a key and value.')}
                      </Typography>
                    )}
                  </div>
                  {/* Allowed DICOM Tags */}
                  {!isAddInferenceModel && !isViewInferenceModel && (
                    <div className="border-b border-white border-opacity-10 pb-4">
                      <Typography
                        variant="body"
                        className="mb-2 text-white"
                      >
                        {t('Allowed DICOM Tags')}
                      </Typography>
                      {fetchingInferenceModelInfo ? (
                        <div className="flex items-center justify-center">
                          <img
                            src={refreshIcon}
                            alt="Refresh icon"
                            className="h-5 w-5 animate-spin"
                          />
                        </div>
                      ) : selectedInferenceModelInfo.supportedDicomTags?.[0] === '*' ? (
                        <div className="my-4 flex items-center justify-center gap-2">
                          <Typography
                            variant="body"
                            className="text-center text-white/70"
                          >
                            All metadata are supported
                          </Typography>
                        </div>
                      ) : (
                        selectedInferenceModelInfo.supportedDicomTags?.map((tag, index) => (
                          <div
                            key={index}
                            className="my-2 flex cursor-pointer items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              id={`tag-${index}`}
                              checked={!selectedInferenceModel.disallowedDICOMTags?.includes(tag)}
                              onChange={e => {
                                const isChecked = e.target.checked;
                                setSelectedInferenceModel(prev => ({
                                  ...prev,
                                  disallowedDICOMTags: isChecked
                                    ? prev.disallowedDICOMTags?.filter(t => t !== tag)
                                    : [...(prev.disallowedDICOMTags || []), tag],
                                }));
                              }}
                              className="accent-primary-light h-4 w-4 cursor-pointer rounded"
                            />
                            <Typography
                              variant="body"
                              component="label"
                              htmlFor={`tag-${index}`}
                              className="cursor-pointer text-white"
                            >
                              {tag} ({getDICOMTagsName(tag)})
                            </Typography>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {(isViewInferenceModel || !isAddInferenceModel) && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Typography
                          variant="body"
                          className="text-white text-opacity-70"
                        >
                          {t('Status')}
                        </Typography>
                        <div className="flex min-w-[100px] items-center gap-2">
                          <div
                            className={`inline-flex h-[24px] items-center justify-center gap-1 rounded-full px-2 ${
                              containerStatusColors[
                                selectedInferenceModel.container.status.toLowerCase()
                              ]?.bg || 'bg-gray-300'
                            } ${
                              containerStatusColors[
                                selectedInferenceModel.container.status.toLowerCase()
                              ]?.bgOpacity || 'bg-opacity-20'
                            } ${
                              containerStatusColors[
                                selectedInferenceModel.container.status.toLowerCase()
                              ]?.text || 'text-gray-300'
                            }`}
                          >
                            <span className="text-sm capitalize">
                              {selectedInferenceModel.container.status}
                            </span>
                            <div
                              className={`h-1 w-1 rounded-full ${
                                containerStatusColors[
                                  selectedInferenceModel.container.status.toLowerCase()
                                ]?.dot || 'bg-gray-300'
                              }`}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Typography
                          variant="body"
                          className="text-white text-opacity-70"
                        >
                          {t('CPU%')}
                        </Typography>
                        <div className="flex min-w-[100px] items-center gap-2">
                          <div
                            className={`inline-flex h-[24px] items-center justify-center gap-1 rounded-full bg-[#323631] bg-opacity-10 px-2`}
                          >
                            <span className="text-sm text-white">
                              {selectedInferenceModel.container.cpuPercentUsage.toFixed(3)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <select
                    id="inferenceModelOutputMode"
                    className={`mb-4 block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-[#2D302D] py-3 px-3 pr-8 text-lg leading-tight placeholder:opacity-50 focus:outline-none ${
                      selectedInferenceModel.outputMode ? 'text-white' : 'text-white/40'
                    }`}
                    disabled={isViewInferenceModel}
                    value={selectedInferenceModel.outputMode}
                    onChange={e => {
                      setSelectedInferenceModel({
                        ...selectedInferenceModel,
                        outputMode: e.target.value,
                      });
                    }}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select Output Mode
                    </option>
                    {outputModeOptions.map(option => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {!isViewInferenceModel && (
                <div className="mt-5 flex w-full justify-end">
                  <Button
                    disabled={isAddingInferenceModel || isUpdatingInferenceModel}
                    className="h-[41px] w-[111px] rounded-lg"
                    onClick={isAddInferenceModel ? addInferenceModel : updateInferenceModel}
                  >
                    {isAddingInferenceModel || isUpdatingInferenceModel
                      ? '...'
                      : t(isAddInferenceModel ? 'Add' : 'Update')}
                  </Button>
                </div>
              )}
            </div>
          </Modal>
        )}

        {isOpenModelFactsModal && (
          <ModelFactsModal
            isOpen={isOpenModelFactsModal}
            onClose={() => {
              setIsOpenModelFactsModal(false);
            }}
            data={selectedAIModel}
          />
        )}
        {/* remove modality modal */}
        {isOpenRemoveModalityModal && (
          <Modal
            isOpen={isOpenRemoveModalityModal}
            size="min-w-[400px]"
            isCloseable={true}
            onClose={() => {
              setIsOpenRemoveModalityModal(false);
            }}
          >
            <div className="relative">
              <Typography
                variant="h6"
                className="font-light text-white"
              >
                {t('Remove Modality')}
              </Typography>
              <Typography
                variant="body"
                className="mt-2 font-light text-white text-opacity-70"
              >
                {t('Are you sure you want to delete ')} {selectedModalityToRemove}?
              </Typography>

              <div className="mt-4 flex w-full justify-end">
                <button
                  disabled={isRemovingModality}
                  className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400"
                  onClick={() => setIsOpenRemoveModalityModal(false)}
                >
                  {isRemovingModality ? '...' : t('Cancel')}
                </button>
                <button
                  disabled={isRemovingModality}
                  className="h-[41px] w-[111px] rounded-lg bg-red-700 text-white"
                  onClick={removeModality}
                >
                  {isRemovingModality ? '...' : t('Confirm')}
                </button>
              </div>
            </div>
          </Modal>
        )}
        {/* add/edit ingestion job modal */}
        {isOpenAddEditIngestionJobModal && (
          <Modal
            isOpen={isOpenAddEditIngestionJobModal}
            size="w-[520px] max-w-[520px]"
            isCloseable={true}
            onClose={() => {
              setIsOpenAddEditIngestionJobModal(false);
              setIsAddIngestionJob(true);
              setSelectedIngestionJobId('');
              resetIngestionJobForm();
            }}
          >
            <div className="relative">
              <Typography
                variant="h6"
                className="font-light text-white"
              >
                {t(isAddIngestionJob ? 'Add Ingestion Job' : 'Edit Ingestion Job')}
              </Typography>
              <Typography
                variant="body"
                className="mt-2 font-light text-white text-opacity-70"
              >
                {t(
                  isAddIngestionJob
                    ? 'Set up a new job to ingest and process inference data.'
                    : 'Update the ingestion job configuration.'
                )}
              </Typography>

              <div className="mt-4 flex flex-col gap-4">
                {/* DICOM Modality selector */}
                <select
                  disabled={!isAddIngestionJob}
                  className={`block h-[51px] w-full appearance-none rounded-lg border-none bg-[#2D302D] px-3 py-3 pr-8 text-base leading-tight focus:outline-none ${
                    !isAddIngestionJob ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${newJobDicomModality ? 'text-white' : 'text-white/40'}`}
                  value={newJobDicomModality}
                  onChange={e => setNewJobDicomModality(e.target.value)}
                >
                  <option
                    value=""
                    disabled
                    className="text-white text-opacity-40"
                  >
                    {t('DICOM Modality')}
                  </option>
                  {dicomModalities.map(m => (
                    <option
                      key={m.id}
                      value={m.id}
                    >
                      {m.aet}
                    </option>
                  ))}
                </select>
                {/* Model selector */}
                <select
                  disabled={!isAddIngestionJob}
                  className={`block h-[51px] w-full appearance-none rounded-lg border-none bg-[#2D302D] px-3 py-3 pr-8 text-base leading-tight focus:outline-none ${
                    !isAddIngestionJob ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${newJobModel?.value ? 'text-white' : 'text-white/40'}`}
                  value={newJobModel?.value || ''}
                  onChange={e => {
                    const selected = availableInferenceModels.find(
                      m => m.containerId === e.target.value
                    );
                    setNewJobModel(
                      selected
                        ? {
                            value: selected.containerId,
                            label: `${selected.modelName} - ${selected.version}`,
                          }
                        : null
                    );
                    setNewJobModalities([]);
                  }}
                >
                  <option
                    value=""
                    disabled
                    className="text-white text-opacity-40"
                  >
                    {t('Model')}
                  </option>
                  {availableInferenceModels.map(m => (
                    <option
                      key={m.containerId}
                      value={m.containerId}
                    >
                      {m.modelName} - {m.version}
                    </option>
                  ))}
                </select>

                {/* Modalities multi-select */}
                <div>
                  <select
                    disabled={!isAddIngestionJob}
                    className={`block h-[51px] w-full appearance-none rounded-lg border-none bg-[#2D302D] px-3 py-3 pr-8 text-base leading-tight text-white/40 focus:outline-none ${
                      !isAddIngestionJob ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    }`}
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) {
                        return;
                      }
                      setNewJobModalities(prev =>
                        prev.find(m => m.value === val)
                          ? prev.filter(m => m.value !== val)
                          : [...prev, { value: val, label: val }]
                      );
                    }}
                  >
                    <option
                      value=""
                      disabled
                      className="text-white text-opacity-40"
                    >
                      {t('Select Modalities')}
                    </option>
                    {(
                      availableInferenceModels.find(m => m.containerId === newJobModel?.value)
                        ?.supportedDicomModalities ?? []
                    ).map(m => (
                      <option
                        key={m}
                        value={m}
                      >
                        {newJobModalities.find(mod => mod.value === m) ? `✓ ${m}` : m}
                      </option>
                    ))}
                  </select>
                  {newJobModalities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {newJobModalities.map(mod => (
                        <span
                          key={mod.value}
                          className="flex items-center gap-1 rounded-full bg-[#c8f469] bg-opacity-10 px-3 py-3 text-sm font-medium text-[#c8f469]"
                        >
                          {mod.label}
                          <button
                            type="button"
                            disabled={!isAddIngestionJob}
                            className={`ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#c8f469] ${!isAddIngestionJob ? 'cursor-not-allowed opacity-40' : ''}`}
                            onClick={() =>
                              isAddIngestionJob &&
                              setNewJobModalities(prev => prev.filter(m => m.value !== mod.value))
                            }
                          >
                            <svg
                              viewBox="0 0 14 14"
                              width="10"
                              height="10"
                              fill="none"
                              stroke="#151815"
                              strokeWidth="2"
                            >
                              <path d="M2 2l10 10M12 2L2 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interval */}
                <div className="relative">
                  <Input
                    id="jobInterval"
                    placeholder={`Interval (minimum of ${minIngestionJobIntervalMinutes} minutes)`}
                    className="w-full pr-20"
                    type="number"
                    min={minIngestionJobIntervalMinutes}
                    value={newJobInterval}
                    onChange={e => setNewJobInterval(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white text-opacity-50">
                    {t('minutes')}
                  </span>
                </div>

                {/* Schedule */}
                <div>
                  <Typography
                    variant="body"
                    className="mb-3 text-white text-opacity-50"
                  >
                    {t('Schedule')}
                  </Typography>
                  <div className="flex flex-col gap-3">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="always"
                        checked={newJobScheduleType === 'always'}
                        onChange={() => {
                          setNewJobScheduleType('always');
                          setNewJobStartDate(null);
                          setNewJobEndDate(null);
                        }}
                        className="h-4 w-4 cursor-pointer accent-[#c8f469]"
                      />
                      <span className="text-white">{t('Always')}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="dateRange"
                        checked={newJobScheduleType === 'dateRange'}
                        onChange={() => setNewJobScheduleType('dateRange')}
                        className="h-4 w-4 cursor-pointer accent-[#c8f469]"
                      />
                      <span className="text-white">{t('Select Date Range')}</span>
                    </label>
                  </div>

                  {/* Date pickers — only shown when dateRange is selected */}
                  {newJobScheduleType === 'dateRange' && (
                    <div className="mt-4 flex flex-col gap-3">
                      <div className="pacs-date-range flex gap-3">
                        <div className="relative flex-1">
                          <DateRangePicker
                            startDate={newJobStartDate}
                            startDateId="JobRunFrom"
                            endDate={newJobEndDate}
                            endDateId="JobRunTo"
                            onDatesChange={({ startDate, endDate }) => {
                              setNewJobStartDate(startDate);
                              setNewJobEndDate(endDate);
                            }}
                            focusedInput={newJobFocusedInput}
                            onFocusChange={focusedInput => setNewJobFocusedInput(focusedInput)}
                            isOutsideRange={() => false}
                            minimumNights={0}
                            appendToBody
                            openDirection="up"
                            startDatePlaceholderText="Run From"
                            endDatePlaceholderText="Run To"
                            renderMonthElement={({ month, onMonthSelect, onYearSelect }) => {
                              const years = [];
                              const currentYear = moment().year();
                              for (let i = currentYear - 10; i <= currentYear + 10; i++) {
                                years.push(i);
                              }
                              return (
                                <div className="MonthElementWrapper">
                                  <select
                                    value={month.month()}
                                    onChange={e => onMonthSelect(month, e.target.value)}
                                  >
                                    {moment.months().map((label, index) => (
                                      <option
                                        key={index}
                                        value={index}
                                      >
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={month.year()}
                                    onChange={e => onYearSelect(month, e.target.value)}
                                  >
                                    {years.map(year => (
                                      <option
                                        key={year}
                                        value={year}
                                      >
                                        {year}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex flex-1 flex-col gap-1">
                          <span className="text-xs text-white text-opacity-50">
                            {t('Start Time')}
                          </span>
                          <input
                            type="time"
                            value={newJobStartTime}
                            onChange={e => setNewJobStartTime(e.target.value)}
                            className="h-[51px] w-full cursor-pointer rounded-lg border-none bg-[#2D302D] px-3 text-white accent-[#c8f469] [color-scheme:dark] focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                          <span className="text-xs text-white text-opacity-50">
                            {t('End Time')}
                          </span>
                          <input
                            type="time"
                            value={newJobEndTime}
                            onChange={e => setNewJobEndTime(e.target.value)}
                            className="h-[51px] w-full cursor-pointer rounded-lg border-none bg-[#2D302D] px-3 text-white accent-[#c8f469] [color-scheme:dark] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex w-full justify-end">
                <Button
                  className="h-[41px] rounded-lg px-8"
                  disabled={isSavingIngestionJob}
                  onClick={handleSaveIngestionJob}
                >
                  {isSavingIngestionJob ? '...' : t(isAddIngestionJob ? 'Start' : 'Save')}
                </Button>
              </div>
            </div>
          </Modal>
        )}
        {/* remove ingestion job modal */}
        {isOpenRemoveIngestionJobModal && (
          <Modal
            isOpen={isOpenRemoveIngestionJobModal}
            size="min-w-[400px]"
            isCloseable={true}
            onClose={() => {
              if (isDeletingIngestionJob) {
                return;
              }
              setIsOpenRemoveIngestionJobModal(false);
              setSelectedIngestionJobId('');
            }}
          >
            <div className="relative">
              <Typography
                variant="h6"
                className="font-light text-white"
              >
                {t('Remove Ingestion Job')}
              </Typography>
              <Typography
                variant="body"
                className="mt-2 font-light text-white text-opacity-70"
              >
                {t('Are you sure you want to delete job ')} {selectedIngestionJobId}?
              </Typography>
              <div className="mt-4 flex w-full justify-end">
                <button
                  disabled={isDeletingIngestionJob}
                  className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400 disabled:opacity-50"
                  onClick={() => {
                    setIsOpenRemoveIngestionJobModal(false);
                    setSelectedIngestionJobId('');
                  }}
                >
                  {t('Cancel')}
                </button>
                <button
                  disabled={isDeletingIngestionJob}
                  className="h-[41px] w-[111px] rounded-lg bg-red-700 text-white disabled:opacity-50"
                  onClick={deleteIngestionJob}
                >
                  {isDeletingIngestionJob ? '...' : t('Delete')}
                </button>
              </div>
            </div>
          </Modal>
        )}
        {/* remove inference model modal */}
        {isOpenRemoveInferenceModelModal && (
          <Modal
            isOpen={isOpenRemoveInferenceModelModal}
            size="min-w-[400px]"
            isCloseable={true}
            onClose={() => {
              setIsOpenRemoveInferenceModelModal(false);
            }}
          >
            <div className="relative">
              <Typography
                variant="h6"
                className="font-light text-white"
              >
                {t('Remove Inference Model')}
              </Typography>
              <Typography
                variant="body"
                className="mt-2 font-light text-white text-opacity-70"
              >
                {t('Are you sure you want to delete this model?')}
              </Typography>

              <div className="mt-4 flex w-full justify-end">
                <button
                  disabled={deletingInferenceModel}
                  className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400"
                  onClick={() => setIsOpenRemoveInferenceModelModal(false)}
                >
                  {deletingInferenceModel ? '...' : t('Cancel')}
                </button>
                <button
                  disabled={deletingInferenceModel}
                  className="h-[41px] w-[111px] rounded-lg bg-red-700 text-white"
                  onClick={() => {
                    deleteInferenceModel(selectedInferenceModelToRemove);
                  }}
                >
                  {deletingInferenceModel ? '...' : t('Confirm')}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSettingsPage;
