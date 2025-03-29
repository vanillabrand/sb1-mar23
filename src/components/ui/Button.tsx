import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-turquoise disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      default: "bg-gunmetal-800 text-white hover:bg-gunmetal-700",
      outline: "border border-gunmetal-700 bg-transparent hover:bg-gunmetal-800 hover:text-white",
      ghost: "bg-transparent hover:bg-gunmetal-800 hover:text-white"
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-8 text-lg"
    };

    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          isLoading && "opacity-50 cursor-wait",
          className
        )}
        disabled={disabled || isLoading}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";