import React, { useState, useEffect } from 'react';

export const AlertContext = React.createContext();

export const AlertProvider = ({ children }) => {
  const [alert, setAlert] = useState({ message: '', variant: '' });

  const showAlert = (message: string, variant: string) => {
    let variantClass = '';
    switch (variant) {
      case 'error':
        variantClass = 'bg-red-500';
        break;
      case 'success':
        variantClass = 'bg-green-500';
        break;
      default:
        variantClass = 'bg-primary-dark';
    }

    setAlert({ message, variant: variantClass });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setAlert({ message: '', variant: '' });
    }, 5000); // alert disappears after 3 seconds

    return () => clearTimeout(timer); // clean up timer
  }, [alert]);

  return (
    <AlertContext.Provider value={showAlert}>
      {children}
      {alert.message && (
        <div
          className={`${alert.variant} fixed left-1/2 top-0 z-[99999] w-full -translate-x-1/2 rounded-none p-3 text-center text-white`}
        >
          {alert.message}
        </div>
      )}
    </AlertContext.Provider>
  );
};
