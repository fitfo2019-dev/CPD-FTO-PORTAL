import { createRoot } from "react-dom/client";
import App from "./App.js";
import { ErrorBoundary } from "./components/error-boundary.js";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Preview root element is missing.");

createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
