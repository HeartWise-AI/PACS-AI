import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ohif/ui';
import ModelFactsModal from '../../../components/ModelFactsModal';
import refreshIcon from '../../../assets/pacs/icons/refresh.png';
import type { UseInferenceModelsResult } from '../hooks/useInferenceModels';
import { getContainerStatusColor } from '../utils';
import AddEditInferenceModelModal from '../inference-models/components/AddEditInferenceModelModal';
import InferenceModelsTable from '../inference-models/components/InferenceModelsTable';
import RemoveInferenceModelModal from '../inference-models/components/RemoveInferenceModelModal';

type InferenceModelsSectionProps = {
  inference: UseInferenceModelsResult;
};

const InferenceModelsSection = ({ inference }: InferenceModelsSectionProps) => {
  const { t } = useTranslation('Common');
  const statusColor = getContainerStatusColor(
    inference.selectedInferenceModel.container?.status || ''
  );

  return (
    <>
      <div>
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <h1 className="text-xl text-white">{t('Inference Models')}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={inference.loading}
              className="flex h-[35px] items-center gap-2 rounded-full bg-white bg-opacity-10 px-3"
              onClick={() => inference.refreshInferenceModels()}
            >
              <img
                src={refreshIcon}
                alt="Refresh icon"
                className={`${inference.loading ? 'animate-spin' : ''} h-4 w-4`}
              />
              <span
                className={`text-white ${inference.loading ? 'opacity-40' : ''} text-[14px]`}
              >
                {t('Refresh')}
              </span>
            </button>
            <Button
              className="h-[35px] rounded-lg"
              onClick={inference.openAddModelModal}
            >
              {t('New Model')}
            </Button>
          </div>
        </div>
      </div>
      <div className="bg-transparent py-5">
        <InferenceModelsTable
          models={inference.models}
          loading={inference.loading}
          starting={inference.startingInferenceModelContainer}
          stopping={inference.stoppingInferenceModelContainer}
          deleting={inference.deletingInferenceModel}
          selectedContainerToStartStop={inference.selectedContainerToStartStop}
          onStartStop={inference.handleStartStop}
          onEdit={inference.openEditModelModal}
          onView={inference.openViewModelModal}
          onViewFacts={inference.handleViewModelFacts}
          onDelete={inference.openRemoveModelModal}
        />
      </div>

      <AddEditInferenceModelModal
        isOpen={inference.isOpenAddEditInferenceModelModal}
        isAdd={inference.isAddInferenceModel}
        isView={inference.isViewInferenceModel}
        model={inference.selectedInferenceModel}
        modelInfo={inference.selectedInferenceModelInfo}
        fetchingInfo={inference.fetchingInferenceModelInfo}
        envKey={inference.environmentalVariableKey}
        envValue={inference.environmentalVariableValue}
        isAdding={inference.isAddingInferenceModel}
        isUpdating={inference.isUpdatingInferenceModel}
        statusColor={statusColor}
        onClose={inference.closeAddEditModelModal}
        onChangeSelected={inference.setSelectedInferenceModel}
        onChangeEnvKey={inference.setEnvironmentalVariableKey}
        onChangeEnvValue={inference.setEnvironmentalVariableValue}
        onAdd={inference.addInferenceModel}
        onUpdate={inference.updateInferenceModel}
      />

      {inference.isOpenModelFactsModal && (
        <ModelFactsModal
          isOpen={inference.isOpenModelFactsModal}
          onClose={inference.closeModelFactsModal}
          data={inference.selectedAIModel}
        />
      )}

      <RemoveInferenceModelModal
        isOpen={inference.isOpenRemoveInferenceModelModal}
        isDeleting={inference.deletingInferenceModel}
        onClose={inference.closeRemoveModelModal}
        onConfirm={() =>
          inference.deleteInferenceModel(inference.selectedInferenceModelToRemove)
        }
      />
    </>
  );
};

export default InferenceModelsSection;
