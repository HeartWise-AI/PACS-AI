import React from 'react';
import { useTranslation } from 'react-i18next';
import Table from '../../../../components/Table';
import playIcon from '../../../../assets/pacs/icons/play.png';
import refreshIcon from '../../../../assets/pacs/icons/refresh.png';
import stopIcon from '../../../../assets/pacs/icons/stop.png';
import { getInferenceModelHeaders, InferenceContainerStatus } from '../../constants';
import type { InferenceModelView } from '../../types';
import { getContainerStatusColor, getDockerImageVersion } from '../../utils';
import InferenceModelActionButton from './InferenceModelActionButton';

type InferenceModelsTableProps = {
  models: InferenceModelView[];
  loading: boolean;
  starting: boolean;
  stopping: boolean;
  deleting: boolean;
  selectedContainerToStartStop: string;
  onStartStop: (containerId: string, running: boolean) => void;
  onEdit: (row: InferenceModelView) => void;
  onView: (row: InferenceModelView) => void;
  onViewFacts: (containerId: string) => void;
  onDelete: (modelId: string) => void;
};

const InferenceModelsTable = ({
  models,
  loading,
  starting,
  stopping,
  deleting,
  selectedContainerToStartStop,
  onStartStop,
  onEdit,
  onView,
  onViewFacts,
  onDelete,
}: InferenceModelsTableProps) => {
  const { t } = useTranslation('Common');
  const headers = getInferenceModelHeaders(t);

  if (loading) {
    return (
      <div
        role="status"
        className={`grid max-w-full animate-pulse grid-cols-5 gap-4`}
      >
        {Array.from({ length: 5 }, (_, c) => (
          <div key={c}>
            {Array.from({ length: 3 }, (_, r) => (
              <div key={r}>
                <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (models.length === 0) {
    return <p className="text-center text-white opacity-60">{t('No Data Found')}</p>;
  }

  return (
    <Table
      headers={headers}
      data={models}
      className={'max-w-[170px]'}
    >
      {(cell, header, row) => {
        if (header.value === 'containerId') {
          return (
            <div className="w-[250px] text-white">{row.container.id?.substring(0, 12) || ''}</div>
          );
        }
        if (header.value === 'name') {
          return <div className="w-[250px] text-white">{cell}</div>;
        }
        if (header.value === 'version') {
          return (
            <div className="w-[200px] text-white">{getDockerImageVersion(row.dockerImage)}</div>
          );
        }
        if (header.value === 'dockerImage') {
          return <div className="w-[200px] text-white">{cell}</div>;
        }
        if (header.value === 'status') {
          const statusColor = getContainerStatusColor(row.container.status);
          return (
            <div className="flex min-w-[100px] items-center gap-2">
              <div
                className={`inline-flex h-[27px] items-center justify-center gap-1 rounded-full px-2 ${statusColor.bg} ${statusColor.bgOpacity} ${statusColor.text}`}
              >
                <span className="capitalize">{row.container.status}</span>
                <div className={`h-1 w-1 rounded-full ${statusColor.dot}`}></div>
              </div>
            </div>
          );
        }
        if (header.value === 'cpu') {
          return (
            <div className="w-[200px] text-white">
              {row.container.cpuPercentUsage ? `${row.container.cpuPercentUsage.toFixed(3)}%` : '-'}
            </div>
          );
        }
        if (header.value === 'action') {
          const running = row.container.status === InferenceContainerStatus.RUNNING;
          return (
            <div
              className="flex items-center justify-center gap-2"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => onStartStop(row.container.id, running)}>
                {(running ? stopping : starting) &&
                selectedContainerToStartStop === row.container.id ? (
                  <img
                    src={refreshIcon}
                    alt="Refresh icon"
                    className="h-4 w-4 animate-spin"
                  />
                ) : (
                  <img
                    src={running ? stopIcon : playIcon}
                    alt={running ? 'Stop icon' : 'Play icon'}
                  />
                )}
              </button>
              <InferenceModelActionButton
                row={row}
                deleting={deleting}
                onEdit={onEdit}
                onView={onView}
                onViewFacts={onViewFacts}
                onDelete={onDelete}
              />
            </div>
          );
        }
        return cell;
      }}
    </Table>
  );
};

export default InferenceModelsTable;
