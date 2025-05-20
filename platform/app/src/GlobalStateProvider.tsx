import React, { createContext, useContext, useState } from 'react';
import { ServicesManager } from '@ohif/core';

interface GlobalStateContextType {
  displaySets: any; // TODO: remove this
  modalitiesInStudy: string; // TODO: remove this
  selectedModalities: { [key: string]: { modality: string; displaySets: any } };
  servicesManager: ServicesManager;
  setDisplaySets: (displaySets: any) => void;
  setModalitiesInStudy: (modalitiesInStudy: string) => void;
  setSelectedModalities: (selectedModalities: {
    [key: string]: { modality: string; displaySets: any };
  }) => void;
  setServicesManager: (servicesManager: ServicesManager) => void;
}

interface GlobalStateProviderProps {
  children: React.ReactNode;
}

// create context with initial type definition
const GlobalStateContext = createContext<GlobalStateContextType>({
  displaySets: null,
  modalitiesInStudy: '',
  selectedModalities: {},
  servicesManager: {} as ServicesManager,
  setDisplaySets: () => {},
  setModalitiesInStudy: () => {},
  setSelectedModalities: () => {},
  setServicesManager: () => {},
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
  const [selectedModalities, setSelectedModalities] = useState<{
    [key: string]: { modality: string; displaySets: any };
  }>({});
  const [servicesManager, setServicesManager] = useState<ServicesManager>({} as ServicesManager);
  const value = {
    displaySets,
    modalitiesInStudy,
    selectedModalities,
    servicesManager,
    setDisplaySets,
    setModalitiesInStudy,
    setSelectedModalities,
    setServicesManager,
  };

  return <GlobalStateContext.Provider value={value}>{children}</GlobalStateContext.Provider>;
};
