import React, { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonGradient, Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import { AlertContext } from '../../AlertProvider';
import copyIcon from './../../assets/pacs/icons/copy-gradient.png';
import refreshIcon from './../../assets/pacs/icons/refresh.png';
import dotsVertical from './../../assets/pacs/icons/dots-vertical-inactive.png';
import tenantRepository from '../../api/tenantRepository';
import { GetTenantInfoResponse, ModelDetails } from '../../api/tenantDTO';
import Modal from '../../components/Modal';
import Table from '../../components/Table';

const WorkspaceSettingsPage = () => {
  const { t } = useTranslation('Common');
  const showAlert = useContext(AlertContext);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [selectedAIModel, setSelectedAIModel] = useState<Partial<ModelDetails>>({});
  const [isOpenAIModelModal, setIsOpenAIModelModal] = useState<boolean>(false);
  const headers = [
    { text: t('ID'), value: 'id', align: 'left' },
    { text: t('Target AET'), value: 'targetAET', align: 'left' },
    { text: t('Host'), value: 'host', align: 'center' },
    { text: t('Port'), value: 'port', align: 'left' },
    { text: t('Status'), value: 'status', align: 'left' },
    { text: t('Action'), value: 'action', align: 'center' },
  ];
  const modalityDataList = [
    {
      id: 'MOD001',
      targetAET: 'CT_SCANNER',
      host: '192.168.1.100',
      port: 11112,
      status: true,
    },
    {
      id: 'MOD002',
      targetAET: 'MRI_MACHINE',
      host: '192.168.1.101',
      port: 11113,
      status: false,
    },
    {
      id: 'MOD003',
      targetAET: 'XRAY_SYSTEM',
      host: '192.168.1.102',
      port: 11114,
      status: true,
    },
    {
      id: 'MOD004',
      targetAET: 'ULTRASOUND',
      host: '192.168.1.103',
      port: 11115,
      status: true,
    },
    {
      id: 'MOD005',
      targetAET: 'PET_SCANNER',
      host: '192.168.1.104',
      port: 11116,
      status: false,
    },
  ];
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
   * Table action button
   *
   * @param param0 row
   * @returns
   */
  const ActionButton = ({ row }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef();

    return (
      <div
        className="relative flex items-center justify-center"
        ref={ref}
      >
        <button
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          <img
            src={dotsVertical}
            alt="Dots vertical icon"
          />
        </button>
        {isOpen && (
          <div
            className="absolute z-50 w-28 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
            style={{ top: ref.current ? ref.current.offsetHeight : 0, right: 0 }}
          >
            <ul className="py-2 text-sm text-white">
              <li>
                <a className="block cursor-pointer px-4 py-2 hover:bg-gray-700">{t('Edit')}</a>
              </li>
              <li>
                <a className="block cursor-pointer px-4 py-2 hover:bg-gray-700">{t('Delete')}</a>
              </li>
            </ul>
          </div>
        )}
      </div>
    );
  };

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

  const handleSelectModel = (model: ModelDetails) => {
    setSelectedAIModel(model);
    setIsOpenAIModelModal(true);
  };

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
            {/* modality data */}
            <div>
              <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                <h1 className="text-xl text-white">{t('DICOM (Orthanc)')}</h1>
                <Button className="h-[35px] rounded-lg">{t('New Modality')}</Button>
              </div>
            </div>
            {/* table container */}
            <div className="bg-transparent py-5">
              {modalityDataList.length > 0 ? (
                <Table
                  headers={headers}
                  data={modalityDataList}
                  className={'max-w-[170px]'}
                >
                  {(cell, header, row) => {
                    if (header.value === 'targetAET') {
                      return <div className="w-[250px] text-white">{cell}</div>;
                    }
                    if (header.value === 'host') {
                      return <div className="w-[250px] text-white">{cell}</div>;
                    }
                    if (header.value === 'port') {
                      return <div className="w-[200px] text-white">{cell}</div>;
                    }
                    // email status
                    if (header.value === 'status') {
                      return (
                        <div className="flex min-w-[100px] items-center gap-2">
                          <div
                            className={`inline-flex h-[27px] items-center justify-center rounded-full px-2 ${
                              cell
                                ? 'bg-[#6ED47C] bg-opacity-20 text-[#6ED47C]'
                                : 'bg-red-300 bg-opacity-10 text-red-500'
                            }`}
                          >
                            <span>{cell ? 'Connected' : 'Disconnected'}</span>
                          </div>
                          <button className="h-[27px] w-[27px] rounded-full bg-white bg-opacity-10 p-1.5 focus:ring-0">
                            <img
                              src={refreshIcon}
                              alt="refresh icon"
                            />
                          </button>
                        </div>
                      );
                    }

                    // action
                    if (header.value === 'action') {
                      return <ActionButton row={row} />;
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
      </div>
    </div>
  );
};

export default WorkspaceSettingsPage;
