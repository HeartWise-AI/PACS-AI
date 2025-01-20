import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { ThumbnailList } from '../ThumbnailList';
// NOTE: This is a PACS changes
import { useGlobalStateData } from '@ohif/app/src/GlobalStateProvider';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../Accordion';

const StudyItem = ({
  date,
  description,
  numInstances,
  modalities,
  isActive,
  onClick,
  isExpanded,
  displaySets,
  activeDisplaySetInstanceUIDs,
  onClickThumbnail,
  onDoubleClickThumbnail,
  onClickUntrack,
  viewPreset = 'thumbnails',
  onThumbnailContextMenu,
}: withAppTypes) => {
  // NOTE: This is a PACS changes
  const { setModalitiesInStudy, setDisplaySets } = useGlobalStateData();

  // NOTE: This is a PACS changes
  useEffect(() => {
    if (modalities) {
      setModalitiesInStudy(modalities as string);
    }
    if (displaySets) {
      setDisplaySets(displaySets);
    }
  }, [modalities, setModalitiesInStudy]);
  return (
    <Accordion
      type="single"
      collapsible
      onClick={onClick}
      onKeyDown={() => {}}
      className="flex-shrink-0"
      role="button"
      tabIndex={0}
      defaultValue={isActive ? 'study-item' : undefined}
    >
      <AccordionItem value="study-item">
        {/* NOTE: This is a PACS changes */}
        <AccordionTrigger className={classnames('mx-1 rounded bg-white/10 hover:bg-white/20')}>
          <div className="flex h-[40px] flex-1 flex-row">
            <div className="flex w-full flex-row items-center justify-between">
              <div className="flex flex-col items-start text-[13px]">
                <div className="text-white">{date}</div>
                {/* NOTE: This is a PACS changes */}
                <div className="h-[18px] max-w-[160px] overflow-hidden truncate whitespace-nowrap text-white/70">
                  {description}
                </div>
              </div>
              {/* NOTE: This is a PACS changes */}
              <div className="mr-2 flex flex-col items-end text-[12px] text-white/70">
                <div className="max-w-[150px] overflow-hidden text-ellipsis">{modalities}</div>
                <div>{numInstances}</div>
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent
          onClick={event => {
            event.stopPropagation();
          }}
        >
          {isExpanded && displaySets && (
            <ThumbnailList
              thumbnails={displaySets}
              activeDisplaySetInstanceUIDs={activeDisplaySetInstanceUIDs}
              onThumbnailClick={onClickThumbnail}
              onThumbnailDoubleClick={onDoubleClickThumbnail}
              onClickUntrack={onClickUntrack}
              viewPreset={viewPreset}
              onThumbnailContextMenu={onThumbnailContextMenu}
            />
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

StudyItem.propTypes = {
  date: PropTypes.string.isRequired,
  description: PropTypes.string,
  modalities: PropTypes.string.isRequired,
  numInstances: PropTypes.number.isRequired,
  trackedSeries: PropTypes.number,
  isActive: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  isExpanded: PropTypes.bool,
  displaySets: PropTypes.array,
  activeDisplaySetInstanceUIDs: PropTypes.array,
  onClickThumbnail: PropTypes.func,
  onDoubleClickThumbnail: PropTypes.func,
  onClickUntrack: PropTypes.func,
  viewPreset: PropTypes.string,
};

export { StudyItem };
