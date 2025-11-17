import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { PeriodProvider } from "@/contexts/PeriodContext";
import App from "./App.tsx";
import "./index.css";

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
