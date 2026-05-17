import React from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  resolveInitialLocale,
  setLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from "./lib/i18n";
import { Widget } from "./Widget";

import "./index.css";

export type MountOptions = {
  workflowsApiUrl?: string;
  providersApiUrl?: string;
  sessionId: string;
  mobileUrl?: string | null;
  // Explicit locale for the widget. Defaults to navigator.language → "en".
  locale?: Locale;
  onComplete?: (status: "submitted") => void;
};

const isSupported = (s: string): s is Locale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(s);

export type MountedWidget = {
  unmount: () => void;
};

const DEFAULT_WORKFLOWS_URL = "http://localhost:3004";
const DEFAULT_PROVIDERS_URL = "http://localhost:3008";

export const mount = (
  container: HTMLElement,
  options: MountOptions,
): MountedWidget => {
  setLocale(
    options.locale && isSupported(options.locale)
      ? options.locale
      : resolveInitialLocale(),
  );
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
