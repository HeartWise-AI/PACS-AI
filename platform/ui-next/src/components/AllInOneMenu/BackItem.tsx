import React from 'react';

import { Icons } from '@ohif/ui-next';
import DividerItem from './DividerItem';

type BackItemProps = {
  backLabel?: string;
  onBackClick: () => void;
};

const BackItem = ({ backLabel, onBackClick }: BackItemProps) => {
  return (
    <>
      <div
        // NOTE: This is a PACS changes
        className="flex h-8 w-full flex-shrink-0 cursor-pointer items-center pl-1 pr-2 text-base hover:rounded hover:bg-[#151815]"
        onClick={onBackClick}
      >
        <Icons.ByName
          name="content-prev"
          className="ml-2 mr-2"
        />
        <span>{backLabel || 'Back to Display Options'}</span>
      </div>
      <DividerItem></DividerItem>
    </>
  );
};

export default BackItem;
