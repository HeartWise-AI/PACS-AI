import React, { useEffect } from 'react';

import AIModelButton from '@pacs-ai/ui/src/legacy/AIModelButton';
import ChatButton from '@pacs-ai/ui/src/legacy/ChatButton/ChatButton';
import { IconPresentationProvider, ToolButton } from '@ohif/ui-next';
import { useSystem } from '@ohif/core';
import { Toolbar, usePatientInfo } from '@ohif/extension-default';
import useStudyContext from '@pacs-ai/extension-core/src/hooks/useStudyContext';
import useAvailableModels from '@pacs-ai/extension-core/src/hooks/useAvailableModels';

/**
 * The viewer header bar: the mode's primary toolbar, the run-model menu and
 * the chat button, centred in a rounded bar.
 *
 * Built from the default extension's ViewerHeader as PACS-AI changed it: the
 * ui-next Header it used had its logo, secondary toolbar, undo/redo, patient
 * information and settings menu blocks removed, leaving only the centred
 * children. This bar renders that same markup without the Header component,
 * so ui-next's Header stays as upstream ships it.
 */
function PacsAiViewerHeader() {
  const { servicesManager } = useSystem();
  const { patientInfo } = usePatientInfo();
  const { setPatientInfo } = useStudyContext();
  const { inferenceAvailableModels, fetchingAvailableModels } = useAvailableModels();

  useEffect(() => {
    // check if patientInfo is not empty (has PatientName and PatientID)
    if (patientInfo && patientInfo.PatientName && patientInfo.PatientID) {
      setPatientInfo({
        PatientName: patientInfo.PatientName,
        PatientID: patientInfo.PatientID,
      });
    }
  }, [patientInfo, setPatientInfo]);

  return (
    <IconPresentationProvider
      size="large"
      IconContainer={ToolButton}
    >
      <div className="relative mb-2 w-full rounded-lg border border-white border-opacity-10 bg-white bg-opacity-[5%] py-1">
        <div className="relative h-[48px] items-center">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
            <div className="flex items-center justify-center space-x-2">
              <div className="flex items-center">
                <Toolbar buttonSection="primary" />
                <AIModelButton
                  isShowBG={true}
                  servicesManager={servicesManager}
                  inferenceAvailableModels={inferenceAvailableModels}
                  loading={fetchingAvailableModels}
                />
                <div className="ml-2">
                  <ChatButton servicesManager={servicesManager} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </IconPresentationProvider>
  );
}

export default PacsAiViewerHeader;
