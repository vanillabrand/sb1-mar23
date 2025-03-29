import * as React from "react";
import * as PopoverPrimitive from "@floating-ui/react";
import { cn } from "../../lib/utils";

const Popover = PopoverPrimitive.FloatingOverlay;

const PopoverTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLProps<HTMLElement> & { asChild?: boolean }
>(({ asChild = false, ...props }, ref) => {
  const Comp = asChild ? React.Fragment : "button";
  return <Comp ref={ref} {...props} />;
});
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLProps<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <PopoverPrimitive.FloatingPortal>
    <PopoverPrimitive.FloatingFocusManager>
      <div
        ref={ref}
        className={cn(
          "z-50 w-72 rounded-md border border-gunmetal-700 bg-gunmetal-900 p-4 shadow-md outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2",
          "data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2",
          "data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.FloatingFocusManager>
  </PopoverPrimitive.FloatingPortal>
));
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };