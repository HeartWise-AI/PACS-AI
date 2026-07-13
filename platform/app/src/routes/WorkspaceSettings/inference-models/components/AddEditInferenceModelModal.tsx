import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@ohif/ui-next';
import { Button, Typography } from '@ohif/ui';
import Modal from '../../../../components/Modal';
import refreshIcon from '../../../../assets/pacs/icons/refresh.png';
import { outputModeOptions } from '../../constants';
import type { InferenceModelView, StatusColorClasses } from '../../types';
import { GetInferenceModelInfoResponse } from '../../../../api/inferenceDTO';
import { getDICOMTagsName } from '../../utils';

type AddEditInferenceModelModalProps = {
  isOpen: boolean;
  isAdd: boolean;
  isView: boolean;
  model: InferenceModelView;
  modelInfo: GetInferenceModelInfoResponse;
  fetchingInfo: boolean;
  envKey: string;
  envValue: string;
  isAdding: boolean;
  isUpdating: boolean;
  statusColor: StatusColorClasses;
  onClose: () => void;
  onChangeSelected: (
    next: InferenceModelView | ((prev: InferenceModelView) => InferenceModelView)
  ) => void;
  onChangeEnvKey: (value: string) => void;
  onChangeEnvValue: (value: string) => void;
  onAdd: () => void;
  onUpdate: () => void;
};

