// shadcn-style Table primitives (adapted). Pure styling wrappers around native
// table elements — the shadcn approach: structure you own, classes from tokens.
import * as React from "react";
import { cn } from "../../lib/utils";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...p }, ref) => (
  <table ref={ref} className={cn("w-full border-collapse text-sm caption-bottom", className)} {...p} />
));
Table.displayName = "Table";

const THead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...p }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border-strong", className)} {...p} />
));
THead.displayName = "THead";

const TBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...p }, ref) => (
  <tbody ref={ref} className={cn(className)} {...p} />
));
TBody.displayName = "TBody";

const TR = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...p }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b border-border transition-colors hover:bg-hover", className)}
      {...p}
    />
  )
);
TR.displayName = "TR";

const TH = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...p }, ref) => (
    <th
      ref={ref}
      className={cn(
        "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground",
        className
      )}
      {...p}
    />
  )
);
TH.displayName = "TH";

const TD = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...p }, ref) => (
    <td ref={ref} className={cn("px-2 py-2", className)} {...p} />
  )
);
TD.displayName = "TD";

export { Table, THead, TBody, TR, TH, TD };
