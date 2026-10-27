import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { reportError } from "./lib/report";
import "./styles.css";

window.addEventListener("error", (e) => reportError(e.error ?? e.message, "window"));
window.addEventListener("unhandledrejection", (e) => reportError(e.reason, "promise"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
