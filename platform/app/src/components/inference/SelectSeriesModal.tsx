import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import closeIcon from './../../assets/pacs/icons/close-inactive.png';
import uncheckIcon from './../../assets/pacs/icons/check-inactive.png';
import checkIcon from './../../assets/pacs/icons/check-active.png';
import informationIcon from './../../assets/pacs/icons/information-circle.png';
import { Input } from '@ohif/ui';

interface SelectSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: string;
  loading: boolean;
  title: string;
  thumbnails: any;
}

const SelectSeriesModal: React.FC<SelectSeriesModalProps> = ({
  isOpen,
  onClose,
  data,
  loading,
  title,
  thumbnails,
}) => {
  const [mounted, setMounted] = useState(false);
  const [stepper, setStepper] = useState(1);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [applyToStudy, setApplyToStudy] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const toggleSeriesSelection = (displaySetInstanceUID: string) => {
    setSelectedSeries(prev => {
      if (prev.includes(displaySetInstanceUID)) {
        return prev.filter(id => id !== displaySetInstanceUID);
      } else {
        return [...prev, displaySetInstanceUID];
      }
    });
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      id="modal"
      className="fixed inset-0 z-[99999] overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-auto items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
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
          className={`relative inline-block w-[480px] max-w-[480px] transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle`}
        >
          {/* content */}
          <div className="h-auto w-full">
            {/* title */}
            <h1 className="mb-4 text-[18px] font-bold text-white">{title}</h1>
            {/* stepper */}
            <div className="flex items-center gap-2">
              <div
                className={`h-[5px] w-full rounded-full ${
                  stepper >= 1 ? 'bg-[#C8F469]' : 'bg-[#1F221F]'
                }`}
              ></div>
              <div
                className={`h-[5px] w-full rounded-full ${
                  stepper >= 2 ? 'bg-[#C8F469]' : 'bg-[#1F221F]'
                }`}
              ></div>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="flex h-[calc(100vh-200px)] items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
                </div>
              ) : (
                <div>
                  {stepper === 1 && (
                    <div>
                      {/* header */}
                      <div className="align-center mt-4 flex flex-row justify-between text-[14px]">
                        <h1 className="text-white">Select Series</h1>
                        <div
                          className="flex cursor-pointer items-center gap-2"
                          onClick={() => setApplyToStudy(!applyToStudy)}
                        >
                          <h2 className="text-[14px] text-white">Apply to Study</h2>
                          <img
                            src={applyToStudy ? checkIcon : uncheckIcon}
                            alt={applyToStudy ? 'check' : 'uncheck'}
                            className="h-[18px] w-[18px]"
                          />
                        </div>
                      </div>

                      {/* list of series */}
                      <div className="ml-0 mt-4 max-h-[450px] space-y-3 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#ffffff] [&::-webkit-scrollbar-thumb]:bg-opacity-30 [&::-webkit-scrollbar-track]:bg-transparent">
                        {thumbnails.map(thumbnail => (
                          <div
                            key={thumbnail.displaySetInstanceUID}
                            className="flex cursor-pointer items-center justify-between rounded-xl bg-[#7A7A7A] bg-opacity-10 p-3"
                            onClick={() => toggleSeriesSelection(thumbnail.displaySetInstanceUID)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-[58px] w-[73px] rounded-lg border border-[#C8F469] bg-white bg-opacity-20">
                                <img
                                  src={thumbnail.imageSrc}
                                  alt="thumbnail"
                                  className="h-full w-full rounded-lg object-cover"
                                />
                              </div>
                              <div className="text-[14px]">
                                <h1 className="inline text-[#C8F469]">Series: </h1>
                                <h2 className="mr-2 inline text-white">{thumbnail.seriesNumber}</h2>
                                <h3 className="inline text-white">{thumbnail.numInstances}</h3>
                                <h4 className="block text-white opacity-70">
                                  {thumbnail.description}
                                </h4>
                              </div>
                            </div>
                            <div>
                              <img
                                src={
                                  selectedSeries.includes(thumbnail.displaySetInstanceUID)
                                    ? checkIcon
                                    : uncheckIcon
                                }
                                alt={
                                  selectedSeries.includes(thumbnail.displaySetInstanceUID)
                                    ? 'check'
                                    : 'uncheck'
                                }
                                className="h-[18px] w-[18px]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* actions */}
                      <div className="mt-4 flex flex-row justify-end gap-3">
                        <button
                          className="rounded-lg bg-[#ffffff] bg-opacity-10 px-4 py-2 text-white"
                          onClick={handleClose}
                        >
                          Cancel
                        </button>
                        <button
                          className={`rounded-lg px-4 py-2 ${
                            selectedSeries.length > 0
                              ? 'bg-[#C8F469] text-black'
                              : 'cursor-not-allowed bg-[#C8F469] bg-opacity-50 text-black'
                          }`}
                          onClick={() => {
                            if (selectedSeries.length > 0) {
                              setStepper(2);
                            }
                          }}
                          disabled={selectedSeries.length === 0}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}
                  {stepper === 2 && (
                    <div>
                      <h1 className="mt-4 block text-white">Additional Details (optional)</h1>
                      <div className="mt-4 flex gap-2">
                        <div className="flex h-[43px] w-[50%] items-center rounded-lg bg-[#323631] bg-opacity-10 px-4 text-[14px] text-white">
                          Siblings
                        </div>
                        <Input
                          className="h-[43px] w-full"
                          type="text"
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <div className="flex h-[43px] w-[50%] items-center rounded-lg bg-[#323631] bg-opacity-10 px-4 text-[14px] text-white">
                          Siblings
                        </div>
                        <Input
                          className="h-[43px] w-full"
                          type="text"
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <img
                          src={informationIcon}
                          alt="information"
                          className="h-[15px] w-[15px]"
                        />
                        <h1 className="text-[12px] text-white opacity-50">
                          Additional details required fields should be answered.
                        </h1>
                      </div>
                      {/* actions */}
                      <div className="mt-5 flex flex-row justify-end gap-3">
                        <button
                          className="rounded-lg bg-[#ffffff] bg-opacity-10 px-4 py-2 text-white"
                          onClick={() => {
                            setStepper(1);
                          }}
                        >
                          Back
                        </button>
                        <button
                          className="rounded-lg bg-[#C8F469] px-4 py-2 text-black"
                          onClick={() => {}}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return mounted ? ReactDOM.createPortal(modalContent, document.body) : null;
};

SelectSeriesModal.defaultProps = {
  onClose: () => {},
  isOpen: false,
  data: '',
  loading: false,
  title: '',
};

SelectSeriesModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  data: PropTypes.string,
  loading: PropTypes.bool,
  title: PropTypes.string,
  thumbnails: PropTypes.arrayOf(
    PropTypes.shape({
      displaySetInstanceUID: PropTypes.string.isRequired,
      imageSrc: PropTypes.string,
      imageAltText: PropTypes.string,
      seriesDate: PropTypes.string,
      seriesNumber: PropTypes.string,
      numInstances: PropTypes.number,
      description: PropTypes.string,
      componentType: PropTypes.string.isRequired,
      viewportIdentificator: PropTypes.arrayOf(PropTypes.string),
      isTracked: PropTypes.bool,
      dragData: PropTypes.shape({
        type: PropTypes.string.isRequired,
      }),
    })
  ),
};

export default SelectSeriesModal;
