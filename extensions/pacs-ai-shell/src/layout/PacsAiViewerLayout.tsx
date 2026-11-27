import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HangingProtocolService } from '@ohif/core';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  useImageViewer,
} from '@ohif/ui-next';
import { useAppConfig } from '@state';
import { logoutUser } from '@pacs-ai/extension-core/src/service/userService';
import { ViewerModelResultsProvider } from '@pacs-ai/extension-inference/src/viewerResults/ViewerModelResultsProvider';
import TopNavigation from '../components/TopNavigation';
import { AlertContext } from '../alerts';
import { loadViewerModels } from './loadViewerModels';
import { stripPatientIdentifiersFromAddressBar } from '@pacs-ai/extension-core/src/utils/viewerUrl';
import ViewerTour from '../tour/ViewerTour';
import PacsAiViewerHeader from './PacsAiViewerHeader';
import { SidePanelWithServices, useResizablePanels } from './upstreamLayoutPieces';

// The rounded translucent side-panel chrome comes from @pacs-ai/theme
// (pacs-ai-theme.css), keyed on this class.
const SIDE_PANEL_CLASS_NAME = 'pacs-ai-side-panel';

// rounded-none: square handle, as on 3.11.1 (upstream's ResizableHandle is
// rounded-full; its classes are merged with tailwind-merge, so ours win).
const resizableHandleClassName = 'mt-[1px] rounded-none bg-white/10';

/**
 * The PACS-AI viewer layout template (getLayoutTemplateModule), built from
 * the default extension's ViewerLayout (OHIF 3.13.14) as PACS-AI changed it: our top
 * navigation above a rounded viewer area, our header bar (toolbar, run-model
 * menu, chat), the stored-results context around the viewer, and the tour
 * gated by the server. It takes the same props as the default layout, so a
 * mode can point its layoutTemplate at it unchanged.
 */
