import { ConnectionEnvironment } from "@/types/common";

export const ENVIRONMENTS: ConnectionEnvironment[] = [
  "dev",
  "staging",
  "prod",
];

export const ENV_LABEL: Record<ConnectionEnvironment, string> = {
  dev: "DEV",
  staging: "STAGING",
  prod: "PROD",
};

// Literal class strings so Tailwind sees them at build time.
export const ENV_BADGE_CLASS: Record<ConnectionEnvironment, string> = {
  dev: "bg-sky-500/15 text-sky-500 border border-sky-500/40",
  staging: "bg-amber-500/15 text-amber-500 border border-amber-500/40",
  prod: "bg-violet-500/15 text-violet-500 border border-violet-500/40",
};

export const ENV_DOT_CLASS: Record<ConnectionEnvironment, string> = {
  dev: "bg-sky-500",
  staging: "bg-amber-500",
  prod: "bg-violet-500",
};

// Same palette as ENV_DOT_CLASS, as hex for non-CSS contexts (e.g. canvas).
export const ENV_HEX_COLOR: Record<ConnectionEnvironment, string> = {
  dev: "#0ea5e9",
  staging: "#f59e0b",
  prod: "#8b5cf6",
};
