import React, { useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@ohif/ui';
import { Icons } from '@ohif/ui-next';
import orthancRepository from '@ohif/app/src/api/orthancRepository';
import { AlertContext } from '@ohif/app/src/AlertProvider';
import PropTypes from 'prop-types';

const StoreFileButton = ({
  encodedData = '',
  modelName = '',
  modelVersion = '',
  outputMode = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showAlert = useContext(AlertContext);

  // handle close modal
  const handleClose = () => {
    setIsModalOpen(false);
  };

  // handle store
  const handleStore = () => {
    setIsModalOpen(true);
  };

  // handle confirm
  const handleConfirm = async () => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const payload = {
        modalityID: localStorage.getItem('selectedDICOMModality') || '',
        studyInstanceUID: searchParams.get('StudyInstanceUIDs'),
        modelName: modelName,
        modelVersion: modelVersion,
        encodedData: encodedData,
        outputMode: outputMode,
      };

      await orthancRepository.StoreStudyCustomSeries(payload);

      showAlert(
        'Successfully stored the AI prediction as a new DICOM file to the study',
        'success'
      );

      // reload the page after 3 seconds to refresh the study list
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // confirmation modal
  const confirmationModal = (
    <div
      id="modal"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900 bg-opacity-50"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative inline-block transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-middle shadow-xl transition-all">
        {/* content */}
        <div className="w-full">
          <div className="mb-6">
            <h1 className="mb-1 text-[18px] font-bold text-white">Write to Study?</h1>
            <h2 className="text-[14px] text-white">
              Are you sure you want to save the AI prediction as a new DICOM file to the study?
            </h2>
          </div>
        </div>
        <div className="flex justify-end space-x-4">
          <button
            className="min-w-24 h-10 rounded-lg bg-[#4C504B] text-white"
            onClick={handleClose}
          >
            Cancel
          </button>
          <Button
            disabled={loading}
            className="min-w-24 h-10 rounded-lg"
            onClick={handleConfirm}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <Button
        className="min-w-24 flex h-10 items-center rounded-lg"
        onClick={handleStore}
      >
        <Icons.Download className="h-5 w-5" />
        <span>Write to Study</span>
      </Button>
      {isModalOpen && createPortal(confirmationModal, document.body)}
    </div>
  );
};

StoreFileButton.propTypes = {
  encodedData: PropTypes.string.isRequired,
  modelName: PropTypes.string.isRequired,
  modelVersion: PropTypes.string.isRequired,
  outputMode: PropTypes.string.isRequired,
};

export default StoreFileButton;
