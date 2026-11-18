import React from 'react';
import { pacsAiLogo as pacsLogo } from '@pacs-ai/theme';

const Logo = ({ class: className }: { class?: string; width?: string }) => {
  return (
    <img
      src={pacsLogo}
      alt="PACS logo"
      className={className}
    />
  );
};

export default Logo;
