import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import closeIcon from './../../assets/pacs/icons/close-inactive.png';
import { PredictInferenceModelHTMLResponse } from '../../api/inferenceDTO';
import { StoreFileButton } from '@ohif/ui';

interface HTMLOutputModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PredictInferenceModelHTMLResponse;
  modelName: string;
  modelVersion: string;
  outputMode: string;
  loading: boolean;
  title: string;
}

const HTMLOutputModeModal: React.FC<HTMLOutputModeModalProps> = ({
  isOpen = false,
  onClose = () => {},
  data = { htmlBase64: '' },
  modelName = '',
  modelVersion = '',
  outputMode = '',
  loading = false,
  title = '',
}) => {
  const [mounted, setMounted] = useState(false);
  const [parsedHTML, setParsedHTML] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (data && data.htmlBase64) {
      try {
        // Check if the string is not empty and is valid base64
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!data.htmlBase64.match(base64Regex)) {
          throw new Error('Invalid base64 string format');
        }

        // decode base64 string to HTML
        const decodedHTML = atob(data.htmlBase64);
        setParsedHTML(decodedHTML);
      } catch (error) {
        console.error('Error decoding base64 HTML:', error);
        setParsedHTML('<div>Error: Unable to decode HTML content</div>');
      }
    } else {
      setParsedHTML(''); // clear content if no data
    }
  }, [data]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen || !mounted) {
    return null;
  }

  const modalContent = (
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
          className={`relative inline-block h-[calc(100vh-200px)] w-[50%] transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle`}
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
            <div className="mb-4 flex items-center justify-between pr-10">
              <h1 className="text-[18px] font-bold text-white">{title}</h1>
              {/* store button */}
              <StoreFileButton
                encodedData={data.htmlBase64}
                modelName={modelName}
                modelVersion={modelVersion}
                outputMode={outputMode}
              />
            </div>
            <div className="h-[calc(100vh-300px)] space-y-4 overflow-y-auto">
              {loading ? (
                <div className="flex h-[calc(100vh-200px)] items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
                </div>
              ) : (
                <iframe
                  srcDoc={parsedHTML}
                  className="h-full w-full bg-white"
                  title="HTML Content"
                  sandbox="allow-same-origin allow-scripts"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return mounted ? ReactDOM.createPortal(modalContent, document.body) : null;
};

HTMLOutputModeModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  data: PropTypes.object as PropTypes.Validator<PredictInferenceModelHTMLResponse>,
  modelName: PropTypes.string,
  modelVersion: PropTypes.string,
  outputMode: PropTypes.string,
  loading: PropTypes.bool,
  title: PropTypes.string,
};

export default HTMLOutputModeModal;
