import React, { useContext } from 'react';
import { AlertContext } from '../../../AlertProvider';
import copyIcon from '../../../assets/pacs/icons/copy-gradient.png';

type CopyToClipboardButtonProps = {
  text: string;
};

const CopyToClipboardButton = ({ text }: CopyToClipboardButtonProps) => {
  const showAlert = useContext(AlertContext);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text).then(() => {
      showAlert('Copy to clipboard success', 'success');
    });
  };

  return (
    <button className="p-0 focus:ring-0">
      <img
        src={copyIcon}
        alt="Copy icon"
        className="ml-2 h-5 w-5 cursor-pointer"
        onClick={copyToClipboard}
      />
    </button>
  );
};

export default CopyToClipboardButton;
