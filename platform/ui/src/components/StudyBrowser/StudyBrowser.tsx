import React, { useState, useRef, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { AIModelButton } from '@ohif/ui';
import StudyItem from '../StudyItem';
import LegacyButtonGroup from '../LegacyButtonGroup';
import LegacyButton from '../LegacyButton';
import ThumbnailList from '../ThumbnailList';
import { StringNumber } from '../../types';
import aiModelsIcon from './../../assets/pacs/icons/ai-models-white.png';
import refreshIcon from './../../assets/pacs/icons/refresh-gradient.png';
import playerPlayIcon from './../../assets/pacs/icons/player-play-gradient.png';
import helpInactive from './../../assets/pacs/icons/help-inactive.png';
import { AvailableModelsContext } from '../../../../../extensions/default/src/ViewerLayout/index.tsx';
import { useGlobalStateData } from '../../../../app/src/GlobalStateProvider';

const getTrackedSeries = displaySets => {
  let trackedSeries = 0;
  displaySets.forEach(displaySet => {
    if (displaySet.isTracked) {
      trackedSeries++;
    }
  });

  return trackedSeries;
};

const StudyBrowser = ({
  tabs,
  activeTabName,
  expandedStudyInstanceUIDs,
  onClickTab,
  onClickStudy,
  onClickThumbnail,
  onDoubleClickThumbnail,
  onClickUntrack,
  activeDisplaySetInstanceUIDs,
  servicesManager,
}) => {
  const { inferenceAvailableModels, fetchingAvailableModels } =
    useContext(AvailableModelsContext) || {};
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const { t } = useTranslation('StudyBrowser');
  const { customizationService } = servicesManager?.services || {};

  const getTabContent = () => {
    const tabData = tabs.find(tab => tab.name === activeTabName);
    return tabData.studies.map(
      ({ studyInstanceUid, date, description, numInstances, modalities, displaySets }) => {
        const { setDisplaySets } = useGlobalStateData();
        const isExpanded = expandedStudyInstanceUIDs.includes(studyInstanceUid);

        setDisplaySets(displaySets);

        return (
          <React.Fragment key={studyInstanceUid}>
            <div className="flex w-full gap-3 p-3">
              {/* TODO: Added AI Models button and Refresh button */}
              <AIModelButton
                isShowBG={true}
                isShowText={true}
                positionRight={-110}
                inferenceAvailableModels={inferenceAvailableModels}
                loading={fetchingAvailableModels}
              />
              <button className="flex w-full items-center gap-2 rounded-lg bg-white bg-opacity-10 px-2 py-2">
                <img
                  src={refreshIcon}
                  className="h-5 w-5"
                  alt="Refresh icon"
                />
                <span className="text-sm !text-white text-transparent">{t('Refresh')}</span>
              </button>
            </div>
            <StudyItem
              date={date}
              description={description}
              numInstances={numInstances}
              modalities={modalities}
              trackedSeries={getTrackedSeries(displaySets)}
              isActive={isExpanded}
              onClick={() => {
                onClickStudy(studyInstanceUid);
              }}
              data-cy="thumbnail-list"
            />
            {isExpanded && displaySets && (
              <ThumbnailList
                thumbnails={displaySets}
                activeDisplaySetInstanceUIDs={activeDisplaySetInstanceUIDs}
                onThumbnailClick={onClickThumbnail}
                onThumbnailDoubleClick={onDoubleClickThumbnail}
                onClickUntrack={onClickUntrack}
              />
            )}
          </React.Fragment>
        );
      }
    );
  };

  return (
    <React.Fragment>
      <div
        className="w-100 flex h-16 flex-row items-center justify-center border-b border-white border-opacity-10 bg-transparent p-4"
        data-cy={'studyBrowser-panel'}
      >
        {/* TODO Revisit design of LegacyButtonGroup later - for now use LegacyButton for its children.*/}
        <LegacyButtonGroup
          variant="outlined"
          color="secondary"
          splitBorder={false}
        >
          {tabs.map(tab => {
            const { name, label, studies } = tab;
            const isActive = activeTabName === name;
            const isDisabled = !studies.length;
            // Apply the contrasting color for brighter button color visibility
            const classStudyBrowser = customizationService?.getModeCustomization(
              'class:StudyBrowser'
            ) || {
              true: 'default',
              false: 'default',
            };
            const color = classStudyBrowser[`${isActive}`];
            return (
              <LegacyButton
                key={name}
                className={'min-w-18 p-2 text-base hover:!text-black active:!text-black '}
                size="initial"
                color={color}
                bgColor={isActive ? 'bg-primary-main bg-opacity-10' : 'bg-transparent'}
                onClick={() => {
                  onClickTab(name);
                }}
                disabled={isDisabled}
              >
                {t(label)}
              </LegacyButton>
            );
          })}
        </LegacyButtonGroup>
      </div>
      <div className="ohif-scrollbar invisible-scrollbar flex flex-1 flex-col overflow-auto">
        {getTabContent()}
      </div>
    </React.Fragment>
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
              displaySetInstanceUID: PropTypes.string.isRequired,
              imageSrc: PropTypes.string,
              imageAltText: PropTypes.string,
              seriesDate: PropTypes.string,
              seriesNumber: StringNumber,
              numInstances: PropTypes.number,
              description: PropTypes.string,
              componentType: PropTypes.oneOf(['thumbnail', 'thumbnailTracked', 'thumbnailNoImage'])
                .isRequired,
              isTracked: PropTypes.bool,
              viewportIdentificator: PropTypes.arrayOf(PropTypes.string),
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
};

const noop = () => {};

StudyBrowser.defaultProps = {
  onClickTab: noop,
  onClickStudy: noop,
  onClickThumbnail: noop,
  onDoubleClickThumbnail: noop,
  onClickUntrack: noop,
};

export default StudyBrowser;
