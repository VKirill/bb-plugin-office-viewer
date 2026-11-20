import { useEffect, useState } from "react";
import * as sdk from "@get-bb/plugin-sdk/app";

/** New BB hosts defer hidden tabs; older hosts keep their existing eager loading. */
export function useFileTabReady(): boolean {
  const useVisible = Reflect.get(sdk, "experimental_useTabVisible");
  const visible = typeof useVisible === "function" ? useVisible() : true;
  const [ready, setReady] = useState(visible);
  useEffect(() => {
    if (visible) setReady(true);
  }, [visible]);
  return ready;
}
