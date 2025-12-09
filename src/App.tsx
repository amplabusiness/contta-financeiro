import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { ClientProvider } from "@/contexts/ClientContext";
import { PeriodProvider } from "@/contexts/PeriodContext";
import { ExpenseUpdateProvider } from "@/contexts/ExpenseUpdateContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Clients from "./pages/Clients";
import Invoices from "./pages/Invoices";
import Expenses from "./pages/Expenses";
import ExpenseCategories from "./pages/ExpenseCategories";
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
import ReconciliationDiscrepancies from "./pages/ReconciliationDiscrepancies";
import ImportInvoices from "./pages/ImportInvoices";
import ImportBoletoReport from "./pages/ImportBoletoReport";
import BoletoReportsDashboard from "./pages/BoletoReportsDashboard";
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
import ProcessProBonoFix from "./pages/ProcessProBonoFix";
import BarterClients from "./pages/BarterClients";
import ConvertProBonoToBarter from "./pages/ConvertProBonoToBarter";
import BankAccounts from "./pages/BankAccounts";
import BankImport from "./pages/BankImport";
import ImportCNAB from "./pages/ImportCNAB";
import PendingReconciliations from "./pages/PendingReconciliations";
import AccountsPayable from "./pages/AccountsPayable";
import CashFlow from "./pages/CashFlow";
import DefaultAnalysis from "./pages/DefaultAnalysis";
import ImportDefaultReport from "./pages/ImportDefaultReport";
import ImportHonorarios from "./pages/ImportHonorarios";
import ImportExpensesSpreadsheet from "./pages/ImportExpensesSpreadsheet";
import AIAccountant from "./pages/AIAccountant";
import BusinessManager from "./pages/BusinessManager";
import AINetwork from "./pages/AINetwork";
import GenerateRecurringInvoices from "./pages/GenerateRecurringInvoices";
import InvoiceGenerationReport from "./pages/InvoiceGenerationReport";
import BoletoReconciliation from "./pages/BoletoReconciliation";
import AutomatedFileUpload from "./pages/AutomatedFileUpload";
import Partners from "./pages/Partners";
import EconomicGroups from "./pages/EconomicGroups";
import ClientVerification from "./pages/ClientVerification";
import InactiveClientVerification from "./pages/InactiveClientVerification";
import ClientComparisonVerification from "./pages/ClientComparisonVerification";
import ClientSpreadsheetVerification from "./pages/ClientSpreadsheetVerification";
import ClientOpeningBalance from "./pages/ClientOpeningBalance";
import BankFolderImport from "./pages/BankFolderImport";
import SuperConciliador from "./pages/SuperConciliador";
import FeeAdjustment from "./pages/FeeAdjustment";
import DebtNegotiation from "./pages/DebtNegotiation";
import InitialLoad from "./pages/InitialLoad";
import FeatureRequests from "./pages/FeatureRequests";
import Inventory from "./pages/Inventory";
import Payroll from "./pages/Payroll";
import LaborAdvisory from "./pages/LaborAdvisory";
import VideoContent from "./pages/VideoContent";
import PendingEntities from "./pages/PendingEntities";
import Incentives from "./pages/Incentives";
import NotFound from "./pages/NotFound";

