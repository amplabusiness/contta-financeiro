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
import TrialBalance from "./pages/TrialBalance";
import BalanceSheet from "./pages/BalanceSheet";
import FixRevenueEntries from "./pages/FixRevenueEntries";
import ClientDashboard from "./pages/ClientDashboard";
import RegularizeAccounting from "./pages/RegularizeAccounting";
import AIAgents from "./pages/AIAgents";
import AIInsights from "./pages/AIInsights";
import CostCenterAnalysis from "./pages/CostCenterAnalysis";
import ImportCompanies from "./pages/ImportCompanies";
import ReconciliationDashboard from "./pages/ReconciliationDashboard";
import ImportInvoices from "./pages/ImportInvoices";
import ImportBoletoReport from "./pages/ImportBoletoReport";
import BoletoReportsDashboard from "./pages/BoletoReportsDashboard";
import ReconciliationDiscrepancies from "./pages/ReconciliationDiscrepancies";
import MergeClients from "./pages/MergeClients";
import UnmatchedPixReport from "./pages/UnmatchedPixReport";
import ClientEnrichment from "./pages/ClientEnrichment";
import BatchEnrichment from "./pages/BatchEnrichment";
import LivroDiario from "./pages/LivroDiario";
import LivroRazao from "./pages/LivroRazao";
import Balancete from "./pages/Balancete";
import GeneralLedgerAll from "./pages/GeneralLedgerAll";
import Settings from "./pages/Settings";
import CollectionDashboard from "./pages/CollectionDashboard";
import CollectionLetters from "./pages/CollectionLetters";
import Contracts from "./pages/Contracts";
import FeesAnalysis from "./pages/FeesAnalysis";
import CollectionWorkOrders from "./pages/CollectionWorkOrders";
import ProfitabilityAnalysis from "./pages/ProfitabilityAnalysis";
import EconomicGroupAnalysis from "./pages/EconomicGroupAnalysis";
import ProBonoClients from "./pages/ProBonoClients";
import AccountsPayable from "./pages/AccountsPayable";
import CashFlow from "./pages/CashFlow";
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
            <Route path="/import-invoices" element={<ImportInvoices />} />
            <Route path="/import-boleto-report" element={<ImportBoletoReport />} />
            <Route path="/boleto-reports-dashboard" element={<BoletoReportsDashboard />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
            <Route path="/dre" element={<DRE />} />
            <Route path="/revenue-types" element={<RevenueTypes />} />
            <Route path="/bank-reconciliation" element={<BankReconciliation />} />
            <Route path="/pix-reconciliation" element={<PixReconciliation />} />
            <Route path="/boleto-gaps" element={<BoletoGapsAnalysis />} />
            <Route path="/trial-balance" element={<TrialBalance />} />
            <Route path="/balance-sheet" element={<BalanceSheet />} />
            <Route path="/fix-revenue-entries" element={<FixRevenueEntries />} />
            <Route path="/client-ledger" element={<ClientLedger />} />
            <Route path="/regularize-accounting" element={<RegularizeAccounting />} />
            <Route path="/ai-agents" element={<AIAgents />} />
            <Route path="/cost-center-analysis" element={<CostCenterAnalysis />} />
            <Route path="/import-companies" element={<ImportCompanies />} />
            <Route path="/reconciliation-dashboard" element={<ReconciliationDashboard />} />
            <Route path="/reconciliation-discrepancies" element={<ReconciliationDiscrepancies />} />
            <Route path="/import-invoices" element={<ImportInvoices />} />
            <Route path="/merge-clients" element={<MergeClients />} />
            <Route path="/unmatched-pix-report" element={<UnmatchedPixReport />} />
            <Route path="/client-enrichment" element={<ClientEnrichment />} />
            <Route path="/batch-enrichment" element={<BatchEnrichment />} />
            <Route path="/livro-diario" element={<LivroDiario />} />
            <Route path="/livro-razao" element={<LivroRazao />} />
            <Route path="/razao-geral" element={<GeneralLedgerAll />} />
            <Route path="/balancete" element={<Balancete />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/collection-dashboard" element={<CollectionDashboard />} />
            <Route path="/collection-letters" element={<CollectionLetters />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/fees-analysis" element={<FeesAnalysis />} />
            <Route path="/collection-work-orders" element={<CollectionWorkOrders />} />
            <Route path="/profitability-analysis" element={<ProfitabilityAnalysis />} />
            <Route path="/economic-group-analysis" element={<EconomicGroupAnalysis />} />
            <Route path="/pro-bono-clients" element={<ProBonoClients />} />
            <Route path="/accounts-payable" element={<AccountsPayable />} />
            <Route path="/cash-flow" element={<CashFlow />} />
            <Route path="/ai-agents" element={<AIAgents />} />
            <Route path="/ai-insights" element={<AIInsights />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ClientProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
