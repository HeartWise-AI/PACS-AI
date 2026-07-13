import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import dotsVertical from '../../../../assets/pacs/icons/dots-vertical-inactive.png';
import { GetInferenceIngestionJobsResponse } from '../../../../api/inferenceDTO';

type IngestionJobActionButtonProps = {
  row: GetInferenceIngestionJobsResponse;
  onEdit: (row: GetInferenceIngestionJobsResponse) => void;
  onDelete: (jobId: string) => void;
};

const IngestionJobActionButton = ({ row, onEdit, onDelete }: IngestionJobActionButtonProps) => {
  const { t } = useTranslation('Common');
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = event => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      return {
        top: `${rect.top - 10}px`,
        right: `${window.innerWidth - rect.left}px`,
      };
    }
    return {};
  };

  return (
    <div className="relative flex items-center justify-center">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
      >
        <img
          src={dotsVertical}
          alt="Dots vertical icon"
          className="h-4 w-4"
        />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 w-28 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
            style={getDropdownPosition()}
          >
            <ul className="py-2 text-sm text-white">
              <li>
                <button
                  className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
                  onClick={() => {
                    onEdit(row);
                    setIsOpen(false);
                  }}
                >
                  {t('Edit')}
                </button>
              </li>
              <li>
                <button
                  className="block w-full cursor-pointer px-4 py-2 text-left text-red-500 hover:bg-gray-700"
                  onClick={() => {
                    onDelete(row.id);
                    setIsOpen(false);
                  }}
                >
                  {t('Delete')}
                </button>
              </li>
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
};

export default IngestionJobActionButton;
