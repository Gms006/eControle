import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = React.forwardRef(
  ({ className, sideOffset = 8, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          // base shadcn
          "z-50 min-w-[14rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-xl focus:outline-none",
          // polish
          "backdrop-blur supports-[backdrop-filter]:bg-popover/95",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
);
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = React.forwardRef(
  ({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none transition-colors",
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export const DropdownMenuLabel = React.forwardRef(
  ({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
);
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

export const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export const DropdownMenuSubTrigger = React.forwardRef(
  ({ className, inset, children, ...props }, ref) => (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        "flex cursor-default select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.SubTrigger>
  )
);
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

export const DropdownMenuSubContent = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[12rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg focus:outline-none",
      "backdrop-blur supports-[backdrop-filter]:bg-popover/95",
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

export const DropdownMenuCheckboxItem = React.forwardRef(
  ({ className, children, checked, ...props }, ref) => (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <span className="h-2 w-2 rounded-full bg-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
);
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

export const DropdownMenuRadioItem = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <span className="h-2 w-2 rounded-full bg-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
);
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

export const DropdownMenuArrow = DropdownMenuPrimitive.Arrow;

/* ------------ Extras “polish” ------------- */

/** Badge compacto para rotular origem (ex.: “RFB”, “Megasoft”) */
export function MiniBadge({ children, className }) {
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center justify-center rounded-md bg-slate-100 px-1.5 py-0 text-center text-[10px] font-medium text-slate-600",
        className
      )}
    >
      {children}
    </span>
  );
}

/** KBD estilizado para dica de atalho (opcional) */
export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        "rounded-md border border-slate-200 bg-slate-50 px-1 py-[2px] text-[10px] text-slate-500",
        "shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.04)]",
        className
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * Item “fancy”: ícone à esquerda + bloco título/descrição + hint à direita.
 * Usa onSelect para evitar o comportamento de “enter key” disparar clique indesejado.
 */
export const DropdownMenuItemFancy = React.forwardRef(
  ({ icon: Icon, title, description, hint, className, onClick, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      onSelect={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      className={cn(
        "group relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-2 py-2 outline-none",
        "transition-colors duration-150",
        "focus:ring-2 focus:ring-sky-200 focus:bg-sky-50/60 hover:bg-slate-50",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        "data-[disabled]:hover:bg-transparent data-[disabled]:focus:bg-transparent",
        "data-[disabled]:text-slate-400 data-[disabled]:ring-0",
        className
      )}
      {...props}
    >
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-200">
        {Icon && <Icon className="h-4.5 w-4.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center text-sm font-medium text-slate-800">
          <span className="truncate">{title}</span>
        </div>
        {description && (
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{description}</p>
        )}
      </div>
      {hint && <div className="pl-2 text-[11px] text-slate-500">{hint}</div>}
    </DropdownMenuPrimitive.Item>
  )
);
DropdownMenuItemFancy.displayName = "DropdownMenuItemFancy";
