import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
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
import { GetTenantInfoResponse, ModelDetails } from '../../api/tenantDTO';
import Modal from '../../components/Modal';
import Table from '../../components/Table';
import orthancRepository from '../../api/orthancRepository';
import { createPortal } from 'react-dom';

interface DICOMModalities {
  id: string;
  aet: string;
  host: string;
  port: number;
  status: string;
}

const WorkspaceSettingsPage = () => {
  const { t } = useTranslation('Common');
  const showAlert = useContext(AlertContext);
  const [dicomModalities, setDICOMModalities] = useState<DICOMModalities[]>([]);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [selectedAIModel, setSelectedAIModel] = useState<Partial<ModelDetails>>({});
  const [selectedModalityToRemove, setSelectedModalityToRemove] = useState<string>('');
  const [selectedModality, setSelectedModality] = useState({
    id: '',
    aet: '',
    host: '',
    port: '',
  });
  const [selectedInferenceModelToRemove, setSelectedInferenceModelToRemove] = useState<string>('');
  const [selectedInferenceModel, setSelectedInferenceModel] = useState({
    id: '',
    name: '',
    image: '',
    outputMode: '',
    status: '',
    cpu: '',
    environmentalVariables: [],
  });
  const [environmentalVariableKey, setEnvironmentalVariableKey] = useState<string>('');
  const [environmentalVariableValue, setEnvironmentalVariableValue] = useState<string>('');
  const [isLoadingModalities, setIsLoadingModalities] = useState(true);
  const [isAddModality, setIsAddModality] = useState<boolean>(true);
  const [isAddInferenceModel, setIsAddInferenceModel] = useState<boolean>(true);
  const [isViewInferenceModel, setIsViewInferenceModel] = useState<boolean>(false);
  const [isUpdatingModality, setIsUpdatingModality] = useState<boolean>(false);
  const [isAddingModality, setIsAddingModality] = useState<boolean>(false);
  const [isUpdatingInferenceModel, setIsUpdatingInferenceModel] = useState<boolean>(false);
  const [isAddingInferenceModel, setIsAddingInferenceModel] = useState<boolean>(false);
  const [isOpenAIModelModal, setIsOpenAIModelModal] = useState<boolean>(false);
  const [isOpenAddEditModalityModal, setIsOpenAddEditModalityModal] = useState<boolean>(false);
  const [isOpenAddEditInferenceModelModal, setIsOpenAddEditInferenceModelModal] =
    useState<boolean>(false);
  const [isOpenRemoveModalityModal, setIsOpenRemoveModalityModal] = useState<boolean>(false);
  const [isOpenRemoveInferenceModelModal, setIsOpenRemoveInferenceModelModal] =
    useState<boolean>(false);
  const [isRefreshingDICOMModalities, setIsRefreshingDICOMModalities] = useState<boolean>(false);
  const [isRemovingModality, setIsRemovingModality] = useState<boolean>(false);
  const dicomHeaders = [
    { text: t('ID'), value: 'id', align: 'left' },
    { text: t('Target AET'), value: 'aet', align: 'left' },
    { text: t('Host'), value: 'host', align: 'left' },
    { text: t('Port'), value: 'port', align: 'left' },
    { text: t('Status'), value: 'status', align: 'left' },
    { text: t('Action'), value: 'action', align: 'center' },
  ];
  const inferenceModelHeaders = [
    { text: t('Container ID'), value: 'id', align: 'left' },
    { text: t('Name'), value: 'name', align: 'left' },
    { text: t('Version'), value: 'version', align: 'left' },
    { text: t('Image'), value: 'image', align: 'left' },
    { text: t('Status'), value: 'status', align: 'left' },
    { text: t('CPU %'), value: 'cpu', align: 'left' },
    { text: t('Action'), value: 'action', align: 'center' },
  ];
  const [inferenceModels, setInferenceModels] = useState([
    {
      id: 'container1',
      name: 'Lung Segmentation',
      version: '1.0.0',
      image: 'lung-seg:latest',
      status: 'Running',
      cpu: 25.5,
    },
    {
      id: 'container2',
      name: 'Brain Tumor Detection',
      version: '2.1.3',
      image: 'brain-tumor:v2',
      status: 'Stopped',
      cpu: 0,
    },
    {
      id: 'container3',
      name: 'Chest X-Ray Classification',
      version: '3.0.1',
      image: 'chest-xray:3.0',
      status: 'Running',
      cpu: 35.2,
    },
    {
      id: 'container4',
      name: 'Bone Fracture Detection',
      version: '1.2.0',
      image: 'bone-fracture:1.2',
      status: 'Running',
      cpu: 28.7,
    },
    {
      id: 'container5',
      name: 'Skin Lesion Analysis',
      version: '2.3.1',
      image: 'skin-lesion:2.3',
      status: 'Stopped',
      cpu: 0,
    },
  ]);
  const outputModeOptions = ['JSON', 'OHIF_ANNOTATIONS', 'HTML', 'WEB_APP', 'PDF'];

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
    setIsLoadingModalities(true);
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
      console.error('Error fetching DICOM modalities:', error);
    } finally {
      setIsLoadingModalities(false);
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
        console.error(`Error triggering DICOM Echo for modality ${modality.id}:`, error);
        updatedModalities[index] = { ...modality, status: 'Disconnected' };
      }
      setDICOMModalities([...updatedModalities]);
    });

    await Promise.all(modalityPromises);
  };

  useEffect(() => {
    fetchDICOMModalities();
  }, [fetchDICOMModalities]);

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
      console.error(`Error adding modality: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsAddingModality(false);
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
      image: '',
      outputMode: '',
      status: '',
      cpu: '',
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
                      setSelectedInferenceModelToRemove(row.id);
                      setIsOpenRemoveInferenceModelModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {' '}
                    {t('Delete')}{' '}
                  </a>
                </li>
              </ul>
            </div>,
            document.body
          )}
      </div>
    );
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
              className="fixed z-50 w-28 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
              style={getDropdownPosition()}
            >
              <ul className="py-2 text-sm text-white">
                <li>
                  <a
                    className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                    onClick={() => {
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
                      setSelectedInferenceModelToRemove(row.id);
                      // setIsOpenRemoveInferenceModelModal(true);
                      setIsOpen(false);
                    }}
                  >
                    {' '}
                    {t('Delete')}{' '}
                  </a>
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
  const handleSelectModel = (model: ModelDetails) => {
    setSelectedAIModel(model);
    setIsOpenAIModelModal(true);
  };

  const handleInferenceModelTableRowClick = rowData => {
    setSelectedInferenceModel(rowData);
    setIsAddInferenceModel(false);
    setIsViewInferenceModel(true);
    setIsOpenAddEditInferenceModelModal(true);
  };

  /**
   * Validation and perfomance table
   *
   * @param data
   */
  const ValidationAndPerfomanceTable = ({ data }) => {
    const { Validation_and_performance } = data;

    const renderTable = (performanceData: {
      [key: string]: { [key: string]: string | number };
    }) => (
      <table className="mx-auto mb-4 w-[70%] border-collapse border border-gray-600">
        <thead>
          <tr>
            <th className="w-1/4 border border-gray-600 px-4 py-2"></th>
            {Object.keys(performanceData).map(dataset => (
              <th
                key={dataset}
                className="w-1/4 border border-gray-600 px-4 py-2 text-base text-white"
              >
                {dataset.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(performanceData[Object.keys(performanceData)[0]]).map(metric => (
            <tr key={metric}>
              <td className="w-1/4 border border-gray-600 px-4 py-2 text-base font-medium text-white">
                {metric.replace(/_/g, ' ')}
              </td>
              {Object.keys(performanceData).map(dataset => (
                <td
                  key={dataset + metric}
                  className="w-1/4 border border-gray-600 px-4 py-2 text-base text-white"
                >
                  {performanceData[dataset][metric]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
    return (
      <div>
        <Typography
          variant="h6"
          className="mb-2 font-medium text-white"
        >
          {t('Validation and Perfomance')}
        </Typography>
        {Object.keys(Validation_and_performance).map(key => (
          <div key={key}>{renderTable(Validation_and_performance[key])}</div>
        ))}
      </div>
    );
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
              {isLoadingModalities ? (
                <div
                  role="status"
                  className={`grid max-w-full animate-pulse grid-cols-5 gap-4`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i}>
                      <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                      <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                      <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                      <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
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
                <Button
                  className="h-[35px] rounded-lg"
                  onClick={() => setIsOpenAddEditInferenceModelModal(true)}
                >
                  {t('New Model')}
                </Button>
              </div>
            </div>
            {/* Inference models table container */}
            <div className="bg-transparent py-5">
              {isLoadingModalities ? (
                <div
                  role="status"
                  className={`grid max-w-full animate-pulse grid-cols-5 gap-4`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i}>
                      <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                      <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                      <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                      <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                    </div>
                  ))}
                </div>
              ) : inferenceModels.length > 0 ? (
                <Table
                  headers={inferenceModelHeaders}
                  data={inferenceModels}
                  className={'max-w-[170px]'}
                  onRowClick={handleInferenceModelTableRowClick}
                >
                  {(cell, header, row) => {
                    if (header.value === 'name') {
                      return <div className="w-[250px] text-white">{cell}</div>;
                    }
                    if (header.value === 'version') {
                      return <div className="w-[200px] text-white">{cell}</div>;
                    }
                    if (header.value === 'image') {
                      return <div className="w-[200px] text-white">{cell}</div>;
                    }
                    // status
                    if (header.value === 'status') {
                      return (
                        <div className="flex min-w-[100px] items-center gap-2">
                          <div
                            className={`inline-flex h-[27px] items-center justify-center gap-1 rounded-full px-2 ${
                              cell === 'Running'
                                ? 'bg-[#6ED47C] bg-opacity-20 text-[#6ED47C]'
                                : 'bg-red-300 bg-opacity-10 text-red-500'
                            }`}
                          >
                            <span>{cell}</span>
                            <div
                              className={`h-1 w-1 rounded-full ${
                                cell === 'Running' ? 'bg-[#6ED47C]' : 'bg-red-500'
                              }`}
                            ></div>
                          </div>
                        </div>
                      );
                    }
                    if (header.value === 'cpu') {
                      return <div className="w-[200px] text-white">{cell ? `${cell}%` : '-'}</div>;
                    }
                    // action
                    if (header.value === 'action') {
                      return (
                        <div
                          className="flex items-center justify-center gap-2"
                          onClick={e => e.stopPropagation()}
                        >
                          <button>
                            <img
                              src={playIcon}
                              alt="Play icon"
                            />
                          </button>
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
            {/* AI models */}
            <div className="mt-5 mb-3">
              <h1 className="text-xl text-white">{t('Available AI Models')}</h1>
            </div>
            {!tenantInfo.availableModels && (
              <div
                role="tenantInfo"
                className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3"
              >
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="w-full animate-pulse"
                  >
                    <div className='className="mb-2 mb-2 h-[330px] rounded-lg bg-gray-200 bg-opacity-30'></div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {tenantInfo.availableModels &&
                tenantInfo.availableModels.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5"
                  >
                    <Typography
                      variant="h6"
                      className="text-white"
                    >
                      {item.en.Summary['Name']}
                    </Typography>
                    <Typography
                      variant="body"
                      className="my-2 text-sm font-light text-white text-opacity-70"
                    >
                      {item.en.Summary['Description']}
                    </Typography>
                    {Object.entries(item.en.Summary)
                      .filter(([key]) => key !== 'Description' && key !== 'Name')
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between pt-2"
                        >
                          <Typography
                            variant="body"
                            className="pr-2 font-light text-white text-opacity-70"
                          >
                            {`${key.replace(/_/g, ' ')}`}
                          </Typography>
                          <Typography
                            variant="body"
                            className="text-right font-light text-white"
                          >
                            {`${value}`}
                          </Typography>
                        </div>
                      ))}
                    <ButtonGradient
                      onClick={() => handleSelectModel(item.en)}
                      className="mt-5 h-[40px] w-full"
                    >
                      {'View More'}
                    </ButtonGradient>
                  </div>
                ))}
            </div>
          </div>
        </div>
        {/* add and edit modality modal */}
        {isOpenAddEditModalityModal && (
          <Modal
            isOpen={isOpenAddEditModalityModal}
            size="w-[520px] max-w-[520px]"
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
                    ? 'View Inference'
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
                      className="w-full"
                      type="text"
                      autoFocus
                      value={selectedInferenceModel.id}
                      onChange={e => {
                        setSelectedInferenceModel({
                          ...selectedInferenceModel,
                          id: e.target.value,
                        });
                      }}
                      className="disabled:opacity-50"
                    />
                  )}

                  <Input
                    id="inferenceModelName"
                    placeholder={t('Name')}
                    className="w-full"
                    disabled={isViewInferenceModel || !isAddInferenceModel}
                    type="text"
                    value={selectedInferenceModel.name}
                    onChange={e => {
                      setSelectedInferenceModel({
                        ...selectedInferenceModel,
                        name: e.target.value,
                      });
                    }}
                    className="disabled:opacity-50"
                  />
                  <Input
                    id="inferenceModelImage"
                    placeholder={t('Image')}
                    className="w-full"
                    disabled={isViewInferenceModel}
                    type="text"
                    value={selectedInferenceModel.image}
                    onChange={e => {
                      setSelectedInferenceModel({
                        ...selectedInferenceModel,
                        image: e.target.value,
                      });
                    }}
                    className="disabled:opacity-50"
                  />
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
                              selectedInferenceModel.status === 'Running'
                                ? 'bg-[#6ED47C] bg-opacity-20 text-[#6ED47C]'
                                : 'bg-red-300 bg-opacity-10 text-red-500'
                            }`}
                          >
                            <span className="text-sm">{selectedInferenceModel.status}</span>
                            <div
                              className={`h-1 w-1 rounded-full ${
                                selectedInferenceModel.status === 'Running'
                                  ? 'bg-[#6ED47C]'
                                  : 'bg-red-500'
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
                              {selectedInferenceModel.cpu}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* environment variables */}
                  <div className="border-b border-white border-opacity-10 pb-4">
                    <Typography
                      variant="body"
                      className="mb-2 text-white"
                    >
                      {t('Environmental Variables')}
                    </Typography>
                    <div className="flex items-center gap-2">
                      <Input
                        id="environmentalVariablesKey"
                        placeholder={t('Key')}
                        className="w-full"
                        disabled={isViewInferenceModel || !isAddInferenceModel}
                        type="text"
                        value={environmentalVariableKey}
                        onChange={e => {
                          setEnvironmentalVariableKey(e.target.value);
                        }}
                        className="h-[43px] disabled:opacity-50"
                      />
                      <Input
                        id="environmentalVariablesValue"
                        placeholder={t('Value')}
                        className="w-full"
                        disabled={isViewInferenceModel || !isAddInferenceModel}
                        type="text"
                        value={environmentalVariableValue}
                        onChange={e => {
                          setEnvironmentalVariableValue(e.target.value);
                        }}
                        className="h-[43px] disabled:opacity-50"
                      />
                      <button
                        disabled={isAddingInferenceModel || isUpdatingInferenceModel}
                        className="h-[43px] w-[60px] rounded-lg bg-[#C8F469] bg-opacity-10"
                        onClick={() => {
                          setSelectedInferenceModel({
                            ...selectedInferenceModel,
                            environmentalVariables: [
                              ...selectedInferenceModel.environmentalVariables,
                              { key: environmentalVariableKey, value: environmentalVariableValue },
                            ],
                          });
                          setEnvironmentalVariableKey('');
                          setEnvironmentalVariableValue('');
                        }}
                      >
                        <span className="text-[#C8F469]"> {t('Add')}</span>
                      </button>
                    </div>
                    {/* added environment variables */}
                    <div className="mt-4 flex flex-col gap-2">
                      {selectedInferenceModel.environmentalVariables?.map((variable, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2"
                        >
                          <Input
                            id={`env-key-${index}`}
                            label=""
                            value={variable.key}
                            className="h-[43px] w-full"
                            disabled={true}
                            type="text"
                          />
                          <Input
                            id={`env-value-${index}`}
                            label=""
                            value={variable.value}
                            className="h-[43px] w-full"
                            disabled={true}
                            type="text"
                          />
                          <button
                            disabled={isAddingInferenceModel || isUpdatingInferenceModel}
                            className="flex h-[43px] w-[60px] items-center justify-center rounded-lg bg-red-500 bg-opacity-10"
                            onClick={() => {
                              setSelectedInferenceModel({
                                ...selectedInferenceModel,
                                environmentalVariables:
                                  selectedInferenceModel.environmentalVariables.filter(
                                    (_, i) => i !== index
                                  ),
                              });
                            }}
                          >
                            <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-red-500 text-red-500">
                              <span className="-mt-[1px] text-xl">{t('-')}</span>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                    <Typography
                      variant="body"
                      className="mt-1 text-white text-opacity-50"
                    >
                      {t('Environment Variable should contain at least a key and value.')}
                    </Typography>
                  </div>
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
                    // onClick={isAddInferenceModel ? addInferenceModel : updateInferenceModel}
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

        {isOpenAIModelModal && (
          <Modal
            isOpen={isOpenAIModelModal}
            size="max-w-[80%]"
            onClose={() => {
              setIsOpenAIModelModal(false);
            }}
          >
            <div className="relative">
              {/* summary */}
              <div className="grid grid-cols-3 border-b border-white border-opacity-10 py-2">
                <div className="col-span-1">
                  <Typography
                    variant="h6"
                    className="font-medium text-white"
                  >
                    {t('Model Facts')}
                  </Typography>
                </div>
                <div className="col-span-1">
                  <Typography
                    variant="subtitle"
                    className="font-light text-white"
                  >
                    {t('Model Name')}: {selectedAIModel.Summary['Name']}
                  </Typography>
                </div>
                <div className="col-span-1">
                  <Typography
                    variant="subtitle"
                    className="font-light text-white"
                  >
                    {t('Locale')}: {selectedAIModel.Summary['Licensed_to']}
                  </Typography>
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-white border-opacity-10 py-2">
                <div className="col-span-1">
                  <Typography
                    variant="subtitle"
                    className="font-light text-white"
                  >
                    {t('Approval Date')}: {selectedAIModel.Summary['Approval_date']}
                  </Typography>
                </div>
                <div className="col-span-1">
                  <Typography
                    variant="subtitle"
                    className="font-light text-white"
                  >
                    {t('Last Update')}: {selectedAIModel.Summary['Last_update']}
                  </Typography>
                </div>
                <div className="col-span-1">
                  <Typography
                    variant="subtitle"
                    className="font-light text-white"
                  >
                    {t('Version')}: {selectedAIModel.Summary['Version']}
                  </Typography>
                </div>
              </div>
              <div className="border-b border-white border-opacity-10 py-2">
                <Typography
                  variant="h6"
                  className="font-medium text-white"
                >
                  {t('Summary')}
                </Typography>
                <Typography
                  variant="body"
                  className="mt-2 font-light text-white"
                >
                  {selectedAIModel.Summary['Description']}
                </Typography>
              </div>
              {/* mechanism */}
              <div className="border-b border-white border-opacity-10 py-2">
                <Typography
                  variant="h6"
                  className="font-medium text-white"
                >
                  {t('Mechanism')}
                </Typography>
                {Object.entries(selectedAIModel.Mechanism).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-4 pt-2"
                  >
                    <Typography
                      variant="body"
                      className="pr-2 font-medium text-white"
                    >
                      • {`${key.replace(/_/g, ' ')}`}
                    </Typography>
                    <div className="flex-1 border-b border-dotted border-white border-opacity-70" />
                    <Typography
                      variant="body"
                      className="pl-2 text-right font-light text-white"
                    >
                      {`${value}`}
                    </Typography>
                  </div>
                ))}
              </div>
              {/* validation and performance */}
              <div className="border-b border-white border-opacity-10 py-2">
                <ValidationAndPerfomanceTable data={selectedAIModel} />
              </div>
              {/* uses and directions */}
              <div className="border-b border-white border-opacity-10 py-2">
                <Typography
                  variant="h6"
                  className="font-medium text-white"
                >
                  {t('Uses and directions')}
                </Typography>
                {Object.entries(selectedAIModel.Uses_and_directions).map(([key, value]) => (
                  <div
                    key={key}
                    className="px-4 pt-2"
                  >
                    <Typography
                      variant="body"
                      className="pr-2 text-white"
                    >
                      <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                      <span className="font-light"> {`${value}`}</span>
                    </Typography>
                  </div>
                ))}
              </div>
              {/* warning and limitations */}
              <div className="border-b border-white border-opacity-10 py-2">
                <Typography
                  variant="h6"
                  className="font-medium text-white"
                >
                  {t('Warnings')}
                </Typography>
                {Object.entries(selectedAIModel.Warnings_and_limitations).map(([key, value]) => (
                  <div
                    key={key}
                    className="px-4 pt-2"
                  >
                    <Typography
                      variant="body"
                      className="pr-2 text-white"
                    >
                      <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                      <span className="font-light"> {`${value}`}</span>
                    </Typography>
                  </div>
                ))}
              </div>
              {/* other information */}
              <div className="border-b border-white border-opacity-10 py-2">
                <Typography
                  variant="h6"
                  className="font-medium text-white"
                >
                  {t('Other information')}
                </Typography>
                {Object.entries(selectedAIModel.Other_information).map(([key, value]) => (
                  <div
                    key={key}
                    className="px-4 pt-2"
                  >
                    <Typography
                      variant="body"
                      className="pr-2 text-white"
                    >
                      <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                      <span className="font-light"> {`${value}`}</span>
                    </Typography>
                  </div>
                ))}
              </div>
              {/* other results */}
              <div className="border-b border-white border-opacity-10 py-2">
                <Typography
                  variant="h6"
                  className="font-medium text-white"
                >
                  {t('Other results')}
                </Typography>
                {Object.entries(selectedAIModel.Other_results).map(([key, value]) => (
                  <div
                    key={key}
                    className="px-4 pt-2"
                  >
                    <Typography
                      variant="body"
                      className="pr-2 text-white"
                    >
                      <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                      <span className="font-light"> {`${value}`}</span>
                    </Typography>
                  </div>
                ))}
              </div>
              {/* change logs */}
              <div className="border-b border-white border-opacity-10 py-2">
                <Typography
                  variant="h6"
                  className="font-medium text-white"
                >
                  {t('Change logs')}
                </Typography>
                {Object.entries(selectedAIModel.Changelogs).map(([key, value]) => (
                  <div
                    key={key}
                    className="px-4 pt-2"
                  >
                    <Typography
                      variant="body"
                      className="pr-2 text-white"
                    >
                      <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                      <span className="font-light"> {`${value}`}</span>
                    </Typography>
                  </div>
                ))}
              </div>
            </div>
          </Modal>
        )}
        {/* remove modality modal */}
        {isOpenRemoveModalityModal && (
          <Modal
            isOpen={isOpenRemoveModalityModal}
            size="min-w-[400px]"
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
            onClose={() => {
              setIsOpenRemoveInferenceModelModal(false);
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
                {t('Are you sure you want to delete ')} {selectedInferenceModelToRemove}?
              </Typography>

              <div className="mt-4 flex w-full justify-end">
                <button
                  disabled={isRemovingModality}
                  className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400"
                  onClick={() => setIsOpenRemoveInferenceModelModal(false)}
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
      </div>
    </div>
  );
};

export default WorkspaceSettingsPage;
