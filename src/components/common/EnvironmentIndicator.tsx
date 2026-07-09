import useAppStore from "@/store";
import { ENV_DOT_CLASS } from "@/lib/environments";

/**
 * Always-visible marker of the environment you are connected to:
 * a colored strip across the top of the viewport, plus a red
 * "PROD" pill when the active connection is production.
 */
const EnvironmentIndicator = () => {
  const { savedConnections, activeConnectionId, isServerAvailable } =
    useAppStore();
  const active = savedConnections.find((c) => c.id === activeConnectionId);

  if (!active || !isServerAvailable) return null;

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none ${
          ENV_DOT_CLASS[active.environment]
        }`}
      />
      {active.environment === "prod" && (
        <div className="fixed top-1.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none rounded-full bg-red-600 text-white text-[10px] font-bold tracking-wider px-2.5 py-0.5 shadow-md">
          PROD — {active.name}
        </div>
      )}
    </>
  );
};

export default EnvironmentIndicator;
