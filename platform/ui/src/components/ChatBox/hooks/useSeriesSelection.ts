import { useState, useCallback } from 'react';
import type { SeriesInfo, ModalityData, DisplaySet } from '../types';
import { formatSeriesInfo } from '../utils/formatSeriesInfo';

interface UseSeriesSelectionReturn {
  selectedSeries: string[];
  selectedSeriesDetails: SeriesInfo[];
  currentStudyInstanceUID: string;
  currentSeriesInfo: string;
  carouselPage: number;
  seriesPerPage: number;
  isSeriesModalOpen: boolean;
  setIsSeriesModalOpen: (isOpen: boolean) => void;
  handleSeriesSelected: (
    seriesInstanceUIDs: string[],
    passedStudyInstanceUID?: string,
    selectedModalities?: Record<string, ModalityData>,
    threadId?: string | null,
    uploadDicomPayload?: (
      threadId: string,
      studyInstanceUID: string,
      seriesInstanceUIDs: string[]
    ) => Promise<void>
  ) => Promise<void>;
  removeSeries: (
    seriesInstanceUID: string,
    threadId?: string | null,
    uploadDicomPayload?: (
      threadId: string,
      studyInstanceUID: string,
      seriesInstanceUIDs: string[]
    ) => Promise<void>
  ) => void;
  goToPrevPage: () => void;
  goToNextPage: () => void;
  getCurrentPageItems: () => SeriesInfo[];
  resetSelection: () => void;
}

export function useSeriesSelection(): UseSeriesSelectionReturn {
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [selectedSeriesDetails, setSelectedSeriesDetails] = useState<SeriesInfo[]>([]);
  const [currentStudyInstanceUID, setCurrentStudyInstanceUID] = useState<string>('');
  const [currentSeriesInfo, setCurrentSeriesInfo] = useState<string>('');
  const [carouselPage, setCarouselPage] = useState(0);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const seriesPerPage = 3;

  const handleSeriesSelected = useCallback(
    async (
      seriesInstanceUIDs: string[],
      passedStudyInstanceUID?: string,
      selectedModalities?: Record<string, ModalityData>,
      threadId?: string | null,
      uploadDicomPayload?: (
        threadId: string,
        studyInstanceUID: string,
        seriesInstanceUIDs: string[]
      ) => Promise<void>
    ) => {
      if (seriesInstanceUIDs.length === 0) {
        setIsSeriesModalOpen(false);
        return;
      }

      const selectionChanged =
        seriesInstanceUIDs.length !== selectedSeries.length ||
        !seriesInstanceUIDs.every(uid => selectedSeries.includes(uid));

      if (!selectionChanged) {
        setIsSeriesModalOpen(false);
        return;
      }

      const newSeriesInfo: SeriesInfo[] = [];
      let studyInstanceUID = passedStudyInstanceUID || currentStudyInstanceUID;

      if (selectedModalities) {
        for (const modality of Object.values(selectedModalities)) {
          if (modality.displaySets) {
            const matchingSeries = modality.displaySets.filter(series =>
              seriesInstanceUIDs.includes(series.SeriesInstanceUID || '')
            );

            if (matchingSeries.length > 0 && !studyInstanceUID) {
              studyInstanceUID =
                matchingSeries[0].StudyInstanceUID || matchingSeries[0].studyInstanceUID || '';
            }

            matchingSeries.forEach((series: DisplaySet) => {
              const thumbnailImageSrc = series.thumbnailSrc || series.imageSrc || '';

              newSeriesInfo.push({
                SeriesInstanceUID: series.SeriesInstanceUID || series.seriesInstanceUID || '',
                info: formatSeriesInfo(series),
                imageSrc: thumbnailImageSrc,
                seriesDescription:
                  series.SeriesDescription ||
                  series.seriesDescription ||
                  series.description ||
                  'No description',
                seriesNumber: String(series.SeriesNumber || series.seriesNumber || 'Unknown'),
                modality: series.Modality || series.modality || 'Unknown',
              });
            });
          }
        }
      }

      setSelectedSeries(seriesInstanceUIDs);

      if (studyInstanceUID && studyInstanceUID !== currentStudyInstanceUID) {
        setCurrentStudyInstanceUID(studyInstanceUID);
      }

      setSelectedSeriesDetails(newSeriesInfo);
      setCarouselPage(0);

      const allSeriesInfo = newSeriesInfo.map(seriesInfo => seriesInfo.info).join('\n\n');
      setCurrentSeriesInfo(allSeriesInfo);

      if (threadId && studyInstanceUID && uploadDicomPayload) {
        try {
          await uploadDicomPayload(threadId, studyInstanceUID, seriesInstanceUIDs);
          console.log('DICOM payload uploaded successfully');
        } catch (error) {
          console.error('Failed to upload DICOM payload:', error);
        }
      }

      setIsSeriesModalOpen(false);
    },
    [selectedSeries, currentStudyInstanceUID]
  );

  const removeSeries = useCallback(
    (
      seriesInstanceUID: string,
      threadId?: string | null,
      uploadDicomPayload?: (
        threadId: string,
        studyInstanceUID: string,
        seriesInstanceUIDs: string[]
      ) => Promise<void>
    ) => {
      const updatedSelection = selectedSeries.filter(uid => uid !== seriesInstanceUID);
      const updatedDetails = selectedSeriesDetails.filter(
        series => series.SeriesInstanceUID !== seriesInstanceUID
      );

      setSelectedSeries(updatedSelection);
      setSelectedSeriesDetails(updatedDetails);

      const allSeriesInfo = updatedDetails.map(seriesInfo => seriesInfo.info).join('\n\n');
      setCurrentSeriesInfo(allSeriesInfo);

      const maxPage = Math.ceil(updatedDetails.length / seriesPerPage) - 1;
      if (carouselPage > maxPage && maxPage >= 0) {
        setCarouselPage(maxPage);
      }

      if (threadId && currentStudyInstanceUID && uploadDicomPayload) {
        uploadDicomPayload(threadId, currentStudyInstanceUID, updatedSelection).catch(error =>
          console.error('Failed to update DICOM payload:', error)
        );
      }
    },
    [selectedSeries, selectedSeriesDetails, carouselPage, currentStudyInstanceUID, seriesPerPage]
  );

  const goToPrevPage = useCallback(() => {
    setCarouselPage(prev => Math.max(0, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    const maxPage = Math.ceil(selectedSeriesDetails.length / seriesPerPage) - 1;
    setCarouselPage(prev => Math.min(maxPage, prev + 1));
  }, [selectedSeriesDetails.length, seriesPerPage]);

  const getCurrentPageItems = useCallback(() => {
    const startIndex = carouselPage * seriesPerPage;
    return selectedSeriesDetails.slice(startIndex, startIndex + seriesPerPage);
  }, [carouselPage, seriesPerPage, selectedSeriesDetails]);

  const resetSelection = useCallback(() => {
    setSelectedSeries([]);
    setSelectedSeriesDetails([]);
    setCurrentSeriesInfo('');
    setCarouselPage(0);
  }, []);

  return {
    selectedSeries,
    selectedSeriesDetails,
    currentStudyInstanceUID,
    currentSeriesInfo,
    carouselPage,
    seriesPerPage,
    isSeriesModalOpen,
    setIsSeriesModalOpen,
    handleSeriesSelected,
    removeSeries,
    goToPrevPage,
    goToNextPage,
    getCurrentPageItems,
    resetSelection,
  };
}
