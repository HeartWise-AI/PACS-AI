import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@ohif/ui-next';
import { Button, Typography } from '@ohif/ui';
import Modal from '../../../../components/Modal';
import type { ModalityFormState } from '../../types';

type AddEditModalityModalProps = {
  isOpen: boolean;
  isAddModality: boolean;
  selectedModality: ModalityFormState;
  isAddingModality: boolean;
  isUpdatingModality: boolean;
  onClose: () => void;
  onChange: (next: ModalityFormState | ((prev: ModalityFormState) => ModalityFormState)) => void;
  onSave: () => void;
};

const AddEditModalityModal = ({
  isOpen,
  isAddModality,
  selectedModality,
  isAddingModality,
  isUpdatingModality,
  onClose,
  onChange,
  onSave,
}: AddEditModalityModalProps) => {
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
          {t(isAddModality ? 'New Modality' : 'Edit Modality')}
        </Typography>
        <Typography
          variant="body"
          className="mt-2 font-light text-white text-opacity-70"
        >
          {t(isAddModality ? 'Add a new DICOM modality.' : 'Update modality information.')}
        </Typography>

        <div className="mt-4">
          <div className="flex flex-col gap-4">
            <Input
              id="modalityId"
              disabled={!isAddModality}
              placeholder={t('Modality ID')}
              className="w-full disabled:opacity-50"
              type="text"
              autoFocus
              value={selectedModality.id}
              onChange={e => {
                onChange({ ...selectedModality, id: e.target.value });
              }}
            />
            <Input
              id="targetAET"
              placeholder={t('Target AET')}
              className="w-full"
              type="text"
              value={selectedModality.aet}
              onChange={e => {
                onChange({ ...selectedModality, aet: e.target.value });
              }}
            />
            <Input
              id="host"
              placeholder={t('Host')}
              className="w-full"
              type="text"
              value={selectedModality.host}
              onChange={e => {
                onChange({ ...selectedModality, host: e.target.value });
              }}
            />
            <Input
              id="port"
              placeholder={t('Port')}
              className="w-full"
              type="number"
              value={selectedModality.port}
              onChange={e => {
                onChange({ ...selectedModality, port: e.target.value });
              }}
            />
            <div>
              <Typography
                variant="body"
                className="mb-2 text-white"
              >
                {t('Enabled SCUs')}
              </Typography>
              <div className="my-2 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  id="tag-c-find"
                  checked={selectedModality.targetCFindEnabled}
                  onChange={e => {
                    const isChecked = e.target.checked;
                    onChange(prev => ({
                      ...prev,
                      targetCFindEnabled: isChecked,
                    }));
                  }}
                  className="accent-primary-light h-4 w-4 cursor-pointer rounded"
                />
                <Typography
                  variant="body"
                  component="label"
                  htmlFor="tag-c-find"
                  className="cursor-pointer text-white"
                >
                  {t('C-Find')}
                </Typography>
              </div>
              <div className="my-2 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  id="tag-c-move"
                  checked={selectedModality.targetCMoveEnabled}
                  onChange={e => {
                    const isChecked = e.target.checked;
                    onChange(prev => ({
                      ...prev,
                      targetCMoveEnabled: isChecked,
                    }));
                  }}
                  className="accent-primary-light h-4 w-4 cursor-pointer rounded"
                />
                <Typography
                  variant="body"
                  component="label"
                  htmlFor="tag-c-move"
                  className="cursor-pointer text-white"
                >
                  {t('C-Move')}
                </Typography>
              </div>
              <div className="my-2 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  id="tag-c-store"
                  checked={selectedModality.targetCStoreEnabled}
                  onChange={e => {
                    const isChecked = e.target.checked;
                    onChange(prev => ({
                      ...prev,
                      targetCStoreEnabled: isChecked,
                    }));
                  }}
                  className="accent-primary-light h-4 w-4 cursor-pointer rounded"
                />
                <Typography
                  variant="body"
                  component="label"
                  htmlFor="tag-c-store"
                  className="cursor-pointer text-white"
                >
                  {t('C-Store')}
                </Typography>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex w-full justify-end">
          <Button
            disabled={isAddingModality || isUpdatingModality}
            className="h-[41px] w-[111px] rounded-lg"
            onClick={onSave}
          >
            {isAddingModality || isUpdatingModality ? '...' : t('Save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AddEditModalityModal;
