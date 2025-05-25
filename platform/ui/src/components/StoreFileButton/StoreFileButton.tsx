import React, { useState, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@ohif/ui';
import { Icons } from '@ohif/ui-next';
import orthancRepository from '@ohif/app/src/api/orthancRepository';
import { AlertContext } from '@ohif/app/src/AlertProvider';
import PropTypes from 'prop-types';
import { useGlobalStateData } from '@ohif/app/src/GlobalStateProvider';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const StoreFileButton = ({
  iframeRef,
  encodedData = '',
  modelName = '',
  modelVersion = '',
  modalityId = '',
  seriesInstanceUIDs = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showAlert = useContext(AlertContext);
  const { patientInfo } = useGlobalStateData();

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
      const iframe = iframeRef.current;
      if (!iframe) {
        throw new Error('Iframe not found');
      }
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Cannot access iframe document');
      }
      const iframeBody = iframeDoc.body;

      const canvas = await html2canvas(iframeBody, {
        scale: 2, // Keep high scale for quality
        useCORS: true,
        logging: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: iframeBody.scrollWidth,
        windowHeight: iframeBody.scrollHeight,
      });

      // create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      // calculate dimensions
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdfWidth = pdf.internal.pageSize.getWidth();

      // calculate aspect ratio
      const ratio = pdfWidth / imgWidth;
      const imgHeightOnPdf = imgHeight * ratio;

      // add image to PDF
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, pdfWidth, imgHeightOnPdf);

      // get the PDF as a blob
      const pdfBlob = pdf.output('blob');

      const searchParams = new URLSearchParams(window.location.search);
      const payload = {
        modalityID: modalityId,
        studyInstanceUID: searchParams.get('StudyInstanceUIDs'),
        seriesInstanceUIDs: seriesInstanceUIDs,
        patientID: patientInfo.PatientID,
        patientName: patientInfo.PatientName,
        modelName: modelName,
        modelVersion: modelVersion,
        file: pdfBlob,
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
      showAlert(error.message, 'error');
    } finally {
      handleClose();
      setLoading(false);
    }
  };

  // confirmation modal
  const confirmationModal = (
    <div
      id="modal"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900 bg-opacity-90"
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
            {loading ? '...' : 'Confirm'}
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
  iframeRef: PropTypes.object.isRequired,
  encodedData: PropTypes.string.isRequired,
  modelName: PropTypes.string.isRequired,
  modelVersion: PropTypes.string.isRequired,
  modalityId: PropTypes.string.isRequired,
  seriesInstanceUIDs: PropTypes.string.isRequired,
};

export default StoreFileButton;
