import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import closeIcon from './../assets/pacs/icons/close-inactive.png';

const Modal = ({
  children = '',
  isOpen = false,
  onClose = () => {},
  size = 'max-w-[400px]',
  isCloseable = true,
}) => {
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
              className={`relative inline-block transform overflow-hidden rounded-xl bg-[#151815] p-5 text-left align-bottom shadow-xl transition-all sm:my-8 ${size} sm:align-middle`}
            >
              {/* close button */}
              {isCloseable && (
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 z-[999999999]"
                >
                  <img
                    src={closeIcon}
                    alt="Close icon"
                  />
                </button>
              )}

              {/* content */}
              {children}
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

Modal.propTypes = {
  children: PropTypes.node,
  size: PropTypes.string,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  isCloseable: PropTypes.bool,
};

export default Modal;
