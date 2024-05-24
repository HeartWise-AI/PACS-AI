import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, InputDateRange, InputMultiSelect, Logo, Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import Table from '../../components/Table';
import chevronDownIcon from './../../assets/pacs/icons/chevron-down.png';
import downloadIcon from './../../assets/pacs/icons/download-black.png';
import { LogsAuditType } from '../../api/dto';

const KibanaLogsPage = () => {
  const { t } = useTranslation();
  const [selectedAuditType, setSelectedAuditType] = useState<LogsAuditType>(
    LogsAuditType.INFERENCE
  );
  const auditInferenceHeaders = [
    { text: 'Author', value: 'author', align: 'left' },
    { text: 'Timestamp', value: 'timestamp', align: 'left' },
    { text: 'Algorithm', value: 'algorithm', align: 'center' },
    { text: 'Python Version', value: 'pythonVersion', align: 'left' },
    { text: 'Cuda Version', value: 'cudaVersion', align: 'left' },
    { text: 'Pytorch Version', value: 'pytorchVersion', align: 'left' },
    { text: 'Model Version', value: 'modelVersion', align: 'left' },
    { text: 'MRN', value: 'mrn', align: 'left' },
    { text: 'Study Instance UID', value: 'studyInstanceUID', align: 'left' },
    { text: 'Accession Number', value: 'accessionNumber', align: 'center' },
    { text: 'Series', value: 'series', align: 'left' },
    { text: 'Series Instance UID', value: 'seriesInstanceUID', align: 'left' },
    { text: 'Instance UID', value: 'instanceUID', align: 'left' },
    { text: 'Detected Vessel', value: 'detectedVessel', align: 'left' },
    { text: 'LVEF', value: 'lvef', align: 'left' },
  ];
  const auditDatabaseHeaders = [
    { text: 'Author', value: 'author', align: 'left' },
    { text: 'Timestamp', value: 'timestamp', align: 'left' },
    { text: 'Deleted Series', value: 'deletedSeries', align: 'left' },
  ];
  const auditInferenceData = [
    // {
    //   author: 'denis.corbin@e-mhicc.org',
    //   timestamp: 'Mar 20, 2024 14:19',
    //   algorithm: 'Cath-EF',
    //   pythonVersion: 'Python 3.9.18',
    //   cudaVersion: '12.1',
    //   pytorchVersion: '2.1.0+cu121',
    //   modelVersion: '1.0.0',
    //   mrn: '556342B',
    //   studyInstanceUID: '1.3.6.1.4.1.14538.0.101.76.6279.6001.128435439123456789',
    //   accessionNumber: '-',
    //   series: 'Series 1',
    //   seriesInstanceUID: '1.3.6.1.4.1.14538.0.101.76.6279.6001.123456789123456789',
    //   instanceUID: '1.3.6.1.4.1.14538.0.101.76.6279.6001.123456789123456789',
    //   detectedVessel: 'Stenting',
    //   lvef: 0,
    // },
    // {
    //   author: 'denis.corbin@e-mhicc.org',
    //   timestamp: 'Mar 20, 2024 14:19',
    //   algorithm: 'Cath-EF',
    //   pythonVersion: 'Python 3.9.18',
    //   cudaVersion: '12.1',
    //   pytorchVersion: '2.1.0+cu121',
    //   modelVersion: '1.0.0',
    //   mrn: '556342B',
    //   studyInstanceUID: '1.3.6.1.4.1.14538.0.101.76.6279.6001.128435439123456789',
    //   accessionNumber: '-',
    //   series: 'Series 1',
    //   seriesInstanceUID: '1.3.6.1.4.1.14538.0.101.76.6279.6001.123456789123456789',
    //   instanceUID: '1.3.6.1.4.1.14538.0.101.76.6279.6001.123456789123456789',
    //   detectedVessel: 'Stenting',
    //   lvef: 0,
    // },
    // {
    //   author: 'denis.corbin@e-mhicc.org',
    //   timestamp: 'Mar 20, 2024 14:19',
    //   algorithm: 'Cath-EF',
    //   pythonVersion: 'Python 3.9.18',
    //   cudaVersion: '12.1',
    //   pytorchVersion: '2.1.0+cu121',
    //   modelVersion: '1.0.0',
    //   mrn: '556342B',
    //   studyInstanceUID: '1.3.6.1.4.1.14538.0.101.76.6279.6001.128435439123456789',
    //   accessionNumber: '-',
    //   series: 'Series 1',
    //   seriesInstanceUID: '1.3.6.1.4.1.14538.0.101.76.6279.6001.123456789123456789',
    //   instanceUID: '1.3.6.1.4.1.14538.0.101.76.6279.6001.123456789123456789',
    //   detectedVessel: 'Stenting',
    //   lvef: 0,
    // },
  ];

  const auditDatabaseData = [
    // {
    //   author: 'System',
    //   timestamp: 'Mar 20, 2024 14:19',
    //   deletedSeries: '62cc4f41-9b1679c0-6ad19a2e-71fccb6f-07a3d16d',
    // },
    // {
    //   author: 'System',
    //   timestamp: 'Mar 20, 2024 14:19',
    //   deletedSeries: '62cc4f41-9b1679c0-6ad19a2e-71fccb6f-07a3d16d',
    // },
    // {
    //   author: 'System',
    //   timestamp: 'Mar 20, 2024 14:19',
    //   deletedSeries: '62cc4f41-9b1679c0-6ad19a2e-71fccb6f-07a3d16d',
    // },
    // {
    //   author: 'System',
    //   timestamp: 'Mar 20, 2024 14:19',
    //   deletedSeries: '62cc4f41-9b1679c0-6ad19a2e-71fccb6f-07a3d16d',
    // },
    // {
    //   author: 'System',
    //   timestamp: 'Mar 20, 2024 14:19',
    //   deletedSeries: '62cc4f41-9b1679c0-6ad19a2e-71fccb6f-07a3d16d',
    // },
    // {
    //   author: 'System',
    //   timestamp: 'Mar 20, 2024 14:19',
    //   deletedSeries: '62cc4f41-9b1679c0-6ad19a2e-71fccb6f-07a3d16d',
    // },
  ];

  // Set page title
  useEffect(() => {
    document.title = 'Admin Kibana Logs - PACS AI';
  }, []);

  const AuditInferenceTable = () => {
    return (
      <div>
        {auditInferenceData.length > 0 ? (
          <Table
            headers={auditInferenceHeaders}
            data={auditInferenceData}
          >
            {cell => {
              return cell;
            }}
          </Table>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-lg font-normal text-white text-opacity-70">
              {t('No data found')}
            </span>
          </div>
        )}
      </div>
    );
  };
  const AuditDatabaseTable = () => {
    return (
      <div>
        {auditDatabaseData.length > 0 ? (
          <Table
            headers={auditDatabaseHeaders}
            data={auditDatabaseData}
          >
            {cell => {
              return cell;
            }}
          </Table>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-lg font-normal text-white text-opacity-70">
              {t('No data found')}
            </span>
          </div>
        )}
      </div>
    );
  };

  const handleDateRangeFieldChange = ({ startDate, endDate }) => {
    console.log({ startDate, endDate });
  };
  const handleFieldChange = newValue => {
    console.log({ newValue });
  };
  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815] ">
        <SidebarAdmin />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Kibana Logs" />
          {/* filter container */}
          <div className="flex w-full justify-between gap-2 rounded-xl border  border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <div className="w-1/4">
              <InputDateRange
                id="KibanaLogsInputDateRange"
                label=""
                onChange={handleDateRangeFieldChange}
              />
            </div>
            {selectedAuditType === LogsAuditType.INFERENCE && (
              <div className="flex w-[45%] items-center gap-2">
                {/* select MRN */}
                <div className="relative w-full">
                  <select
                    id="SelectMRN"
                    className="block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-white bg-opacity-10 py-3 px-3 pr-8 text-lg leading-tight text-white focus:outline-none"
                  >
                    <option
                      value=""
                      disabled
                      selected
                      hidden
                    ></option>
                    {Object.values(auditInferenceData).map(item => (
                      <option
                        key={item.mrn}
                        value={item.mrn}
                        className="!cursor-pointer !bg-[#323631] !py-2"
                      >
                        {item.mrn}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <img
                      src={chevronDownIcon}
                      alt="Chevron down icon"
                      className="w-5"
                    />
                  </div>
                </div>
                {/* select author */}
                <div className="relative w-full">
                  <select
                    id="SelectAuthor"
                    className="block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-white bg-opacity-10 py-3 px-3 pr-8 text-lg leading-tight text-white focus:outline-none"
                  >
                    <option
                      value=""
                      disabled
                      selected
                      hidden
                    ></option>
                    {Object.values(auditInferenceData).map(item => (
                      <option
                        key={item.author}
                        value={item.author}
                        className="!cursor-pointer !bg-[#323631] !py-2"
                      >
                        {item.author}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <img
                      src={chevronDownIcon}
                      alt="Chevron down icon"
                      className="w-5"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex w-[30%] items-center gap-2">
              {/* select audit type */}
              <div className="relative w-full">
                <select
                  id="SelectAuditType"
                  value={selectedAuditType}
                  className="block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-white bg-opacity-10 py-3 px-3 pr-8 text-lg leading-tight text-white focus:outline-none"
                  onChange={e => setSelectedAuditType(e.target.value as LogsAuditType)}
                >
                  {Object.values(LogsAuditType).map(auditType => (
                    <option
                      key={auditType}
                      value={auditType}
                      className="!cursor-pointer !bg-[#323631] !py-2"
                    >
                      {auditType}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <img
                    src={chevronDownIcon}
                    alt="Chevron down icon"
                    className="w-5"
                  />
                </div>
              </div>
              <Button
                disabled={false}
                className="h-[51px] min-w-[51px] rounded-lg !px-0"
              >
                {'Q'}
              </Button>
              <Button
                disabled={false}
                className="h-[51px] min-w-[51px] rounded-lg !px-0"
              >
                <img
                  src={downloadIcon}
                  alt="download icon"
                  className="w-5"
                />
              </Button>
            </div>
          </div>
          {/* table container */}
          <div className="mt-5 rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            {selectedAuditType === LogsAuditType.INFERENCE && <AuditInferenceTable />}
            {selectedAuditType === LogsAuditType.DATABASE && <AuditDatabaseTable />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KibanaLogsPage;
