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

// Handle unhandled promise rejections with proper error logging
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error instanceof TypeError) {
    const errorMsg = error.message || String(error);
    const cause = (error as any).cause;
    const url = (error as any).url;
    const method = (error as any).method;

    if (cause === 'xhr_timeout' || errorMsg.includes('timeout')) {
      console.error('[App] Unhandled network timeout:', {
        message: errorMsg,
        url,
        method,
        cause,
      });
    } else if (cause === 'xhr_network_error' || errorMsg.includes('Network')) {
      console.error('[App] Unhandled network error:', {
        message: errorMsg,
        url,
        method,
        cause,
      });
    }
  }
});

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
