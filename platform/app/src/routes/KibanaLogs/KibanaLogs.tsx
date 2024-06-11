import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangePicker } from 'react-dates';
import moment from 'moment';
import { Button, Input } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import Table from '../../components/Table';
import { LogsType } from '../../api/ecsDTO';
import ecsRepository from '../../api/ecsRepository';
import { AlertContext } from '../../AlertProvider';
import chevronDownIcon from './../../assets/pacs/icons/chevron-down.png';
import downloadIcon from './../../assets/pacs/icons/download-black.png';
import closeInactive from './../../assets/pacs/icons/close-inactive.png';
import chevronLefttIcon from './../../assets/pacs/icons/chevron-left.png';
import chevronRightIcon from './../../assets/pacs/icons/chevron-right.png';
import searchIcon from './../../assets/pacs/icons/search-black.png';

const KibanaLogsPage = () => {
  const { t } = useTranslation();
  const [selectedIndexType, setSelectedIndexType] = useState<LogsType>(LogsType.LOGINS);
  const [searchQuery, setSearchQuery] = useState('');
  const [columnHeaders, setColumnHeaders] = useState([]);
  const [columnData, setColumnData] = useState([]);
  const [focusedInput, setFocusedInput] = useState(null);
  const tenantId = localStorage.getItem('tenantId') || '';
  const showAlert = useContext(AlertContext);
  const [isLogsDataLoading, setIsLogsDataLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const totalPages = Math.ceil(columnData.length / itemsPerPage);
  const currentItems = columnData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  // set default date range
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const startMoment = moment(thirtyDaysAgo);
  const endMoment = moment(today);
  const [startDate, setStartDate] = useState(startMoment);
  const [endDate, setEndDate] = useState(endMoment);

  // Set page title
  useEffect(() => {
    document.title = 'Admin Kibana Logs - PACS AI';
  }, []);

  useEffect(() => {
    getECSLogs();
  }, [ecsRepository]);

  useEffect(() => {
    if (columnData.length > 0) {
      setColumnHeaders(
        Object.keys(columnData[0]).map(column => ({
          text: column.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          value: column as keyof [],
          align: 'left',
        }))
      );
    }
  }, [columnData]);

  // Get ECS logs
  const getECSLogs = async () => {
    if (!startDate || !endDate) {
      showAlert('Please select a start date and end date.', 'error');
      return;
    }

    setIsLogsDataLoading(true);
    try {
      const response = await ecsRepository.GetECSLogs({
        index: selectedIndexType,
        query: searchQuery ? searchQuery : tenantId,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
      });

      // check and convert timestamps in the response data
      const formattedData = response.data.map(item => {
        // use a type guard to check if `timestamp` exists and is a number
        if (
          typeof item === 'object' &&
          item !== null &&
          'timestamp' in item &&
          typeof item.timestamp === 'number'
        ) {
          const date = new Date(item.timestamp * 1000);

          // format the date to "MM DD, YYYY HH:MM"
          const formattedDate = date.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false, // use 24-hour format. Set to `true` for 12-hour format with AM/PM
          });

          // replace the epoch timestamp with the formatted date
          return { ...item, timestamp: formattedDate };
        }
        return item;
      });

      // if the response is empty, set column data to empty
      if (formattedData.length === 0) {
        setColumnData([]);
      } else {
        // update the state with the formatted data
        setColumnData(formattedData);
      }
    } catch (error) {
      console.error(error);
    }

    setIsLogsDataLoading(false);
  };

  // ECS logs table
  const ECSLogsTable = () => {
    return (
      <div>
        {columnData.length > 0 ? (
          <Table
            headers={columnHeaders}
            data={currentItems}
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

  // Table pagination actions
  const TablePagination = () => {
    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
    return (
      <div className="pagination flex items-center justify-center gap-1">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          className={`h-5 w-5 bg-transparent ${currentPage === 1 ? 'invisible' : 'visible'}`}
        >
          <img
            src={chevronLefttIcon}
            alt="Chevron left icon"
          />
        </button>
        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => handlePageChange(number)}
            className={`h-7 w-7 rounded-md ${
              number === currentPage ? 'text-black' : 'text-white text-opacity-70'
            }`}
            style={{
              background:
                number === currentPage
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : 'rgba(204, 204, 204, 0.1)',
            }}
          >
            {number}
          </button>
        ))}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          className={`h-5 w-5 bg-transparent ${
            currentPage === totalPages ? 'invisible' : 'visible'
          }`}
        >
          <img
            src={chevronRightIcon}
            alt="Chevron right icon"
          />
        </button>
      </div>
    );
  };

  // Handle page change
  const handlePageChange = page => {
    setCurrentPage(page);
  };

  /**
   * Handle select for date range filter
   *
   * @param startDate
   * @param endDate
   */
  const handleDateRangeChange = ({ startDate, endDate }) => {
    setStartDate(startDate);
    setEndDate(endDate);
  };
  /**
   * Clear date range
   */
  const handleClearDates = () => {
    setStartDate(null);
    setEndDate(null);
  };
  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815] ">
        <SidebarAdmin />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Kibana Logs" />
          {/* filter container */}
          <div className="flex w-full justify-between gap-2 rounded-xl border  border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <div className="flex w-[45%] items-center gap-2">
              <Input
                placeholder={t('Search for ...')}
                id="PatientName"
                className="w-full"
                type="text"
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative w-[25%]">
              <DateRangePicker
                startDate={startDate}
                startDateId="FilterStartDate"
                endDate={endDate}
                endDateId="FilterEndDate"
                onDatesChange={handleDateRangeChange}
                focusedInput={focusedInput}
                onFocusChange={focusedInput => {
                  setFocusedInput(focusedInput);
                }}
                isOutsideRange={() => false}
              />
              {(startDate || endDate) && (
                <button onClick={handleClearDates}>
                  <img
                    src={closeInactive}
                    alt="Close icon"
                    className="absolute right-[10px] top-1/2 w-4 -translate-y-1/2"
                  />
                </button>
              )}
            </div>

            <div className="flex w-[30%] items-center gap-2">
              {/* select index type */}
              <div className="relative w-full">
                <select
                  id="SelectAuditType"
                  value={selectedIndexType}
                  className="block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-white bg-opacity-10 py-3 px-3 pr-8 text-lg leading-tight text-white focus:outline-none"
                  onChange={e => setSelectedIndexType(e.target.value as LogsType)}
                >
                  {Object.values(LogsType).map(indexType => (
                    <option
                      key={indexType}
                      value={indexType}
                      className="!cursor-pointer !bg-[#323631] !py-2"
                    >
                      {indexType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                onClick={getECSLogs}
              >
                <img
                  src={searchIcon}
                  className="w-5"
                  alt="Search icon"
                />
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
            {isLogsDataLoading ? (
              <div className="flex items-center justify-center p-5 text-center text-white">
                <span className="text-lg font-normal text-opacity-70">
                  {t('Searching for data')}
                </span>
              </div>
            ) : (
              <div>
                <ECSLogsTable />
                {totalPages > 1 && <TablePagination />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KibanaLogsPage;
