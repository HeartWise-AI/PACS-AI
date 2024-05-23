import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import filtersMeta from './filtersMeta.js';
import { Button, Input, InputDateRange, DateRange, Select } from '@ohif/ui';
import i18n from '@ohif/i18n';
import orthancRepository from '../../api/orthancRepository';
import HeaderPanel from '../../components/HeaderPanel';
import Sidebar from '../../components/Sidebar';
import Modal from '../../components/Modal';
import { JobState } from '../../api/orthancDTO';

function WorkList() {
  const { t } = useTranslation('StudyList');
  const navigate = useNavigate();
  const [isOpenOrthancServiceModal, setIsOpenOrthancServiceModal] = useState<boolean>(false);
  const [tableDataSource, setTableDataSource] = useState([]);
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
    try {
      const response = await orthancRepository.GetModalityStudies(filterRef.current);
      setTableDataSource(response.data.studies);
      setStudyQueryId(response.data.queryId);
    } catch (error) {
      console.error(error);
    }
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
        [field]: `*${value}*`,
      };
      filterRef.current = updatedFilter;
      debounceSearch();
      return updatedFilter;
    });
  };

  // TODO: issue in multiple select
  const handleModalitiesChange = selectedOptions => {
    const updatedModalitiesInStudy = selectedOptions.map(option => option.value).join('//');

    setStudyListFilter(prevFilter => ({
      ...prevFilter,
      modalitiesInStudy: updatedModalitiesInStudy,
    }));
    console.log(studyListFilter.modalitiesInStudy, updatedModalitiesInStudy);
    debounceSearch();
  };

  // TODO: issue in date range select
  const handleDateRangeFieldChange = ({ startDate, endDate }) => {
    console.log({ startDate, endDate });
    setStudyListFilter(prevFilter => {
      const updatedFilter = {
        ...prevFilter,
        studyDate: `${startDate}`,
      };
      filterRef.current = updatedFilter;
      debounceSearch();
      return updatedFilter;
    });
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
    const modalityStudyResponse = await orthancRepository.RetrieveModalityStudy({
      queryID,
      answerIndex: index,
    });
    const jobInfoResponse = await orthancRepository.GetJobInfo({
      jobID: modalityStudyResponse.data.id,
    });
    console.log('jobInfo', jobInfoResponse);
    setJobInfo({
      id: jobInfoResponse.data.id,
      priority: jobInfoResponse.data.priority,
      progress: jobInfoResponse.data.progress,
      state: JobState[jobInfoResponse.data.state.toUpperCase()],
    });

    setTimeout(() => {
      console.log(jobInfoResponse.data.state, JobState.SUCCESS, type);
      if (jobInfoResponse.data.state === JobState.SUCCESS) {
        if (type === 'viewer') {
          navigate(`/viewer?StudyInstanceUIDs=${studyInstanceUID}`);
        }
        if (type === 'segmentation') {
          navigate(`/segmentation?StudyInstanceUIDs=${studyInstanceUID}`);
        }
      }
    }, 2000);
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
  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815]">
        {/* Sidebar component */}
        <Sidebar />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          {/* HeaderPanel component */}
          <HeaderPanel title="Studies" />
          <div className="sticky -top-1 z-10 mx-auto mb-5 w-full rounded-xl border  border-white border-opacity-10 bg-white bg-opacity-[5%]">
            <div className="flex items-center gap-3 bg-transparent p-5">
              <Input
                placeholder={t('Patient name')}
                id="PatientName"
                className="w-full"
                type="text"
                onChange={e => handleInputChange('patientName', e.target.value)}
              />
              <Input
                placeholder={t('MRN')}
                id="MRN"
                className="w-full"
                type="text"
                onChange={e => handleInputChange('patientID', e.target.value)}
              />

              <InputDateRange
                id="DateRangeFilter"
                label=""
                onChange={handleDateRangeFieldChange}
              />
              <Input
                placeholder={t('Description')}
                id="Description"
                className="w-full"
                type="text"
                onChange={e => handleInputChange('studyDescription', e.target.value.toUpperCase())}
              />
              <Select
                id="SelectModalities"
                placeholder={t('Modalities')}
                className="min-w-[150px]"
                options={filtersMeta[4].inputProps.options}
                value={studyListFilter.modalitiesInStudy}
                isMulti={true}
                isClearable={false}
                isSearchable={false}
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                onChange={(selectedOptions, action) => {
                  switch (action) {
                    case 'select-option':
                    case 'remove-value':
                    case 'deselect-option':
                    case 'clear':
                      handleModalitiesChange(selectedOptions);
                      break;
                    default:
                      break;
                  }
                }}
              />
              <Input
                id="Accession"
                placeholder={t('Accession #')}
                className="w-full"
                type="text"
                onChange={e => handleInputChange('accessionNumber', e.target.value)}
              />
            </div>
          </div>
          <div className="mb-5 flex flex-col rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <div className="mx-auto w-full overflow-x-auto">
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
                <tbody className="!rounded-lg bg-transparent">
                  {tableDataSource.map((row, index) => (
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
                          {row.patientID.substring(0, 10)}....
                          {row.patientID.substring(row.patientID.length - 10)}
                        </td>
                        <td className="text-md py-2 px-4 font-normal">
                          {formatDate(row.studyDate)}
                        </td>
                        <td className="text-md py-2 px-4 font-normal">{row.studyDescription}</td>
                        <td className="text-md py-2 px-4 font-normal">{row.modalitiesInStudy}</td>
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
                              <h1 className="text-lg text-white text-opacity-70">{t('Tools')}</h1>
                              <Button
                                onClick={() => {
                                  viewStudy(studyQueryId, index, 'viewer', row.studyInstanceUID);
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
              </table>
            </div>
          </div>
        </div>
        <Modal
          isOpen={isOpenOrthancServiceModal}
          size="min-w-[400px]"
          isCloseable={false}
        >
          <h1 className="mb-4 text-center text-xl text-white">{t('OrthancServiceProgress')}</h1>
          <div className="h-2.5 w-full rounded-full bg-gray-500">
            <div
              className={`bg-primary-main h-2.5 rounded-full`}
              style={{ width: `${jobInfo.progress}%` }}
            ></div>
          </div>
          <h2 className="mt-4 text-white">
            <span className="text-white text-opacity-70">{t('State')}:</span> {jobInfo.state}
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
