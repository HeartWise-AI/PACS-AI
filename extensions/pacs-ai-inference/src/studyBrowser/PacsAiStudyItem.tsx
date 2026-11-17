/**
 * OHIF v3.11.1 platform/ui-next/src/components/StudyItem/StudyItem.tsx with the
 * PACS-AI changes (marked "PACS-AI"): it reports the study's modalities to the
 * study context (the run-model menu reads them), uses our colours, and renders
 * the PACS-AI thumbnail list. Prop types dropped.
 */
import React, { useEffect } from 'react';
import classnames from 'classnames';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ohif/ui-next';
import useStudyContext from '@pacs-ai/extension-core/src/hooks/useStudyContext';
import { PacsAiThumbnailList as ThumbnailList } from './PacsAiThumbnailList';

const PacsAiStudyItem = ({
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
  ThumbnailMenuItems,
  StudyMenuItems,
  StudyInstanceUID,
}: Record<string, any>) => {
  // PACS-AI
  const { setModalitiesInStudy } = useStudyContext();

  useEffect(() => {
    if (modalities) {
      setModalitiesInStudy(modalities);
    }
  }, [modalities, setModalitiesInStudy]);

  return (
    <Accordion
      type="single"
      collapsible
      onClick={onClick}
      onKeyDown={() => {}}
      // PACS-AI
      className="flex-shrink-0"
      role="button"
      tabIndex={0}
      defaultValue={isActive ? 'study-item' : undefined}
    >
      <AccordionItem value="study-item">
        {/* PACS-AI */}
        <AccordionTrigger
          className={classnames('group w-full rounded bg-white/10 hover:bg-white/20')}
        >
          <div className="flex h-[40px] w-full flex-row overflow-hidden">
            <div className="flex w-full flex-row items-center justify-between">
              <div className="flex min-w-0 flex-col items-start text-[13px]">
                <Tooltip>
                  <TooltipContent>{date}</TooltipContent>
                  <TooltipTrigger
                    className="w-full"
                    asChild
                  >
                    {/* PACS-AI */}
                    <div className="h-[18px] w-full max-w-[160px] overflow-hidden truncate whitespace-nowrap text-left text-white/70">
                      {date}
                    </div>
                  </TooltipTrigger>
                </Tooltip>
                <Tooltip>
                  <TooltipContent>{description}</TooltipContent>
                  <TooltipTrigger
                    className="w-full"
                    asChild
                  >
                    {/* PACS-AI */}
                    <div className="h-[18px] w-full overflow-hidden truncate whitespace-nowrap text-left text-white/70">
                      {description}
                    </div>
                  </TooltipTrigger>
                </Tooltip>
              </div>
              {/* PACS-AI */}
              <div className="flex flex-col items-end pl-[10px] text-[12px] text-white/70">
                <div className="max-w-[150px] overflow-hidden text-ellipsis">{modalities}</div>
                <div>{numInstances}</div>
              </div>
              {StudyMenuItems && (
                <div className="ml-2 flex items-center">
                  <StudyMenuItems StudyInstanceUID={StudyInstanceUID} />
                </div>
              )}
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
              ThumbnailMenuItems={ThumbnailMenuItems}
            />
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export { PacsAiStudyItem };
