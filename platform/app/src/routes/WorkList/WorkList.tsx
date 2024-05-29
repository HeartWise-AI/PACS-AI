import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { DateRangePicker } from 'react-dates';
import { Button, Input } from '@ohif/ui';
import filtersMeta from './filtersMeta.js';
import orthancRepository from '../../api/orthancRepository';
import HeaderPanel from '../../components/HeaderPanel';
import Sidebar from '../../components/Sidebar';
import Modal from '../../components/Modal';
import { JobState } from '../../api/orthancDTO';
import circularLoading from './../../assets/pacs/icons/circular-loading.png';
import closeInactive from './../../assets/pacs/icons/close-inactive.png';
import chevronLefttIcon from './../../assets/pacs/icons/chevron-left.png';
import chevronRightIcon from './../../assets/pacs/icons/chevron-right.png';

function WorkList() {
  const { t } = useTranslation('StudyList');
  const navigate = useNavigate();
  const [isOpenOrthancServiceModal, setIsOpenOrthancServiceModal] = useState<boolean>(false);
  const [isStudyListDataLoading, setIsStudyListDataLoading] = useState<boolean>(false);
  const [tableDataSource, setTableDataSource] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [expandedTableRows, setExpandedTableRows] = useState({});
  const [studyListFilter, setStudyListFilter] = useState({
    accessionNumber: '',
    institutionName: '',
    modalitiesInStudy: '',
    numberOfStudyRelatedSeries: '',
    patientBirthDate: '',
    patientID: '',
    patientName: '',
    patientSex: '',
    referringPhysicianName: '',
    requestingPhysician: '',
    studyDate: '',
    studyDescription: '',
    studyID: '',
    studyInstanceUID: '',
    studyTime: '',
  });
  const [jobInfo, setJobInfo] = useState({
    id: '',
    priority: 0,
    progress: 0,
    state: JobState.PENDING,
  });
  const [studyQueryId, setStudyQueryId] = useState('');
  const filterRef = useRef(studyListFilter);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);
  const totalPages = Math.ceil(tableDataSource.length / itemsPerPage);
  const currentItems = tableDataSource.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    filterRef.current = studyListFilter;
  }, [studyListFilter]);

  // Set page title
  useEffect(() => {
    document.title = 'Studies - PACS AI';
  }, []);

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
    };
  }, []);

  useEffect(() => {
    fetchStudyListData();
  }, [orthancRepository]);

  /**
   * Get study list data
   */
  const fetchStudyListData = async () => {
    setTableDataSource([]);
    setIsStudyListDataLoading(true);
    try {
      const response = await orthancRepository.GetModalityStudies(filterRef.current);

      setTableDataSource(response.data.studies);
      setStudyQueryId(response.data.queryId);
    } catch (error) {
      console.error(error);
    }
    setIsStudyListDataLoading(false);
  };

  /**
   * Table toggle for expandable rows
   * @param index
   */
  const toggleRow = index => {
    setExpandedTableRows(prevState => ({
      ...prevState,
      [index]: !prevState[index],
    }));
  };

  /**
   * Debounce search
   */
  const debounceSearch = useCallback(
    debounce(() => {
      fetchStudyListData();
    }, 2000),
    []
  );

  /**
   * Debounce function implementation
   *
   * @param func
   * @param wait
   * @returns
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Handle page change
  const handlePageChange = page => {
    setCurrentPage(page);
  };

  /**
   * Handle input change filter
   *
   * @param field
   * @param value
   */
  const handleInputChange = (field, value) => {
    setStudyListFilter(prevFilter => {
      const updatedFilter = {
        ...prevFilter,
        [field]: value ? `*${value}*` : '',
      };
      filterRef.current = updatedFilter;

      setIsStudyListDataLoading(true);
      debounceSearch();
      return updatedFilter;
    });
  };

  /**
   * Handle select for modalities filter
   *
   * @param selectedOptions
   */
  const handleModalitiesChange = selectedOptions => {
    const updatedModalitiesInStudy = selectedOptions.map(option => option.value).join('//');

    setStudyListFilter(prevFilter => ({
      ...prevFilter,
      modalitiesInStudy: updatedModalitiesInStudy,
    }));

    setIsStudyListDataLoading(true);
    debounceSearch();
  };

  /**
   * Handle select for date range filter
   *
   * @param startDate
   * @param endDate
   */
  const handleDateRangeChange = ({ startDate, endDate }) => {
    if (startDate && endDate) {
      const formattedStartDate = startDate.format('YYYYMMDD');
      const formattedEndDate = endDate.format('YYYYMMDD');
      const formattedDateRange = `${formattedStartDate}-${formattedEndDate}`;

      setStudyListFilter(prevFilter => ({
        ...prevFilter,
        studyDate: formattedDateRange,
      }));

      setIsStudyListDataLoading(true);
      debounceSearch();
    }

    setStartDate(startDate);
    setEndDate(endDate);
  };

  /**
   * Clear date range
   */
  const handleClearDates = () => {
    setStartDate(null);
    setEndDate(null);

    setStudyListFilter(prevFilter => ({
      ...prevFilter,
      studyDate: '',
    }));

    setIsStudyListDataLoading(true);
    debounceSearch();
  };
  /**
   * View selected study
   *
   * @param queryID
   * @param index
   * @param type
   * @param studyInstanceUID
   */
  const viewStudy = async (queryID, index, type, studyInstanceUID) => {
    setIsOpenOrthancServiceModal(true);

    let jobInfoResponse;

    // retrieve modalidy study
    const modalityStudyResponse = await orthancRepository.RetrieveModalityStudy({
      queryID,
      answerIndex: index,
    });

    // get job info with interval of 3 seconds
    let intervalId = setInterval(async () => {
      jobInfoResponse = await orthancRepository.GetJobInfo({
        jobID: modalityStudyResponse.data.id,
      });
      // clear interval if job is not in running state
      if (
        jobInfoResponse.data.state === JobState.FAILURE ||
        jobInfoResponse.data.state === JobState.RETRY ||
        jobInfoResponse.data.state === JobState.PAUSED ||
        jobInfoResponse.data.state === JobState.SUCCESS
      ) {
        clearInterval(intervalId);
      }
      // set job info
      setJobInfo({
        id: jobInfoResponse.data.id,
        priority: jobInfoResponse.data.priority,
        progress: jobInfoResponse.data.progress,
        state: JobState[jobInfoResponse.data.state.toUpperCase()],
      });

      // redirect to viewer if job is in success state
      setTimeout(() => {
        if (jobInfoResponse.data.state === JobState.SUCCESS) {
          if (type === 'viewer') {
            navigate(`/viewer?StudyInstanceUIDs=${studyInstanceUID}`);
          }
          if (type === 'segmentation') {
            navigate(`/segmentation?StudyInstanceUIDs=${studyInstanceUID}`);
          }
        }
      }, 2000);
    }, 3000);
  };

  /**
   * Format date
   */
  function formatDate(dateString) {
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6) - 1; // Months are 0-indexed in JavaScript
    const day = dateString.substring(6, 8);

    const date = new Date(year, month, day);

    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }

  const selectCustomStyles = {
    control: styles => ({
      ...styles,
      height: '50px',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      border: 'none',
      outline: 'none',
    }),
    option: (styles, { isFocused }) => ({
      ...styles,
      border: isFocused ? 'none' : '',
      cursor: 'pointer',
      outline: 'none',
    }),
    multiValue: styles => ({
      ...styles,
      backgroundColor: '#c8f469',
      margin: '1px',
      borderRadius: '4px',
      color: 'white',
    }),
    multiValueRemove: styles => ({
      ...styles,
      color: '#1e427e',
      ':hover': {
        backgroundColor: '#1e427e',
        color: 'white',
        borderRadius: '0 3px 3px 0',
      },
    }),
  };

  // table pagination actions
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

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815]">
        {/* Sidebar component */}
        <Sidebar />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          {/* HeaderPanel component */}
          <HeaderPanel title="Studies" />
          <div className="sticky -top-1 z-10 mx-auto mb-5 w-full rounded-xl border  border-white border-opacity-10 bg-white bg-opacity-[5%]">
            <div className="flex w-full flex-wrap items-center gap-3 gap-1 bg-transparent p-5 xl:flex-nowrap">
              <Input
                placeholder={t('Patient name')}
                id="PatientName"
                className="min-w-[150px]"
                type="text"
                onChange={e => handleInputChange('patientName', e.target.value)}
              />
              <Input
                placeholder={t('MRN')}
                id="MRN"
                className="min-w-[150px]"
                type="text"
                onChange={e => handleInputChange('patientID', e.target.value)}
              />
              <div className="relative w-[250px]">
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
              <Input
                placeholder={t('Description')}
                id="Description"
                className="min-w-[150px]"
                type="text"
                onChange={e => handleInputChange('studyDescription', e.target.value.toUpperCase())}
              />
              <Select
                isMulti
                placeholder={t('Modality')}
                options={filtersMeta[4].inputProps.options}
                onChange={handleModalitiesChange}
                styles={selectCustomStyles}
                className="min-w-[200px] bg-transparent"
                classNamePrefix="select"
              />
              <Input
                id="Accession"
                placeholder={t('Accession #')}
                className="min-w-[150px]"
                type="text"
                onChange={e => handleInputChange('accessionNumber', e.target.value)}
              />
            </div>
          </div>
          <div className="mb-5 flex flex-col rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <div className="mx-auto w-full overflow-x-auto">
              {isStudyListDataLoading ? (
                <div className="flex items-center justify-center p-5 text-center text-white">
                  <span className="text-lg font-normal text-opacity-70">
                    {t('Searching for data')}
                  </span>
                </div>
              ) : (
                <table className="mb-4 min-w-full rounded-xl border-none bg-transparent">
                  <thead className="bg-transparent">
                    <tr className="bg-transparent">
                      <th className="py-3 text-left text-sm font-normal tracking-wider text-white text-opacity-70">
                        {t('PatientName')}
                      </th>
                      <th className="py-3 px-4 text-left text-sm font-normal tracking-wider text-white text-opacity-70">
                        {t('MRN')}
                      </th>
                      <th className="py-3 px-4 text-left text-sm font-normal tracking-wider text-white text-opacity-70">
                        {t('StudyDate')}
                      </th>
                      <th className="py-3 px-4 text-left text-sm font-normal tracking-wider text-white text-opacity-70">
                        {t('Description')}
                      </th>
                      <th className="py-3 px-4 text-left text-sm font-normal tracking-wider text-white text-opacity-70">
                        {t('Modality')}
                      </th>
                      <th className="py-3 px-4 text-left text-sm font-normal tracking-wider text-white text-opacity-70">
                        {t('AccessionNumber')}
                      </th>
                      <th className="py-3 text-left text-sm font-normal tracking-wider text-white text-opacity-70">
                        {t('Instances')}
                      </th>
                    </tr>
                  </thead>
                  {tableDataSource.length > 0 ? (
                    <tbody className="!rounded-lg bg-transparent">
                      {currentItems.map((row, index) => (
                        <React.Fragment key={index}>
                          <tr
                            className="expandable-row my-5 cursor-pointer !rounded-lg bg-white bg-opacity-[10%] py-2 px-2 text-white"
                            onClick={() => toggleRow(index)}
                          >
                            <td
                              className={`text-md py-2 px-4 font-normal ${
                                expandedTableRows[index] ? 'rounded-tl-lg' : 'rounded-l-lg'
                              }`}
                            >
                              {row.patientName}
                            </td>
                            <td className="text-md py-2 px-4 font-normal">
                              {row.patientID.substring(0, 7)}....
                              {row.patientID.substring(row.patientID.length - 7)}
                            </td>
                            <td className="text-md py-2 px-4 font-normal">
                              {formatDate(row.studyDate)}
                            </td>
                            <td className="text-md py-2 px-4 font-normal">
                              {row.studyDescription}
                            </td>
                            <td className="text-md py-2 px-4 font-normal">
                              {row.modalitiesInStudy}
                            </td>
                            <td className="py-2 px-4">{row.accessionNumber}</td>
                            <td
                              className={`py-2 px-4 text-sm font-normal ${
                                expandedTableRows[index] ? '!rounded-tr-lg' : '!rounded-r-lg'
                              }`}
                            >
                              {row.numberOfStudyRelatedSeries}
                            </td>
                          </tr>
                          {expandedTableRows[index] && (
                            <tr className="expandable-content mb-5 bg-white bg-opacity-[10%] pb-5">
                              <td
                                colSpan={7}
                                className="rounded-bl-lg rounded-br-lg py-4 px-4"
                              >
                                <div className="flex items-center gap-3">
                                  <h1 className="text-lg text-white text-opacity-70">
                                    {t('Tools')}
                                  </h1>
                                  <Button
                                    onClick={() => {
                                      viewStudy(
                                        studyQueryId,
                                        index,
                                        'viewer',
                                        row.studyInstanceUID
                                      );
                                    }}
                                  >
                                    {t('BasicViewer')}
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      viewStudy(
                                        studyQueryId,
                                        index,
                                        'segmentation',
                                        row.studyInstanceUID
                                      );
                                    }}
                                  >
                                    {t('Segmentation')}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {/* adding an empty row for spacing */}
                          <tr className="h-3"></tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  ) : (
                    <tr>
                      <td
                        colSpan={12}
                        className="p-5 text-center"
                      >
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="text-lg font-normal text-white text-opacity-70">
                            {t('No data found')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </table>
              )}
            </div>
            {totalPages > 1 && <TablePagination />}
          </div>
        </div>
        <Modal
          isOpen={isOpenOrthancServiceModal}
          size="min-w-[400px]"
          isCloseable={false}
        >
          {(JobState.PENDING === jobInfo.state || JobState.RUNNING === jobInfo.state) && (
            <div
              role="status"
              className="mb-3"
            >
              <img
                src={circularLoading}
                alt="Circular loading"
                className="mx-auto w-8 animate-spin"
              />
            </div>
          )}
          <h1 className="mb-4 text-center text-xl text-white">{t('OrthancServiceProgress')}</h1>
          <div className="h-2.5 w-full rounded-full bg-gray-500">
            <div
              className={`bg-primary-main h-2.5 rounded-full`}
              style={{ width: `${jobInfo.progress}%` }}
            ></div>
          </div>
          <h2 className="mt-4 text-white">
            <span className="text-white text-opacity-70">{t('Status')}:</span> {jobInfo.state}
          </h2>
          {(jobInfo.state === JobState.PAUSED ||
            jobInfo.state === JobState.RETRY ||
            jobInfo.state === JobState.FAILURE) && (
            <div className="mt-2">
              <h1 className="text-white">{t('OrthancServiceProgressMessage')}</h1>
              <div className="mt-6 flex justify-end">
                <Button
                  className="block h-5 w-11"
                  onClick={() => {
                    setIsOpenOrthancServiceModal(false);
                    setJobInfo({ id: '', priority: 0, progress: 0, state: JobState.PENDING });
                  }}
                >
                  {t('Okay')}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

export default WorkList;
