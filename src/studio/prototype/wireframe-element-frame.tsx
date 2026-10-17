import type { ReactNode } from "react";
import type { StyleTarget } from "./inspector-model";
import { wireframeElementBoxStyle } from "./inspector-model";
import type { WireframeElement } from "./model";

export function WireframeElementFrame({
  el,
  target = "base",
  className,
  children,
}: {
  el: WireframeElement;
  target?: StyleTarget;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        ...wireframeElementBoxStyle(el, target),
      }}
    >
      <div className="size-full overflow-hidden">{children}</div>
    </div>
  );
}
