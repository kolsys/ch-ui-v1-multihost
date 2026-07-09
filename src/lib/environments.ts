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

// Literal class strings so Tailwind sees them at build time
export const ENV_BADGE_CLASS: Record<ConnectionEnvironment, string> = {
  dev: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40",
  staging: "bg-amber-500/15 text-amber-500 border border-amber-500/40",
  prod: "bg-red-500/15 text-red-500 border border-red-500/40",
};

export const ENV_DOT_CLASS: Record<ConnectionEnvironment, string> = {
  dev: "bg-emerald-500",
  staging: "bg-amber-500",
  prod: "bg-red-500",
};
