import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Icon from '../Icon';
import Thumbnail from '../Thumbnail';
import Tooltip from '../Tooltip';
import { StringNumber } from '../../types';
import aiModelsIcon from './../../assets/pacs/icons/ai-models-gradient.png';
import playerPlayIcon from './../../assets/pacs/icons/player-play-gradient.png';
import helpInactive from './../../assets/pacs/icons/help-inactive.png';

const ThumbnailTracked = ({
  displaySetInstanceUID,
  className,
  imageSrc,
  imageAltText,
  description,
  seriesNumber,
  numInstances,
  countIcon,
  messages,
  dragData,
  onClick,
  onDoubleClick,
  onClickUntrack,
  viewportIdentificator,
  isTracked,
  isActive,
}) => {
  const trackedIcon = isTracked ? 'circled-checkmark' : 'dotted-circle';
  const viewportIdentificatorLabel = viewportIdentificator.join(', ');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const renderViewportLabels = () => {
    const MAX_LABELS_PER_COL = 3;
    const shouldShowStack = viewportIdentificator.length > MAX_LABELS_PER_COL;
    if (shouldShowStack) {
      return (
        <div>
          <div>
            {viewportIdentificator.slice(0, MAX_LABELS_PER_COL).map(label => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <Tooltip
            position="right"
            content={
              <div className="max-w-40 text-left">
                Series is displayed <br /> in viewport {viewportIdentificatorLabel}
              </div>
            }
          >
            <Icon
              name="tool-more-menu"
              className="py-2 text-white"
            />
          </Tooltip>
        </div>
      );
    }

    return viewportIdentificator.map(label => <div key={label}>{label}</div>);
  };

  return (
    <div
      className={classnames('flex cursor-pointer flex-col px-2 py-2 outline-none', className)}
      id={`thumbnail-${displaySetInstanceUID}`}
    >
      <div className="mb-2 flex items-center rounded-lg bg-white bg-opacity-10 py-1">
        <div
          className={classnames(
            'relative flex w-full cursor-pointer flex-col items-center justify-start p-1',
            isTracked && 'rounded-sm hover:bg-gray-900'
          )}
        >
          <Tooltip
            position="right"
            content={
              <div className="flex flex-1 flex-row">
                <div className="flex-2 flex items-center justify-center pr-4">
                  <Icon
                    name="info-link"
                    className="text-primary-active"
                  />
                </div>
                <div className="flex flex-1 flex-col">
                  <span>
                    Series is
                    <span className="text-black">{isTracked ? ' tracked' : ' untracked'}</span>
                  </span>
                  {!!viewportIdentificator.length && (
                    <span>
                      in viewport
                      <span className="ml-1 text-white">{viewportIdentificatorLabel}</span>
                    </span>
                  )}
                </div>
              </div>
            }
          >
            <Icon
              name={trackedIcon}
              className="text-primary-light w-5"
            />
          </Tooltip>

          <div
            className="text-center text-xl leading-tight text-white"
            data-cy={'thumbnail-viewport-labels'}
          >
            {renderViewportLabels()}
          </div>
        </div>
        {isTracked && (
          <div onClick={onClickUntrack}>
            <Icon
              name="cancel"
              className="text-primary-active w-4"
            />
          </div>
        )}
        <div
          className="relative flex w-full items-center"
          ref={ref}
        >
          <button
            className="h-auto w-full rounded-lg bg-transparent"
            type="button"
            onClick={() => setIsOpen(!isOpen)}
          >
            <img
              src={aiModelsIcon}
              alt="AI Model icon"
              className="mx-auto block w-6"
            />
          </button>

          {isOpen && (
            <div
              className="absolute z-50 w-[200px] divide-y divide-gray-100 rounded-lg bg-[#4C504B] shadow"
              style={{ top: ref.current ? ref.current.offsetHeight : 0, right: 0 }}
            >
              <ul className="flex flex-col gap-1 py-2 text-sm text-white">
                <li className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black">
                  <img
                    src={playerPlayIcon}
                    alt="Player play icon"
                    className="w-5"
                  />
                  <h1 className="text-[11px]">Apply X3D LVEF detection</h1>
                  <img
                    src={helpInactive}
                    alt="Player play icon"
                    className="w-4"
                  />
                </li>
                <li className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black">
                  <img
                    src={playerPlayIcon}
                    alt="Player play icon"
                    className="w-5"
                  />
                  <h1 className="text-[11px]">Apply X4D LVEF detection</h1>
                  <img
                    src={helpInactive}
                    alt="Player play icon"
                    className="w-4"
                  />
                </li>
                <li className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black">
                  <img
                    src={playerPlayIcon}
                    alt="Player play icon"
                    className="w-5"
                  />
                  <h1 className="text-[11px]">Apply X5D LVEF detection</h1>
                  <img
                    src={helpInactive}
                    alt="Player play icon"
                    className="w-4"
                  />
                </li>
              </ul>
            </div>
          )}
        </div>
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
        isActive={isActive}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
};

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
  onClick: PropTypes.func.isRequired,
  onDoubleClick: PropTypes.func.isRequired,
  onClickUntrack: PropTypes.func.isRequired,
  viewportIdentificator: PropTypes.array,
  isTracked: PropTypes.bool,
  messages: PropTypes.object,
  isActive: PropTypes.bool.isRequired,
};

export default ThumbnailTracked;
