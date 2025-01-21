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
          'placeholder:text-muted-foreground focus-visible:ring-primary flex h-7 w-full rounded border border-white/10 bg-transparent px-2 py-1 text-base text-white shadow-sm transition-colors file:border-0 file:bg-transparent file:text-base file:font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
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
