import * as React from 'react';
import { cn } from '@ohif/ui-next';

/**
 * The form input of the PACS-AI pages: 51px high, rounded, translucent white
 * field with white text and a white/40 placeholder. On 3.11.1 this was the
 * fork's edit of ui-next's `Input` (all inputs of the app); on 3.13 ui-next's
 * `Input` is upstream's compact 28px field and our pages use this one. Classes
 * passed in `className` win over these (tailwind-merge, as ui-next's `Input`).
 */
export const PACS_AI_INPUT_CLASSES =
  'h-[51px] w-full rounded-lg border border-transparent bg-white bg-opacity-10 py-2 px-3 text-lg leading-tight text-white transition duration-300 placeholder:text-lg placeholder:text-white placeholder:text-opacity-40 disabled:border-none';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(PACS_AI_INPUT_CLASSES, className)}
      ref={ref}
      {...props}
    />
  )
);

Input.displayName = 'Input';

export default Input;
