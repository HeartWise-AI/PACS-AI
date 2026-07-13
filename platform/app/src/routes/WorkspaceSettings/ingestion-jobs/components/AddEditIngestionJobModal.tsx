import React from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangePicker } from 'react-dates';
import moment from 'moment';
import { Input } from '@ohif/ui-next';
import { Button, Typography } from '@ohif/ui';
import Modal from '../../../../components/Modal';
import { GetInferenceAvailableModelsResponse } from '../../../../api/inferenceDTO';
import { minIngestionJobIntervalMinutes } from '../../constants';
import type { DICOMModalities, IngestionScheduleType, SelectOption } from '../../types';

type AddEditIngestionJobModalProps = {
  isOpen: boolean;
  isAdd: boolean;
  isSaving: boolean;
  dicomModalities: DICOMModalities[];
  availableModels: GetInferenceAvailableModelsResponse[];
  dicomModality: string;
  jobModel: SelectOption | null;
  jobModalities: SelectOption[];
  jobInterval: string;
  scheduleType: IngestionScheduleType;
  startDate: any;
  endDate: any;
  focusedInput: any;
  startTime: string;
  endTime: string;
  onClose: () => void;
  onChangeDicomModality: (value: string) => void;
  onChangeJobModel: (value: SelectOption | null) => void;
  onChangeJobModalities: (
    value: SelectOption[] | ((prev: SelectOption[]) => SelectOption[])
  ) => void;
  onChangeJobInterval: (value: string) => void;
  onChangeScheduleType: (value: IngestionScheduleType) => void;
  onChangeStartDate: (value: any) => void;
  onChangeEndDate: (value: any) => void;
  onChangeFocusedInput: (value: any) => void;
  onChangeStartTime: (value: string) => void;
  onChangeEndTime: (value: string) => void;
  onSave: () => void;
};

