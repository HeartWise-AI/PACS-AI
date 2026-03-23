import React, { useEffect, useRef, useContext } from 'react'; // NOTE: This is a PACS changes ({ useEffect, useRef, useContext })
import PropTypes from 'prop-types';
import { useGlobalStateData } from '@ohif/app/src/GlobalStateProvider'; // NOTE: This is a PACS changes
import { StudyItem } from '../StudyItem';
import { StudyBrowserSort } from '../StudyBrowserSort';
import { StudyBrowserViewOptions } from '../StudyBrowserViewOptions';
import { ScrollArea } from '../ScrollArea';
import { AIModelButton } from '@ohif/ui-next'; // NOTE: This is a PACS changes
import refreshIcon from './../../assets/pacs/icons/refresh-gradient.png'; // NOTE: This is a PACS changes
import { AvailableModelsContext } from '../../../../../extensions/default/src/ViewerLayout/index.tsx'; // NOTE: This is a PACS changes
import { useTranslation } from 'react-i18next'; // NOTE: This is a PACS changes

const noop = () => {};

const StudyBrowser = ({
  tabs,
  activeTabName,
  expandedStudyInstanceUIDs,
  onClickTab = noop,
  onClickStudy = noop,
  onClickThumbnail = noop,
  onDoubleClickThumbnail = noop,
  onClickUntrack = noop,
  activeDisplaySetInstanceUIDs,
  servicesManager,
  showSettings,
  viewPresets,
  ThumbnailMenuItems,
  StudyMenuItems,
}: withAppTypes) => {
  // NOTE: This is a PACS changes
  const { setSelectedModalities } = useGlobalStateData();
  // NOTE: This is a PACS changes
  const { inferenceAvailableModels, fetchingAvailableModels } =
    useContext(AvailableModelsContext) || {};
  // NOTE: This is a PACS changes
  const { t } = useTranslation('StudyBrowser');
  // NOTE: This is a PACS changes
  const { setDisplaySets } = useGlobalStateData();

  // NOTE: This is a PACS changes (Find the active tab and its display sets)
  const activeTab = tabs.find(tab => tab.name === activeTabName);
  const activeDisplaySets = activeTab?.studies.map(study => study.displaySets).flat() || [];

  // NOTE: This is a PACS changes (Add this before the useEffect)
  const prevDisplaySets = useRef(activeDisplaySets);

  // NOTE: This is a PACS changes (Update display sets when they change)
  useEffect(() => {
    if (
      activeDisplaySets.length > 0 &&
      JSON.stringify(activeDisplaySets) !== JSON.stringify(prevDisplaySets.current)
    ) {
      setDisplaySets(activeDisplaySets);
      prevDisplaySets.current = activeDisplaySets;
    }
  }, [activeDisplaySets]);

  // NOTE: This is a PACS changes
  useEffect(() => {
    const tabData = tabs.find(tab => tab.name === activeTabName);
    if (!tabData) {
      return;
    }

    const selectedModalitiesMap = tabData.studies.reduce((acc, { modalities, displaySets }) => {
      if (modalities) {
        acc[modalities] = {
          modality: modalities,
          displaySets,
        };
      }
      return acc;
    }, {});

    setSelectedModalities(selectedModalitiesMap);
  }, [tabs, activeTabName, setSelectedModalities]);

  const getTabContent = () => {
    const tabData = tabs.find(tab => tab.name === activeTabName);
    const viewPreset = viewPresets
      ? viewPresets.filter(preset => preset.selected)[0]?.id
      : 'thumbnails';
    return tabData?.studies?.map(
      ({ studyInstanceUid, date, description, numInstances, modalities, displaySets }) => {
        const isExpanded = expandedStudyInstanceUIDs.includes(studyInstanceUid);

        return (
          <React.Fragment key={studyInstanceUid}>
            {/* <div className="flex w-full gap-3 p-3">

              <AIModelButton
                isShowBG={true}
                isShowText={true}
                servicesManager={servicesManager}
                positionRight={-110}
                inferenceAvailableModels={inferenceAvailableModels}
                loading={fetchingAvailableModels}
              />
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-white bg-opacity-10 px-2 py-2">
                <img
                  src={refreshIcon}
                  className="h-5 w-5"
                  alt="Refresh icon"
                />
                <span className="text-sm !text-white text-transparent">{t('Refresh')}</span>
              </button>
            </div> */}
            <StudyItem
              date={date}
              description={description}
              numInstances={numInstances}
              isExpanded={isExpanded}
              displaySets={displaySets}
              modalities={modalities}
              isActive={isExpanded}
              onClick={() => onClickStudy(studyInstanceUid)}
              onClickThumbnail={onClickThumbnail}
              onDoubleClickThumbnail={onDoubleClickThumbnail}
              onClickUntrack={onClickUntrack}
              activeDisplaySetInstanceUIDs={activeDisplaySetInstanceUIDs}
              data-cy="thumbnail-list"
              viewPreset={viewPreset}
              ThumbnailMenuItems={ThumbnailMenuItems}
              StudyMenuItems={StudyMenuItems}
              StudyInstanceUID={studyInstanceUid}
            />
          </React.Fragment>
        );
      }
    );
  };

  return (
    <ScrollArea>
      <div
        className="bg-bkg-low flex flex-1 flex-col gap-[4px]"
        data-cy={'studyBrowser-panel'}
      >
        <div className="flex flex-col gap-[4px]">
          {showSettings && (
            <div className="w-100 bg-bkg-low flex h-[48px] items-center justify-center gap-[10px] px-[8px] py-[10px]">
              <>
                <StudyBrowserViewOptions
                  tabs={tabs}
                  onSelectTab={onClickTab}
                  activeTabName={activeTabName}
                />
                <StudyBrowserSort servicesManager={servicesManager} />
              </>
            </div>
          )}
          {getTabContent()}
        </div>
      </div>
    </ScrollArea>
  );
};

