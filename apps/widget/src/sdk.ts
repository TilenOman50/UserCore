import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { Widget } from "./Widget";

import "./index.css";

export type MountOptions = {
  workflowsApiUrl?: string;
  providersApiUrl?: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  onComplete?: (status: "submitted") => void;
};

export type MountedWidget = {
  unmount: () => void;
};

const DEFAULT_WORKFLOWS_URL = "http://localhost:3004";
const DEFAULT_PROVIDERS_URL = "http://localhost:3008";

// Single entry point used by host pages to embed the verification flow.
//   <script src=".../usercore-widget.js"></script>
//   <script>
//     UserCore.mount(document.getElementById('kyc'), {...});
//   </script>
export const mount = (
  container: HTMLElement,
  options: MountOptions,
): MountedWidget => {
  const root: Root = createRoot(container);
  root.render(
    React.createElement(Widget, {
      workflowsApiUrl: options.workflowsApiUrl ?? DEFAULT_WORKFLOWS_URL,
      providersApiUrl: options.providersApiUrl ?? DEFAULT_PROVIDERS_URL,
      workspaceId: options.workspaceId,
      organizationId: options.organizationId,
      customerId: options.customerId,
      onComplete: options.onComplete,
    }),
  );
  return {
    unmount: () => root.unmount(),
  };
};
