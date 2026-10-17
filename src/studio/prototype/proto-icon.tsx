import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Icon, isBuiltinIconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { isProtoIconCustomColor } from "./icons";
import { ensureHugeiconLoaded, getHugeiconSvg, subscribeHugeiconsCatalog } from "./hugeicons-runtime";

const EMPTY_ICON: IconSvgElement = [];

export function isRegistryIconName(name: string): boolean {
  return isBuiltinIconName(name);
}

export function protoIconColorClass(color: string): string {
  if (color === "muted") return "text-muted-foreground";
  if (color === "primary") return "text-primary";
  return "text-foreground";
}

export function protoIconColorStyle(color: string): CSSProperties | undefined {
  if (isProtoIconCustomColor(color)) return { color };
  return undefined;
}

export function ProtoIcon({
  name,
  size = 24,
  color = "foreground",
  className,
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const registry = isRegistryIconName(name);
  const svg = useSyncExternalStore(
    subscribeHugeiconsCatalog,
    () => (registry ? undefined : getHugeiconSvg(name)),
    () => undefined,
  );

  useEffect(() => {
    if (registry || !name) return;
    void ensureHugeiconLoaded(name).catch(() => undefined);
  }, [registry, name]);

  const colorClass = protoIconColorClass(color);
  const colorStyle = protoIconColorStyle(color);
  const dim = { width: size, height: size };

  if (registry) {
    return (
      <Icon
        name={name}
        className={cn(colorClass, className)}
        style={{ ...dim, ...colorStyle }}
        aria-hidden
      />
    );
  }

  return (
    <HugeiconsIcon
      icon={svg ?? EMPTY_ICON}
      size={size}
      className={cn(!isProtoIconCustomColor(color) && colorClass, className)}
      style={colorStyle}
      aria-hidden
      data-icon-pending={svg === undefined ? "" : undefined}
    />
  );
}
