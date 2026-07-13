import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@ohif/ui';
import Modal from '../../../../components/Modal';

type RemoveModalityModalProps = {
  isOpen: boolean;
  modalityId: string;
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const RemoveModalityModal = ({
  isOpen,
  modalityId,
  isRemoving,
  onClose,
  onConfirm,
}: RemoveModalityModalProps) => {
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
          {t('Remove Modality')}
        </Typography>
        <Typography
          variant="body"
          className="mt-2 font-light text-white text-opacity-70"
        >
          {t('Are you sure you want to delete ')} {modalityId}?
        </Typography>

        <div className="mt-4 flex w-full justify-end">
          <button
            disabled={isRemoving}
            className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400"
            onClick={onClose}
          >
            {isRemoving ? '...' : t('Cancel')}
          </button>
          <button
            disabled={isRemoving}
            className="h-[41px] w-[111px] rounded-lg bg-red-700 text-white"
            onClick={onConfirm}
          >
            {isRemoving ? '...' : t('Confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RemoveModalityModal;
