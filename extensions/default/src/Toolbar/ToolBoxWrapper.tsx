import React from 'react';
import classNames from 'classnames';
import { ToolButton } from '@ohif/ui-next';
import { useToolbar } from '@ohif/core/src/hooks/useToolbar';

/**
 * Wraps the ToolButtonList component to handle the OHIF toolbar button structure
 * @param props - Component props
 * @returns Component
 */
export function ToolBoxButtonGroupWrapper({ groupId, buttonSection, ...props }) {
  const { onInteraction, toolbarButtons } = useToolbar({
    buttonSection,
  });

  if (!groupId) {
    return null;
  }

  const items = toolbarButtons.map(button => button.componentProps);

  return (
    // NOTE: This is a PACS changes
    <div className="flex flex-row space-x-1 rounded-md bg-[#151815] px-0 py-0">
      {items.map(item => (
        <ToolButton
          {...item}
          key={item.id}
          size="small"
          className={item.disabled && 'text-foreground/70'}
          onInteraction={event => {
            onInteraction?.({
              event,
              groupId,
              commands: item.commands,
              itemId: item.id,
              item,
            });
          }}
        />
      ))}
    </div>
  );
}

export function ToolBoxButtonWrapper({ onInteraction, className, options, ...props }) {
  return (
    <div className="flex flex-row rounded-md bg-[#151815] px-0 py-0">
      <ToolButton
        {...props}
        id={props.id}
        size="small"
        className={classNames(props.disabled && 'text-foreground/70', className)}
        onInteraction={event => {
          onInteraction?.({
            event,
            itemId: props.id,
            commands: props.commands,
            options,
          });
        }}
      />
    </div>
  );
}
