// shadcn-style Collapsible — Radix primitive + className passthrough.
import * as React from "react";
import { Collapsible as RadixCollapsible } from "radix-ui";
import { cn } from "../../lib/utils";

const Collapsible = RadixCollapsible.Root;

const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof RadixCollapsible.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixCollapsible.Trigger>
>(({ className, ...props }, ref) => (
  <RadixCollapsible.Trigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between bg-card px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      className
    )}
    {...props}
  />
));
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof RadixCollapsible.Content>,
  React.ComponentPropsWithoutRef<typeof RadixCollapsible.Content>
>(({ className, ...props }, ref) => (
  <RadixCollapsible.Content
    ref={ref}
    className={cn("px-4 py-3", className)}
    {...props}
  />
));
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
