/**
 * OHIF v3.11.1 extensions/default/src/Panels/StudyBrowser/PanelStudyBrowserHeader.tsx
 * with the PACS-AI changes (marked "PACS-AI"): a transparent bar, the
 * view-preset toggles in our colour, and a slot for extra actions (the
 * refresh-from-PACS button).
 */
import React from 'react';
import { ToggleGroup, ToggleGroupItem, Icons } from '@ohif/ui-next';
import type { ActionIcon as actionIcon } from './constants';

type viewPreset = { id: string; iconName: string; selected: boolean };

function PacsAiPanelStudyBrowserHeader({
  viewPresets,
  updateViewPresetValue,
  actionIcons,
  updateActionIconValue,
  extraActions, // PACS-AI
}: {
  viewPresets: viewPreset[];
  updateViewPresetValue: (viewPreset: viewPreset) => void;
  actionIcons: actionIcon[];
  updateActionIconValue: (actionIcon: actionIcon) => void;
  extraActions?: React.ReactNode; // PACS-AI
}) {
  return (
    <>
      {/* PACS-AI */}
      <div className="flex h-[40px] select-none rounded-t bg-transparent p-2">
        <div className={'flex h-[24px] w-full select-none justify-center self-center text-[14px]'}>
          <div className="flex w-full items-center gap-[10px]">
            <div className="flex items-center justify-center">
              <div className="text-primary flex items-center space-x-1">
                {actionIcons.map((icon: actionIcon, index) =>
                  React.createElement(Icons[icon.iconName] || Icons.MissingIcon, {
                    key: index,
                    onClick: () => updateActionIconValue(icon),
                    className: `cursor-pointer`,
                  })
                )}
              </div>
            </div>
            {/* PACS-AI */}
            {extraActions}
            <div className="ml-auto flex h-full items-center justify-center">
              <ToggleGroup
                type="single"
                value={viewPresets.filter(preset => preset.selected)[0].id}
                onValueChange={value => {
                  const selectedViewPreset = viewPresets.find(preset => preset.id === value);
                  updateViewPresetValue(selectedViewPreset);
                }}
              >
                {viewPresets.map((viewPreset: viewPreset, index) => (
                  <ToggleGroupItem
                    key={index}
                    aria-label={viewPreset.id}
                    value={viewPreset.id}
                    // PACS-AI
                    className="text-primary-dark/50"
                  >
                    {React.createElement(Icons[viewPreset.iconName] || Icons.MissingIcon)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export { PacsAiPanelStudyBrowserHeader };
