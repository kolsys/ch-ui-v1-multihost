import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "uplot/dist/uPlot.min.css";
import "./features/metrics/components/uplot.css";
import { Toaster } from "@/components/ui/sonner";

// Storage hosts that serve objects by exact key (no directory-index
// resolution, e.g. plain S3/Yandex Object Storage buckets) require
// requesting ".../index.html" literally. Strip that suffix before Router
// mounts so location.pathname matches the router's basename (which is
// derived from the same directory path, without "index.html").
if (/\/index\.html$/i.test(window.location.pathname)) {
  const cleanPath = window.location.pathname.replace(/\/index\.html$/i, "/");
  window.history.replaceState(
    null,
    "",
    cleanPath + window.location.search + window.location.hash
  );
}

// Polyfill for crypto.randomUUID if not available
if (typeof crypto.randomUUID !== "function") {
  crypto.randomUUID = function () {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        parseInt(c) ^
        (crypto.getRandomValues(new Uint8Array(1))[0] &
          (15 >> (parseInt(c) / 4)))
      ).toString(16)
    ) as `${string}-${string}-${string}-${string}-${string}`;
  };
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Toaster
      richColors
      toastOptions={{ duration: 2000, closeButton: true }}
      expand={true}
    />
    <App />
  </React.StrictMode>
);
