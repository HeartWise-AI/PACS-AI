import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

const baseClasses = 'relative overflow-hidden rounded-lg';

const baseFontTextClasses = 'relative z-10 text-lg font-bold';

const backgroundClass = 'bg-gradient-to-r from-[rgba(108,105,244,0.1)] to-[rgba(62,241,209,0.1)]';

const textColor =
  'bg-gradient-to-r from-[rgba(108,105,244,1)] to-[rgba(62,241,209,1)] bg-clip-text text-transparent';

const borderClass = 'border-[1px] border-[rgba(62,241,209,.8)]';
const ButtonSecondary = ({ children, className, disabled, onClick }) => {
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

ButtonSecondary.defaultProps = {
  children: '',
  className: '',
  disabled: false,
  onClick: () => {},
};

ButtonSecondary.propTypes = {
  /** What is inside the button, can be text or react component */
  children: PropTypes.node,
  /** Callback to be called when the button is clicked  */
  onClick: PropTypes.func.isRequired,
  /** Whether the button should be disabled  */
  disabled: PropTypes.bool,
  /** Additional TailwindCSS classnames */
  className: PropTypes.string,
};

export default ButtonSecondary;
