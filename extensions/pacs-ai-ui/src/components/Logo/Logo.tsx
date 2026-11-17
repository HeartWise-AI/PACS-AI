import React from 'react';
import PropTypes from 'prop-types';
import { pacsAiLogo as pacsLogo } from '@pacs-ai/theme';

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
