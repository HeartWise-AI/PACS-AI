import React, { useRef } from 'react';
import PropTypes from 'prop-types';

const baseClasses = 'relative overflow-hidden rounded-lg';

const baseFontTextClasses = 'relative z-10 text-lg font-bold';

const backgroundClass =
  'bg-gradient-to-r from-[rgba(200,244,105,0.2)] via-[rgba(200,244,105,0.2)] to-[rgba(5,144,94,0.2)]';

const textColor =
  'bg-gradient-to-br from-[rgba(5,144,94,1)] via-[rgba(200,244,105,1)] to-[rgba(200,244,105,1)] bg-clip-text text-transparent';

const borderClass = 'border border-solid border-primary-main border-opacity-80 border-[.5px]';

const ButtonGradient = ({ children, className, disabled, onClick }) => {
  const buttonElement = useRef(null);

  const handleOnClick = e => {
    buttonElement.current.blur();
    if (!disabled) {
      onClick(e);
    }
  };

  return (
    <button
      ref={buttonElement}
      disabled={disabled}
      className={`${borderClass} ${baseClasses} ${className}`}
      onClick={handleOnClick}
    >
      <span className={`${baseFontTextClasses} ${textColor}`}>{children}</span>
      <span className={`absolute inset-0 rounded-lg ${backgroundClass}`}></span>
    </button>
  );
};

ButtonGradient.defaultProps = {
  children: '',
  className: '',
  disabled: false,
  onClick: () => {},
};

ButtonGradient.propTypes = {
  /** What is inside the button, can be text or react component */
  children: PropTypes.node,
  /** Callback to be called when the button is clicked  */
  onClick: PropTypes.func.isRequired,
  /** Whether the button should be disabled  */
  disabled: PropTypes.bool,
  /** Additional TailwindCSS classnames */
  className: PropTypes.string,
};

export default ButtonGradient;
