import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SeriesInfo } from '../types';

interface SeriesCarouselProps {
  selectedSeries: string[];
  selectedSeriesDetails: SeriesInfo[];
  carouselPage: number;
  seriesPerPage: number;
  getCurrentPageItems: () => SeriesInfo[];
  goToPrevPage: () => void;
  goToNextPage: () => void;
  onRemoveSeries: (seriesInstanceUID: string) => void;
}

export const SeriesCarousel: React.FC<SeriesCarouselProps> = ({
  selectedSeries,
  selectedSeriesDetails,
  carouselPage,
  seriesPerPage,
  getCurrentPageItems,
  goToPrevPage,
  goToNextPage,
  onRemoveSeries,
}) => {
  const { t } = useTranslation();

  if (selectedSeries.length === 0) {
    return null;
  }

  const currentItems = getCurrentPageItems();
  const maxPage = Math.ceil(selectedSeriesDetails.length / seriesPerPage) - 1;

  return (
    <div className="series-carousel">
      <div className="series-carousel-title">
        {t('Selected Series')} ({selectedSeries.length})
      </div>
      <div className="series-carousel-container">
        <button
          className="series-carousel-button"
          onClick={goToPrevPage}
          disabled={carouselPage === 0}
          aria-label="Previous series"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="series-thumbnails">
          {currentItems.length > 0 ? (
            currentItems.map(series => (
              <div
                key={series.SeriesInstanceUID}
                className="series-thumbnail"
              >
                <div className="series-thumbnail-badge">
                  {series.modality} {series.seriesNumber}
                </div>
                <button
                  className="series-thumbnail-remove"
                  onClick={() => onRemoveSeries(series.SeriesInstanceUID)}
                  aria-label="Remove series"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                {series.imageSrc ? (
                  <img
                    src={series.imageSrc}
                    alt={`Series ${series.seriesNumber}`}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-[80px] w-full items-center justify-center bg-black bg-opacity-30">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-[#C8F469]">{series.modality}</span>
                      <span className="mt-1 text-xs text-white opacity-70">
                        Series {series.seriesNumber}
                      </span>
                    </div>
                  </div>
                )}
                <div className="series-thumbnail-info">{series.seriesDescription}</div>
              </div>
            ))
          ) : (
            <div className="series-placeholder">
              {t('No series selected. Click the "+" button to add series to the conversation.')}
            </div>
          )}
        </div>

        <button
          className="series-carousel-button"
          onClick={goToNextPage}
          disabled={carouselPage >= maxPage || selectedSeriesDetails.length <= seriesPerPage}
          aria-label="Next series"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
