/**
 * OHIF v3.13.14 platform/ui-next/src/components/Thumbnail/Thumbnail.tsx with the
 * PACS-AI changes (marked "PACS-AI"): the AI result's selected-view badge
 * (number in a circle, ring around the thumbnail) and our colours. Prop types
 * dropped.
 */
import React, { useEffect, useState } from 'react';
import classnames from 'classnames';
import { useDrag } from 'react-dnd';
import {
  Icons,
  DisplaySetMessageListTooltip,
  TooltipTrigger,
  TooltipContent,
  Tooltip,
} from '@ohif/ui-next';

const DraggableThumbnailContent = ({ dragData, children }: any) => {
  const [, drag] = useDrag({
    type: 'displayset',
    item: { ...dragData },
    canDrag: function () {
      return Object.keys(dragData).length !== 0;
    },
  });

  return (
    <div
      ref={drag}
      className="h-full w-full"
    >
      {children}
    </div>
  );
};

const StaticThumbnailContent = ({ children }: any) => {
  return <div className="h-full w-full">{children}</div>;
};

/**
 * Display a thumbnail for a display set.
 */
const PacsAiThumbnail = ({
  displaySetInstanceUID,
  className,
  children,
  imageSrc,
  imageAltText,
  description,
  seriesNumber,
  numInstances,
  loadingProgress,
  countIcon,
  messages,
  isActive,
  onClick,
  onDoubleClick,
  thumbnailType,
  modality,
  viewPreset = 'thumbnails',
  isHydratedForDerivedDisplaySet = false,
  isTracked = false,
  canReject = false,
  dragData = {},
  isDraggable = true,
  onReject = () => {},
  onClickUntrack = () => {},
  ThumbnailMenuItems = () => {},
  selectedViewBadge = null, // PACS-AI
  onImageLoadError = () => {},
}: Record<string, any>): React.ReactNode => {
  const [lastTap, setLastTap] = useState(0);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [imageSrc]);

  const shouldRenderThumbnailImage = Boolean(imageSrc && !imageLoadFailed);

  const handleTouchEnd = e => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      onDoubleClick(e);
    } else {
      onClick(e);
    }
    setLastTap(currentTime);
  };

  // PACS-AI: AI result "selected view" marker
  const renderSelectedViewBadge = (sizeClassName: string) =>
    selectedViewBadge ? (
      <span
        className={classnames(
          'flex shrink-0 items-center justify-center rounded-full bg-[#3ef1d1] font-bold text-black',
          sizeClassName
        )}
        title={selectedViewBadge.label}
        aria-label={selectedViewBadge.label}
        data-cy="thumbnail-selected-view-badge"
      >
        {selectedViewBadge.number}
      </span>
    ) : null;

  const renderThumbnailPreset = () => {
    return (
      <div
        className={classnames(
          'flex h-full w-full flex-col items-center justify-center gap-[2px] p-[4px]',
          // PACS-AI
          isActive && 'bg-primary/10 rounded'
        )}
      >
        <div className="h-[114px] w-[128px]">
          <div className="relative bg-black">
            {shouldRenderThumbnailImage ? (
              <img
                src={imageSrc}
                alt={imageAltText}
                className="h-[114px] w-[128px] rounded object-contain"
                crossOrigin="anonymous"
                onError={() => {
                  setImageLoadFailed(true);
                  onImageLoadError();
                }}
              />
            ) : (
              // PACS-AI
              <div className="bg-primary/20 h-[114px] w-[128px] rounded">{children}</div>
            )}

            {/* bottom left */}
            <div className="absolute bottom-0 left-0 flex h-[14px] items-center gap-[4px] rounded-tr pt-[10px] pb-[10px] pr-[6px] pl-[5px]">
              <div
                className={classnames(
                  'h-[10px] w-[10px] rounded-[2px]',
                  // PACS-AI
                  isActive || isHydratedForDerivedDisplaySet ? 'bg-primary' : 'bg-primary/40',
                  loadingProgress && loadingProgress < 1 && 'bg-primary/25'
                )}
              ></div>
              <div
                className="text-foreground text-[11px] font-semibold"
                data-cy="series-modality-label"
              >
                {modality}
              </div>
            </div>

            {/* top left (PACS-AI) */}
            {selectedViewBadge && (
              <div className="absolute top-[4px] left-[4px]">
                {renderSelectedViewBadge('h-[18px] w-[18px] text-[11px]')}
              </div>
            )}

            {/* top right */}
            <div className="absolute top-0 right-0 flex items-center gap-[4px]">
              <DisplaySetMessageListTooltip
                messages={messages}
                id={`display-set-tooltip-${displaySetInstanceUID}`}
              />
              {isTracked && (
                <Tooltip>
                  <TooltipTrigger>
                    <div className="group">
                      <Icons.StatusTracking className="text-highlight h-[15px] w-[15px] group-hover:hidden" />
                      <Icons.Cancel
                        className="text-highlight hidden h-[15px] w-[15px] group-hover:block"
                        onClick={onClickUntrack}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex flex-1 flex-row">
                      <div className="flex-2 flex items-center justify-center pr-4">
                        <Icons.InfoLink className="text-primary" />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <span>
                          <span className="text-foreground">
                            {isTracked ? 'Series is tracked' : 'Series is untracked'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {/* bottom right */}
            <div className="absolute bottom-0 right-0 flex items-center gap-[4px] p-[4px]">
              <ThumbnailMenuItems
                displaySetInstanceUID={displaySetInstanceUID}
                canReject={canReject}
                onReject={onReject}
              />
            </div>
          </div>
        </div>
        <div className="flex h-[52px] w-[128px] flex-col justify-start pt-px">
          <Tooltip>
            <TooltipContent>{description}</TooltipContent>
            <TooltipTrigger>
              <div
                className="text-foreground min-h-[18px] w-[128px] overflow-hidden text-ellipsis whitespace-nowrap pb-0.5 pl-1 text-left text-[12px] font-normal leading-4"
                data-cy="series-description-label"
              >
                {description}
              </div>
            </TooltipTrigger>
          </Tooltip>
          <div className="flex h-[12px] items-center gap-[7px] overflow-hidden">
            {/* PACS-AI */}
            <div className="pl-1 text-[11px] font-semibold text-white/80"> S:{seriesNumber}</div>
            {/* PACS-AI */}
            <div className="text-[11px] font-semibold text-white/80">
              <div className="flex items-center gap-[4px]">
                {countIcon ? (
                  React.createElement(Icons[countIcon] || Icons.MissingIcon, { className: 'w-3' })
                ) : (
                  <Icons.InfoSeries className="w-3" />
                )}
                <div>{numInstances}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderListPreset = () => {
    return (
      <div
        className={classnames(
          'flex h-full w-full items-center justify-between pr-[8px] pl-[8px] pt-[4px] pb-[4px]',
          // PACS-AI
          isActive && 'bg-primary/10 rounded'
        )}
      >
        <div className="relative flex h-[32px] w-full items-center gap-[8px] overflow-hidden">
          <div
            className={classnames(
              'h-[32px] w-[4px] min-w-[4px] rounded',
              // PACS-AI
              isActive || isHydratedForDerivedDisplaySet ? 'bg-primary' : 'bg-primary/40',
              loadingProgress && loadingProgress < 1 && 'bg-primary/20'
            )}
          ></div>
          <div className="flex h-full w-[calc(100%-12px)] flex-col justify-start">
            <div className="flex items-center gap-[7px]">
              {/* PACS-AI */}
              {renderSelectedViewBadge('h-[16px] w-[16px] text-[10px]')}
              {/* PACS-AI */}
              <div
                className="text-[13px] font-semibold text-white/80"
                data-cy="series-modality-label"
              >
                {modality}
              </div>
              <Tooltip>
                <TooltipContent>{description}</TooltipContent>
                <TooltipTrigger className="w-full overflow-hidden">
                  {/* PACS-AI */}
                  <div
                    className="max-w-[160px] overflow-hidden overflow-ellipsis whitespace-nowrap text-left text-[13px] font-normal text-white/80"
                    data-cy="series-description-label"
                  >
                    {description}
                  </div>
                </TooltipTrigger>
              </Tooltip>
            </div>

            <div className="flex h-[12px] items-center gap-[7px] overflow-hidden">
              {/* PACS-AI */}
              <div className="text-[12px] font-semibold text-white/80"> S:{seriesNumber}</div>
              {/* PACS-AI */}
              <div className="text-[12px] font-semibold text-white/80">
                <div className="flex items-center gap-[4px]">
                  {' '}
                  {countIcon ? (
                    React.createElement(Icons[countIcon] || Icons.MissingIcon, { className: 'w-3' })
                  ) : (
                    <Icons.InfoSeries className="w-3" />
                  )}
                  <div>{numInstances}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex h-full items-center gap-[4px]">
          <DisplaySetMessageListTooltip
            messages={messages}
            id={`display-set-tooltip-${displaySetInstanceUID}`}
          />
          {isTracked && (
            <Tooltip>
              <TooltipTrigger>
                <div className="group">
                  <Icons.StatusTracking className="text-highlight h-[20px] w-[15px] group-hover:hidden" />
                  <Icons.Cancel
                    className="text-highlight hidden h-[15px] w-[15px] group-hover:block"
                    onClick={onClickUntrack}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="flex flex-1 flex-row">
                  <div className="flex-2 flex items-center justify-center pr-4">
                    <Icons.InfoLink className="text-primary" />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span>
                      <span className="text-foreground">
                        {isTracked ? 'Series is tracked' : 'Series is untracked'}
                      </span>
                    </span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          <ThumbnailMenuItems
            displaySetInstanceUID={displaySetInstanceUID}
            canReject={canReject}
            onReject={onReject}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={classnames(
        className,
        // PACS-AI
        'group flex select-none flex-col rounded bg-white/10 outline-none',
        isDraggable && 'cursor-pointer hover:bg-white/30',
        !isDraggable && 'cursor-default',
        viewPreset === 'thumbnails' && 'h-[170px] w-[135px]',
        selectedViewBadge && 'ring-1 ring-[#3ef1d1]', // PACS-AI
        viewPreset === 'list' && 'h-[40px] w-full'
      )}
      id={`thumbnail-${displaySetInstanceUID}`}
      data-cy={
        thumbnailType === 'thumbnailNoImage'
          ? 'study-browser-thumbnail-no-image'
          : 'study-browser-thumbnail'
      }
      data-series={seriesNumber}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onTouchEnd={handleTouchEnd}
      role={isDraggable ? 'button' : undefined}
    >
      {isDraggable ? (
        <DraggableThumbnailContent dragData={dragData}>
          {viewPreset === 'thumbnails' && renderThumbnailPreset()}
          {viewPreset === 'list' && renderListPreset()}
        </DraggableThumbnailContent>
      ) : (
        <StaticThumbnailContent>
          {viewPreset === 'thumbnails' && renderThumbnailPreset()}
          {viewPreset === 'list' && renderListPreset()}
        </StaticThumbnailContent>
      )}
    </div>
  );
};

export { PacsAiThumbnail };