const AddEditIngestionJobModal = ({
  isOpen,
  isAdd,
  isSaving,
  dicomModalities,
  availableModels,
  dicomModality,
  jobModel,
  jobModalities,
  jobInterval,
  scheduleType,
  startDate,
  endDate,
  focusedInput,
  startTime,
  endTime,
  onClose,
  onChangeDicomModality,
  onChangeJobModel,
  onChangeJobModalities,
  onChangeJobInterval,
  onChangeScheduleType,
  onChangeStartDate,
  onChangeEndDate,
  onChangeFocusedInput,
  onChangeStartTime,
  onChangeEndTime,
  onSave,
}: AddEditIngestionJobModalProps) => {
  const { t } = useTranslation('Common');

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      size="w-[520px] max-w-[520px]"
      isCloseable={true}
      onClose={onClose}
    >
  <div className="relative">
    <Typography
      variant="h6"
      className="font-light text-white"
    >
      {t(isAdd ? 'Add Ingestion Job' : 'Edit Ingestion Job')}
    </Typography>
    <Typography
      variant="body"
      className="mt-2 font-light text-white text-opacity-70"
    >
      {t(
        isAdd
          ? 'Set up a new job to ingest and process inference data.'
          : 'Update the ingestion job configuration.'
      )}
    </Typography>

    <div className="mt-4 flex flex-col gap-4">
      {/* DICOM Modality selector */}
      <select
        disabled={!isAdd}
        className={`block h-[51px] w-full appearance-none rounded-lg border-none bg-[#2D302D] px-3 py-3 pr-8 text-base leading-tight focus:outline-none ${
          !isAdd ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${dicomModality ? 'text-white' : 'text-white/40'}`}
        value={dicomModality}
        onChange={e => onChangeDicomModality(e.target.value)}
      >
        <option
          value=""
          disabled
          className="text-white text-opacity-40"
        >
          {t('DICOM Modality')}
        </option>
        {dicomModalities.map(m => (
          <option
            key={m.id}
            value={m.id}
          >
            {m.aet}
          </option>
        ))}
      </select>
      {/* Model selector */}
      <select
        disabled={!isAdd}
        className={`block h-[51px] w-full appearance-none rounded-lg border-none bg-[#2D302D] px-3 py-3 pr-8 text-base leading-tight focus:outline-none ${
          !isAdd ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${jobModel?.value ? 'text-white' : 'text-white/40'}`}
        value={jobModel?.value || ''}
        onChange={e => {
          const selected = availableModels.find(
            m => m.containerId === e.target.value
          );
          onChangeJobModel(
            selected
              ? {
                  value: selected.containerId,
                  label: `${selected.modelName} - ${selected.version}`,
                }
              : null
          );
          onChangeJobModalities([]);
        }}
      >
        <option
          value=""
          disabled
          className="text-white text-opacity-40"
        >
          {t('Model')}
        </option>
        {availableModels.map(m => (
          <option
            key={m.containerId}
            value={m.containerId}
          >
            {m.modelName} - {m.version}
          </option>
        ))}
      </select>

      {/* Modalities multi-select */}
      <div>
        <select
          disabled={!isAdd}
          className={`block h-[51px] w-full appearance-none rounded-lg border-none bg-[#2D302D] px-3 py-3 pr-8 text-base leading-tight text-white/40 focus:outline-none ${
            !isAdd ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
          value=""
          onChange={e => {
            const val = e.target.value;
            if (!val) {
              return;
            }
            onChangeJobModalities(prev =>
              prev.find(m => m.value === val)
                ? prev.filter(m => m.value !== val)
                : [...prev, { value: val, label: val }]
            );
          }}
        >
          <option
            value=""
            disabled
            className="text-white text-opacity-40"
          >
            {t('Select Modalities')}
          </option>
          {(
            availableModels.find(m => m.containerId === jobModel?.value)
              ?.supportedDicomModalities ?? []
          ).map(m => (
            <option
              key={m}
              value={m}
            >
              {jobModalities.find(mod => mod.value === m) ? `✓ ${m}` : m}
            </option>
          ))}
        </select>
        {jobModalities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {jobModalities.map(mod => (
              <span
                key={mod.value}
                className="flex items-center gap-1 rounded-full bg-[#c8f469] bg-opacity-10 px-3 py-3 text-sm font-medium text-[#c8f469]"
              >
                {mod.label}
                <button
                  type="button"
                  disabled={!isAdd}
                  className={`ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#c8f469] ${!isAdd ? 'cursor-not-allowed opacity-40' : ''}`}
                  onClick={() =>
                    isAdd &&
                    onChangeJobModalities(prev => prev.filter(m => m.value !== mod.value))
                  }
                >
                  <svg
                    viewBox="0 0 14 14"
                    width="10"
                    height="10"
                    fill="none"
                    stroke="#151815"
                    strokeWidth="2"
                  >
                    <path d="M2 2l10 10M12 2L2 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Interval */}
      <div className="relative">
        <Input
          id="jobInterval"
          placeholder={`Interval (minimum of ${minIngestionJobIntervalMinutes} minutes)`}
          className="w-full pr-20"
          type="number"
          min={minIngestionJobIntervalMinutes}
          value={jobInterval}
          onChange={e => onChangeJobInterval(e.target.value)}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white text-opacity-50">
          {t('minutes')}
        </span>
      </div>

      {/* Schedule */}
      <div>
        <Typography
          variant="body"
          className="mb-3 text-white text-opacity-50"
        >
          {t('Schedule')}
        </Typography>
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="scheduleType"
              value="always"
              checked={scheduleType === 'always'}
              onChange={() => {
                onChangeScheduleType('always');
                onChangeStartDate(null);
                onChangeEndDate(null);
              }}
              className="h-4 w-4 cursor-pointer accent-[#c8f469]"
            />
            <span className="text-white">{t('Always')}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="scheduleType"
              value="dateRange"
              checked={scheduleType === 'dateRange'}
              onChange={() => onChangeScheduleType('dateRange')}
              className="h-4 w-4 cursor-pointer accent-[#c8f469]"
            />
            <span className="text-white">{t('Select Date Range')}</span>
          </label>
        </div>

        {/* Date pickers — only shown when dateRange is selected */}
        {scheduleType === 'dateRange' && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="pacs-date-range flex gap-3">
              <div className="relative flex-1">
                <DateRangePicker
                  startDate={startDate}
                  startDateId="JobRunFrom"
                  endDate={endDate}
                  endDateId="JobRunTo"
                  onDatesChange={({ startDate, endDate }) => {
                    onChangeStartDate(startDate);
                    onChangeEndDate(endDate);
                  }}
                  focusedInput={focusedInput}
                  onFocusChange={focusedInput => onChangeFocusedInput(focusedInput)}
                  isOutsideRange={() => false}
                  minimumNights={0}
                  appendToBody
                  openDirection="up"
                  startDatePlaceholderText="Run From"
                  endDatePlaceholderText="Run To"
                  renderMonthElement={({ month, onMonthSelect, onYearSelect }) => {
                    const years = [];
                    const currentYear = moment().year();
                    for (let i = currentYear - 10; i <= currentYear + 10; i++) {
                      years.push(i);
                    }
                    return (
                      <div className="MonthElementWrapper">
                        <select
                          value={month.month()}
                          onChange={e => onMonthSelect(month, e.target.value)}
                        >
                          {moment.months().map((label, index) => (
                            <option
                              key={index}
                              value={index}
                            >
                              {label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={month.year()}
                          onChange={e => onYearSelect(month, e.target.value)}
                        >
                          {years.map(year => (
                            <option
                              key={year}
                              value={year}
                            >
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-white text-opacity-50">
                  {t('Start Time')}
                </span>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => onChangeStartTime(e.target.value)}
                  className="h-[51px] w-full cursor-pointer rounded-lg border-none bg-[#2D302D] px-3 text-white accent-[#c8f469] [color-scheme:dark] focus:outline-none"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-white text-opacity-50">
                  {t('End Time')}
                </span>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => onChangeEndTime(e.target.value)}
                  className="h-[51px] w-full cursor-pointer rounded-lg border-none bg-[#2D302D] px-3 text-white accent-[#c8f469] [color-scheme:dark] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    <div className="mt-6 flex w-full justify-end">
      <Button
        className="h-[41px] rounded-lg px-8"
        disabled={isSaving}
        onClick={onSave}
      >
        {isSaving ? '...' : t(isAdd ? 'Start' : 'Save')}
      </Button>
    </div>
  </div>
    </Modal>
  );
};

export default AddEditIngestionJobModal;