const appRoutes = [
  { path: "/", element: <Navigate to="/auth" replace /> },
  { path: "/accounts-payable", element: <AccountsPayable /> },
  { path: "/ai-accountant", element: <AIAccountant /> },
  { path: "/ai-agents", element: <AIAgents /> },
  { path: "/ai-insights", element: <AIInsights /> },
  { path: "/ai-network", element: <AINetwork /> },
  { path: "/auth", element: <Auth /> },
  { path: "/audit-logs", element: <AuditLogs /> },
  { path: "/automated-upload", element: <AutomatedFileUpload /> },
  { path: "/balance-sheet", element: <BalanceSheet /> },
  { path: "/balancete", element: <Balancete /> },
  { path: "/bank-accounts", element: <BankAccounts /> },
  { path: "/bank-folder-import", element: <BankFolderImport /> },
  { path: "/bank-import", element: <BankImport /> },
  { path: "/bank-reconciliation", element: <BankReconciliation /> },
  { path: "/barter-clients", element: <BarterClients /> },
  { path: "/batch-enrichment", element: <BatchEnrichment /> },
  { path: "/boleto-gaps", element: <BoletoGapsAnalysis /> },
  { path: "/boleto-reconciliation", element: <BoletoReconciliation /> },
  { path: "/boleto-reports-dashboard", element: <BoletoReportsDashboard /> },
  { path: "/business-manager", element: <BusinessManager /> },
  { path: "/cash-flow", element: <CashFlow /> },
  { path: "/chart-of-accounts", element: <ChartOfAccounts /> },
  { path: "/client-comparison-verification", element: <ClientComparisonVerification /> },
  { path: "/client-dashboard", element: <ClientDashboard /> },
  { path: "/client-enrichment", element: <ClientEnrichment /> },
  { path: "/client-ledger", element: <ClientLedger /> },
  { path: "/client-opening-balance", element: <ClientOpeningBalance /> },
  { path: "/client-spreadsheet-verification", element: <ClientSpreadsheetVerification /> },
  { path: "/client-verification", element: <ClientVerification /> },
  { path: "/clients", element: <Clients /> },
  { path: "/collection-dashboard", element: <CollectionDashboard /> },
  { path: "/collection-letters", element: <CollectionLetters /> },
  { path: "/collection-work-orders", element: <CollectionWorkOrders /> },
  { path: "/convert-pro-bono-to-barter", element: <ConvertProBonoToBarter /> },
  { path: "/contracts", element: <Contracts /> },
  { path: "/cost-center-analysis", element: <CostCenterAnalysis /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/debt-negotiation", element: <DebtNegotiation /> },
  { path: "/default-analysis", element: <DefaultAnalysis /> },
  { path: "/dre", element: <DRE /> },
  { path: "/economic-group-analysis", element: <EconomicGroupAnalysis /> },
  { path: "/economic-groups", element: <EconomicGroups /> },
  { path: "/executive-dashboard", element: <ExecutiveDashboard /> },
  { path: "/expenses", element: <Expenses /> },
  { path: "/feature-requests", element: <FeatureRequests /> },
  { path: "/fee-adjustment", element: <FeeAdjustment /> },
  { path: "/fees-analysis", element: <FeesAnalysis /> },
  { path: "/fix-revenue-entries", element: <FixRevenueEntries /> },
  { path: "/generate-recurring-invoices", element: <GenerateRecurringInvoices /> },
  { path: "/import", element: <Import /> },
  { path: "/import-boletos", element: <ImportBoletos /> },
  { path: "/import-boleto-report", element: <ImportBoletoReport /> },
  { path: "/import-companies", element: <ImportCompanies /> },
  { path: "/import-default-report", element: <ImportDefaultReport /> },
  { path: "/import-expenses-spreadsheet", element: <ImportExpensesSpreadsheet /> },
  { path: "/import-honorarios", element: <ImportHonorarios /> },
  { path: "/import-invoices", element: <ImportInvoices /> },
  { path: "/invoice-generation-report", element: <InvoiceGenerationReport /> },
  { path: "/inactive-client-verification", element: <InactiveClientVerification /> },
  { path: "/incentives", element: <Incentives /> },
  { path: "/initial-load", element: <InitialLoad /> },
  { path: "/invoices", element: <Invoices /> },
  { path: "/inventory", element: <Inventory /> },
  { path: "/labor-advisory", element: <LaborAdvisory /> },
  { path: "/livro-diario", element: <LivroDiario /> },
  { path: "/livro-razao", element: <LivroRazao /> },
  { path: "/partners", element: <Partners /> },
  { path: "/payroll", element: <Payroll /> },
  { path: "/pending-entities", element: <PendingEntities /> },
  { path: "/pix-reconciliation", element: <PixReconciliation /> },
  { path: "/process-pro-bono-fix", element: <ProcessProBonoFix /> },
  { path: "/profitability-analysis", element: <ProfitabilityAnalysis /> },
  { path: "/pro-bono-clients", element: <ProBonoClients /> },
  { path: "/razao-geral", element: <GeneralLedgerAll /> },
  { path: "/recurring-expenses", element: <RecurringExpenses /> },
  { path: "/regularize-accounting", element: <RegularizeAccounting /> },
  { path: "/reconciliation-dashboard", element: <ReconciliationDashboard /> },
  { path: "/reconciliation-discrepancies", element: <ReconciliationDiscrepancies /> },
  { path: "/reports", element: <Reports /> },
  { path: "/revenue-types", element: <RevenueTypes /> },
  { path: "/settings", element: <Settings /> },
  { path: "/super-conciliador", element: <SuperConciliador /> },
  { path: "/trial-balance", element: <TrialBalance /> },
  { path: "/unmatched-pix-report", element: <UnmatchedPixReport /> },
  { path: "/video-content", element: <VideoContent /> },
];

const App = () => (
  <TooltipProvider>
    <ClientProvider>
      <PeriodProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {appRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PeriodProvider>
    </ClientProvider>
  </TooltipProvider>
);

export default App;
