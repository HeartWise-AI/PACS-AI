import React from 'react';
import PropTypes from 'prop-types';
import pacsLogo from './../../assets/pacs/logo/pacs-ai-logo.png';

const Logo = ({ class: className }) => {
  return (
    <img
      src={pacsLogo}
      alt="PACS logo"
      className={className}
    />
  );
};

Logo.propTypes = {
  width: PropTypes.string,
};
export default Logo;
