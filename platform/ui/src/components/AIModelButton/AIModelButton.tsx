import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import aiModelsIcon from './../../assets/pacs/icons/ai-models-white.png';
import playerPlayIcon from './../../assets/pacs/icons/player-play-gradient.png';
import helpInactive from './../../assets/pacs/icons/help-inactive.png';

const baseClasses = 'relative overflow-hidden rounded-lg p-1 ml-2';

const baseFontTextClasses = 'relative z-10 text-lg font-bold';

const backgroundClass = 'bg-gradient-to-r from-[rgba(108,105,244,1)] to-[rgba(62,241,209,1)]';

const textColor = 'text-white';
const AIModelButton = ({ children, className, disabled, onClick, isShowBG }) => {
  const buttonElement = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const handleOnClick = e => {
    buttonElement.current.blur();
    if (!disabled) {
      onClick(e);
    }
  };

  return (
    <div className="flex w-full">
      <button
        className={`${baseClasses} ${className} ${textColor} ${
          isShowBG ? backgroundClass : 'bg-transparent'
        }`}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <img
          src={aiModelsIcon}
          className="h-6 w-6"
          alt="AI Models icon"
        />
      </button>
      {isOpen && (
        <div
          className="absolute z-10 w-[225px] divide-y divide-gray-100 rounded-lg bg-[#4C504B] shadow "
          style={{ top: ref.current ? ref.current.offsetHeight : 40 }}
        >
          <ul className="flex flex-col gap-1 py-2 text-sm text-white">
            <li className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black">
              <img
                src={playerPlayIcon}
                alt="Player play icon"
                className="w-5"
              />
              <h1 className="text-sm">Apply X3D LVEF detection</h1>
              <img
                src={helpInactive}
                alt="Player play icon"
                className="w-5"
              />
            </li>
            <li className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black">
              <img
                src={playerPlayIcon}
                alt="Player play icon"
                className="w-5"
              />
              <h1 className="text-sm">Apply X4D LVEF detection</h1>
              <img
                src={helpInactive}
                alt="Player play icon"
                className="w-5"
              />
            </li>
            <li className="hover:bg-primary-dark flex cursor-pointer items-center gap-2 p-1 hover:text-black">
              <img
                src={playerPlayIcon}
                alt="Player play icon"
                className="w-5"
              />
              <h1 className="text-sm">Apply X5D LVEF detection</h1>
              <img
                src={helpInactive}
                alt="Player play icon"
                className="w-5"
              />
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

AIModelButton.defaultProps = {
  children: '',
  className: '',
  disabled: false,
  isShowBG: false,
  onClick: () => {},
};

AIModelButton.propTypes = {
  /** What is inside the button, can be text or react component */
  children: PropTypes.node,
  /** Callback to be called when the button is clicked  */
  onClick: PropTypes.func.isRequired,
  /** Whether the button should be disabled  */
  disabled: PropTypes.bool,
  /** Whether to show the gradient background  */
  isShowBG: PropTypes.bool,
  /** Additional TailwindCSS classnames */
  className: PropTypes.string,
};

export default AIModelButton;
