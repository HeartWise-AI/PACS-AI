import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@ohif/ui';
import { Icons } from '@ohif/ui-next';

const StoreFileButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // handle close modal
  const handleClose = () => {
    setIsModalOpen(false);
  };

  // handle store
  const handleStore = () => {
    setIsModalOpen(true);
  };

  // handle confirm
  const handleConfirm = () => {
    // TODO: Implement store logic here
    handleClose();
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
            className="min-w-24 h-10 rounded-lg"
            onClick={handleConfirm}
          >
            Confirm
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

export default StoreFileButton;
