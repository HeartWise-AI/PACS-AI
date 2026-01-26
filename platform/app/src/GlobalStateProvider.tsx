import React, { createContext, useContext, useState } from 'react';
import { ServicesManager } from '@ohif/core';

interface GlobalStateContextType {
  selectedModalities: { [key: string]: { modality: string; displaySets: any } };
  servicesManager: ServicesManager;
  patientInfo: {
    PatientID: string;
    PatientName: string;
  };
  setDisplaySets: (displaySets: any) => void;
  setModalitiesInStudy: (modalitiesInStudy: string) => void;
  setSelectedModalities: (selectedModalities: {
    [key: string]: { modality: string; displaySets: any };
  }) => void;
  setServicesManager: (servicesManager: ServicesManager) => void;
  setPatientInfo: (patientInfo: { PatientID: string; PatientName: string }) => void;
}

interface GlobalStateProviderProps {
  children: React.ReactNode;
}

// create context with initial type definition
const GlobalStateContext = createContext<GlobalStateContextType>({
  selectedModalities: {},
  servicesManager: {} as ServicesManager,
  patientInfo: {
    PatientID: '',
    PatientName: '',
  },
  setDisplaySets: () => {},
  setModalitiesInStudy: () => {},
  setSelectedModalities: () => {},
  setServicesManager: () => {},
  setPatientInfo: () => {},
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
  const [selectedModalities, setSelectedModalities] = useState<{
    [key: string]: { modality: string; displaySets: any };
  }>({});
  const [servicesManager, setServicesManager] = useState<ServicesManager>({} as ServicesManager);
  const [patientInfo, setPatientInfo] = useState<{ PatientID: string; PatientName: string }>({
    PatientID: '',
    PatientName: '',
  });
  const [displaySets, setDisplaySets] = useState<any>(null);
  const [modalitiesInStudy, setModalitiesInStudy] = useState<string>('');

  const value = {
    selectedModalities,
    servicesManager,
    setSelectedModalities,
    setServicesManager,
    patientInfo,
    setPatientInfo,
    setDisplaySets,
    setModalitiesInStudy,
  };

  return <GlobalStateContext.Provider value={value}>{children}</GlobalStateContext.Provider>;
};
