import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { reportError, track } from "./lib/telemetry";
import "./styles.css";

window.addEventListener("error", (e) => reportError(e.error ?? e.message, "window"));
track("app_start", {
  standalone: matchMedia("(display-mode: standalone)").matches,
  saved_menu: (() => {
    try {
      return localStorage.getItem("picky.menu") !== null;
    } catch {
      return null;
    }
  })(),
});
window.addEventListener("unhandledrejection", (e) => reportError(e.reason, "promise"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
