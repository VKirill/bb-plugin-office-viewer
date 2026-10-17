import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "./tooltip";

export function IconTooltipButton({
  label,
  shortcut,
  disabled,
  pressed,
  onClick,
  className,
  children,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-7", disabled && "opacity-40", className)}
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-1.5">
        <span>{label}</span>
        {shortcut ? <span className="text-muted-foreground">{shortcut}</span> : null}
        <TooltipArrow width={8} height={4} />
      </TooltipContent>
    </Tooltip>
  );
}
