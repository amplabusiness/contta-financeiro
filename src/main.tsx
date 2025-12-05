import { createRoot } from "react-dom/client";
import "@/lib/patchFetchForVitePing";
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { PeriodProvider } from "@/contexts/PeriodContext";
import App from "./App.tsx";
import "./index.css";

// Suppress ResizeObserver loop error (harmless warning)
const resizeObserverErrorHandler = (e: ErrorEvent) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    e.stopImmediatePropagation();
    return;
  }
};

window.addEventListener('error', resizeObserverErrorHandler);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PeriodProvider>
          <App />
        </PeriodProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
