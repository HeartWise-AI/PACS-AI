import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { SidePanel, ErrorBoundary, LoadingIndicatorProgress, Typography } from '@ohif/ui';
import { ServicesManager, HangingProtocolService, CommandsManager } from '@ohif/core';
import Sidebar from '../../../../platform/app/src/components/Sidebar';
import HeaderPanel from '../../../../platform/app/src/components/HeaderPanel';
import { useAppConfig } from '@state';
import ViewerHeader from './ViewerHeader';
import SidePanelWithServices from '../Components/SidePanelWithServices';
import { useTranslation } from 'react-i18next';

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
}: withAppTypes): React.FunctionComponent {
  const [appConfig] = useAppConfig();
  const { t } = useTranslation();

  const { panelService, hangingProtocolService } = servicesManager.services;
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

    return { entry, content: entry.component };
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

  const getViewportComponentData = viewportComponent => {
    const { entry } = getComponent(viewportComponent.namespace);

    return {
      component: entry.component,
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
      <div className="flex w-full bg-[#151815] ">
        <Sidebar />

        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Viewer" />
          <ViewerHeader
            hotkeysManager={hotkeysManager}
            extensionManager={extensionManager}
            servicesManager={servicesManager}
          />
          <div
            className="relative flex w-full flex-row flex-nowrap items-stretch overflow-hidden rounded-lg bg-transparent"
            style={{ height: 'calc(100vh - 200px)' }}
          >
            <React.Fragment>
              {showLoadingIndicator && (
                <LoadingIndicatorProgress className="h-full w-full bg-transparent" />
              )}
              {/* LEFT SIDEPANELS */}
              {leftPanelComponents.length ? (
                <ErrorBoundary context="Left Panel">
                  <SidePanelWithServices
                    side="left"
                    activeTabIndex={leftPanelDefaultClosed ? null : 0}
                    tabs={leftPanelComponents}
                    servicesManager={servicesManager}
                  />
                </ErrorBoundary>
              ) : null}
              {/* TOOLBAR + GRID */}
              <div className="flex h-full flex-1 flex-col">
                <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-white border-opacity-10 bg-white bg-opacity-[5%] backdrop-blur-lg">
                  <ErrorBoundary context="Grid">
                    <ViewportGridComp
                      servicesManager={servicesManager}
                      viewportComponents={viewportComponents}
                      commandsManager={commandsManager}
                    />
                  </ErrorBoundary>
                </div>
              </div>
              {rightPanelComponents.length ? (
                <ErrorBoundary context="Right Panel">
                  <SidePanelWithServices
                    side="right"
                    activeTabIndex={rightPanelDefaultClosed ? null : 0}
                    tabs={rightPanelComponents}
                    servicesManager={servicesManager}
                  />
                </ErrorBoundary>
              ) : null}
            </React.Fragment>
          </div>
        </div>
      </div>
      <Onboarding />
      <InvestigationalUseDialog dialogConfiguration={appConfig?.investigationalUseDialog} />
    </div>
  );
}

ViewerLayout.propTypes = {
  // From extension module params
  extensionManager: PropTypes.shape({
    getModuleEntry: PropTypes.func.isRequired,
  }).isRequired,
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
