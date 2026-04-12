import pino from "pino";

export type Logger = pino.Logger;

export const createLogger = (props: {
  name: string;
  level?: string;
}): Logger => {
  return pino({
    name: props.name,
    level: props.level ?? "info",
  });
};