StudyBrowser.propTypes = {
  onClickTab: PropTypes.func.isRequired,
  onClickStudy: PropTypes.func,
  onClickThumbnail: PropTypes.func,
  onDoubleClickThumbnail: PropTypes.func,
  onClickUntrack: PropTypes.func,
  activeTabName: PropTypes.string.isRequired,
  expandedStudyInstanceUIDs: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeDisplaySetInstanceUIDs: PropTypes.arrayOf(PropTypes.string),
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      studies: PropTypes.arrayOf(
        PropTypes.shape({
          studyInstanceUid: PropTypes.string.isRequired,
          date: PropTypes.string,
          numInstances: PropTypes.number,
          modalities: PropTypes.string,
          description: PropTypes.string,
          displaySets: PropTypes.arrayOf(
            PropTypes.shape({
              // NOTE: This is a PACS changes
              SeriesInstanceUID: PropTypes.string,
              displaySetInstanceUID: PropTypes.string.isRequired,
              imageSrc: PropTypes.string,
              imageAltText: PropTypes.string,
              seriesDate: PropTypes.string,
              seriesNumber: PropTypes.any,
              numInstances: PropTypes.number,
              description: PropTypes.string,
              componentType: PropTypes.oneOf(['thumbnail', 'thumbnailTracked', 'thumbnailNoImage'])
                .isRequired,
              isTracked: PropTypes.bool,
              /**
               * Data the thumbnail should expose to a receiving drop target. Use a matching
               * `dragData.type` to identify which targets can receive this draggable item.
               * If this is not set, drag-n-drop will be disabled for this thumbnail.
               *
               * Ref: https://react-dnd.github.io/react-dnd/docs/api/use-drag#specification-object-members
               */
              dragData: PropTypes.shape({
                /** Must match the "type" a dropTarget expects */
                type: PropTypes.string.isRequired,
              }),
            })
          ),
        })
      ).isRequired,
    })
  ),
  StudyMenuItems: PropTypes.func,
};

export { StudyBrowser };
