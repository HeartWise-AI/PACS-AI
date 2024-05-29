import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ButtonGradient, Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import Sidebar from '../../components/Sidebar';
import tenantRepository from '../../api/tenantRepository';
import { GetTenantInfoResponse, ModelDetails } from '../../api/tenantDTO';
import Modal from '../../components/Modal';

const AIModelsPage = () => {
  const { t } = useTranslation('Common');
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [selectedAIModel, setSelectedAIModel] = useState<Partial<ModelDetails>>({});
  const [isOpenAIModelModal, setIsOpenAIModelModal] = useState<boolean>(false);

  // Set page title
  useEffect(() => {
    document.title = 'AI Models - PACS AI';
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
        <Sidebar />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="AI Models" />
          {!tenantInfo.availableModels && (
            <div
              role="aiModels"
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
                    {t('View More')}
                  </ButtonGradient>
                </div>
              ))}
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

export default AIModelsPage;
