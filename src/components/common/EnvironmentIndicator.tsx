import { useEffect } from "react";
import useAppStore from "@/store";
import { ENV_DOT_CLASS } from "@/lib/environments";
import { setFaviconForEnvironment } from "@/lib/favicon";

const EnvironmentIndicator = () => {
  const { savedConnections, activeConnectionId, isServerAvailable } =
    useAppStore();
  const active = savedConnections.find((c) => c.id === activeConnectionId);
  const environment = active && isServerAvailable ? active.environment : null;

  useEffect(() => {
    setFaviconForEnvironment(environment);
  }, [environment]);

  if (!active || !isServerAvailable) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none ${
        ENV_DOT_CLASS[active.environment]
      }`}
    />
  );
};

export default EnvironmentIndicator;
