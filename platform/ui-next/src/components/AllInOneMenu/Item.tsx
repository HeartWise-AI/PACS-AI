import React, { ReactNode, useCallback, useContext } from 'react';
import { MenuContext } from './Menu';

type ItemProps = {
  label: string;
  secondaryLabel?: string;
  icon?: ReactNode;
  rightIcon?: ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  useIconSpace?: boolean;
};

const Item = ({
  label,
  secondaryLabel,
  icon,
  rightIcon,
  onClick,
  onMouseEnter,
  onMouseLeave,
  useIconSpace = false,
}: ItemProps) => {
  const { hideMenu } = useContext(MenuContext);

  const onClickHandler = useCallback(() => {
    hideMenu();
    onClick?.();
  }, [hideMenu, onClick]);

  return (
    <div
      // NOTE: This is a PACS changes
      className="flex h-8 w-full flex-shrink-0 cursor-pointer items-center px-2 text-base leading-[18px] hover:rounded hover:bg-[#151815]"
      onClick={onClickHandler}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {(icon || useIconSpace) && (
        <div className="flex w-7 flex-shrink-0 items-center justify-center">{icon}</div>
      )}
      <span className="flex-grow">{label}</span>
      {secondaryLabel && (
        <span className="text-muted-foreground ml-2 flex-shrink-0">{secondaryLabel}</span>
      )}
      {rightIcon && <div className="ml-2 flex-shrink-0">{rightIcon}</div>}
    </div>
  );
};

export default Item;
