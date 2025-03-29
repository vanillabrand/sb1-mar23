import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-gunmetal-700 bg-gunmetal-800",
          "px-3 py-2 text-sm ring-offset-gunmetal-950 file:border-0",
          "file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-gunmetal-400",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };