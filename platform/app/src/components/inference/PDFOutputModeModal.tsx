import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import closeIcon from './../../assets/pacs/icons/close-inactive.png';
import { PredictInferenceModelPDFResponse } from '../../api/inferenceDTO';

interface PDFOutputModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PredictInferenceModelPDFResponse;
  loading: boolean;
  title: string;
}

const PDFOutputModeModal: React.FC<PDFOutputModeModalProps> = ({
  isOpen,
  onClose,
  data,
  loading,
  title,
}) => {
  const [pdfUrl, setPdfUrl] = useState<string>('');

  useEffect(() => {
    if (data) {
      try {
        // convert base64 to Blob
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        // create URL from Blob
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);

        // cleanup function to revoke the URL when component unmounts
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error('Error decoding base64 PDF:', error);
      }
    }
  }, [data]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

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
              className={`relative inline-block h-[calc(100vh-100px)] w-[90%] transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle`}
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
                <h1 className="mb-4 text-xl font-bold text-white">{title}</h1>
                <div className="space-y-4">
                  {/* Display PDF content in an iframe */}
                  {loading ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
                    </div>
                  ) : (
                    <iframe
                      src={pdfUrl}
                      className="h-[calc(100vh-200px)] w-full bg-white"
                      title="PDF Content"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

PDFOutputModeModal.defaultProps = {
  onClose: () => {},
  isOpen: false,
  data: {
    pdfBase64: '',
  },
  loading: false,
  title: '',
};

PDFOutputModeModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  data: PropTypes.object as PropTypes.Validator<PredictInferenceModelPDFResponse>,
  loading: PropTypes.bool,
  title: PropTypes.string,
};

export default PDFOutputModeModal;
