import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ohif/ui';
import refreshIcon from '../../../assets/pacs/icons/refresh.png';
import { GetInferenceAvailableModelsResponse } from '../../../api/inferenceDTO';
import type { DICOMModalities } from '../types';
import type { UseIngestionJobsResult } from '../hooks/useIngestionJobs';
import AddEditIngestionJobModal from '../ingestion-jobs/components/AddEditIngestionJobModal';
import IngestionJobsTable from '../ingestion-jobs/components/IngestionJobsTable';
import RemoveIngestionJobModal from '../ingestion-jobs/components/RemoveIngestionJobModal';

type IngestionJobsSectionProps = {
  ingestion: UseIngestionJobsResult;
  dicomModalities: DICOMModalities[];
  availableModels: GetInferenceAvailableModelsResponse[];
};

const IngestionJobsSection = ({
  ingestion,
  dicomModalities,
  availableModels,
}: IngestionJobsSectionProps) => {
  const { t } = useTranslation('Common');

  return (
    <>
      <div>
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <h1 className="text-xl text-white">{t('Inference Ingestion Service')}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={ingestion.loading}
              className="flex h-[35px] items-center gap-2 rounded-full bg-white bg-opacity-10 px-3"
              onClick={() => ingestion.refreshIngestionJobs()}
            >
              <img
                src={refreshIcon}
                alt="Refresh icon"
                className={`${ingestion.loading ? 'animate-spin' : ''} h-4 w-4`}
              />
              <span
                className={`text-white ${ingestion.loading ? 'opacity-40' : ''} text-[14px]`}
              >
                {t('Refresh')}
              </span>
            </button>
            <input
              ref={ingestion.ingestionJobsCsvInputRef}
              type="file"
              accept=".csv,text/csv,application/csv,text/plain"
              className="hidden"
              onChange={ingestion.handleImportIngestionJobsCsv}
            />
            <button
              type="button"
              disabled={ingestion.loading || ingestion.isImportingIngestionJobs}
              className="border-primary text-primary h-[35px] rounded-lg border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => ingestion.ingestionJobsCsvInputRef.current?.click()}
            >
              {ingestion.isImportingIngestionJobs ? '...' : t('Import CSV')}
            </button>
            <Button
              className="h-[35px] rounded-lg px-6"
              onClick={ingestion.openAddJobModal}
            >
              {t('Add Job')}
            </Button>
          </div>
        </div>
      </div>
      <div className="bg-transparent py-5">
        <IngestionJobsTable
          jobs={ingestion.jobs}
          loading={ingestion.loading}
          starting={ingestion.startingIngestionJob}
          stopping={ingestion.stoppingIngestionJob}
          selectedJobToStartStop={ingestion.selectedIngestionJobToStartStop}
          onStartStop={ingestion.handleStartStop}
          onEdit={ingestion.openEditJobModal}
          onDelete={ingestion.openRemoveJobModal}
        />
      </div>

      <AddEditIngestionJobModal
        isOpen={ingestion.isOpenAddEditIngestionJobModal}
        isAdd={ingestion.isAddIngestionJob}
        isSaving={ingestion.isSavingIngestionJob}
        dicomModalities={dicomModalities}
        availableModels={availableModels}
        dicomModality={ingestion.newJobDicomModality}
        jobModel={ingestion.newJobModel}
        jobModalities={ingestion.newJobModalities}
        jobInterval={ingestion.newJobInterval}
        scheduleType={ingestion.newJobScheduleType}
        startDate={ingestion.newJobStartDate}
        endDate={ingestion.newJobEndDate}
        focusedInput={ingestion.newJobFocusedInput}
        startTime={ingestion.newJobStartTime}
        endTime={ingestion.newJobEndTime}
        onClose={ingestion.closeAddEditJobModal}
        onChangeDicomModality={ingestion.setNewJobDicomModality}
        onChangeJobModel={ingestion.setNewJobModel}
        onChangeJobModalities={ingestion.setNewJobModalities}
        onChangeJobInterval={ingestion.setNewJobInterval}
        onChangeScheduleType={ingestion.setNewJobScheduleType}
        onChangeStartDate={ingestion.setNewJobStartDate}
        onChangeEndDate={ingestion.setNewJobEndDate}
        onChangeFocusedInput={ingestion.setNewJobFocusedInput}
        onChangeStartTime={ingestion.setNewJobStartTime}
        onChangeEndTime={ingestion.setNewJobEndTime}
        onSave={ingestion.handleSaveIngestionJob}
      />

      <RemoveIngestionJobModal
        isOpen={ingestion.isOpenRemoveIngestionJobModal}
        jobId={ingestion.selectedIngestionJobId}
        isDeleting={ingestion.isDeletingIngestionJob}
        onClose={ingestion.closeRemoveJobModal}
        onConfirm={ingestion.deleteIngestionJob}
      />
    </>
  );
};

export default IngestionJobsSection;
