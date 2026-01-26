import * as React from 'react';

import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // NOTE: This is a PACS changes
          'disabled:border-inputfield-disabled placeholder-inputfield-placeholder h-[51px] w-full rounded-lg border border-transparent bg-white bg-opacity-10 py-2 px-3 text-lg leading-tight text-white transition duration-300 placeholder:text-lg placeholder:text-white placeholder:text-opacity-40 disabled:border-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
