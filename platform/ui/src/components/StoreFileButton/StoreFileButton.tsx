import React, { useState, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@ohif/ui';
import { Icons } from '@ohif/ui-next';
import orthancRepository from '@ohif/app/src/api/orthancRepository';
import { AlertContext } from '@ohif/app/src/AlertProvider';
import PropTypes from 'prop-types';

declare global {
  interface Window {
    html2pdf: any;
  }
}

const StoreFileButton = ({
  encodedData = '',
  modelName = '',
  modelVersion = '',
  modalityId = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showAlert = useContext(AlertContext);

  // Load html2pdf.js script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

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
      // decode base64 to HTML string
      const htmlContent = atob(encodedData);

      // create a temporary div to hold the HTML content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);

      // configure PDF options
      const opt = {
        margin: 1,
        filename: 'document.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 1,
          useCORS: true,
          logging: true,
        },
        jsPDF: {
          unit: 'in',
          format: 'letter',
          orientation: 'portrait',
        },
      };

      let pdfBlob;
      // wait for html2pdf to be available
      if (window.html2pdf) {
        // convert HTML to PDF
        pdfBlob = await window
          .html2pdf()
          .from(tempDiv)
          .set(opt)
          .toPdf()
          .get('pdf')
          .then(pdf => pdf.output('blob'));

        // download blob
        const downloadBlob = (blob, filename) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        };

        // Use the function to download the PDF blob
        downloadBlob(pdfBlob, 'document.pdf');
      } else {
        throw new Error('html2pdf not loaded');
      }

      // clean up
      document.body.removeChild(tempDiv);

      const searchParams = new URLSearchParams(window.location.search);
      const payload = {
        modalityID: modalityId,
        studyInstanceUID: searchParams.get('StudyInstanceUIDs'),
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
      handleClose();
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
  modalityId: PropTypes.string.isRequired,
};

export default StoreFileButton;
