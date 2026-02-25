import * as React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { cn } from "@/lib/utils";

export const Select = RadixSelect.Root;
export const SelectValue = RadixSelect.Value;

export const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <RadixSelect.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-9 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      className
    )}
    {...props}
  >
    {children}
  </RadixSelect.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => (
  <RadixSelect.Content ref={ref} position={position} className={cn("z-50 rounded-xl border bg-popover p-1 shadow-md", className)} {...props}>
    <RadixSelect.Viewport className="max-h-72 overflow-y-auto overscroll-contain p-1">
      {children}
    </RadixSelect.Viewport>
  </RadixSelect.Content>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <RadixSelect.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent",
      className
    )}
    {...props}
  >
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
  </RadixSelect.Item>
));
SelectItem.displayName = "SelectItem";
