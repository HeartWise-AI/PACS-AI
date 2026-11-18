import React from 'react';
import classnames from 'classnames';

/**
 * Text with the variants and colours our pages use. Same rendered classes as
 * the `Typography` in OHIF's legacy `@ohif/ui`, which our pages used before P2.1.
 */

const baseClasses = 'm-0 leading-tight';

const defaultVariantMapping = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  subtitle: 'h6',
  body: 'p',
};

const classes = {
  variant: {
    h1: 'text-6xl',
    h2: 'text-5xl',
    h3: 'text-4xl',
    h4: 'text-3xl',
    h5: 'text-2xl',
    // Using px value temporarily until larger fontsize variables are finalized
    h6: 'text-[20px]',
    subtitle: 'text-lg',
    body: 'text-base',
    caption: 'text-xs',
    button: 'text-sm uppercase',
    overline: 'text-xs uppercase',
    srOnly: 'absolute h-0 w-0 hidden',
    inherit: '',
  },
  color: {
    initial: 'text-white',
    inherit: 'text-inherit',
    primary: 'text-primary',
    primaryActive: 'text-primary',
    primaryLight: 'text-primary',
    secondary: 'text-[#a19fad]',
    error: 'text-red-600',
  },
  align: {
    inherit: '',
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  },
  display: {
    initial: '',
    block: 'block',
    inline: 'inline',
  },
  gutterBottom: {
    true: 'mb-3',
    false: '',
  },
  paragraph: {
    true: 'mb-3',
    false: '',
  },
  noWrap: {
    true: 'truncate',
    false: '',
  },
};

export type TypographyVariant = keyof typeof classes.variant;
export type TypographyColor = keyof typeof classes.color;

export type TypographyProps = {
  component?: React.ElementType;
  paragraph?: boolean;
  display?: keyof typeof classes.display;
  variant?: TypographyVariant;
  color?: TypographyColor;
  className?: string;
  children?: React.ReactNode;
  align?: keyof typeof classes.align;
  gutterBottom?: boolean;
  noWrap?: boolean;
  [attribute: string]: unknown;
};

const Typography = ({
  align = 'inherit',
  color = 'initial',
  display = 'initial',
  gutterBottom = false,
  noWrap = false,
  paragraph = false,
  variant = 'body',
  component,
  className,
  ...rest
}: TypographyProps) => {
  const Component: React.ElementType =
    component || (paragraph ? 'p' : defaultVariantMapping[variant]) || 'span';
  return (
    <Component
      className={classnames(
        baseClasses,
        classes.variant[variant],
        classes.color[color],
        classes.align[align],
        classes.gutterBottom[String(gutterBottom)],
        classes.paragraph[String(paragraph)],
        classes.noWrap[String(noWrap)],
        classes.display[display],
        className
      )}
      {...rest}
    />
  );
};

export default Typography;
