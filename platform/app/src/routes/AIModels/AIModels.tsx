import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ButtonGradient, Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import Sidebar from '../../components/Sidebar';
import tenantRepository from '../../api/tenantRepository';
import { ModelDetails } from '../../api/inferenceDTO';
import ModelFactsModal from '../../components/ModelFactsModal';
import { GetInferenceAvailableModelsResponse } from '../../api/inferenceDTO';
import inferenceRepository from '../../api/inferenceRepository';

const AIModelsPage = () => {
  const { t } = useTranslation('Common');
  const [selectedAIModel, setSelectedAIModel] = useState<ModelDetails>();
  const [isOpenAIModelModal, setIsOpenAIModelModal] = useState<boolean>(false);
  const [inferenceAvailableModels, setInferenceAvailableModels] = useState<
    GetInferenceAvailableModelsResponse[]
  >([]);
  const [fetchingAvailableModels, setFetchingAvailableModels] = useState<boolean>(false);

  // set page title
  useEffect(() => {
    document.title = 'AI Models - PACS AI';
  }, []);

  useEffect(() => {
    const fetchInferenceAvailableModels = async () => {
      setFetchingAvailableModels(true);
      try {
        const response = await inferenceRepository.GetInferenceAvailableModels();
        setInferenceAvailableModels(response.data);
      } catch (error) {
        console.error(`Can't fetch available inference models: ${error}`);
      }
      setFetchingAvailableModels(false);
    };
    fetchInferenceAvailableModels();
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
          {fetchingAvailableModels && (
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
            {!fetchingAvailableModels &&
              inferenceAvailableModels &&
              inferenceAvailableModels.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5"
                >
                  <Typography
                    variant="h6"
                    className="text-white"
                  >
                    {item.modelFacts.en.Summary['Name']}
                  </Typography>
                  <Typography
                    variant="body"
                    className="my-2 text-sm font-light text-white text-opacity-70"
                  >
                    {item.modelFacts.en.Summary['Description']}
                  </Typography>
                  {Object.entries(item.modelFacts.en.Summary)
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
                    onClick={() => handleSelectModel(item.modelFacts.en)}
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
