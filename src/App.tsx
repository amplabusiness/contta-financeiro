import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { ClientProvider } from "@/contexts/ClientContext";
import { PeriodProvider } from "@/contexts/PeriodContext";
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

const App = () => (
  <TooltipProvider>
    <ClientProvider>
      <Toaster />
      <Sonner />
      <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/executive-dashboard" element={<ExecutiveDashboard />} />
            <Route path="/client-dashboard" element={<ClientDashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expense-categories" element={<ExpenseCategories />} />
            <Route path="/import" element={<Import />} />
            <Route path="/import-boletos" element={<ImportBoletos />} />
            <Route path="/import-invoices" element={<ImportInvoices />} />
            <Route path="/import-boleto-report" element={<ImportBoletoReport />} />
            <Route path="/import-honorarios" element={<ImportHonorarios />} />
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
            <Route path="/fee-adjustment" element={<FeeAdjustment />} />
            <Route path="/debt-negotiation" element={<DebtNegotiation />} />
            <Route path="/collection-work-orders" element={<CollectionWorkOrders />} />
            <Route path="/profitability-analysis" element={<ProfitabilityAnalysis />} />
            <Route path="/economic-group-analysis" element={<EconomicGroupAnalysis />} />
            <Route path="/pro-bono-clients" element={<ProBonoClients />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/economic-groups" element={<EconomicGroups />} />
            <Route path="/process-pro-bono-fix" element={<ProcessProBonoFix />} />
            <Route path="/barter-clients" element={<BarterClients />} />
            <Route path="/convert-pro-bono-to-barter" element={<ConvertProBonoToBarter />} />
            <Route path="/bank-accounts" element={<BankAccounts />} />
            <Route path="/bank-import" element={<BankImport />} />
            <Route path="/accounts-payable" element={<AccountsPayable />} />
            <Route path="/import-expenses-spreadsheet" element={<ImportExpensesSpreadsheet />} />
            <Route path="/cash-flow" element={<CashFlow />} />
            <Route path="/default-analysis" element={<DefaultAnalysis />} />
            <Route path="/import-default-report" element={<ImportDefaultReport />} />
            <Route path="/ai-agents" element={<AIAgents />} />
            <Route path="/ai-insights" element={<AIInsights />} />
            <Route path="/ai-accountant" element={<AIAccountant />} />
            <Route path="/business-manager" element={<BusinessManager />} />
            <Route path="/ai-network" element={<AINetwork />} />
            <Route path="/generate-recurring-invoices" element={<GenerateRecurringInvoices />} />
            <Route path="/invoice-generation-report" element={<InvoiceGenerationReport />} />
            <Route path="/boleto-reconciliation" element={<BoletoReconciliation />} />
            <Route path="/automated-upload" element={<AutomatedFileUpload />} />
          <Route path="/client-verification" element={<ClientVerification />} />
          <Route path="/inactive-client-verification" element={<InactiveClientVerification />} />
          <Route path="/client-comparison-verification" element={<ClientComparisonVerification />} />
          <Route path="/client-spreadsheet-verification" element={<ClientSpreadsheetVerification />} />
          <Route path="/client-opening-balance" element={<ClientOpeningBalance />} />
          <Route path="/bank-folder-import" element={<BankFolderImport />} />
          <Route path="/super-conciliador" element={<SuperConciliador />} />
          <Route path="/initial-load" element={<InitialLoad />} />
            <Route path="/feature-requests" element={<FeatureRequests />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/labor-advisory" element={<LaborAdvisory />} />
            <Route path="/video-content" element={<VideoContent />} />
            <Route path="/pending-entities" element={<PendingEntities />} />
            <Route path="/incentives" element={<Incentives />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ClientProvider>
      </TooltipProvider>
);

export default App;
