import React, { useRef } from "react";
import type { MountFlowQAOptions } from "../lib/types";
import { FlowQAShell } from "./FlowQAShell";

export type FlowQARootProps = MountFlowQAOptions & {
  children: React.ReactNode;
};

export function FlowQARoot(props: FlowQARootProps) {
  const { children, ...rest } = props;
  const appViewportRef = useRef<HTMLDivElement>(null);
  return (
    <FlowQAShell {...rest} appViewportRef={appViewportRef}>
      {children}
    </FlowQAShell>
  );
}
