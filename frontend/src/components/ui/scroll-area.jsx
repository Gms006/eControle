import * as React from "react";
import * as RadixScrollArea from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
  <RadixScrollArea.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <RadixScrollArea.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </RadixScrollArea.Viewport>
    <RadixScrollArea.Scrollbar
      className="flex touch-none select-none p-0.5 bg-transparent transition-colors duration-[160ms] ease-out data-[orientation=vertical]:w-2 data-[orientation=horizontal]:h-2"
      orientation="vertical"
    >
      <RadixScrollArea.Thumb className="relative flex-1 rounded-full bg-muted-foreground/30" />
    </RadixScrollArea.Scrollbar>
    <RadixScrollArea.Corner />
  </RadixScrollArea.Root>
));
ScrollArea.displayName = "ScrollArea";