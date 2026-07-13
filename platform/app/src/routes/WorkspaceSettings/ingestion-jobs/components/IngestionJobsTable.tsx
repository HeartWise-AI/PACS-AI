import React from 'react';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import Table from '../../../../components/Table';
import playIcon from '../../../../assets/pacs/icons/play.png';
import refreshIcon from '../../../../assets/pacs/icons/refresh.png';
import stopIcon from '../../../../assets/pacs/icons/stop.png';
import { GetInferenceIngestionJobsResponse } from '../../../../api/inferenceDTO';
import { getIngestionJobHeaders, InferenceContainerStatus } from '../../constants';
import { getContainerStatusColor } from '../../utils';
import IngestionJobActionButton from './IngestionJobActionButton';
import ModalityBadges from './ModalityBadges';

type IngestionJobsTableProps = {
  jobs: GetInferenceIngestionJobsResponse[];
  loading: boolean;
  starting: boolean;
  stopping: boolean;
  selectedJobToStartStop: string;
  onStartStop: (jobId: string, running: boolean) => void;
  onEdit: (row: GetInferenceIngestionJobsResponse) => void;
  onDelete: (jobId: string) => void;
};

const IngestionJobsTable = ({
  jobs,
  loading,
  starting,
  stopping,
  selectedJobToStartStop,
  onStartStop,
  onEdit,
  onDelete,
}: IngestionJobsTableProps) => {
  const { t } = useTranslation('Common');
  const headers = getIngestionJobHeaders(t);

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

  if (jobs.length === 0) {
    return <p className="text-center text-white opacity-60">{t('No Data Found')}</p>;
  }

  return (
    <Table
      headers={headers}
      data={jobs}
      className={'max-w-[170px]'}
    >
      {(cell, header, row) => {
        if (header.value === 'jobId') {
          return <div className="w-[120px] font-mono text-sm text-white">{row.id}</div>;
        }
        if (header.value === 'model') {
          return (
            <div className="w-[260px] space-x-1 text-white">
              <span>{row.modelName}</span>
              <span>-</span>
              <span>{row.modelVersion}</span>
            </div>
          );
        }
        if (header.value === 'dicomModality') {
          return <div className="w-[140px] text-white">{row.dicomModality || '-'}</div>;
        }
        if (header.value === 'modalities') {
          return (
            <div className="w-[200px]">
              <ModalityBadges modalities={row.modalities} />
            </div>
          );
        }
        if (header.value === 'interval') {
          return <div className="w-[80px] text-white">{row.intervalInMinutes} minutes</div>;
        }
        if (header.value === 'schedule') {
          const hasRange = row.scheduleStartTimestamp || row.scheduleEndTimestamp;
          return (
            <div className="w-[160px] text-sm text-white">
              {hasRange ? (
                <div>
                  <div>
                    {moment.unix(row.scheduleStartTimestamp).format('MMM D, YYYY HH:mm')} -{' '}
                    {moment.unix(row.scheduleEndTimestamp).format('MMM D, YYYY HH:mm')}
                  </div>
                </div>
              ) : (
                'Always'
              )}
            </div>
          );
        }
        if (header.value === 'status') {
          const statusColor = getContainerStatusColor(row.status || '');
          return (
            <div className="flex min-w-[100px] items-center gap-2">
              <div
                className={`inline-flex h-[27px] items-center justify-center gap-1 rounded-full px-2 ${statusColor.bg} ${statusColor.bgOpacity} ${statusColor.text}`}
              >
                <span className="capitalize">{row.status?.toLowerCase() || '-'}</span>
                <div className={`h-1 w-1 rounded-full ${statusColor.dot}`}></div>
              </div>
            </div>
          );
        }
        if (header.value === 'action') {
          const running = row.status?.toLowerCase() === InferenceContainerStatus.RUNNING;
          return (
            <div
              className="flex items-center justify-center gap-2"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => onStartStop(row.id, running)}>
                {(running ? stopping : starting) && selectedJobToStartStop === row.id ? (
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
              <IngestionJobActionButton
                row={row}
                onEdit={onEdit}
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

export default IngestionJobsTable;
