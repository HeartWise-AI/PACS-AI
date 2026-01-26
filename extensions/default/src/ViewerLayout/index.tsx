import React, { createContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { LoadingIndicatorProgress } from '@ohif/ui';
import { InvestigationalUseDialog } from '@ohif/ui-next';
import { HangingProtocolService, CommandsManager } from '@ohif/core';
import Sidebar from '@ohif/app/src/components/Sidebar';
import HeaderPanel from '@ohif/app/src/components/HeaderPanel';
import { useAppConfig } from '@state';
import ViewerHeader from './ViewerHeader';
import SidePanelWithServices from '../Components/SidePanelWithServices';
import { useTranslation } from 'react-i18next';
import inferenceRepository from '@ohif/app/src/api/inferenceRepository';
import { GetInferenceAvailableModelsResponse } from '@ohif/app/src/api/inferenceDTO';
import { logoutUser } from '@ohif/app/src/service/userService';
import { Error } from '@ohif/app/src/api/dto';
import { Onboarding, ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@ohif/ui-next';
import useResizablePanels from './ResizablePanelsHook'; // NOTE: This is a PACS changes
interface AvailableModelsContextType {
  inferenceAvailableModels: GetInferenceAvailableModelsResponse[];
  fetchingAvailableModels: boolean;
}

export const AvailableModelsContext = createContext<AvailableModelsContextType | null>(null);

const resizableHandleClassName = 'mt-[1px] bg-white/10'; // NOTE: This is a PACS changes

function ViewerLayout({
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
}: withAppTypes): React.FunctionComponent {
  const [appConfig] = useAppConfig();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || ''; // NOTE: This is a PACS changes
  const [inferenceAvailableModels, setInferenceAvailableModels] = useState<
    GetInferenceAvailableModelsResponse[]
  >([]); // NOTE: This is a PACS changes
  const [fetchingAvailableModels, setFetchingAvailableModels] = useState(false); // NOTE: This is a PACS changes

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
  );

  const handleMouseEnter = () => {
    (document.activeElement as HTMLElement)?.blur();
  };

  const LoadingIndicatorProgress = customizationService.getCustomization(
    'ui.loadingIndicatorProgress'
  );

  /**
   * Set body classes (tailwindcss) that don't allow vertical
   * or horizontal overflow (no scrolling). Also guarantee window
   * is sized to our viewport.
   */
  useEffect(() => {
    document.body.classList.add('bg-black');
    document.body.classList.add('overflow-hidden');

    return () => {
      document.body.classList.remove('bg-black');
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const getComponent = id => {
    const entry = extensionManager.getModuleEntry(id);

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
    const fetchInferenceAvailableModels = async () => {
      setFetchingAvailableModels(true);
      try {
        const response = await inferenceRepository.GetInferenceAvailableModels();
        setInferenceAvailableModels(response.data);
      } catch (error) {
        if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
          showAlert(error.message, 'error');

          setTimeout(() => {
            logoutUser(navigate, tenantId);
          }, 3000);
        }

        console.error('Error fetching available inference models:', error);
      }
      setFetchingAvailableModels(false);
    };

    fetchInferenceAvailableModels();
  }, [inferenceRepository]);

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

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815]">
        <AvailableModelsContext.Provider
          value={{ inferenceAvailableModels, fetchingAvailableModels }}
        >
          {/* TODO: Added Sidebar component */}
          <Sidebar />
          <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
            {/* TODO: Added HeaderPanel component */}
            <HeaderPanel title="Viewer" />
            <ViewerHeader
              hotkeysManager={hotkeysManager}
              extensionManager={extensionManager}
              servicesManager={servicesManager}
              appConfig={appConfig}
            />
            {/* NOTE: This is a PACS changes */}
            <div
              className="relative flex w-full flex-row flex-nowrap items-stretch gap-2 overflow-hidden rounded-lg bg-transparent"
              style={{ height: 'calc(100vh - 152px' }}
            >
              <React.Fragment>
                {showLoadingIndicator && (
                  <LoadingIndicatorProgress className="h-full w-full bg-white bg-opacity-[5%]" /> // NOTE: This is a PACS changes
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
                      {/* NOTE: This is a PACS changes */}
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
                        />
                      </ResizablePanel>
                    </>
                  ) : null}
                </ResizablePanelGroup>
              </React.Fragment>
            </div>
          </div>
        </AvailableModelsContext.Provider>
      </div>
      <Onboarding tours={customizationService.getCustomization('ohif.tours')} />
      {/* NOTE: This is a PACS changes */}
      {/* <InvestigationalUseDialog dialogConfiguration={appConfig?.investigationalUseDialog} /> */}
    </div>
  );
}

ViewerLayout.propTypes = {
  // From extension module params
  extensionManager: PropTypes.shape({ getModuleEntry: PropTypes.func.isRequired }).isRequired,
  commandsManager: PropTypes.instanceOf(CommandsManager),
  servicesManager: PropTypes.object.isRequired,
  // From modes
  leftPanels: PropTypes.array,
  rightPanels: PropTypes.array,
  leftPanelClosed: PropTypes.bool.isRequired,
  rightPanelClosed: PropTypes.bool.isRequired,
  /** Responsible for rendering our grid of viewports; provided by consuming application */
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  viewports: PropTypes.array,
};

export default ViewerLayout;
