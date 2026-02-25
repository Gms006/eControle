import * as React from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = RadixTabs.Root;

export const TabsList = ({ className, ...props }) => (
  <RadixTabs.List className={cn("inline-grid w-full grid-cols-2 md:grid-cols-6 gap-2 bg-muted/50 p-1 rounded-xl", className)} {...props} />
);

export const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow data-[state=active]:text-foreground text-slate-600",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <RadixTabs.Content ref={ref} className={cn("focus-visible:outline-none", className)} {...props} />
));
TabsContent.displayName = "TabsContent";