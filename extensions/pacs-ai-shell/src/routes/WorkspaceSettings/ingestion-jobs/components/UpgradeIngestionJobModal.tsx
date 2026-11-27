import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@pacs-ai/ui';
import type { GetInferenceIngestionJobsResponse } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import Modal from '../../../../components/Modal';

type UpgradeIngestionJobModalProps = {
  job: GetInferenceIngestionJobsResponse | null;
  targetVersion?: string;
  isUpgrading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const UpgradeIngestionJobModal = ({
  job,
  targetVersion,
  isUpgrading,
  onClose,
  onConfirm,
}: UpgradeIngestionJobModalProps) => {
  const { t } = useTranslation('Common');
  if (!job || !targetVersion) {
    return null;
  }

  return (
    <Modal
      isOpen={true}
      size="min-w-[440px]"
      isCloseable={!isUpgrading}
      onClose={onClose}
    >
      <div className="relative">
        <Typography
          variant="h6"
          className="font-light text-white"
        >
          {t('Upgrade Ingestion Job')}
        </Typography>
        <Typography
          variant="body"
          className="mt-2 font-light text-white text-opacity-70"
        >
          {t('Upgrade job')} {job.id} {t('from version')} {job.modelVersion} {t('to version')}{' '}
          {targetVersion}?
        </Typography>
        <Typography
          variant="body"
          className="mt-2 font-light text-white text-opacity-70"
        >
          {t('The job must remain stopped and have no active processing while it is upgraded.')}
        </Typography>
        <div className="mt-4 flex w-full justify-end">
          <button
            disabled={isUpgrading}
            className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400 disabled:opacity-50"
            onClick={onClose}
          >
            {t('Cancel')}
          </button>
          <button
            disabled={isUpgrading}
            className="bg-primary h-[41px] min-w-[111px] rounded-lg px-4 text-black disabled:opacity-50"
            onClick={onConfirm}
          >
            {isUpgrading ? '...' : t('Upgrade')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UpgradeIngestionJobModal;
