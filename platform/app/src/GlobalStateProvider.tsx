import React, { createContext, useContext, useState } from 'react';

interface GlobalStateContextType {
  displaySets: any;
  modalitiesInStudy: string;
  setDisplaySets: (displaySets: any) => void;
  setModalitiesInStudy: (modalitiesInStudy: string) => void;
}

interface GlobalStateProviderProps {
  children: React.ReactNode;
}

// create context with initial type definition
const GlobalStateContext = createContext<GlobalStateContextType>({
  displaySets: null,
  modalitiesInStudy: '',
  setDisplaySets: () => {},
  setModalitiesInStudy: () => {},
});

// custom hook to use the data context
export const useGlobalStateData = () => {
  const context = useContext(GlobalStateContext);
  if (!context) {
    console.error('useGlobalStateData must be used within a GlobalStateProvider');
  }
  return context;
};

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = ({ children }) => {
  const [displaySets, setDisplaySets] = useState<any>(null);
  const [modalitiesInStudy, setModalitiesInStudy] = useState<string>('');
  const value = {
    displaySets,
    modalitiesInStudy,
    setDisplaySets,
    setModalitiesInStudy,
  };

  return <GlobalStateContext.Provider value={value}>{children}</GlobalStateContext.Provider>;
};
