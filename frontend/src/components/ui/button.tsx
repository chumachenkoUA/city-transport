import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          {
            "bg-gradient-to-r from-violet-500 to-pink-500 text-white hover:opacity-90 shadow-lg shadow-violet-500/20":
              variant === "primary",
            "bg-surface text-text hover:bg-white/10 border border-white/10":
              variant === "secondary",
            "border border-white/10 bg-transparent hover:bg-white/5 text-text":
              variant === "outline",
            "hover:bg-white/5 text-text": variant === "ghost",
            "h-10 px-4 py-2": size === "default",
            "h-8 rounded-xl px-3 text-xs": size === "sm",
            "h-12 rounded-2xl px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
