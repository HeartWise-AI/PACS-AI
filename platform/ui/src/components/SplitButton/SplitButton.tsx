import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import OutsideClickHandler from 'react-outside-click-handler';
import { useTranslation } from 'react-i18next';

import Icon from '../Icon';
import Tooltip from '../Tooltip';
import ListMenu from '../ListMenu';

const baseClasses = {
  Button: 'flex items-center rounded-md border-transparent cursor-pointer group/button',
  Primary:
    // By default border on left, top and bottom for hover effect and only rounded on left side.
    // Extra padding on right to compensate for no right border.
    'h-full rounded-tl-md rounded-bl-md group/primary !pl-2 !py-2',
  Secondary:
    'h-full flex items-center justify-center rounded-tr-md rounded-br-md w-4 border-transparent group/secondary',
  SecondaryIcon: 'w-4 h-full stroke-1',
  Separator: 'py-2.5',
  Content: 'absolute z-10 top-0 mt-12',
};

const classes = {
  Button: ({ isExpanded, primary }) =>
    classNames(
      baseClasses.Button,
      !isExpanded &&
        !primary.isActive &&
        'hover:!bg-primary-dark hover:border-none hover:!text-black'
    ),
  Interface: 'h-full flex flex-row items-center',
  Primary: ({ primary, isExpanded }) =>
    classNames(
      baseClasses.Primary,
      primary.isActive
        ? isExpanded
          ? 'border-none !bg-transparent hover:border-none !text-black'
          : `${primary.isToggle ? 'border-none bg-secondary-light' : 'border-none bg-transparent'}
            border-2 rounded-md !p-2` // Full, rounded border with less right padding when active.
        : `focus:!text-black focus:!rounded-md focus:!border-none focus:!bg-transparent
        ${
          isExpanded
            ? 'border-none bg-transparent !text-black'
            : 'border-none bg-none group-hover/button:border-none group-hover/button:text-black hover:!bg-primary-dark hover:!text-black hover:border-none focus:!text-black'
        }
        `
    ),
  Secondary: ({ isExpanded, primary }) =>
    classNames(
      baseClasses.Secondary,
      isExpanded
        ? 'bg-transparent !rounded-tr-md !rounded-br-md'
        : primary.isActive
        ? 'bg-none'
        : 'hover:bg-primary-dark bg-none group-hover/button:border-none hover:!text-black'
    ),
  SecondaryIcon: ({ isExpanded }) =>
    classNames(
      baseClasses.SecondaryIcon,
      isExpanded
        ? 'text-primary-dark'
        : 'text-white group-hover/secondary:text-black hover:!text-black'
    ),
  Separator: ({ primary, isExpanded, isHovering }) =>
    classNames(
      baseClasses.Separator,
      isHovering || isExpanded || primary.isActive ? 'border-transparent' : 'border-primary-active'
    ),
  Content: ({ isExpanded }) => classNames(baseClasses.Content, isExpanded ? 'block' : 'hidden'),
};

const SplitButton = ({
  isToggle,
  groupId,
  primary,
  secondary,
  items,
  renderer,
  isActive,
  onInteraction,
  Component,
}) => {
  const { t } = useTranslation('Buttons');
  const [state, setState] = useState({ isHovering: false, isExpanded: false });

  const toggleExpanded = () => setState({ ...state, isExpanded: !state.isExpanded });
  const setHover = hovering => setState({ ...state, isHovering: hovering });
  const collapse = () => setState({ ...state, isExpanded: false });

  const renderPrimaryButton = () => (
    <Component
      key={primary.id}
      {...primary}
      isActive={isActive}
      onInteraction={onInteraction}
      rounded="none"
      className={classes.Primary({ ...state, primary: { isActive, isToggle } })}
      data-tool={primary.id}
      data-cy={`${groupId}-split-button-primary`}
    />
  );

  return (
    <OutsideClickHandler
      onOutsideClick={collapse}
      disabled={!state.isExpanded}
    >
      <div
        id="SplitButton"
        className="relative"
      >
        <div
          className={classes.Button({ ...state, primary: { isActive } })}
          style={{ height: '40px' }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className={classes.Interface}>
            <div onClick={collapse}>{renderPrimaryButton()}</div>
            <div className={classes.Separator({ ...state, primary: { isActive } })}></div>
            <div
              className={classes.Secondary({ ...state, primary: { isActive } })}
              onClick={toggleExpanded}
              data-cy={`${groupId}-split-button-secondary`}
            >
              <Tooltip
                isDisabled={state.isExpanded || !secondary.tooltip}
                content={secondary.tooltip}
                className="h-full"
              >
                <Icon
                  name={secondary.icon}
                  className={classes.SecondaryIcon({ ...state, primary: { isActive } })}
                />
              </Tooltip>
            </div>
          </div>
        </div>
        <div
          className={classes.Content({ ...state })}
          data-cy={`${groupId}-list-menu`}
        >
          <ListMenu
            items={items}
            onClick={collapse}
            renderer={args => renderer({ ...args, t })}
          />
        </div>
      </div>
    </OutsideClickHandler>
  );
};

SplitButton.propTypes = {
  isToggle: PropTypes.bool,
  groupId: PropTypes.string.isRequired,
  primary: PropTypes.object.isRequired,
  secondary: PropTypes.object.isRequired,
  items: PropTypes.array.isRequired,
  renderer: PropTypes.func,
  isActive: PropTypes.bool,
  onInteraction: PropTypes.func.isRequired,
  Component: PropTypes.elementType,
};

SplitButton.defaultProps = {
  isToggle: false,
  renderer: null,
  isActive: false,
  Component: null,
};

export default SplitButton;