function PacsAiViewerLayout({
  // From Extension Module Params
  extensionManager,
  servicesManager,
  hotkeysManager,
  commandsManager,
  // From Modes
  viewports,
  ViewportGridComp,
  leftPanelClosed = false,
  rightPanelClosed = false,
  leftPanelResizable = false,
  rightPanelResizable = false,
  leftPanelInitialExpandedWidth,
  rightPanelInitialExpandedWidth,
  leftPanelMinimumExpandedWidth,
  rightPanelMinimumExpandedWidth,
}: any) {
  const [appConfig] = useAppConfig();
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';
  const showAlert = useContext(AlertContext);
  const { StudyInstanceUIDs = [] } = useImageViewer() || {};

  const { panelService, hangingProtocolService, customizationService } = servicesManager.services;
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(appConfig.showLoadingIndicator);

  const hasPanels = useCallback(
    (side): boolean => !!panelService.getPanels(side).length,
    [panelService]
  );

  const [hasRightPanels, setHasRightPanels] = useState(hasPanels('right'));
  const [hasLeftPanels, setHasLeftPanels] = useState(hasPanels('left'));
  const [leftPanelClosedState, setLeftPanelClosed] = useState(leftPanelClosed);
  const [rightPanelClosedState, setRightPanelClosed] = useState(rightPanelClosed);
  // Set page title
  useEffect(() => {
    document.title = 'Viewer - PACS AI';
    // Old links and bookmarks may still carry patientId/patientName: the viewer
    // ignores them; take them out of the address bar and history entry too.
    stripPatientIdentifiersFromAddressBar();
  }, []);

  const [
    leftPanelProps,
    rightPanelProps,
    resizablePanelGroupProps,
    resizableLeftPanelProps,
    resizableViewportGridPanelProps,
    resizableRightPanelProps,
    onHandleDragging,
  ] = useResizablePanels(
    leftPanelClosed,
    setLeftPanelClosed,
    rightPanelClosed,
    setRightPanelClosed,
    hasLeftPanels,
    hasRightPanels,
    leftPanelInitialExpandedWidth,
    rightPanelInitialExpandedWidth,
    leftPanelMinimumExpandedWidth,
    rightPanelMinimumExpandedWidth
  ) as any[];

  const handleMouseEnter = () => {
    (document.activeElement as HTMLElement)?.blur();
  };

  const LoadingIndicatorProgress = customizationService.getCustomization(
    'ui.loadingIndicatorProgress'
  ) as React.ComponentType<any>;

  /**
   * Set body classes (tailwindcss) that don't allow vertical
   * or horizontal overflow (no scrolling). Also guarantee window
   * is sized to our viewport.
   */
  useEffect(() => {
    document.body.classList.add('bg-background');
    document.body.classList.add('overflow-hidden');

    return () => {
      document.body.classList.remove('bg-background');
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const getComponent = id => {
    const entry: any = extensionManager.getModuleEntry(id);

    if (!entry || !entry.component) {
      throw new Error(
        `${id} is not valid for an extension module or no component found from extension ${id}. Please verify your configuration or ensure that the extension is properly registered. It's also possible that your mode is utilizing a module from an extension that hasn't been included in its dependencies (add the extension to the "extensionDependencies" array in your mode's index.js file). Check the reference string to the extension in your Mode configuration`
      );
    }

    return { entry };
  };

  useEffect(() => {
    const { unsubscribe } = hangingProtocolService.subscribe(
      HangingProtocolService.EVENTS.PROTOCOL_CHANGED,

      // Todo: right now to set the loading indicator to false, we need to wait for the
      // hangingProtocolService to finish applying the viewport matching to each viewport,
      // however, this might not be the only approach to set the loading indicator to false. we need to explore this further.
      () => {
        setShowLoadingIndicator(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [hangingProtocolService]);

  useEffect(() => {
    loadViewerModels({ showAlert, logout: () => logoutUser(navigate, tenantId) });
    // Once per layout mount, as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getViewportComponentData = viewportComponent => {
    const { entry } = getComponent(viewportComponent.namespace);

    return {
      component: entry.component,
      isReferenceViewable: entry.isReferenceViewable,
      displaySetsToDisplay: viewportComponent.displaySetsToDisplay,
    };
  };

  useEffect(() => {
    const { unsubscribe } = panelService.subscribe(
      panelService.EVENTS.PANELS_CHANGED,
      ({ options }) => {
        setHasLeftPanels(hasPanels('left'));
        setHasRightPanels(hasPanels('right'));
        if (options?.leftPanelClosed !== undefined) {
          setLeftPanelClosed(options.leftPanelClosed);
        }
        if (options?.rightPanelClosed !== undefined) {
          setRightPanelClosed(options.rightPanelClosed);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [panelService, hasPanels]);

  const viewportComponents = viewports.map(getViewportComponentData);

  // OHIF's ViewerLayout also renders the investigational-use dialog
  // (appConfig.investigationalUseDialog) and Onboarding; PACS-AI keeps the
  // dialog hidden (decision D3) and renders Onboarding through ViewerTour
  // (server-gated). SidePanelWithServices (3.13) reads toolbarService and
  // viewportGridService from servicesManager.services, which OHIF passes in.
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#151815]">
      <TopNavigation title="Viewer" />
      <>
        <ViewerModelResultsProvider
          studyInstanceUID={StudyInstanceUIDs[0] ?? null}
          studyInstanceUIDs={StudyInstanceUIDs}
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          appConfig={appConfig}
        >
          <main className="flex min-h-0 grow flex-col overflow-hidden px-2 pb-2 sm:px-4 sm:pb-4">
            <PacsAiViewerHeader />
            <div className="relative flex min-h-0 w-full grow flex-row flex-nowrap items-stretch gap-2 overflow-hidden rounded-lg bg-transparent">
              <React.Fragment>
                {showLoadingIndicator && (
                  <LoadingIndicatorProgress className="h-full w-full bg-white bg-opacity-[5%]" />
                )}
                <ResizablePanelGroup {...resizablePanelGroupProps}>
                  {/* LEFT SIDEPANELS */}
                  {hasLeftPanels ? (
                    <>
                      <ResizablePanel {...resizableLeftPanelProps}>
                        <SidePanelWithServices
                          side="left"
                          isExpanded={!leftPanelClosedState}
                          servicesManager={servicesManager}
                          {...leftPanelProps}
                          className={SIDE_PANEL_CLASS_NAME}
                        />
                      </ResizablePanel>
                      <ResizableHandle
                        onDragging={onHandleDragging}
                        disabled={!leftPanelResizable}
                        className={resizableHandleClassName}
                      />
                    </>
                  ) : null}
                  {/* TOOLBAR + GRID */}
                  <ResizablePanel {...resizableViewportGridPanelProps}>
                    <div className="flex h-full flex-1 flex-col">
                      <div
                        className="relative flex h-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-white border-opacity-10 bg-white bg-opacity-[5%] backdrop-blur-lg"
                        onMouseEnter={handleMouseEnter}
                      >
                        <ViewportGridComp
                          servicesManager={servicesManager}
                          viewportComponents={viewportComponents}
                          commandsManager={commandsManager}
                        />
                      </div>
                    </div>
                  </ResizablePanel>
                  {hasRightPanels ? (
                    <>
                      <ResizableHandle
                        onDragging={onHandleDragging}
                        disabled={!rightPanelResizable}
                        className={resizableHandleClassName}
                      />
                      <ResizablePanel {...resizableRightPanelProps}>
                        <SidePanelWithServices
                          side="right"
                          isExpanded={!rightPanelClosedState}
                          servicesManager={servicesManager}
                          {...rightPanelProps}
                          className={SIDE_PANEL_CLASS_NAME}
                        />
                      </ResizablePanel>
                    </>
                  ) : null}
                </ResizablePanelGroup>
              </React.Fragment>
            </div>
          </main>
        </ViewerModelResultsProvider>
      </>
      <ViewerTour customizationService={customizationService} />
    </div>
  );
}

export default PacsAiViewerLayout;
