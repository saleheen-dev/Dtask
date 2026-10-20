import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installDevBridge } from "./lib/dev-bridge";
import "./index.css";

// Browser preview mode (electron-vite dev --rendererOnly): mock the preload API
// so the UI can be inspected at http://localhost:5173 without Electron.
installDevBridge();

const root = createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);