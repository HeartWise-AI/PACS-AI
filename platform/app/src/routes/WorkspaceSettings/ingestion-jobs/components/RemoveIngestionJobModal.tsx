import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@ohif/ui';
import Modal from '../../../../components/Modal';

type RemoveIngestionJobModalProps = {
  isOpen: boolean;
  jobId: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const RemoveIngestionJobModal = ({
  isOpen,
  jobId,
  isDeleting,
  onClose,
  onConfirm,
}: RemoveIngestionJobModalProps) => {
  const { t } = useTranslation('Common');

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      size="min-w-[400px]"
      isCloseable={true}
      onClose={onClose}
    >
      <div className="relative">
        <Typography
          variant="h6"
          className="font-light text-white"
        >
          {t('Remove Ingestion Job')}
        </Typography>
        <Typography
          variant="body"
          className="mt-2 font-light text-white text-opacity-70"
        >
          {t('Are you sure you want to delete job ')} {jobId}?
        </Typography>
        <div className="mt-4 flex w-full justify-end">
          <button
            disabled={isDeleting}
            className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400 disabled:opacity-50"
            onClick={onClose}
          >
            {t('Cancel')}
          </button>
          <button
            disabled={isDeleting}
            className="h-[41px] w-[111px] rounded-lg bg-red-700 text-white disabled:opacity-50"
            onClick={onConfirm}
          >
            {isDeleting ? '...' : t('Delete')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RemoveIngestionJobModal;
