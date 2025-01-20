import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Typography } from '@ohif/ui';
import closeIcon from './../assets/pacs/icons/close-inactive.png';
import { ModelDetails } from '../api/inferenceDTO';

interface ModelFactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ModelDetails;
}

const ModelFactsModal: React.FC<ModelFactsModalProps> = ({
  isOpen = false,
  onClose = () => {},
  data = {} as ModelDetails,
}) => {
  const { t } = useTranslation('Common');
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  /**
   * Validation and perfomance table
   *
   * @param data
   */
  const ValidationAndPerfomanceTable = ({ data }) => {
    const { Validation_and_performance } = data;

    const renderTable = (performanceData: {
      [key: string]: { [key: string]: string | number };
    }) => (
      <table className="mx-auto mb-4 w-[70%] border-collapse border border-gray-600">
        <thead>
          <tr>
            <th className="w-1/4 border border-gray-600 px-4 py-2"></th>
            {Object.keys(performanceData).map(dataset => (
              <th
                key={dataset}
                className="w-1/4 border border-gray-600 px-4 py-2 text-base text-white"
              >
                {dataset.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(performanceData[Object.keys(performanceData)[0]]).map(metric => (
            <tr key={metric}>
              <td className="w-1/4 border border-gray-600 px-4 py-2 text-base font-medium text-white">
                {metric.replace(/_/g, ' ')}
              </td>
              {Object.keys(performanceData).map(dataset => (
                <td
                  key={dataset + metric}
                  className="w-1/4 border border-gray-600 px-4 py-2 text-base text-white"
                >
                  {performanceData[dataset][metric]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
    return (
      <div>
        <Typography
          variant="h6"
          className="mb-2 font-medium text-white"
        >
          {t('Validation and Perfomance')}
        </Typography>
        {Object.keys(Validation_and_performance).map(key => (
          <div key={key}>{renderTable(Validation_and_performance[key])}</div>
        ))}
      </div>
    );
  };

  return (
    <React.Fragment>
      {isOpen && (
        <div
          id="modal"
          className="fixed inset-0 z-[99999] overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"
              aria-hidden="true"
            ></div>
            <span
              className="hidden sm:inline-block sm:h-screen sm:align-middle"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <div
              className={`relative inline-block w-[80%] transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle`}
            >
              {/* close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-[999999999]"
              >
                <img
                  src={closeIcon}
                  alt="Close icon"
                />
              </button>
              {/* content */}
              <div className="h-full w-full">
                {!data || Object.keys(data).length === 0 ? (
                  <div className="flex h-40 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="relative">
                    {/* summary */}
                    <div className="grid grid-cols-3 border-b border-white border-opacity-10 py-2">
                      <div className="col-span-1">
                        <Typography
                          variant="h6"
                          className="font-medium text-white"
                        >
                          {t('Model Facts')}
                        </Typography>
                      </div>
                      <div className="col-span-1">
                        <Typography
                          variant="subtitle"
                          className="font-light text-white"
                        >
                          {t('Model Name')}: {data.Summary['Name']}
                        </Typography>
                      </div>
                      <div className="col-span-1">
                        <Typography
                          variant="subtitle"
                          className="font-light text-white"
                        >
                          {t('Locale')}: {data.Summary['Licensed_to']}
                        </Typography>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 border-b border-white border-opacity-10 py-2">
                      <div className="col-span-1">
                        <Typography
                          variant="subtitle"
                          className="font-light text-white"
                        >
                          {t('Approval Date')}: {data.Summary['Approval_date']}
                        </Typography>
                      </div>
                      <div className="col-span-1">
                        <Typography
                          variant="subtitle"
                          className="font-light text-white"
                        >
                          {t('Last Update')}: {data.Summary['Last_update']}
                        </Typography>
                      </div>
                      <div className="col-span-1">
                        <Typography
                          variant="subtitle"
                          className="font-light text-white"
                        >
                          {t('Version')}: {data.Summary['Version']}
                        </Typography>
                      </div>
                    </div>
                    <div className="border-b border-white border-opacity-10 py-2">
                      <Typography
                        variant="h6"
                        className="font-medium text-white"
                      >
                        {t('Summary')}
                      </Typography>
                      <Typography
                        variant="body"
                        className="mt-2 font-light text-white"
                      >
                        {data.Summary['Description']}
                      </Typography>
                    </div>
                    {/* mechanism */}
                    <div className="border-b border-white border-opacity-10 py-2">
                      <Typography
                        variant="h6"
                        className="font-medium text-white"
                      >
                        {t('Mechanism')}
                      </Typography>
                      {Object.entries(data.Mechanism).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between px-4 pt-2"
                        >
                          <Typography
                            variant="body"
                            className="pr-2 font-medium text-white"
                          >
                            • {`${key.replace(/_/g, ' ')}`}
                          </Typography>
                          <div className="flex-1 border-b border-dotted border-white border-opacity-70" />
                          <Typography
                            variant="body"
                            className="pl-2 text-right font-light text-white"
                          >
                            {`${value}`}
                          </Typography>
                        </div>
                      ))}
                    </div>
                    {/* validation and performance */}
                    <div className="border-b border-white border-opacity-10 py-2">
                      <ValidationAndPerfomanceTable data={data} />
                    </div>
                    {/* uses and directions */}
                    <div className="border-b border-white border-opacity-10 py-2">
                      <Typography
                        variant="h6"
                        className="font-medium text-white"
                      >
                        {t('Uses and directions')}
                      </Typography>
                      {Object.entries(data.Uses_and_directions).map(([key, value]) => (
                        <div
                          key={key}
                          className="px-4 pt-2"
                        >
                          <Typography
                            variant="body"
                            className="pr-2 text-white"
                          >
                            <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                            <span className="font-light"> {`${value}`}</span>
                          </Typography>
                        </div>
                      ))}
                    </div>
                    {/* warning and limitations */}
                    <div className="border-b border-white border-opacity-10 py-2">
                      <Typography
                        variant="h6"
                        className="font-medium text-white"
                      >
                        {t('Warnings')}
                      </Typography>
                      {Object.entries(data.Warnings_and_limitations).map(([key, value]) => (
                        <div
                          key={key}
                          className="px-4 pt-2"
                        >
                          <Typography
                            variant="body"
                            className="pr-2 text-white"
                          >
                            <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                            <span className="font-light"> {`${value}`}</span>
                          </Typography>
                        </div>
                      ))}
                    </div>
                    {/* other information */}
                    <div className="border-b border-white border-opacity-10 py-2">
                      <Typography
                        variant="h6"
                        className="font-medium text-white"
                      >
                        {t('Other information')}
                      </Typography>
                      {Object.entries(data.Other_information).map(([key, value]) => (
                        <div
                          key={key}
                          className="px-4 pt-2"
                        >
                          <Typography
                            variant="body"
                            className="pr-2 text-white"
                          >
                            <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                            <span className="font-light"> {`${value}`}</span>
                          </Typography>
                        </div>
                      ))}
                    </div>
                    {/* other results */}
                    <div className="border-b border-white border-opacity-10 py-2">
                      <Typography
                        variant="h6"
                        className="font-medium text-white"
                      >
                        {t('Other results')}
                      </Typography>
                      {Object.entries(data.Other_results).map(([key, value]) => (
                        <div
                          key={key}
                          className="px-4 pt-2"
                        >
                          <Typography
                            variant="body"
                            className="pr-2 text-white"
                          >
                            <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                            <span className="font-light"> {`${value}`}</span>
                          </Typography>
                        </div>
                      ))}
                    </div>
                    {/* change logs */}
                    <div className="border-b border-white border-opacity-10 py-2">
                      <Typography
                        variant="h6"
                        className="font-medium text-white"
                      >
                        {t('Change logs')}
                      </Typography>
                      {Object.entries(data.Changelogs).map(([key, value]) => (
                        <div
                          key={key}
                          className="px-4 pt-2"
                        >
                          <Typography
                            variant="body"
                            className="pr-2 text-white"
                          >
                            <span className="font-medium">• {`${key.replace(/_/g, ' ')}`}:</span>{' '}
                            <span className="font-light"> {`${value}`}</span>
                          </Typography>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

ModelFactsModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  data: PropTypes.object as PropTypes.Validator<ModelDetails>,
};

export default ModelFactsModal;
