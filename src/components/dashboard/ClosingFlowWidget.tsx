/**
 * ClosingFlowWidget — Mini painel do fluxo de fechamento mensal
 * Exibe no Dashboard inicial o status do pipeline de fechamento.
 *
 * Pipeline: Context Builder → Dr. Cícero → APROVAR → Fechar Mês
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Lock, CheckCircle2, Clock, AlertTriangle, ArrowRight, Bot, Database, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const TENANT_ID = "bd437228-6413-45ac-974b-9833eb25b007";

interface MonthSummary {
  label: string;           // "Jan/2025"
  yyyyMm: string;          // "2025-01"
  status: "closed" | "in_progress" | "pending";
  pendingTransactions: number;
}

interface ClosingStats {
  totalMonths: number;
  closedMonths: number;
  inProgressMonth: string | null;
  pendingMonths: number;
  months: MonthSummary[];
  oldestPending: string | null;
}

export function ClosingFlowWidget() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ClosingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Months from Jan/2025 to current
        const start = new Date(2025, 0, 1); // Jan 2025
        const now = new Date();
        const months: MonthSummary[] = [];

        let cur = new Date(start);
        while (cur <= now) {
          const y = cur.getFullYear();
          const m = cur.getMonth() + 1;
          months.push({
            label: `${String(m).padStart(2, "0")}/${y}`,
            yyyyMm: `${y}-${String(m).padStart(2, "0")}`,
            status: "pending",
            pendingTransactions: 0,
          });
          cur = new Date(y, m, 1);
        }

        // Fetch closed months from accounting_closures
        const { data: closures } = await supabase
          .from("accounting_closures")
          .select("year, month, status")
          .eq("tenant_id", TENANT_ID)
          .eq("status", "closed");

        const closedSet = new Set<string>();
        (closures || []).forEach((c: { year: number; month: number }) => {
          closedSet.add(`${c.year}-${String(c.month).padStart(2, "0")}`);
        });

        // Also check monthly_closings
        const { data: monthlyClosings } = await supabase
          .from("monthly_closings")
          .select("reference_month, status")
          .eq("tenant_id", TENANT_ID)
          .eq("status", "closed");

        (monthlyClosings || []).forEach((mc: { reference_month: string }) => {
          const d = new Date(mc.reference_month);
          closedSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        });

        // Fetch pending bank transactions per month
        const { data: txData } = await supabase
          .from("bank_transactions")
          .select("date, reconciled")
          .eq("tenant_id", TENANT_ID)
          .eq("reconciled", false);

        const pendingByMonth: Record<string, number> = {};
        (txData || []).forEach((tx: { date: string }) => {
          const d = new Date(tx.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          pendingByMonth[key] = (pendingByMonth[key] || 0) + 1;
        });

        // Assign statuses
        let foundInProgress = false;
        for (let i = 0; i < months.length; i++) {
          const key = months[i].yyyyMm;
          months[i].pendingTransactions = pendingByMonth[key] || 0;

          if (closedSet.has(key)) {
            months[i].status = "closed";
          } else if (!foundInProgress) {
            months[i].status = "in_progress";
            foundInProgress = true;
          }
        }

        const closedMonths = months.filter((m) => m.status === "closed").length;
        const inProgressMonth = months.find((m) => m.status === "in_progress")?.label || null;
        const pendingMonths = months.filter((m) => m.status === "pending").length;
        const oldestPending = months.find((m) => m.status !== "closed")?.label || null;

        setStats({
          totalMonths: months.length,
          closedMonths,
          inProgressMonth,
          pendingMonths,
          months,
          oldestPending,
        });
      } catch (e) {
        console.error("ClosingFlowWidget error:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-blue-600" />
            Pipeline de Fechamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const progressPct = stats.totalMonths > 0 ? Math.round((stats.closedMonths / stats.totalMonths) * 100) : 0;

  // Show last 6 months as pills
  const visibleMonths = stats.months.slice(-6);

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-blue-600" />
            Pipeline de Fechamento Mensal
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => navigate("/fechamento-mensal")}
          >
            Ver Fluxo Completo
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>{stats.closedMonths} de {stats.totalMonths} meses fechados</span>
            <span className="font-semibold text-blue-700">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Month pills (last 6) */}
        <div className="flex items-center gap-1 flex-wrap">
          {visibleMonths.map((m) => (
            <button
              key={m.yyyyMm}
              onClick={() => navigate("/fechamento-mensal")}
              className={cn(
                "text-xs px-2 py-0.5 rounded-full border font-medium transition-all",
                m.status === "closed"
                  ? "bg-green-100 text-green-700 border-green-300"
                  : m.status === "in_progress"
                  ? "bg-amber-100 text-amber-700 border-amber-300 ring-1 ring-amber-400 animate-pulse"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              )}
            >
              {m.status === "closed" && "✓ "}
              {m.status === "in_progress" && "▶ "}
              {m.label}
              {m.pendingTransactions > 0 && m.status !== "closed" && (
                <span className="ml-1 text-orange-500">({m.pendingTransactions})</span>
              )}
            </button>
          ))}
          {stats.totalMonths > 6 && (
            <span className="text-xs text-slate-400">+{stats.totalMonths - 6} mais</span>
          )}
        </div>

        {/* AI Pipeline mini-flow */}
        <div className="bg-white/80 rounded-lg border border-slate-100 p-3">
          <p className="text-xs text-slate-500 mb-2 font-medium">Pipeline AI-First</p>
          <div className="flex items-center gap-1 text-xs overflow-x-auto">
            {/* Context Builder */}
            <div className="flex items-center gap-1 bg-slate-50 rounded px-2 py-1 border border-slate-200 shrink-0">
              <Database className="h-3 w-3 text-slate-600" />
              <span className="text-slate-700 font-medium">Contexto</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
            {/* Dr. Cícero */}
            <div className="flex items-center gap-1 bg-blue-50 rounded px-2 py-1 border border-blue-200 shrink-0">
              <Bot className="h-3 w-3 text-blue-600" />
              <span className="text-blue-700 font-medium">Dr. Cícero</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
            {/* Decision */}
            <div className="flex items-center gap-1 bg-amber-50 rounded px-2 py-1 border border-amber-200 shrink-0">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              <span className="text-amber-700 font-medium">Decisão</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
            {/* Lock */}
            <div className="flex items-center gap-1 bg-green-50 rounded px-2 py-1 border border-green-200 shrink-0">
              <Lock className="h-3 w-3 text-green-600" />
              <span className="text-green-700 font-medium">Fechar Mês</span>
            </div>
          </div>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-green-50 rounded-lg p-2 border border-green-100">
            <p className="text-lg font-bold text-green-700">{stats.closedMonths}</p>
            <p className="text-xs text-green-600">Fechados</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
            <p className="text-lg font-bold text-amber-700">
              {stats.inProgressMonth ? "1" : "0"}
            </p>
            <p className="text-xs text-amber-600">Em andamento</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
            <p className="text-lg font-bold text-slate-700">{stats.pendingMonths}</p>
            <p className="text-xs text-slate-600">Pendentes</p>
          </div>
        </div>

        {stats.oldestPending && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              Próximo a fechar:{" "}
              <strong>{stats.inProgressMonth || stats.oldestPending}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 text-xs text-amber-700 hover:bg-amber-100 px-2"
              onClick={() => navigate("/fechamento-mensal")}
            >
              Iniciar →
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
