import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { Widget } from "./Widget";

import "./index.css";

export type MountOptions = {
  workflowsApiUrl?: string;
  providersApiUrl?: string;
  sessionId: string;
  mobileUrl?: string | null;
  onComplete?: (status: "submitted") => void;
};

export type MountedWidget = {
  unmount: () => void;
};

const DEFAULT_WORKFLOWS_URL = "http://localhost:3004";
const DEFAULT_PROVIDERS_URL = "http://localhost:3008";

export const mount = (
  container: HTMLElement,
  options: MountOptions,
): MountedWidget => {
  const root: Root = createRoot(container);
  root.render(
    React.createElement(Widget, {
      workflowsApiUrl: options.workflowsApiUrl ?? DEFAULT_WORKFLOWS_URL,
      providersApiUrl: options.providersApiUrl ?? DEFAULT_PROVIDERS_URL,
      sessionId: options.sessionId,
      mobileUrl: options.mobileUrl,
      onComplete: options.onComplete,
    }),
  );
  return {
    unmount: () => root.unmount(),
  };
};
