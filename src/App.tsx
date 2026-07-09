import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { getAppBasePath } from "@/lib/basePath";
import Sidebar from "@/components/common/Sidebar";
import HomePage from "@/pages/Home";
import MetricsPage from "@/pages/Metrics";
import SettingsPage from "@/pages/Settings";
import { ThemeProvider } from "@/components/common/theme-provider";
import AppInitializer from "@/components/common/AppInit";
import EnvironmentIndicator from "@/components/common/EnvironmentIndicator";
import useAppStore from "@/store";
import NotFound from "./pages/NotFound";
import { PrivateRoute } from "@/components/common/privateRoute"; // Import PrivateRoute
import Admin from "@/pages/Admin";
import LogsPage from "@/pages/Logs";
import { AdminRoute } from "@/features/admin/routes/adminRoute";

export default function App() {
  // Remount the page tree when the active connection changes, so every
  // page (explorer, metrics, admin, logs) refetches from the new server.
  const activeConnectionId = useAppStore((state) => state.activeConnectionId);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router basename={getAppBasePath()}>
        <AppInitializer>
          <EnvironmentIndicator />
          <div className="flex h-screen">
            <Sidebar />
            <Routes key={activeConnectionId ?? "default"}>
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <HomePage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/metrics"
                element={
                  <PrivateRoute>
                    <MetricsPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/logs"
                element={
                  <PrivateRoute>
                    <LogsPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </AppInitializer>
      </Router>
    </ThemeProvider>
  );
}
