import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { createSearchParams, useNavigate, useSearchParams } from 'react-router-dom';
import Select from 'react-select';
import { DateRangePicker } from 'react-dates';
import { useQuery } from 'react-query';
import moment from 'moment';
import { sortBy } from 'lodash';
import { Button } from '@ohif/ui';
import { Input } from '@ohif/ui-next';
import filtersMeta from './filtersMeta.js';
import orthancRepository from '../../api/orthancRepository';
import HeaderPanel from '../../components/HeaderPanel';
import Sidebar from '../../components/Sidebar';
import Modal from '../../components/Modal';
import { JobState } from '../../api/orthancDTO';
import { Error } from '../../api/dto';
import { AlertContext } from '../../AlertProvider';
import { logoutUser } from '../../service/userService';
import circularLoading from './../../assets/pacs/icons/circular-loading.png';
import closeInactive from './../../assets/pacs/icons/close-inactive.png';
import chevronLefttIcon from './../../assets/pacs/icons/chevron-left.png';
import chevronRightIcon from './../../assets/pacs/icons/chevron-right.png';

function WorkList() {
  const { t } = useTranslation('StudyList');
  const navigate = useNavigate();
  const showAlert = useContext(AlertContext);
  const [isOpenOrthancServiceModal, setIsOpenOrthancServiceModal] = useState<boolean>(false);
  const [isStudyListDataLoading, setIsStudyListDataLoading] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [modalityOptions, setModalityOptions] = useState<string[]>([]);
  const [tableDataSource, setTableDataSource] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [expandedTableRows, setExpandedTableRows] = useState({});
  const [jobInfo, setJobInfo] = useState({
    id: '',
    priority: 0,
    progress: 0,
    state: JobState.RUNNING,
  });
  const [syncingStudyProgress, setSyncingStudyProgress] = useState(0);
  const [studyQueryId, setStudyQueryId] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);
  const totalPages = Math.ceil(tableDataSource.length / itemsPerPage);
  const currentItems = tableDataSource.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const [startDate, setStartDate] = useState(moment());
  const [endDate, setEndDate] = useState(moment());
  const formattedStartDate = moment().format('YYYYMMDD');
  const formattedEndDate = moment().format('YYYYMMDD');
  const [studyListFilter, setStudyListFilter] = useState({
    modalityId: '',
    accessionNumber: '',
    institutionName: '',
    modalitiesInStudy: '',
    numberOfStudyRelatedSeries: '',
    patientBirthDate: '',
    patientId: '',
    patientName: '',
    patientSex: '',
    referringPhysicianName: '',
    requestingPhysician: '',
    studyDate: `${formattedStartDate}-${formattedEndDate}`,
    studyDescription: '',
    studyId: '',
    studyInstanceUID: '',
    studyTime: '',
  });
  const filterRef = useRef(studyListFilter);
  const tenantId = localStorage.getItem('tenantId') || '';
  const [searchParams] = useSearchParams();
  const [selectedModalities, setSelectedModalities] = useState([]);
  const [selectedDICOMModality, setSelectedDICOMModality] = useState<{
    value: string;
    label: string;
  } | null>(null);

  const { data, error, refetch } = useQuery(
    ['studyData', JSON.stringify(studyListFilter)],
    async () => await orthancRepository.GetModalityStudies(filterRef.current),
    {
      enabled: false, // manually trigger the query
      staleTime: 30 * 60 * 1000, // 30 minutes in milliseconds
      cacheTime: 30 * 60 * 1000, // 30 minutes in milliseconds
      retry: 1,
    }
  );

  // Set page title
  useEffect(() => {
    document.title = 'Studies - PACS AI';
  }, []);

  /**
   * Effect hook to handle data and error states from the study data query
   * Updates the table data source and study query ID when new data is received
   */
  useEffect(() => {
    if (data) {
      // sort the studies
      const sortedStudies = sortStudies(data.data.studies);
      // update the table with the new or cached study data
      setTableDataSource(sortedStudies);
      setStudyQueryId(data.data.queryId);
      setIsSearching(false); // reset searching flag after successful response
    }
    if (error) {
      // only show error if it occurred during an explicit search
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      if (isSearching) {
        showAlert(error.message, 'error');
      }
      setIsSearching(false); // reset searching flag after error
    }
  }, [data, error]);

  /**
   * Fetches study list data
   * This function resets the table data source, sets loading state, and triggers a refetch
   * The refetch may return cached data if it's still fresh (within the staleTime of 30 minutes)
   * If the cache is stale, it will trigger a new network request
   *
   * @async
   */
  const fetchStudyListData = async () => {
    setTableDataSource([]);
    setIsStudyListDataLoading(true);
    await refetch();
    setIsStudyListDataLoading(false);
  };

  useEffect(() => {
    const fetchDICOMModalities = async () => {
      try {
        const response = await orthancRepository.GetDICOMModalities();

        const options = Object.keys(response.data.modalities);
        setModalityOptions(options);

        if (options.length === 0) {
          localStorage.removeItem('selectedDICOMModality');
          setSelectedDICOMModality(null);
        }

        // check localStorage for selectedDICOMModality
        const storedDICOMModality = localStorage.getItem('selectedDICOMModality');

        if (!storedDICOMModality && options.length > 0) {
          // if not exist, assign the first key in the response.modalities
          const firstDICOMModalityKey = options[0];
          if (firstDICOMModalityKey) {
            setSelectedDICOMModality({
              value: firstDICOMModalityKey,
              label: firstDICOMModalityKey,
            });

            setStudyListFilter(prevFilter => ({
              ...prevFilter,
              modalityId: firstDICOMModalityKey,
            }));
            localStorage.setItem('selectedDICOMModality', firstDICOMModalityKey);
            fetchStudyListData();
          }
        }
      } catch (error) {
        console.error('Error fetching DICOM modalities:', error);
      }
    };

    fetchDICOMModalities();
  }, [orthancRepository]);

  useEffect(() => {
    filterRef.current = studyListFilter;
  }, [studyListFilter]);

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
    };
  }, []);

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());

    // array to store promises for each state update
    const updatePromises: Promise<void>[] = [];

    // auto-fill the fields using these parameters
    if (params.patientName) {
      updatePromises.push(
        new Promise(resolve => {
          handleInputChange('patientName', params.patientName);
          resolve();
        })
      );
    }

    if (params.patientId) {
      updatePromises.push(
        new Promise(resolve => {
          handleInputChange('patientId', params.patientId);
          resolve();
        })
      );
    }

    if (params.studyDescription) {
      updatePromises.push(
        new Promise(resolve => {
          handleInputChange('studyDescription', params.studyDescription);
          resolve();
        })
      );
    }

    if (params.accessionNumber) {
      updatePromises.push(
        new Promise(resolve => {
          handleInputChange('accessionNumber', params.accessionNumber);
          resolve();
        })
      );
    }

    if (params.modalitiesInStudy) {
      updatePromises.push(
        new Promise(resolve => {
          const modalitiesArray = params.modalitiesInStudy.split('\\');
          const selectedOptions = filtersMeta[4].inputProps.options.filter(option =>
            modalitiesArray.includes(option.value)
          );
          setSelectedModalities(selectedOptions);
          const updatedModalitiesInStudy = selectedOptions.map(option => option.value).join('\\');
          setStudyListFilter(prevFilter => ({
            ...prevFilter,
            modalitiesInStudy: updatedModalitiesInStudy,
          }));
          resolve();
        })
      );
    }

    if (params.studyDate) {
      updatePromises.push(
        new Promise(resolve => {
          const [start, end] = params.studyDate.split('-');
          const startDateMoment = moment(start, 'YYYYMMDD');
          const endDateMoment = moment(end, 'YYYYMMDD');

          setStartDate(startDateMoment);
          setEndDate(endDateMoment);

          const formattedStartDate = startDateMoment.format('YYYYMMDD');
          const formattedEndDate = endDateMoment.format('YYYYMMDD');
          const formattedDateRange = `${formattedStartDate}-${formattedEndDate}`;

          setStudyListFilter(prevFilter => ({
            ...prevFilter,
            studyDate: formattedDateRange,
          }));
          resolve();
        })
      );
    } else if (Object.keys(params).length === 0) {
      // if there are no parameters, set today's date
      const today = moment();
      setStartDate(today);
      setEndDate(today);
    } else {
      // if there are other parameters but no studyDate, clear the date fields
      setStartDate(null);
      setEndDate(null);

      setStudyListFilter(prevFilter => ({
        ...prevFilter,
        studyDate: '',
      }));
    }

    // include selectedDICOMModality from localStorage
    const storedDICOMModality = localStorage.getItem('selectedDICOMModality');
    if (storedDICOMModality) {
      updatePromises.push(
        new Promise(resolve => {
          setSelectedDICOMModality({
            value: storedDICOMModality,
            label: storedDICOMModality,
          });
          setStudyListFilter(prevFilter => ({
            ...prevFilter,
            modalityId: storedDICOMModality,
          }));
          resolve();
        })
      );
    }

    // after all updates are done, check if it's a page refresh
    Promise.all(updatePromises).then(() => {
      // check if it's a page refresh by looking at the performance navigation type
      const isPageRefresh =
        (window.performance &&
          window.performance.navigation &&
          window.performance.navigation.type === 1) ||
        (window.performance &&
          performance.getEntriesByType('navigation').length > 0 &&
          (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type ===
            'reload');

      if (isPageRefresh) {
        searchStudyList();
      }
    });
  }, [searchParams]);

  /**
   *  Sort studies
   *
   * @param studies
   * @returns
   */
  const sortStudies = studies => {
    return sortBy(studies, [
      // sort by last name
      study => {
        const nameParts = study.patientName.split('^');
        const lastName = nameParts[0];
        // remove suffixes and consider multi-word last names
        return lastName.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/, '').toLowerCase();
      },
      // then sort by study date in descending order
      study => -new Date(study.studyDate).getTime(),
    ]);
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
      // check filters if all empty, if true return and erase data in table
      if (Object.values(filterRef.current).every(value => value === '')) {
        setIsStudyListDataLoading(false);
        setTableDataSource([]);
        return;
      }
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
        [field]: value ? `${value}` : '',
      };
      filterRef.current = updatedFilter;

      return updatedFilter;
    });
  };

  /**
   * Search study list
   */
  const searchStudyList = async () => {
    await fetchStudyListData();
  };

  /**
   * Handle select for modalities filter
   *
   * @param selectedOptions
   */
  const handleModalitiesChange = selectedOptions => {
    const updatedModalitiesInStudy = selectedOptions.map(option => option.value).join('\\');
    setSelectedModalities(selectedOptions || []);
    setStudyListFilter(prevFilter => ({
      ...prevFilter,
      modalitiesInStudy: updatedModalitiesInStudy,
    }));
  };

  /**
   * Handle select for DICOM modality
   *
   * @param selectedOption
   */
  const handleDICOMModalityChange = selectedOption => {
    setSelectedDICOMModality(selectedOption);
    setStudyListFilter(prevFilter => ({
      ...prevFilter,
      modalityId: selectedOption.value,
    }));
    localStorage.setItem('selectedDICOMModality', selectedOption.value);
  };

  /**
   * Handle select for date range filter
   *
   * @param startDate
   * @param endDate
   */
  const handleDateRangeChange = ({ startDate, endDate }) => {
    console.log(startDate, moment());
    if (startDate && endDate) {
      const formattedStartDate = startDate.format('YYYYMMDD');
      const formattedEndDate = endDate.format('YYYYMMDD');
      const formattedDateRange = `${formattedStartDate}-${formattedEndDate}`;

      setStudyListFilter(prevFilter => ({
        ...prevFilter,
        studyDate: formattedDateRange,
      }));
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
  };

  /**
   * View selected study
   *
   * @param type
   * @param studyInstanceUID
   */
  const viewStudy = async (type, studyInstanceUID, modalitiesInStudy) => {
    setIsOpenOrthancServiceModal(true);

    let jobInfoResponse;
    // create query params from the filter state
    const viewStudyParams = Object.keys(studyListFilter).reduce((acc, key) => {
      if (studyListFilter[key] && key !== 'modalityId') {
        acc[key] = studyListFilter[key].replace(/\*/g, ''); // removing the asterisks for cleaner URL
      }
      return acc;
    }, {});
    // remove empty fields
    Object.keys(viewStudyParams).forEach(
      key => !viewStudyParams[key] && delete viewStudyParams[key]
    );

    const searchParams = createSearchParams(viewStudyParams);

    try {
      // retrieve modality study
      const modalityStudyResponse = await orthancRepository.RetrieveModalityStudy({
        modalityId: selectedDICOMModality.value,
        studyInstanceUID,
      });

      // extract job IDs from the response
      const jobIds = modalityStudyResponse.data.map(item => item.id);

      // get job info with interval of 3 seconds
      const intervalId = setInterval(async () => {
        jobInfoResponse = await orthancRepository.GetJobsInfo({
          jobIds: jobIds,
        });

        // calculate overall progress based on completed jobs
        // total number of jobs in the response */
        const totalJobs = jobInfoResponse.data.length;
        // number of jobs that have completed (progress is 100%) */
        const completedJobs = jobInfoResponse.data.filter(job => job.progress === 100).length;
        // overall progress percentage, rounded down to nearest integer */
        const overallProgress = Math.floor((completedJobs / totalJobs) * 100);

        setSyncingStudyProgress(overallProgress);

        // clear interval if all jobs are completed
        if (overallProgress === 100) {
          clearInterval(intervalId);
        }

        // set job info
        setJobInfo({
          id: jobInfoResponse.data[0].id,
          priority: jobInfoResponse.data[0].priority,
          progress: overallProgress,
          state: overallProgress === 100 ? JobState.SUCCESS : JobState.RUNNING,
        });

        // redirect to viewer if all jobs are in success state
        if (overallProgress === 100) {
          setTimeout(() => {
            if (type === 'viewer') {
              navigate(`/viewer?StudyInstanceUIDs=${studyInstanceUID}&${searchParams}`);
            }
            if (type === 'segmentation') {
              navigate(`/segmentation?StudyInstanceUIDs=${studyInstanceUID}&${searchParams}`);
            }
          }, 2000);
        }
      }, 1000);
    } catch (error) {
      if (error.errorCode === Error.DUPLICATE_RECORD) {
        if (type === 'viewer') {
          navigate(`/viewer?StudyInstanceUIDs=${studyInstanceUID}&${searchParams}`);
        }
        if (type === 'segmentation') {
          navigate(`/segmentation?StudyInstanceUIDs=${studyInstanceUID}&${searchParams}`);
        }
      }

      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);

        showAlert(error.message, 'error');
      }
    }
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

  /**
   * Dropdown for react-dates select date
   * @param param0
   * @returns
   */
  const renderMonthElement = ({ month, onMonthSelect, onYearSelect }) => {
    const years = [];
    const currentYear = moment().year();

    // generate a range of years for the dropdown
    for (let i = currentYear - 50; i <= currentYear + 50; i++) {
      years.push(i);
    }

    return (
      <div className="MonthElementWrapper">
        <select
          value={month.month()}
          onChange={e => onMonthSelect(month, e.target.value)}
        >
          {moment.months().map((label, index) => (
            <option
              key={index}
              value={index}
            >
              {label}
            </option>
          ))}
        </select>
        <select
          value={month.year()}
          onChange={e => onYearSelect(month, e.target.value)}
        >
          {years.map(year => (
            <option
              key={year}
              value={year}
            >
              {year}
            </option>
          ))}
        </select>
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
          <div className="sticky -top-1 z-10 mx-auto mb-5 w-full rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%]">
            <div className="flex w-full flex-wrap items-center gap-3 bg-transparent p-5 xl:flex-nowrap">
              <Input
                value={studyListFilter.patientName?.replace(/\*/g, '') || ''}
                placeholder={t('Patient name')}
                id="PatientName"
                className="min-w-[150px]"
                type="text"
                onChange={e => handleInputChange('patientName', e.target.value)}
              />
              <Input
                value={studyListFilter.patientId?.replace(/\*/g, '') || ''}
                placeholder={t('MRN')}
                id="MRN"
                className="min-w-[150px]"
                type="text"
                onChange={e => handleInputChange('patientId', e.target.value)}
              />
              <div className="pacs-date-range relative w-full min-w-[240px] max-w-[360px] flex-1 sm:w-[260px] sm:flex-none md:w-[320px]">
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
                  renderMonthElement={renderMonthElement}
                  minimumNights={0}
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
                value={studyListFilter.studyDescription?.replace(/\*/g, '') || ''}
                placeholder={t('Description')}
                id="Description"
                className="min-w-[120px]"
                type="text"
                onChange={e => handleInputChange('studyDescription', e.target.value.toUpperCase())}
              />
              <Select
                isMulti
                placeholder={t('Modality')}
                value={selectedModalities}
                options={filtersMeta[4].inputProps.options}
                onChange={handleModalitiesChange}
                styles={selectCustomStyles}
                className="min-w-[180px] bg-transparent"
                classNamePrefix="select"
              />
              <Input
                value={studyListFilter.accessionNumber?.replace(/\*/g, '') || ''}
                id="Accession"
                placeholder={t('Accession #')}
                className="min-w-[150px]"
                type="text"
                onChange={e => handleInputChange('accessionNumber', e.target.value)}
              />
              <Button
                disabled={isStudyListDataLoading}
                className="h-[51px] w-[110px] rounded-lg !px-5"
                onClick={() => {
                  setIsSearching(true);
                  searchStudyList();
                }}
              >
                {isStudyListDataLoading ? '...' : t('Search')}
              </Button>
            </div>
          </div>
          <div className="mb-5 flex flex-col rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[16px] text-white">{t('DICOM Modality')}</span>
              <Select
                placeholder={t('Modality')}
                value={selectedDICOMModality}
                options={modalityOptions.map(option => ({ value: option, label: option }))}
                onChange={selectedOption => {
                  handleDICOMModalityChange(selectedOption);
                  setSelectedDICOMModality(selectedOption);
                }}
                styles={{
                  ...selectCustomStyles,
                  singleValue: provided => ({
                    ...provided,
                    color: 'white', // Ensure the selected value is visible
                  }),
                }}
                className="min-w-[180px] bg-transparent"
                classNamePrefix="select"
              />
            </div>
            <div className="mx-auto w-full overflow-x-auto">
              {isStudyListDataLoading &&
              !Object.values(filterRef.current).every(value => value === '') ? (
                <div className="flex items-center justify-center p-5 text-center text-white">
                  <span className="text-lg font-normal text-opacity-70">
                    {t('Searching for data')} ...
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
                              {row.patientId.substring(0, 10)}
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
                                        'viewer',
                                        row.studyInstanceUID,
                                        row.modalitiesInStudy
                                      );
                                    }}
                                  >
                                    {t('BasicViewer')}
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      viewStudy(
                                        'segmentation',
                                        row.studyInstanceUID,
                                        row.modalitiesInStudy
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
                    <tbody>
                      <tr>
                        <td
                          colSpan={12}
                          className="p-5 text-center"
                        >
                          <div className="flex h-full w-full items-center justify-center">
                            <span className="mt-5 text-lg font-normal text-white text-opacity-70">
                              {t('searchStudyListInfo')}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  )}
                </table>
              )}
            </div>
            {totalPages > 1 && <TablePagination />}
          </div>
        </div>
        <Modal
          isOpen={isOpenOrthancServiceModal}
          size="w-[400px]"
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
              style={{ width: `${syncingStudyProgress}%` }}
            ></div>
          </div>
          <h2 className="mt-4 text-base text-white">{t('OrthancServiceInfo')}</h2>
          <h3 className="mt-4 text-white">
            <span className="text-white text-opacity-70">{t('Status')}:</span> {jobInfo.state}
          </h3>
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
                    setJobInfo({ id: '', priority: 0, progress: 0, state: JobState.RUNNING });
                    setSyncingStudyProgress(0);
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
