import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Typography } from '@ohif/ui';
import refreshIcon from '../../../../assets/pacs/icons/refresh.png';
import type { GetInferenceModelVersionResponse } from '../../../../api/inferenceDTO';
import Modal from '../../../../components/Modal';
import type { InferenceModelView } from '../../types';
import type { TrackedModelDeployment } from '../modelDeployment';
import ModelDeploymentProgressPanel from './ModelDeploymentProgressPanel';

type InferenceModelVersionsModalProps = {
  isOpen: boolean;
  model: InferenceModelView | null;
  versions: GetInferenceModelVersionResponse[];
  selectedVersionId: string;
  loading: boolean;
  deploying: boolean;
  deployment?: TrackedModelDeployment;
  onClose: () => void;
  onSelect: (versionId: string) => void;
  onDeploy: () => void;
};

const InferenceModelVersionsModal = ({
  isOpen,
  model,
  versions,
  selectedVersionId,
  loading,
  deploying,
  deployment,
  onClose,
  onSelect,
  onDeploy,
}: InferenceModelVersionsModalProps) => {
  const { t } = useTranslation('Common');
  const selected = versions.find(version => version.id === selectedVersionId);
  const deploymentFinished = Boolean(deployment?.progress.terminal);

  return (
    <Modal
      isOpen={isOpen}
      size="w-[600px] max-w-[calc(100vw-32px)]"
      isCloseable
      onClose={onClose}
    >
      <div className="relative">
        <Typography
          variant="h6"
          className="font-light text-white"
        >
          {t('Model Versions')}
        </Typography>
        <Typography
          variant="body"
          className="mt-1 font-light text-white text-opacity-70"
        >
          {model?.name}
        </Typography>

        {deployment && <ModelDeploymentProgressPanel deployment={deployment} />}

        <div
          className={`max-h-[360px] overflow-y-auto border-y border-white border-opacity-10 ${
            deployment ? 'mt-4' : 'mt-5'
          }`}
        >
          {loading ? (
            <div className="flex h-28 items-center justify-center">
              <img
                src={refreshIcon}
                alt={t('Loading')}
                className="h-5 w-5 animate-spin"
              />
            </div>
          ) : versions.length === 0 ? (
            <p className="py-8 text-center text-sm text-white text-opacity-60">
              {t('No model versions available')}
            </p>
          ) : (
            versions.map(version => {
              const unavailable = version.status !== 'AVAILABLE';
              const disabled = unavailable || version.active || deploying;
              return (
                <label
                  key={version.id}
                  className={`flex min-h-[76px] items-center gap-3 border-b border-white border-opacity-10 px-2 py-3 last:border-b-0 ${
                    disabled
                      ? 'cursor-default opacity-60'
                      : 'cursor-pointer hover:bg-white hover:bg-opacity-5'
                  }`}
                >
                  <input
                    type="radio"
                    name="inference-model-version"
                    value={version.id}
                    checked={selectedVersionId === version.id}
                    disabled={disabled}
                    onChange={() => onSelect(version.id)}
                    className="h-4 w-4 accent-[#C8F469]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">v{version.version}</span>
                      {version.active && (
                        <span className="bg-opacity-15 rounded bg-[#C8F469] px-2 py-0.5 text-xs text-[#C8F469]">
                          {t('Current')}
                        </span>
                      )}
                      {unavailable && (
                        <span className="bg-opacity-15 rounded bg-red-500 px-2 py-0.5 text-xs text-red-300">
                          {t('Revoked')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-white text-opacity-60">
                      {version.imageReference}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-white text-opacity-40">
                      {version.imageDigest.slice(0, 19)}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {deploymentFinished ? (
            <Button
              className="h-[41px] min-w-[110px] rounded-lg"
              onClick={onClose}
            >
              {t('OK')}
            </Button>
          ) : (
            <>
              <Button
                disabled={deploying}
                className="h-[41px] rounded-lg bg-white bg-opacity-10 px-4 text-white"
                onClick={onClose}
              >
                {deploying ? t('Close') : t('Cancel')}
              </Button>
              <Button
                disabled={
                  !selected || selected.active || selected.status !== 'AVAILABLE' || deploying
                }
                className="h-[41px] min-w-[110px] rounded-lg"
                onClick={onDeploy}
              >
                {deploying ? t('Deploying') : t('Deploy')}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default InferenceModelVersionsModal;
