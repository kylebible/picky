import { Component, type ReactNode } from "react";
import { reportError, startOver } from "../lib/telemetry";

/** Shows what broke instead of a blank screen, and reports it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportError(error, "render");
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="screen">
        <div className="topbar" />
        <h1>Something went wrong</h1>
        <div className="error-box">Picky hit a problem showing this screen. We've been told about it.</div>
        <p className="small">Details for Picky's team: {error.message}</p>
        <div className="grow" />
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
        <button type="button" className="btn btn-secondary" onClick={startOver}>
          Start over with a new menu
        </button>
      </main>
    );
  }
}
