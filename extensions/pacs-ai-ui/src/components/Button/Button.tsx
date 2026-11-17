import React, { useRef } from 'react';
import classnames from 'classnames';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ohif/ui-next';
import { primaryGradient } from '@pacs-ai/theme';
import * as ButtonEnums from './ButtonEnums';

/**
 * The PACS-AI button: lime-to-green gradient, black text.
 *
 * Same props and same rendered classes as the restyled `Button` the fork kept
 * in `@ohif/ui` (removed in P2.1 when `platform/ui` went back to upstream), so
 * pages that switch their import from `@ohif/ui` to `@pacs-ai/ui` look the same.
 *
 * Note that, as before, `type` is the visual type (`primary` | `secondary`)
 * and is not passed to the `<button>` element. Pages pass `type="submit"`;
 * that selects neither visual type, and the element keeps the browser's
 * default type (`submit` inside a form).
 */

const sizeClasses = {
  [ButtonEnums.size.small]: 'h-[26px] text-[13px]',
  [ButtonEnums.size.medium]: 'h-[32px] text-[14px]',
};

const layoutClasses =
  'box-content inline-flex flex-row items-center justify-center gap-[5px] justify center outline-none rounded px-3';

const baseFontTextClasses = 'leading-[1.2] font-sans text-center whitespace-nowrap';

const fontTextClasses = {
  [ButtonEnums.type.primary]: classnames(baseFontTextClasses, 'font-medium'),
  [ButtonEnums.type.secondary]: classnames(baseFontTextClasses, 'font-400'),
};

const baseEnabledEffectClasses = 'transition duration-300 ease-in-out focus:outline-none';

const enabledEffectClasses = {
  [ButtonEnums.type.primary]: classnames(
    baseEnabledEffectClasses,
    'hover:pacs-gradient-bg active:pacs-gradient-bg'
  ),
  [ButtonEnums.type.secondary]: classnames(
    baseEnabledEffectClasses,
    'hover:bg-customblue-50 active:bg-customblue-20'
  ),
};

const baseEnabledClasses = 'text-black ';

const enabledClasses = {
  [ButtonEnums.type.primary]: classnames(
    'bg-gray-300',
    baseEnabledClasses,
    enabledEffectClasses[ButtonEnums.type.primary]
  ),
  [ButtonEnums.type.secondary]: classnames(
    'bg-customblue-30',
    baseEnabledClasses,
    enabledEffectClasses[ButtonEnums.type.secondary]
  ),
};

const disabledClasses = 'bg-inputfield-placeholder cursor-default text-white opacity-70';

export type ButtonProps = {
  /** What is inside the button, can be text or a React node */
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  size?: ButtonEnums.size | `${ButtonEnums.size}`;
  disabled?: boolean;
  /** Visual type (`primary` | `secondary`); not the element's `type` attribute */
  type?: ButtonEnums.type | `${ButtonEnums.type}` | string;
  name?: string;
  startIcon?: React.ReactElement;
  endIcon?: React.ReactElement;
  /** Additional Tailwind classes */
  className?: string;
  startIconTooltip?: React.ReactNode;
  endIconTooltip?: React.ReactNode;
  /** Data attribute for tests */
  dataCY?: string;
};

function withTooltip(icon: React.ReactNode, tooltip: React.ReactNode) {
  if (!tooltip) {
    return icon;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{icon}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

const Button = ({
  children = '',
  size = ButtonEnums.size.medium,
  disabled = false,
  type = ButtonEnums.type.primary,
  startIcon: startIconProp,
  endIcon: endIconProp,
  name,
  className,
  onClick = () => {},
  dataCY,
  startIconTooltip = null,
  endIconTooltip = null,
}: ButtonProps) => {
  const dataCy = dataCY || `${name}-btn`;

  const startIcon = startIconProp && (
    <>
      {React.cloneElement(startIconProp, {
        className: classnames('w-4 h-4 fill-current', startIconProp?.props?.className),
      })}
    </>
  );

  const endIcon = endIconProp && (
    <>
      {React.cloneElement(endIconProp, {
        className: classnames('w-4 h-4 fill-current', endIconProp?.props?.className),
      })}
    </>
  );
  const buttonElement = useRef<HTMLButtonElement>(null);

  const handleOnClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    buttonElement.current?.blur();
    if (!disabled) {
      onClick(event);
    }
  };

  const finalClassName = classnames(
    layoutClasses,
    fontTextClasses[type],
    disabled ? disabledClasses : enabledClasses[type],
    sizeClasses[size],
    children ? 'min-w-[32px]' : '', // minimum width for buttons with text; icon only button does NOT get a minimum width
    className
  );

  return (
    <button
      className={finalClassName}
      disabled={disabled}
      ref={buttonElement}
      onClick={handleOnClick}
      data-cy={dataCy}
      style={{ background: primaryGradient }}
    >
      {withTooltip(startIcon, startIconTooltip)}
      {children}
      {withTooltip(endIcon, endIconTooltip)}
    </button>
  );
};

export default Button;
