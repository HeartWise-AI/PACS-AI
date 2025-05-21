import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '@ohif/ui-next';
function NoSegmentationRow({ onSegmentationAdd, addSegmentationClassName }) {
  const { t } = useTranslation('SegmentationTable');
  return (
    <div
      className={`group ${addSegmentationClassName}`}
      onClick={onSegmentationAdd}
    >
      <div className="text-primary-active flex items-center rounded-[4px] group-hover:cursor-pointer group-hover:bg-[#4C504B] group-hover:bg-opacity-30">
        <div className="grid h-[28px] w-[28px] place-items-center">
          <Icons.Add />
        </div>
        <span className="text-[13px]">{t('Add segmentation')}</span>
      </div>
    </div>
  );
}

export default NoSegmentationRow;