const AddEditInferenceModelModal = ({
  isOpen,
  isAdd,
  isView,
  model,
  modelInfo,
  fetchingInfo,
  envKey,
  envValue,
  isAdding,
  isUpdating,
  statusColor,
  onClose,
  onChangeSelected,
  onChangeEnvKey,
  onChangeEnvValue,
  onAdd,
  onUpdate,
}: AddEditInferenceModelModalProps) => {
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
      {t(
        isAdd
          ? 'New Inference Model'
          : isView
            ? 'View Inference Model'
            : 'Edit Inference Model'
      )}
    </Typography>
    <Typography
      variant="body"
      className="mt-2 font-light text-white text-opacity-70"
    >
      {t(
        isAdd
          ? 'Add a new inference model.'
          : isView
            ? 'View inference model information.'
            : 'Update inference model information.'
      )}
    </Typography>

    <div className="mt-4">
      <div className="flex flex-col gap-4">
        {(isView || !isAdd) && (
          <Input
            id="inferenceModelId"
            disabled={true}
            placeholder={t('Container ID')}
            className="w-full disabled:opacity-50"
            type="text"
            autoFocus
            value={model.container.id}
            onChange={e => {
              onChangeSelected({
                ...model,
                id: e.target.value,
              });
            }}
          />
        )}

        <Input
          id="inferenceModelName"
          placeholder={t('Name')}
          className="w-full disabled:opacity-50"
          disabled={isView || !isAdd}
          type="text"
          value={model.name.toLowerCase()}
          onChange={e => {
            onChangeSelected({
              ...model,
              name: e.target.value.toLowerCase(),
            });
          }}
        />
        <Input
          id="inferenceModelImage"
          placeholder={t('Image')}
          className="w-full disabled:opacity-50"
          disabled={isView || !isAdd}
          type="text"
          value={model.dockerImage}
          onChange={e => {
            const sanitizedValue = e.target.value.replace(/\s+/g, ''); // remove all spaces
            onChangeSelected({
              ...model,
              dockerImage: sanitizedValue,
            });
          }}
        />

        {/* environment variables */}
        <div className="border-b border-white border-opacity-10 pb-4">
          <Typography
            variant="body"
            className="mb-2 text-white"
          >
            {t('Environmental Variables')}
          </Typography>
          {isAdd && (
            <div className="flex items-center gap-2">
              <Input
                id="environmentalVariablesKey"
                placeholder={t('Key')}
                className="h-[43px] w-full disabled:opacity-50"
                disabled={!isAdd}
                type="text"
                value={envKey}
                onChange={e => {
                  onChangeEnvKey(e.target.value);
                }}
              />
              <Input
                id="environmentalVariablesValue"
                placeholder={t('Value')}
                className="h-[43px] w-full disabled:opacity-50"
                disabled={!isAdd}
                type="text"
                value={envValue}
                onChange={e => {
                  onChangeEnvValue(e.target.value);
                }}
              />
              <button
                disabled={isAdding || isUpdating}
                className="h-[43px] min-w-[60px] rounded-lg bg-[#C8F469] bg-opacity-10 px-4 text-center"
                onClick={() => {
                  onChangeSelected({
                    ...model,
                    envs: [
                      ...(model.envs?.filter(
                        env => typeof env === 'object' && 'key' in env
                      ) ?? []),
                      {
                        key: envKey,
                        value: envValue,
                      },
                    ],
                  });
                  onChangeEnvKey('');
                  onChangeEnvValue('');
                }}
              >
                <span className="text-[#C8F469]"> {t('Add')}</span>
              </button>
            </div>
          )}
          {/* added environment variables */}
          <div className="mt-4 flex flex-col gap-2">
            {isAdd ? (
              model.envs?.map((variable, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2"
                >
                  <Input
                    id={`env-key-${index}`}
                    label=""
                    value={variable.key}
                    className="h-[43px] w-full disabled:opacity-50"
                    disabled={true}
                    type="text"
                  />
                  <Input
                    id={`env-value-${index}`}
                    label=""
                    value={variable.value}
                    className="h-[43px] w-full disabled:opacity-50"
                    disabled={true}
                    type="text"
                  />
                  <button
                    disabled={isAdding || isUpdating}
                    className="flex h-[43px] w-[60px] items-center justify-center rounded-lg bg-red-500 bg-opacity-10"
                    onClick={() => {
                      onChangeSelected({
                        ...model,
                        envs: model.envs
                          .filter(env => typeof env === 'object' && 'key' in env)
                          .filter((_, i) => i !== index),
                      });
                    }}
                  >
                    <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-red-500 text-red-500">
                      <span className="-mt-[1px] text-xl">{t('-')}</span>
                    </div>
                  </button>
                </div>
              ))
            ) : model.envs?.length === 0 ? (
              <div className="flex h-[50px] items-center justify-center">
                <Typography className="mb-2 text-white text-opacity-50">
                  {t('No environment variables added')}
                </Typography>
              </div>
            ) : (
              model.envs?.map((variable, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2"
                >
                  <Input
                    id={`env-key-${index}`}
                    label=""
                    value={variable.key}
                    className="h-[43px] w-full disabled:opacity-50"
                    disabled={true}
                    type="text"
                  />
                  <Input
                    id={`env-value-${index}`}
                    label=""
                    value={variable.value}
                    className="h-[43px] w-full disabled:opacity-50"
                    disabled={true}
                    type="text"
                  />
                </div>
              ))
            )}
          </div>
          {isAdd && (
            <Typography
              variant="body"
              className="mt-1 text-white text-opacity-50"
            >
              <span className="text-red-500">*</span>{' '}
              {t('Environment Variable should contain at least a key and value.')}
            </Typography>
          )}
        </div>
        {/* Allowed DICOM Tags */}
        {!isAdd && !isView && (
          <div className="border-b border-white border-opacity-10 pb-4">
            <Typography
              variant="body"
              className="mb-2 text-white"
            >
              {t('Allowed DICOM Tags')}
            </Typography>
            {fetchingInfo ? (
              <div className="flex items-center justify-center">
                <img
                  src={refreshIcon}
                  alt="Refresh icon"
                  className="h-5 w-5 animate-spin"
                />
              </div>
            ) : modelInfo.supportedDicomTags?.[0] === '*' ? (
              <div className="my-4 flex items-center justify-center gap-2">
                <Typography
                  variant="body"
                  className="text-center text-white/70"
                >
                  All metadata are supported
                </Typography>
              </div>
            ) : (
              modelInfo.supportedDicomTags?.map((tag, index) => (
                <div
                  key={index}
                  className="my-2 flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="checkbox"
                    id={`tag-${index}`}
                    checked={!model.disallowedDICOMTags?.includes(tag)}
                    onChange={e => {
                      const isChecked = e.target.checked;
                      onChangeSelected(prev => ({
                        ...prev,
                        disallowedDICOMTags: isChecked
                          ? prev.disallowedDICOMTags?.filter(t => t !== tag)
                          : [...(prev.disallowedDICOMTags || []), tag],
                      }));
                    }}
                    className="accent-primary-light h-4 w-4 cursor-pointer rounded"
                  />
                  <Typography
                    variant="body"
                    component="label"
                    htmlFor={`tag-${index}`}
                    className="cursor-pointer text-white"
                  >
                    {tag} ({getDICOMTagsName(tag)})
                  </Typography>
                </div>
              ))
            )}
          </div>
        )}
        {(isView || !isAdd) && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Typography
                variant="body"
                className="text-white text-opacity-70"
              >
                {t('Status')}
              </Typography>
              <div className="flex min-w-[100px] items-center gap-2">
                <div
                  className={`inline-flex h-[24px] items-center justify-center gap-1 rounded-full px-2 ${statusColor.bg} ${statusColor.bgOpacity} ${statusColor.text}`}
                >
                  <span className="text-sm capitalize">
                    {model.container.status}
                  </span>
                  <div
                    className={`h-1 w-1 rounded-full ${statusColor.dot}`}
                  ></div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Typography
                variant="body"
                className="text-white text-opacity-70"
              >
                {t('CPU%')}
              </Typography>
              <div className="flex min-w-[100px] items-center gap-2">
                <div
                  className={`inline-flex h-[24px] items-center justify-center gap-1 rounded-full bg-[#323631] bg-opacity-10 px-2`}
                >
                  <span className="text-sm text-white">
                    {model.container.cpuPercentUsage.toFixed(3)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <select
          id="inferenceModelOutputMode"
          className={`mb-4 block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-[#2D302D] py-3 px-3 pr-8 text-lg leading-tight placeholder:opacity-50 focus:outline-none ${
            model.outputMode ? 'text-white' : 'text-white/40'
          }`}
          disabled={isView}
          value={model.outputMode}
          onChange={e => {
            onChangeSelected({
              ...model,
              outputMode: e.target.value,
            });
          }}
        >
          <option
            value=""
            disabled
          >
            Select Output Mode
          </option>
          {outputModeOptions.map(option => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
    {!isView && (
      <div className="mt-5 flex w-full justify-end">
        <Button
          disabled={isAdding || isUpdating}
          className="h-[41px] w-[111px] rounded-lg"
          onClick={isAdd ? onAdd : onUpdate}
        >
          {isAdding || isUpdating
            ? '...'
            : t(isAdd ? 'Add' : 'Update')}
        </Button>
      </div>
    )}
  </div>
    </Modal>
  );
};

export default AddEditInferenceModelModal;
