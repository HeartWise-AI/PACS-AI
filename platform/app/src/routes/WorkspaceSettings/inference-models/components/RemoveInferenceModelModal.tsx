import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@ohif/ui';
import Modal from '../../../../components/Modal';

type RemoveInferenceModelModalProps = {
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const RemoveInferenceModelModal = ({
  isOpen,
  isDeleting,
  onClose,
  onConfirm,
}: RemoveInferenceModelModalProps) => {
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
          {t('Remove Inference Model')}
        </Typography>
        <Typography
          variant="body"
          className="mt-2 font-light text-white text-opacity-70"
        >
          {t('Are you sure you want to delete this model?')}
        </Typography>

        <div className="mt-4 flex w-full justify-end">
          <button
            disabled={isDeleting}
            className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400"
            onClick={onClose}
          >
            {isDeleting ? '...' : t('Cancel')}
          </button>
          <button
            disabled={isDeleting}
            className="h-[41px] w-[111px] rounded-lg bg-red-700 text-white"
            onClick={onConfirm}
          >
            {isDeleting ? '...' : t('Confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RemoveInferenceModelModal;
