import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ohif/ui';
import type { UseDicomModalitiesResult } from '../hooks/useDicomModalities';
import AddEditModalityModal from '../dicom/components/AddEditModalityModal';
import DicomModalitiesTable from '../dicom/components/DicomModalitiesTable';
import RemoveModalityModal from '../dicom/components/RemoveModalityModal';

type DicomModalitiesSectionProps = {
  dicom: UseDicomModalitiesResult;
};

const DicomModalitiesSection = ({ dicom }: DicomModalitiesSectionProps) => {
  const { t } = useTranslation('Common');

  return (
    <>
      <div>
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <h1 className="text-xl text-white">{t('DICOM (Orthanc)')}</h1>
          <Button
            className="h-[35px] rounded-lg"
            onClick={dicom.openAddModalityModal}
          >
            {t('New Modality')}
          </Button>
        </div>
      </div>
      <div className="bg-transparent py-5">
        <DicomModalitiesTable
          modalities={dicom.modalities}
          loading={dicom.loading}
          isRefreshing={dicom.isRefreshingDICOMModalities}
          onRefreshStatus={dicom.updateModalityStatus}
          onEdit={dicom.openEditModalityModal}
          onDelete={dicom.openRemoveModalityModal}
        />
      </div>

      <AddEditModalityModal
        isOpen={dicom.isOpenAddEditModalityModal}
        isAddModality={dicom.isAddModality}
        selectedModality={dicom.selectedModality}
        isAddingModality={dicom.isAddingModality}
        isUpdatingModality={dicom.isUpdatingModality}
        onClose={dicom.closeAddEditModalityModal}
        onChange={dicom.setSelectedModality}
        onSave={dicom.isAddModality ? dicom.addModality : dicom.updateModality}
      />

      <RemoveModalityModal
        isOpen={dicom.isOpenRemoveModalityModal}
        modalityId={dicom.selectedModalityToRemove}
        isRemoving={dicom.isRemovingModality}
        onClose={dicom.closeRemoveModalityModal}
        onConfirm={dicom.removeModality}
      />
    </>
  );
};

export default DicomModalitiesSection;
