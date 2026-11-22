/**
 * OHIF v3.13.14 platform/ui-next/src/components/StudyBrowser/StudyBrowser.tsx
 * with the PACS-AI changes (marked "PACS-AI"): it publishes the active tab's
 * display sets and the modalities of the primary study (plus comparison
 * studies shown in a viewport) to the study context, which the run-model menu
 * and the chat read, and it renders the PACS-AI study items. The disabled
 * (commented-out) run-model and refresh block the fork carried here is
 * dropped; those live in the viewer header and the panel header. Prop types
 * dropped.
 */
import React, { useEffect, useRef } from 'react';
import { StudyBrowserSort, StudyBrowserViewOptions, ScrollArea } from '@ohif/ui-next';
import { pacsAiStudyContextService } from '@pacs-ai/extension-core/src/services/PacsAiStudyContextService';
import { buildInferenceStudyModalities } from '../buildInferenceStudyModalities';
import { PacsAiStudyItem as StudyItem } from './PacsAiStudyItem';

const noop = () => {};

const PacsAiStudyBrowser = ({
  tabs,
  activeTabName,
  expandedStudyInstanceUIDs,
  onClickTab = noop,
  onClickStudy = noop,
  onClickThumbnail = noop,
  onDoubleClickThumbnail = noop,
  onClickUntrack = noop,
  activeDisplaySetInstanceUIDs,
  inferenceDisplaySetInstanceUIDs = activeDisplaySetInstanceUIDs, // PACS-AI
  servicesManager,
  showSettings,
  viewPresets,
  ThumbnailMenuItems,
  StudyMenuItems,
}: Record<string, any>) => {
  const { setSelectedModalities, setDisplaySets } = pacsAiStudyContextService;

  // PACS-AI (Find the active tab and its display sets)
  const activeTab = tabs.find(tab => tab.name === activeTabName);
  const activeDisplaySets = activeTab?.studies.map(study => study.displaySets).flat() || [];

  // PACS-AI (Add this before the useEffect)
  const prevDisplaySets = useRef(activeDisplaySets);

  // PACS-AI (Update display sets when they change)
  useEffect(() => {
    if (
      activeDisplaySets.length > 0 &&
      JSON.stringify(activeDisplaySets) !== JSON.stringify(prevDisplaySets.current)
    ) {
      setDisplaySets(activeDisplaySets);
      prevDisplaySets.current = activeDisplaySets;
    }
  }, [activeDisplaySets]);

  // PACS-AI
  useEffect(() => {
    // Include loaded comparison exams, independent of the selected browser tab.
    const tabData =
      tabs.find(tab => tab.name === 'all') || tabs.find(tab => tab.name === activeTabName);
    const primaryStudies = tabs.find(tab => tab.name === 'primary')?.studies || [];
    const primaryUIDs = new Set(primaryStudies.map(study => study.studyInstanceUid));
    const comparisonStudies = (tabData?.studies || []).filter(
      study =>
        !primaryUIDs.has(study.studyInstanceUid) &&
        study.displaySets?.some(displaySet =>
          inferenceDisplaySetInstanceUIDs?.includes(displaySet.displaySetInstanceUID)
        )
    );
    const selectedModalitiesMap = buildInferenceStudyModalities([
      ...primaryStudies,
      ...comparisonStudies,
    ]);

    if (
      JSON.stringify(selectedModalitiesMap) !==
      JSON.stringify(pacsAiStudyContextService.getState().selectedModalities)
    ) {
      setSelectedModalities(selectedModalitiesMap);
    }
  }, [tabs, activeTabName, inferenceDisplaySetInstanceUIDs, setSelectedModalities]);

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
        className="flex flex-1 bg-transparent flex-col gap-[4px]"
        data-cy={'studyBrowser-panel'}
      >
        <div className="flex flex-col gap-[4px]">
          {showSettings && (
            <div className="w-100 flex bg-transparent h-[48px] items-center justify-center gap-[10px] px-[8px] py-[10px]">
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

export { PacsAiStudyBrowser };
