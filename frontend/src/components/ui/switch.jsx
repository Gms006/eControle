import * as React from "react";
import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <RadixSwitch.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
      className
    )}
    {...props}
  >
    <RadixSwitch.Thumb className="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-background shadow-lg transition-transform data-[state=checked]:translate-x-4" />
  </RadixSwitch.Root>
));
Switch.displayName = "Switch";