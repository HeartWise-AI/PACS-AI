import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, ButtonGradient, Input, Typography } from '@ohif/ui';
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
import { GetInferenceModelInfoResponse, GetInferenceModelResponse } from '../../api/inferenceDTO';
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
}

enum InferenceContainerStatus {
  CREATED = 'created',
  RUNNING = 'running',
  PAUSED = 'paused',
  RESTARTING = 'restarting',
  EXITED = 'exited',
  REMOVING = 'removing',
  DEAD = 'dead',
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
};

const WorkspaceSettingsPage = () => {
  const { t } = useTranslation('Common');
  const showAlert = useContext(AlertContext);
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';
  const [dicomModalities, setDICOMModalities] = useState<DICOMModalities[]>([]);
  const [inferenceModels, setInferenceModels] = useState<GetInferenceModelResponse[]>([]);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [selectedAIModel, setSelectedAIModel] = useState<ModelDetails>();
  const [selectedModalityToRemove, setSelectedModalityToRemove] = useState<string>('');
  const [selectedModality, setSelectedModality] = useState({
    id: '',
    aet: '',
    host: '',
    port: '',
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
  const dicomHeaders = [
    { text: t('ID'), value: 'id', align: 'left' },
    { text: t('Target AET'), value: 'aet', align: 'left' },
    { text: t('Host'), value: 'host', align: 'left' },
    { text: t('Port'), value: 'port', align: 'left' },
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

  /**
   * Fetch DICOM modalities
   */
  const fetchDICOMModalities = useCallback(async () => {
    setLoadingModalities(true);
    try {
      const response = await orthancRepository.GetDICOMModalities();
      const modalities = Object.entries(response.data.modalities).map(
        ([id, modality]: [string, any]) => ({
          id,
          aet: modality.aet,
          host: modality.host,
          port: modality.port,
          status: 'Connecting',
        })
      );
      setDICOMModalities(modalities);
      updateModalitiesStatus(modalities);
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId, true);
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
            logoutUser(navigate, tenantId, true);
          }, 3000);
        }
        console.error(`Error triggering DICOM Echo for modality ${modality.id}:`, error);
        updatedModalities[index] = { ...modality, status: 'Disconnected' };
      }
      setDICOMModalities([...updatedModalities]);
    });

    await Promise.all(modalityPromises);
  };

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
          logoutUser(navigate, tenantId, true);
        }, 3000);
      }
      console.error('Error fetching inference models:', error);
    }
  }, [inferenceRepository]);

  const fetchInferenceModelsInfo = async (containerID: string) => {
    setFetchingInferenceModelInfo(true);
    try {
      const response = await inferenceRepository.GetInferenceModelInfo({ containerID });
      setSelectedInferenceModelInfo(response.data);
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId, true);
        }, 3000);
      }
      console.error('Error fetching inference model info:', error);
      showAlert(error.message, 'error');
    }
    setFetchingInferenceModelInfo(false);
  };

  useEffect(() => {
    // initial fetch
    fetchDICOMModalities();
    setLoadingInferenceModels(true);

    const fetchInitialData = async () => {
      await fetchInferenceModels();
      setLoadingInferenceModels(false);
    };
    fetchInitialData();

    // setup polling interval
    const interval = setInterval(() => {
      fetchInferenceModels();
    }, 15000); // poll every 15 seconds

    setPollingInterval(interval);

    // cleanup function to clear interval when component unmounts
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchDICOMModalities, fetchInferenceModels]);

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
          logoutUser(navigate, tenantId, true);
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

  const addModality = async () => {
    setIsAddingModality(true);
    try {
      const response = await orthancRepository.UpdateDICOMModality({
        modalityId: selectedModality.id,
        aet: selectedModality.aet,
        host: selectedModality.host,
        port: +selectedModality.port,
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
          logoutUser(navigate, tenantId, true);
        }, 3000);
      }
      console.error(`Error adding modality: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsAddingModality(false);
  };

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
          logoutUser(navigate, tenantId, true);
        }, 3000);
      }
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
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId, true);
        }, 3000);
      }
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
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId, true);
        }, 3000);
      }
      console.error(`Error deleting inference model: ${error}`);
      showAlert(error.message, 'error');
    }
    setDeletingInferenceModel(false);
  };

  const refreshInferenceModels = () => {
    setLoadingInferenceModels(true);
    const fetchInitialData = async () => {
      await fetchInferenceModels();
      setLoadingInferenceModels(false);
    };
    fetchInitialData();
  };

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
          logoutUser(navigate, tenantId, true);
        }, 3000);
      }
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
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');

        setTimeout(() => {
          logoutUser(navigate, tenantId, true);
        }, 3000);
      }
      console.error(`Error stopping inference model container: ${error}`);
      showAlert(error.message, 'error');
    }
    setStoppingInferenceModelContainer(false);
  };

  /**
   * Update modality
   *
   * @param modalityId
   */
  const updateModality = async () => {
    setIsUpdatingModality(true);
    try {
      const response = await orthancRepository.UpdateDICOMModality({
        modalityId: selectedModality.id,
        aet: selectedModality.aet,
        host: selectedModality.host,
        port: +selectedModality.port,
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
          logoutUser(navigate, tenantId, true);
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
          logoutUser(navigate, tenantId, true);
        }, 3000);
      }
      console.error(`Error removing modality: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsRemovingModality(false);
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
                  <a
                    className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                    onClick={() => {
                      setSelectedModality(row);
                      setIsAddModality(false);
                      setIsOpenAddEditModalityModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {t('Edit')}
                  </a>
                </li>
                <li>
                  <a
                    className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                    onClick={() => {
                      setSelectedModalityToRemove(row.id);
                      setIsOpenRemoveModalityModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {t('Delete')}
                  </a>
                </li>
              </ul>
            </div>,
            document.body
          )}
      </div>
    );
  };

  const getDICOMTagsName = tag => {
    // create a dictionary instance
    const dictionary = new DataElementDictionary();
    // lookup the element by tag
    const element = dictionary.lookup(tag);

    // return the name or a fallback value if the tag is not found
    return element ? element.name : 'Unknown Tag';
  };

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
                  <a
                    className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
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
                  </a>
                </li>
                <li>
                  <a
                    className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                    onClick={() => {
                      setSelectedInferenceModel(row);
                      setIsAddInferenceModel(false);
                      setIsViewInferenceModel(true);
                      setIsOpenAddEditInferenceModelModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {t('View Instance')}
                  </a>
                </li>
                {row.container.status === InferenceContainerStatus.RUNNING && (
                  <li>
                    <a
                      className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                      onClick={() => {
                        handleViewModelFacts(row.container.id);
                      }}
                    >
                      {t('View Model Facts')}
                    </a>
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
                    <a
                      className="block cursor-pointer px-4 py-2 text-red-500 hover:bg-gray-700"
                      onClick={() => {
                        setSelectedInferenceModelToRemove(row.id);
                        setIsOpenRemoveInferenceModelModal(true);
                        setIsOpen(false);
                      }}
                    >
                      {t('Delete')}
                    </a>
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
          logoutUser(navigate, tenantId, true);
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
          <div className="rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
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
                    if (header.value === 'aet') {
                      return <div className="w-[250px] text-white">{cell}</div>;
                    }
                    if (header.value === 'host') {
                      return <div className="w-[200px] text-white">{cell}</div>;
                    }
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
                    className="w-full"
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
                          className="h-[43px] w-[60px] rounded-lg bg-[#C8F469] bg-opacity-10"
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
                    className="mb-4 block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-[#2D302D] py-3 px-3 pr-8 text-lg leading-tight text-white placeholder:opacity-50 focus:outline-none"
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
