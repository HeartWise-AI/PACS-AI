import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ButtonGradient, Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import Sidebar from '../../components/Sidebar';
import tenantRepository from '../../api/tenantRepository';
import { GetTenantInfoResponse, ModelDetails } from '../../api/tenantDTO';
import ModelFactsModal from '../../components/ModelFactsModal';

const AIModelsPage = () => {
  const { t } = useTranslation('Common');
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [selectedAIModel, setSelectedAIModel] = useState<ModelDetails>();
  const [isOpenAIModelModal, setIsOpenAIModelModal] = useState<boolean>(false);

  // set page title
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
          <ModelFactsModal
            isOpen={isOpenAIModelModal}
            onClose={() => {
              setIsOpenAIModelModal(false);
            }}
            data={selectedAIModel}
          />
        )}
      </div>
    </div>
  );
};

export default AIModelsPage;
