import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertContext } from '../../../AlertProvider';
import orthancRepository from '../../../api/orthancRepository';
import { EMPTY_MODALITY_FORM } from '../constants';
import type { DICOMModalities, ModalityFormState } from '../types';
import { handleUnauthorizedAccess, mapOrthancModalities } from '../utils';

export function useDicomModalities() {
  const showAlert = useContext(AlertContext);
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';

  const [modalities, setModalities] = useState<DICOMModalities[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModalityToRemove, setSelectedModalityToRemove] = useState('');
  const [selectedModality, setSelectedModality] =
    useState<ModalityFormState>(EMPTY_MODALITY_FORM);
  const [isAddModality, setIsAddModality] = useState(true);
  const [isUpdatingModality, setIsUpdatingModality] = useState(false);
  const [isAddingModality, setIsAddingModality] = useState(false);
  const [isOpenAddEditModalityModal, setIsOpenAddEditModalityModal] = useState(false);
  const [isOpenRemoveModalityModal, setIsOpenRemoveModalityModal] = useState(false);
  const [isRefreshingDICOMModalities, setIsRefreshingDICOMModalities] = useState(false);
  const [isRemovingModality, setIsRemovingModality] = useState(false);

  const clearSelectedModality = useCallback(() => {
    setSelectedModality(EMPTY_MODALITY_FORM);
  }, []);

  const updateModalitiesStatus = async (nextModalities: DICOMModalities[]) => {
    const updatedModalities = [...nextModalities];
    const modalityPromises = nextModalities.map(async (modality, index) => {
      try {
        await orthancRepository.TriggerDICOMEchoSCU({ modalityId: modality.id });
        updatedModalities[index] = { ...modality, status: 'Connected' };
      } catch (error) {
        handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
        console.error(`Error triggering DICOM Echo for modality ${modality.id}:`, error);
        updatedModalities[index] = { ...modality, status: 'Disconnected' };
      }
      setModalities([...updatedModalities]);
    });

    await Promise.all(modalityPromises);
  };

  const fetchDICOMModalities = useCallback(async () => {
    setLoading(true);
    setModalities([]);
    try {
      const response = await orthancRepository.GetDICOMModalities();
      const nextModalities = mapOrthancModalities(response.data.modalities);
      setModalities(nextModalities);
      updateModalitiesStatus(nextModalities);
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error('Error fetching DICOM modalities:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showAlert from AlertContext is unstable
  }, []);

  useEffect(() => {
    fetchDICOMModalities();
  }, [fetchDICOMModalities]);

  const updateModalityStatus = async (modalityId: string) => {
    setIsRefreshingDICOMModalities(true);
    setModalities(prevModalities =>
      prevModalities.map(modality =>
        modality.id === modalityId ? { ...modality, status: 'Connecting' } : modality
      )
    );
    try {
      await orthancRepository.TriggerDICOMEchoSCU({ modalityId });
      setModalities(prevModalities =>
        prevModalities.map(modality =>
          modality.id === modalityId ? { ...modality, status: 'Connected' } : modality
        )
      );
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error triggering DICOM Echo for modality ${modalityId}:`, error);
      setModalities(prevModalities =>
        prevModalities.map(modality =>
          modality.id === modalityId ? { ...modality, status: 'Disconnected' } : modality
        )
      );
    }
    setIsRefreshingDICOMModalities(false);
  };

  const addModality = async () => {
    if (
      !selectedModality.targetCFindEnabled &&
      !selectedModality.targetCMoveEnabled &&
      !selectedModality.targetCStoreEnabled
    ) {
      showAlert('At least one of C-Find, C-Move, or C-Store must be enabled', 'error');
      return;
    }

    setIsAddingModality(true);
    try {
      const response = await orthancRepository.UpdateDICOMModality({
        modalityId: selectedModality.id,
        aet: selectedModality.aet,
        host: selectedModality.host,
        port: +selectedModality.port,
        cFindEnabled: selectedModality.targetCFindEnabled,
        cMoveEnabled: selectedModality.targetCMoveEnabled,
        cStoreEnabled: selectedModality.targetCStoreEnabled,
      });
      showAlert(response.message, 'success');
      setIsOpenAddEditModalityModal(false);
      clearSelectedModality();
      fetchDICOMModalities();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error adding modality: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsAddingModality(false);
  };

  const updateModality = async () => {
    if (
      !selectedModality.targetCFindEnabled &&
      !selectedModality.targetCMoveEnabled &&
      !selectedModality.targetCStoreEnabled
    ) {
      showAlert('At least one of C-Find, C-Move, or C-Store must be enabled', 'error');
      return;
    }

    setIsUpdatingModality(true);
    try {
      const response = await orthancRepository.UpdateDICOMModality({
        modalityId: selectedModality.id,
        aet: selectedModality.aet,
        host: selectedModality.host,
        port: +selectedModality.port,
        cFindEnabled: selectedModality.targetCFindEnabled,
        cMoveEnabled: selectedModality.targetCMoveEnabled,
        cStoreEnabled: selectedModality.targetCStoreEnabled,
      });
      showAlert(response.message, 'success');
      setIsOpenAddEditModalityModal(false);
      clearSelectedModality();
      setIsAddModality(true);
      fetchDICOMModalities();
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error updating modality: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsUpdatingModality(false);
  };

  const removeModality = async () => {
    setIsRemovingModality(true);
    try {
      const response = await orthancRepository.RemoveDICOMModality({
        modalityId: selectedModalityToRemove,
      });
      showAlert(response.message, 'success');
      setIsOpenRemoveModalityModal(false);
      fetchDICOMModalities();

      const storedDICOMModality = localStorage.getItem('selectedDICOMModality');
      if (storedDICOMModality === selectedModalityToRemove) {
        localStorage.removeItem('selectedDICOMModality');
      }
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error removing modality: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsRemovingModality(false);
  };

  const openAddModalityModal = () => {
    setIsOpenAddEditModalityModal(true);
  };

  const openEditModalityModal = (row: DICOMModalities) => {
    setSelectedModality({
      ...row,
      port: String(row.port),
    });
    setIsAddModality(false);
    setIsOpenAddEditModalityModal(true);
  };

  const openRemoveModalityModal = (modalityId: string) => {
    setSelectedModalityToRemove(modalityId);
    setIsOpenRemoveModalityModal(true);
  };

  const closeAddEditModalityModal = () => {
    setIsAddModality(true);
    setIsOpenAddEditModalityModal(false);
    clearSelectedModality();
  };

  const closeRemoveModalityModal = () => {
    setIsOpenRemoveModalityModal(false);
  };

  return {
    modalities,
    loading,
    selectedModality,
    setSelectedModality,
    selectedModalityToRemove,
    isAddModality,
    isUpdatingModality,
    isAddingModality,
    isOpenAddEditModalityModal,
    isOpenRemoveModalityModal,
    isRefreshingDICOMModalities,
    isRemovingModality,
    updateModalityStatus,
    addModality,
    updateModality,
    removeModality,
    openAddModalityModal,
    openEditModalityModal,
    openRemoveModalityModal,
    closeAddEditModalityModal,
    closeRemoveModalityModal,
  };
}

export type UseDicomModalitiesResult = ReturnType<typeof useDicomModalities>;
