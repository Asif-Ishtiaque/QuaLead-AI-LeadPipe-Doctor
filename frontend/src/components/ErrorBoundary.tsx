import { Component, type ReactNode } from "react";

// A crash in any single chart/panel must never blank the whole app. This
// catches render errors, logs them, and shows a compact inline fallback so
// the rest of the page keeps working.
export class ErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ""}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="text-[0.82rem] text-muted bg-content border border-line rounded-xl px-4 py-6 text-center">
          This panel couldn’t render.
          <span className="block text-faint text-[0.74rem] mt-1">{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
