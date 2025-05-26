import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md btn-text-small font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-neon-raspberry focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            'default': "bg-neon-raspberry text-white hover:bg-neon-raspberry/90",
            'outline': "bg-transparent hover:bg-gunmetal-800",
            'ghost': "hover:bg-gunmetal-800",
            'link': "text-neon-raspberry underline-offset-4 hover:underline"
          }[variant],
          {
            'default': "h-10 px-4 py-2",
            'sm': "h-9 rounded-md px-3",
            'lg': "h-11 rounded-md px-8"
          }[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
