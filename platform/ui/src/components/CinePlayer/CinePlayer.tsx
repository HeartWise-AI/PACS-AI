import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash.debounce';

import Icon from '../Icon';
import Tooltip from '../Tooltip';
import InputRange from '../InputRange';

import './CinePlayer.css';

export type CinePlayerProps = {
  className: string;
  isPlaying: boolean;
  minFrameRate?: number;
  maxFrameRate?: number;
  stepFrameRate?: number;
  frameRate?: number;
  onPlayPauseChange: (value: boolean) => void;
  onClose: () => void;
  updateDynamicInfo?: () => void;
  dynamicInfo?: {
    timePointIndex: number;
    numTimePoints: number;
    label?: string;
  };
};

const fpsButtonClassNames =
  'cursor-pointer text-primary-active active:text-primary-light hover:bg-white w-4 flex items-center justify-center';

const CinePlayer: React.FC<CinePlayerProps> = ({
  className,
  isPlaying,
  minFrameRate,
  maxFrameRate,
  stepFrameRate,
  frameRate: defaultFrameRate,
  dynamicInfo = {},
  onPlayPauseChange,
  onClose,
  updateDynamicInfo,
}) => {
  const isDynamic = !!dynamicInfo?.numTimePoints;
  const [frameRate, setFrameRate] = useState(defaultFrameRate);

  const getPlayPauseIconName = () => (isPlaying ? 'icon-pause' : 'icon-play');

  const handleSetFrameRate = (frameRate: number) => {
    if (frameRate < minFrameRate || frameRate > maxFrameRate) {
      return;
    }
    setFrameRate(frameRate);
    debouncedSetFrameRate(frameRate);
  };

  useEffect(() => {
    setFrameRate(defaultFrameRate);
  }, [defaultFrameRate]);

  const handleTimePointChange = useCallback(
    (newIndex: number) => {
      if (isDynamic && dynamicInfo) {
        // Here, you would update the component's state or context that controls the current time point index
        // For demonstration, assuming a hypothetical function that updates the time point index
        updateDynamicInfo({
          ...dynamicInfo,
          timePointIndex: newIndex,
        });
      }
    },
    [isDynamic, dynamicInfo]
  );

  return (
    <div className={className}>
      {isDynamic && dynamicInfo && (
        <InputRange
          value={dynamicInfo.timePointIndex}
          onChange={handleTimePointChange}
          minValue={0}
          maxValue={dynamicInfo.numTimePoints - 1}
          step={1}
          containerClassName="mb-3 w-full"
          labelClassName="text-xs text-white"
          leftColor="#3a3f99"
          rightColor="#3a3f99"
          trackHeight="4px"
          thumbColor="#348cfd"
          thumbColorOuter="#000000"
          showLabel={false}
        />
      )}
      <div
        className={
          'border-secondary-light/60 inline-flex select-none items-center gap-2 rounded border bg-[#4C504B] px-2 py-2'
        }
      >
        <Icon
          name={getPlayPauseIconName()}
          className="cursor-pointer text-black hover:bg-white hover:text-black"
          onClick={() => onPlayPauseChange(!isPlaying)}
        />
        {isDynamic && dynamicInfo && (
          <div className="min-w-16 max-w-44 flex flex-col  text-white">
            {/* Add Tailwind classes for monospace font and center alignment */}
            <div className="text-[11px]">
              <span className="w-2 text-white">{dynamicInfo.timePointIndex}</span>{' '}
              <span className="text-aqua-pale">{`/${dynamicInfo.numTimePoints}`}</span>
            </div>
            <div className="text-aqua-pale text-xs">{dynamicInfo.label}</div>
          </div>
        )}

        <div className="ml-4 flex h-6 items-stretch gap-1 rounded border border-none">
          <div
            className={`${fpsButtonClassNames} rounded-l`}
            onClick={() => handleSetFrameRate(frameRate - 1)}
          >
            <Icon
              name="arrow-left-small"
              className="cursor-pointer text-black hover:bg-white hover:text-black"
            />
          </div>
          <Tooltip
            position="top"
            className="group/fps cine-fps-range-tooltip"
            tight={true}
          >
            <div className="flex items-center justify-center gap-1">
              <div className="text-grey-700 flex-shrink-0 text-center text-sm leading-[22px]">
                <span className="inline-block text-right">{`${frameRate} `}</span>
                <span className="whitespace-nowrap text-xs text-white">{' FPS'}</span>
              </div>
            </div>
          </Tooltip>

          <div
            className={`${fpsButtonClassNames} rounded-r`}
            onClick={() => handleSetFrameRate(frameRate + 1)}
          >
            <Icon
              name="arrow-right-small"
              className="cursor-pointer text-black hover:bg-white hover:text-black"
            />
          </div>
        </div>
        <Icon
          name="icon-close"
          className="cursor-pointer text-black hover:bg-white hover:text-black"
          onClick={onClose}
        />
      </div>
    </div>
  );
};

const noop = () => { };

CinePlayer.defaultProps = {
  isPlaying: false,
  minFrameRate: 1,
  maxFrameRate: 90,
  stepFrameRate: 1,
  frameRate: 24,
  onPlayPauseChange: noop,
  onClose: noop,
  isDynamic: false,
  dynamicInfo: {},
};

CinePlayer.propTypes = {
  /** Minimum value for range slider */
  minFrameRate: PropTypes.number,
  /** Maximum value for range slider */
  maxFrameRate: PropTypes.number,
  /** Increment range slider can "step" in either direction */
  stepFrameRate: PropTypes.number,
  frameRate: PropTypes.number,
  /** 'true' if playing, 'false' if paused */
  isPlaying: PropTypes.bool.isRequired,
  onPlayPauseChange: PropTypes.func,
  onClose: PropTypes.func,
  isDynamic: PropTypes.bool,
  dynamicInfo: PropTypes.shape({
    timePointIndex: PropTypes.number,
    numTimePoints: PropTypes.number,
    label: PropTypes.string,
  }),
};

export default CinePlayer;
