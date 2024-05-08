import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ButtonGradient, Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import { AlertContext } from '../../AlertProvider';
import copyIcon from './../../assets/pacs/icons/copy-gradient.png';
import tenantRepository from '../../api/tenantRepository';
import { GetTenantInfoResponse, ModelDetails } from '../../api/tenantDTO';
import Modal from '../../components/Modal';

const WorkspaceSettingsPage = () => {
  const { t } = useTranslation();
  const showAlert = useContext(AlertContext);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [selectedAIModel, setSelectedAIModel] = useState<Partial<ModelDetails>>({});
  const [isOpenAIModelModal, setIsOpenAIModelModal] = useState<boolean>(false);

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

            <div className="mt-5 mb-3">
              <h1 className="text-2xl text-white">{t('Available AI Models')}</h1>
            </div>
            {!tenantInfo.availableModels && (
              <div
                role="tenantInfo"
                className="grid grid-cols-3 gap-5"
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
            <div className="grid grid-cols-3 gap-5">
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
