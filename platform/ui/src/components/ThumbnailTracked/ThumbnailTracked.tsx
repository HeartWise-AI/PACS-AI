import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import Thumbnail from '../Thumbnail';
import Tooltip from '../Tooltip';
import { StringNumber } from '../../types';
import { useTranslation } from 'react-i18next';
// import { AIModelButton } from '@ohif/ui';

import { Icons } from '@ohif/ui-next';
// Todo: This class to me feels like it belongs in an extension, not in platform/ui
// because it is dealing with mode specific components/information
function ThumbnailTracked({
  displaySetInstanceUID,
  className,
  imageSrc,
  imageAltText,
  description,
  seriesNumber,
  numInstances,
  loadingProgress,
  countIcon,
  messages,
  dragData,
  onClick,
  onDoubleClick,
  onClickUntrack,
  isTracked,
  isActive,
}) {
  const { t } = useTranslation('ThumbnailTracked');
  const trackedIcon = isTracked ? 'circled-checkmark' : 'dotted-circle';

  return (
    <div
      className={classnames('flex flex-1 cursor-pointer flex-row px-3 outline-none', className)}
      id={`thumbnail-${displaySetInstanceUID}`}
    >
      <div className="mb-2 flex items-center rounded-lg bg-white bg-opacity-10 py-1">
        <div
          className={classnames(
            'relative mb-2 flex cursor-pointer flex-col items-center justify-start p-2',
            isTracked && 'rounded-sm hover:bg-gray-900'
          )}
        >
          <Tooltip
            position="bottom"
            content={
              <div className="flex flex-1 flex-row">
                <div className="flex-2 flex items-center justify-center pr-4">
                  {/* NOTE: This is a PACS changes */}
                  <Icons.InfoLink className="text-black" />
                </div>
                <div className="flex flex-1 flex-col">
                  <span>
                    <span className="text-white">
                      {isTracked ? t('Series is tracked') : t('Series is untracked')}
                    </span>
                  </span>
                </div>
              </div>
            }
          >
            <Icons.ByName
              name={trackedIcon}
              className="text-primary-light w-5"
            />
          </Tooltip>
        </div>
        {isTracked && (
          <div onClick={onClickUntrack}>
            <Icons.Cancel className="text-primary-active w-4" />
          </div>
        )}
        {/* TODO: Added AI Models button */}
        {/* <AIModelButton
          isShowBG={true}
          positionRight={0}
          inferenceAvailableModels={inferenceAvailableModels}
          modalities={modalities}
        /> */}
      </div>

      <Thumbnail
        displaySetInstanceUID={displaySetInstanceUID}
        imageSrc={imageSrc}
        imageAltText={imageAltText}
        dragData={dragData}
        description={description}
        seriesNumber={seriesNumber}
        messages={messages}
        numInstances={numInstances}
        countIcon={countIcon}
        loadingProgress={loadingProgress}
        isActive={isActive}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}

ThumbnailTracked.propTypes = {
  /**
   * Data the thumbnail should expose to a receiving drop target. Use a matching
   * `dragData.type` to identify which targets can receive this draggable item.
   * If this is not set, drag-n-drop will be disabled for this thumbnail.
   *
   * Ref: https://react-dnd.github.io/react-dnd/docs/api/use-drag#specification-object-members
   */
  dragData: PropTypes.shape({
    /** Must match the "type" a dropTarget expects */
    type: PropTypes.string.isRequired,
  }),
  displaySetInstanceUID: PropTypes.string.isRequired,
  className: PropTypes.string,
  imageSrc: PropTypes.string,
  imageAltText: PropTypes.string,
  description: PropTypes.string.isRequired,
  seriesNumber: StringNumber.isRequired,
  numInstances: PropTypes.number.isRequired,
  loadingProgress: PropTypes.number,
  onClick: PropTypes.func.isRequired,
  onDoubleClick: PropTypes.func.isRequired,
  onClickUntrack: PropTypes.func.isRequired,
  isTracked: PropTypes.bool,
  messages: PropTypes.object,
  isActive: PropTypes.bool.isRequired,
};

export default ThumbnailTracked;
