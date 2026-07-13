import { useCallback, useContext, useEffect, useRef, useState, type ChangeEvent } from 'react';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import { AlertContext } from '../../../AlertProvider';
import inferenceRepository from '../../../api/inferenceRepository';
import {
  GetInferenceAvailableModelsResponse,
  GetInferenceIngestionJobsResponse,
} from '../../../api/inferenceDTO';
import {
  DEFAULT_JOB_END_TIME,
  DEFAULT_JOB_START_TIME,
  minIngestionJobIntervalMinutes,
  POLLING_INTERVAL_MS,
} from '../constants';
import type { IngestionScheduleType, SelectOption } from '../types';
import { buildTimestampFromDateAndTime, handleUnauthorizedAccess, isCSVFile } from '../utils';

type UseIngestionJobsOptions = {
  availableModels: GetInferenceAvailableModelsResponse[];
};

export function useIngestionJobs({ availableModels }: UseIngestionJobsOptions) {
  const showAlert = useContext(AlertContext);
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';
  const availableModelsRef = useRef(availableModels);
  availableModelsRef.current = availableModels;

  const [jobs, setJobs] = useState<GetInferenceIngestionJobsResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingIngestionJob, setStartingIngestionJob] = useState(false);
  const [stoppingIngestionJob, setStoppingIngestionJob] = useState(false);
  const [selectedIngestionJobToStartStop, setSelectedIngestionJobToStartStop] = useState('');
  const [isOpenAddEditIngestionJobModal, setIsOpenAddEditIngestionJobModal] = useState(false);
  const [newJobModel, setNewJobModel] = useState<SelectOption | null>(null);
  const [newJobModalities, setNewJobModalities] = useState<SelectOption[]>([]);
  const [newJobInterval, setNewJobInterval] = useState(String(minIngestionJobIntervalMinutes));
  const [newJobScheduleType, setNewJobScheduleType] = useState<IngestionScheduleType>('always');
  const [newJobStartDate, setNewJobStartDate] = useState(null);
  const [newJobEndDate, setNewJobEndDate] = useState(null);
  const [newJobFocusedInput, setNewJobFocusedInput] = useState(null);
  const [isAddIngestionJob, setIsAddIngestionJob] = useState(true);
  const [selectedIngestionJobId, setSelectedIngestionJobId] = useState('');
  const [isOpenRemoveIngestionJobModal, setIsOpenRemoveIngestionJobModal] = useState(false);
  const [newJobDicomModality, setNewJobDicomModality] = useState('');
  const [newJobStartTime, setNewJobStartTime] = useState(DEFAULT_JOB_START_TIME);
  const [newJobEndTime, setNewJobEndTime] = useState(DEFAULT_JOB_END_TIME);
  const [isSavingIngestionJob, setIsSavingIngestionJob] = useState(false);
  const [isDeletingIngestionJob, setIsDeletingIngestionJob] = useState(false);
  const [isImportingIngestionJobs, setIsImportingIngestionJobs] = useState(false);
  const ingestionJobsCsvInputRef = useRef<HTMLInputElement>(null);

  const resetIngestionJobForm = useCallback(() => {
    setNewJobModel(null);
    setNewJobModalities([]);
    setNewJobInterval(String(minIngestionJobIntervalMinutes));
    setNewJobScheduleType('always');
    setNewJobStartDate(null);
    setNewJobEndDate(null);
    setNewJobFocusedInput(null);
    setNewJobDicomModality('');
    setNewJobStartTime(DEFAULT_JOB_START_TIME);
    setNewJobEndTime(DEFAULT_JOB_END_TIME);
  }, []);

  const fetchIngestionJobs = useCallback(async () => {
    try {
      const response = await inferenceRepository.GetInferenceIngestionJobs();
      setJobs(response.data);
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error('Error fetching inference ingestion jobs:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showAlert from AlertContext is unstable
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchIngestionJobs().then(() => setLoading(false));

    const interval = setInterval(() => {
      fetchIngestionJobs();
    }, POLLING_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [fetchIngestionJobs]);

  const refreshIngestionJobs = () => {
    setLoading(true);
    const run = async () => {
      await fetchIngestionJobs();
      setLoading(false);
    };
    run();
  };

  const startIngestionJob = async (id: string) => {
    setStartingIngestionJob(true);
    try {
      const response = await inferenceRepository.StartInferenceIngestionJob({ id });
      showAlert(response.message, 'success');
      setSelectedIngestionJobToStartStop('');
      fetchIngestionJobs();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error starting ingestion job: ${error}`);
      showAlert(error.message, 'error');
    }
    setStartingIngestionJob(false);
  };

  const stopIngestionJob = async (id: string) => {
    setStoppingIngestionJob(true);
    try {
      const response = await inferenceRepository.StopInferenceIngestionJob({ id });
      showAlert(response.message, 'success');
      setSelectedIngestionJobToStartStop('');
      fetchIngestionJobs();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error stopping ingestion job: ${error}`);
      showAlert(error.message, 'error');
    }
    setStoppingIngestionJob(false);
  };

  const deleteIngestionJob = async () => {
    setIsDeletingIngestionJob(true);
    try {
      const response = await inferenceRepository.DeleteInferenceIngestionJob({
        id: selectedIngestionJobId,
      });
      showAlert(response.message, 'success');
      setIsOpenRemoveIngestionJobModal(false);
      setSelectedIngestionJobId('');
      fetchIngestionJobs();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error deleting ingestion job: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsDeletingIngestionJob(false);
  };

  const handleImportIngestionJobsCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!isCSVFile(file)) {
      showAlert('Only CSV files are allowed.', 'error');
      return;
    }

    setIsImportingIngestionJobs(true);
    try {
      const response = await inferenceRepository.ImportInferenceIngestionJobs({ file });
      showAlert(response.message, 'success');
      fetchIngestionJobs();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error importing ingestion jobs CSV: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsImportingIngestionJobs(false);
  };

  const handleSaveIngestionJob = async () => {
    if (!newJobDicomModality) {
      showAlert('DICOM Modality is required', 'error');
      return;
    }
    if (!newJobModel) {
      showAlert('Model is required', 'error');
      return;
    }
    if (newJobModalities.length === 0) {
      showAlert('At least one modality must be selected', 'error');
      return;
    }
    const parsedInterval = parseInt(newJobInterval.trim(), 10);
    if (
      newJobInterval.trim() === '' ||
      isNaN(parsedInterval) ||
      parsedInterval < minIngestionJobIntervalMinutes
    ) {
      showAlert(
        `Interval is required and must be at least ${minIngestionJobIntervalMinutes} minutes`,
        'error'
      );
      return;
    }
    if (newJobScheduleType === 'dateRange' && (!newJobStartDate || !newJobEndDate)) {
      showAlert('Both start and end dates are required for a date range schedule', 'error');
      return;
    }

    const selectedModel = availableModelsRef.current.find(
      m => m.containerId === newJobModel.value
    );

    if (isAddIngestionJob && !selectedModel) {
      showAlert('Selected model not found. Please try again.', 'error');
      return;
    }

    const scheduleStartTimestamp =
      newJobScheduleType === 'dateRange'
        ? buildTimestampFromDateAndTime(newJobStartDate, newJobStartTime)
        : 0;
    const scheduleEndTimestamp =
      newJobScheduleType === 'dateRange'
        ? buildTimestampFromDateAndTime(newJobEndDate, newJobEndTime)
        : 0;

    if (newJobScheduleType === 'dateRange' && scheduleStartTimestamp >= scheduleEndTimestamp) {
      showAlert('Start date/time must be before end date/time', 'error');
      return;
    }

    setIsSavingIngestionJob(true);
    try {
      if (isAddIngestionJob) {
        const response = await inferenceRepository.CreateInferenceIngestionJob({
          dicomModality: newJobDicomModality,
          containerId: selectedModel.containerId,
          modelId: selectedModel.modelId,
          modelName: selectedModel.modelName,
          modelVersion: selectedModel.version,
          modalities: newJobModalities.map(m => m.value),
          intervalInMinutes: parsedInterval,
          scheduleStartTimestamp,
          scheduleEndTimestamp,
        });
        showAlert(response.message, 'success');
      } else {
        const response = await inferenceRepository.UpdateInferenceIngestionJob({
          id: selectedIngestionJobId,
          modalities: newJobModalities.map(m => m.value),
          intervalInMinutes: parsedInterval,
          scheduleStartTimestamp,
          scheduleEndTimestamp,
        });
        showAlert(response.message, 'success');
      }
      setIsOpenAddEditIngestionJobModal(false);
      setIsAddIngestionJob(true);
      setSelectedIngestionJobId('');
      resetIngestionJobForm();
      fetchIngestionJobs();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error saving ingestion job: ${error}`);
      showAlert(error.message, 'error');
    } finally {
      setIsSavingIngestionJob(false);
    }
  };

  const openAddJobModal = () => {
    setIsOpenAddEditIngestionJobModal(true);
  };

  const openEditJobModal = (row: GetInferenceIngestionJobsResponse) => {
    const matchedModel = availableModelsRef.current.find(m => m.containerId === row.containerId);
    setNewJobModel(
      matchedModel
        ? {
            value: matchedModel.containerId,
            label: `${matchedModel.modelName} - ${matchedModel.version}`,
          }
        : {
            value: row.modelName,
            label: `${row.modelName} - ${row.modelVersion}`,
          }
    );
    setNewJobDicomModality(row.dicomModality || '');
    setNewJobModalities(row.modalities.map(m => ({ value: m, label: m })));
    const existingInterval = Number(row.intervalInMinutes);
    setNewJobInterval(
      String(
        !Number.isFinite(existingInterval) || existingInterval <= 0
          ? minIngestionJobIntervalMinutes
          : existingInterval
      )
    );
    if (!row.scheduleStartTimestamp && !row.scheduleEndTimestamp) {
      setNewJobScheduleType('always');
      setNewJobStartDate(null);
      setNewJobEndDate(null);
      setNewJobStartTime(DEFAULT_JOB_START_TIME);
      setNewJobEndTime(DEFAULT_JOB_END_TIME);
    } else {
      setNewJobScheduleType('dateRange');
      const startMoment = row.scheduleStartTimestamp
        ? moment.unix(row.scheduleStartTimestamp)
        : null;
      const endMoment = row.scheduleEndTimestamp ? moment.unix(row.scheduleEndTimestamp) : null;
      setNewJobStartDate(startMoment);
      setNewJobEndDate(endMoment);
      setNewJobStartTime(startMoment ? startMoment.format('HH:mm') : DEFAULT_JOB_START_TIME);
      setNewJobEndTime(endMoment ? endMoment.format('HH:mm') : DEFAULT_JOB_END_TIME);
    }
    setSelectedIngestionJobId(row.id);
    setIsAddIngestionJob(false);
    setIsOpenAddEditIngestionJobModal(true);
  };

  const openRemoveJobModal = (jobId: string) => {
    setSelectedIngestionJobId(jobId);
    setIsOpenRemoveIngestionJobModal(true);
  };

  const closeAddEditJobModal = () => {
    setIsOpenAddEditIngestionJobModal(false);
    setIsAddIngestionJob(true);
    setSelectedIngestionJobId('');
    resetIngestionJobForm();
  };

  const closeRemoveJobModal = () => {
    if (isDeletingIngestionJob) {
      return;
    }
    setIsOpenRemoveIngestionJobModal(false);
    setSelectedIngestionJobId('');
  };

  const handleStartStop = (jobId: string, running: boolean) => {
    setSelectedIngestionJobToStartStop(jobId);
    if (running) {
      stopIngestionJob(jobId);
    } else {
      startIngestionJob(jobId);
    }
  };

  return {
    jobs,
    loading,
    startingIngestionJob,
    stoppingIngestionJob,
    selectedIngestionJobToStartStop,
    isOpenAddEditIngestionJobModal,
    newJobModel,
    setNewJobModel,
    newJobModalities,
    setNewJobModalities,
    newJobInterval,
    setNewJobInterval,
    newJobScheduleType,
    setNewJobScheduleType,
    newJobStartDate,
    setNewJobStartDate,
    newJobEndDate,
    setNewJobEndDate,
    newJobFocusedInput,
    setNewJobFocusedInput,
    isAddIngestionJob,
    selectedIngestionJobId,
    isOpenRemoveIngestionJobModal,
    newJobDicomModality,
    setNewJobDicomModality,
    newJobStartTime,
    setNewJobStartTime,
    newJobEndTime,
    setNewJobEndTime,
    isSavingIngestionJob,
    isDeletingIngestionJob,
    isImportingIngestionJobs,
    ingestionJobsCsvInputRef,
    refreshIngestionJobs,
    handleImportIngestionJobsCsv,
    handleSaveIngestionJob,
    deleteIngestionJob,
    openAddJobModal,
    openEditJobModal,
    openRemoveJobModal,
    closeAddEditJobModal,
    closeRemoveJobModal,
    handleStartStop,
  };
}

export type UseIngestionJobsResult = ReturnType<typeof useIngestionJobs>;
