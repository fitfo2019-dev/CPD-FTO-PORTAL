import { createRoot } from "react-dom/client";
import App from "./App.js";
import { ErrorBoundary } from "./components/error-boundary.js";
import "./index.css";

if (
  import.meta.env.DEV &&
  "serviceWorker" in navigator &&
  new URLSearchParams(window.location.search).get("component") === "PacketReviewPreview"
) {
  // This public synthetic-only entry lives under /api so an older root-scoped
  // worker cannot replace its navigation with the portal's cached sign-in.
  void navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  }).then(registration => registration.update()).catch(() => {
    // The preview remains usable in browsers without service worker support.
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Preview root element is missing.");

createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
