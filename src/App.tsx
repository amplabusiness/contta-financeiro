import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClientProvider } from "@/contexts/ClientContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Clients from "./pages/Clients";
import Invoices from "./pages/Invoices";
import Expenses from "./pages/Expenses";
import Import from "./pages/Import";
import ImportBoletos from "./pages/ImportBoletos";
import AuditLogs from "./pages/AuditLogs";
import Reports from "./pages/Reports";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import DRE from "./pages/DRE";
import RevenueTypes from "./pages/RevenueTypes";
import BankReconciliation from "./pages/BankReconciliation";
import PixReconciliation from "./pages/PixReconciliation";
import BoletoGapsAnalysis from "./pages/BoletoGapsAnalysis";
import ClientLedger from "./pages/ClientLedger";
import ClientDashboard from "./pages/ClientDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ClientProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/executive-dashboard" element={<ExecutiveDashboard />} />
            <Route path="/client-dashboard" element={<ClientDashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/import" element={<Import />} />
            <Route path="/import-boletos" element={<ImportBoletos />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
            <Route path="/dre" element={<DRE />} />
            <Route path="/revenue-types" element={<RevenueTypes />} />
            <Route path="/bank-reconciliation" element={<BankReconciliation />} />
            <Route path="/pix-reconciliation" element={<PixReconciliation />} />
            <Route path="/boleto-gaps" element={<BoletoGapsAnalysis />} />
            <Route path="/client-ledger" element={<ClientLedger />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ClientProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
