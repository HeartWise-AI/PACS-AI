import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useDrag } from 'react-dnd';
import Icon from '../Icon';
import { StringNumber } from '../../types';
import DisplaySetMessageListTooltip from '../DisplaySetMessageListTooltip';
import aiModelsIcon from './../../assets/pacs/icons/ai-models-gradient.png';
import playerPlayIcon from './../../assets/pacs/icons/player-play-gradient.png';
import helpInactive from './../../assets/pacs/icons/help-inactive.png';

/**
 * Display a thumbnail for a display set.
 */
const Thumbnail = ({
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
  isActive,
  onClick,
  onDoubleClick,
}): React.ReactNode => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  // TODO: We should wrap our thumbnail to create a "DraggableThumbnail", as
  // this will still allow for "drag", even if there is no drop target for the
  // specified item.
  const [collectedProps, drag, dragPreview] = useDrag({
    type: 'displayset',
    item: { ...dragData },
    canDrag: function (monitor) {
      return Object.keys(dragData).length !== 0;
    },
  });

  return (
    <div
      className={classnames(
        className,
        'group mb-8 flex flex-1 cursor-pointer select-none flex-col px-2 outline-none'
      )}
      id={`thumbnail-${displaySetInstanceUID}`}
      data-cy={`study-browser-thumbnail`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      role="button"
      tabIndex="0"
    >
      <div
        className="relative flex items-center pb-2"
        ref={ref}
      >
        <button
          className="h-[28px] w-[28px] rounded-lg bg-transparent"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
        >
          <img
            src={aiModelsIcon}
            alt="AI Model icon"
          />
        </button>

        {isOpen && (
          <div
            className="absolute z-50 w-[200px] divide-y divide-gray-100 rounded-lg bg-[#4C504B] shadow"
            style={{ top: ref.current ? ref.current.offsetHeight : 0 }}
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
      <div ref={drag}>
        <div
          className={classnames(
            'min-h-32 flex flex-1 items-center justify-center overflow-hidden rounded-md bg-transparent text-base text-white',
            isActive ? 'border-primary-light border-2' : 'border-secondary-light border'
          )}
          style={{
            margin: isActive ? '0' : '1px',
          }}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={imageAltText}
              className="min-h-32 object-none"
              crossOrigin="anonymous"
            />
          ) : (
            <div>{imageAltText}</div>
          )}
        </div>
        <div className="flex flex-1 flex-row items-center pt-2 text-base text-white">
          <div className="mr-4">
            <span className="text-primary-main font-bold">{'S: '}</span>
            {seriesNumber}
          </div>
          <div className="flex flex-1 flex-row items-center">
            <Icon
              name={countIcon || 'group-layers'}
              className="mr-2 w-3"
            />
            {` ${numInstances}`}
          </div>
          <DisplaySetMessageListTooltip
            messages={messages}
            id={`display-set-tooltip-${displaySetInstanceUID}`}
          />
        </div>
        <div className="break-all text-base text-white">{description}</div>
      </div>
    </div>
  );
};

Thumbnail.propTypes = {
  displaySetInstanceUID: PropTypes.string.isRequired,
  className: PropTypes.string,
  imageSrc: PropTypes.string,
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
  imageAltText: PropTypes.string,
  description: PropTypes.string.isRequired,
  seriesNumber: StringNumber.isRequired,
  numInstances: PropTypes.number.isRequired,
  messages: PropTypes.object,
  isActive: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  onDoubleClick: PropTypes.func.isRequired,
};

Thumbnail.defaultProps = {
  dragData: {},
};

export default Thumbnail;
