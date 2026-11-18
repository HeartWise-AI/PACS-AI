import React from 'react';
import { useTranslation } from 'react-i18next';
import Table from '../../../../components/Table';
import refreshIcon from '../../../../assets/pacs/icons/refresh.png';
import { getDicomHeaders } from '../../constants';
import type { DICOMModalities } from '../../types';
import DicomActionButton from './DicomActionButton';

type DicomModalitiesTableProps = {
  modalities: DICOMModalities[];
  loading: boolean;
  isRefreshing: boolean;
  onRefreshStatus: (modalityId: string) => void;
  onEdit: (row: DICOMModalities) => void;
  onDelete: (modalityId: string) => void;
};

const DicomModalitiesTable = ({
  modalities,
  loading,
  isRefreshing,
  onRefreshStatus,
  onEdit,
  onDelete,
}: DicomModalitiesTableProps) => {
  const { t } = useTranslation('Common');
  const headers = getDicomHeaders(t);

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

  if (modalities.length === 0) {
    return <p className="text-center text-white opacity-60">{t('No Data Found')}</p>;
  }

  return (
    <Table
      headers={headers}
      data={modalities}
      className={'max-w-[170px]'}
    >
      {(cell, header, row) => {
        if (header.value === 'aet') {
          return <div className="w-[250px] text-white">{cell}</div>;
        }
        if (header.value === 'host') {
          return <div className="w-[200px] text-white">{cell}</div>;
        }
        if (header.value === 'port') {
          return <div className="w-[200px] text-white">{cell}</div>;
        }
        if (header.value === 'status') {
          return (
            <div className="flex min-w-[100px] items-center gap-2">
              <div
                className={`inline-flex h-[27px] items-center justify-center rounded-full px-2 ${
                  cell === 'Connected'
                    ? 'bg-[#6ED47C] bg-opacity-20 text-[#6ED47C]'
                    : cell === 'Disconnected'
                      ? 'bg-red-300 bg-opacity-10 text-red-500'
                      : 'bg-yellow-300 bg-opacity-10 text-yellow-500'
                }`}
              >
                <span>{cell}</span>
              </div>
              {cell !== 'Connecting' && (
                <button
                  className="h-[27px] w-[27px] rounded-full bg-white bg-opacity-10 p-1.5 focus:ring-0"
                  onClick={() => onRefreshStatus(row.id)}
                >
                  <img
                    src={refreshIcon}
                    alt="refresh icon"
                    className={`${isRefreshing ? '' : ''}`}
                  />
                </button>
              )}
            </div>
          );
        }
        if (header.value === 'targetCFindEnabled') {
          return <div className="w-[100px] text-white">{cell ? 'Enabled' : 'Disabled'}</div>;
        }
        if (header.value === 'targetCMoveEnabled') {
          return <div className="w-[100px] text-white">{cell ? 'Enabled' : 'Disabled'}</div>;
        }
        if (header.value === 'targetCStoreEnabled') {
          return <div className="w-[100px] text-white">{cell ? 'Enabled' : 'Disabled'}</div>;
        }
        if (header.value === 'action') {
          return (
            <DicomActionButton
              row={row}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        }
        return cell;
      }}
    </Table>
  );
};

export default DicomModalitiesTable;
