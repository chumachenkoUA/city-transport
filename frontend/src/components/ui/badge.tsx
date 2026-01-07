import * as React from "react";
import { cn } from "../../lib/utils";

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-text",
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
