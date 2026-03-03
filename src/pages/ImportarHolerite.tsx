/**
 * IMPORTAR HOLERITE — Dominio Sistemas → Contta
 *
 * Layout baseado no holerite real do Dominio (folha_pgto/FOLHA AMPLA JAN.pdf).
 * O usuário informa os totais do rodapé de cada holerite:
 *   Total Vencimentos | Total Descontos | Valor Líquido | FGTS do Mês | Sal.Contr.INSS
 *
 * Lançamentos contábeis criados automaticamente:
 *   CC CUSTOS OPERACIONAIS  → D: 4.1.1.01 Salários  | C: 1.1.1.05 Banco
 *   CC DESPESAS ADMINISTRAT → verifica se é babá/pessoal → Adiantamento ou Salário
 *   FGTS → D: 4.1.1.04 FGTS | C: 2.1.2.02 FGTS a Recolher
 */

import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileSpreadsheet, CheckCircle2, Info,
  Loader2, Plus, Trash2, Users, ArrowRight, Calendar,
  AlertTriangle
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

const TENANT_ID = "bd437228-6413-45ac-974b-9833eb25b007";

// Centros de custo conforme holerite Dominio
const CENTROS_CUSTO = [
  { value: "CUSTOS_OPERACIONAIS", label: "CUSTOS OPERACIONAIS", debitCode: "4.1.1.01" },
  { value: "DESPESAS_ADMINISTRAT", label: "DESPESAS ADMINISTRAT", debitCode: "4.1.1.01" },
  { value: "ADIANTAMENTO_SERGIO",  label: "Adiantamento — Sérgio Carneiro", debitCode: "1.1.3.04.01" },
  { value: "ADIANTAMENTO_NAYARA",  label: "Adiantamento — Nayara (Babá)", debitCode: "1.1.3.04.04" },
  { value: "ADIANTAMENTO_AUGUSTO", label: "Adiantamento — Sérgio Augusto", debitCode: "1.1.3.04.05" },
];

interface LinhaHolerite {
  id: string;
  nome: string;
  cargo: string;
  cc: string;                 // centro de custo
  totalVencimentos: number;   // Total de Vencimentos (bruto)
  totalDescontos: number;     // Total de Descontos
  valorLiquido: number;       // Valor Líquido
  fgtsMes: number;            // F.G.T.S. do Mês (rodapé)
  salContrInss: number;       // Sal. Contr. INSS (rodapé) — base INSS
  observacao: string;
}

function novaLinha(): LinhaHolerite {
  return {
    id: crypto.randomUUID(),
    nome: "",
    cargo: "",
    cc: "CUSTOS_OPERACIONAIS",
    totalVencimentos: 0,
    totalDescontos: 0,
    valorLiquido: 0,
    fgtsMes: 0,
    salContrInss: 0,
    observacao: "",
  };
}

export default function ImportarHolerite() {
  const { toast } = useToast();
  const today = new Date();
  const [competencia, setCompetencia] = useState(
    `${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`
  );
  const [linhas, setLinhas] = useState<LinhaHolerite[]>([novaLinha()]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Totais
  const totalVencimentos = linhas.reduce((s, l) => s + (l.totalVencimentos || 0), 0);
  const totalDescontos   = linhas.reduce((s, l) => s + (l.totalDescontos || 0), 0);
  const totalLiquido     = linhas.reduce((s, l) => s + (l.valorLiquido || 0), 0);
  const totalFgts        = linhas.reduce((s, l) => s + (l.fgtsMes || 0), 0);

  // Linhas válidas = tem nome e valor líquido > 0
  const linhasValidas = linhas.filter((l) => l.nome.trim() && l.valorLiquido > 0);
  // Avisos de classificação especial
  const avisos = linhas.filter((l) =>
    l.nome.toLowerCase().includes("bab") ||
    l.cc === "ADIANTAMENTO_NAYARA" ||
    l.cc === "ADIANTAMENTO_AUGUSTO" ||
    l.cc === "ADIANTAMENTO_SERGIO"
  );

  function addLinha() {
    setLinhas((prev) => [...prev, novaLinha()]);
  }

  function removeLinha(id: string) {
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  }

  function update(id: string, field: keyof LinhaHolerite, value: string | number) {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        // Auto-calcular líquido quando bruto ou descontos mudam
        if (field === "totalVencimentos" || field === "totalDescontos") {
          updated.valorLiquido = (updated.totalVencimentos || 0) - (updated.totalDescontos || 0);
        }
        // Auto-calcular FGTS 8% quando bruto muda
        if (field === "totalVencimentos" && !l.fgtsMes) {
          updated.fgtsMes = Math.round(Number(value) * 0.08 * 100) / 100;
        }
        return updated;
      })
    );
  }

  async function handleSalvar() {
    if (linhasValidas.length === 0) {
      toast({ title: "Preencha ao menos um funcionário com líquido > 0", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const [mes, ano] = competencia.split("/");
      // Data de pagamento: dia 30 (2ª parcela) ou 15 (1ª)
      const entryDate = `${ano}-${mes}-28`;

      // Buscar IDs das contas
      const allCodes = [
        "4.1.1.01", "1.1.1.05", "4.1.1.04", "2.1.2.02",
        "1.1.3.04.01", "1.1.3.04.04", "1.1.3.04.05",
      ];
      const { data: chartAccounts } = await supabase
        .from("chart_of_accounts")
        .select("id, code")
        .in("code", allCodes)
        .eq("tenant_id", TENANT_ID);

      const accountMap: Record<string, string> = {};
      (chartAccounts || []).forEach((a: { id: string; code: string }) => {
        accountMap[a.code] = a.id;
      });

      const creditoId = accountMap["1.1.1.05"]; // Banco Sicredi

      // Criar lançamento por funcionário
      for (const l of linhasValidas) {
        const ccInfo = CENTROS_CUSTO.find((c) => c.value === l.cc);
        const debitoCode = ccInfo?.debitCode || "4.1.1.01";
        const debitoId = accountMap[debitoCode];

        if (!debitoId || !creditoId) continue;

        const slug = l.nome.trim().replace(/\s+/g, "_").toLowerCase().slice(0, 30);
        const { data: entry } = await supabase
          .from("accounting_entries")
          .insert({
            tenant_id: TENANT_ID,
            entry_date: entryDate,
            competence_date: entryDate,
            description: `Holerite ${competencia} — ${l.nome}${l.cargo ? ` (${l.cargo})` : ""}`,
            source_type: "payroll",
            internal_code: `holerite_${slug}_${mes}${ano}`,
          })
          .select("id")
          .single();

        if (!entry?.id) continue;

        await supabase.from("accounting_entry_items").insert([
          {
            entry_id: entry.id,
            account_id: debitoId,
            debit: l.valorLiquido,
            credit: 0,
            description: `Salário líquido — ${l.nome}`,
            tenant_id: TENANT_ID,
          },
          {
            entry_id: entry.id,
            account_id: creditoId,
            debit: 0,
            credit: l.valorLiquido,
            description: `Pgto via Banco Sicredi — ${l.nome}`,
            tenant_id: TENANT_ID,
          },
        ]);
      }

      // Lançamento consolidado de FGTS (se houver)
      if (totalFgts > 0 && accountMap["4.1.1.04"] && accountMap["2.1.2.02"]) {
        const { data: fgtsEntry } = await supabase
          .from("accounting_entries")
          .insert({
            tenant_id: TENANT_ID,
            entry_date: entryDate,
            competence_date: entryDate,
            description: `FGTS Patronal — ${competencia}`,
            source_type: "payroll",
            internal_code: `holerite_fgts_${mes}${ano}`,
          })
          .select("id")
          .single();

        if (fgtsEntry?.id) {
          await supabase.from("accounting_entry_items").insert([
            {
              entry_id: fgtsEntry.id,
              account_id: accountMap["4.1.1.04"],
              debit: totalFgts,
              credit: 0,
              description: "FGTS — provisão patronal",
              tenant_id: TENANT_ID,
            },
            {
              entry_id: fgtsEntry.id,
              account_id: accountMap["2.1.2.02"],
              debit: 0,
              credit: totalFgts,
              description: "FGTS a Recolher",
              tenant_id: TENANT_ID,
            },
          ]);
        }
      }

      setSaved(true);
      toast({
        title: `Folha de ${competencia} importada`,
        description: `${linhasValidas.length} funcionários | Líquido total: ${formatCurrency(totalLiquido)}`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao criar lançamentos", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-7 w-7 text-primary" />
              Importar Holerite — Dominio Sistemas
            </h1>
            <p className="text-muted-foreground mt-1">
              Digite os valores do rodapé de cada holerite. O sistema cria os lançamentos contábeis automaticamente.
            </p>
          </div>
          {saved && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 px-3 py-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Lançamentos criados
            </Badge>
          )}
        </div>

        {/* Competência */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-6">
              <div className="space-y-1">
                <Label>Competência (MM/AAAA)</Label>
                <Input
                  value={competencia}
                  onChange={(e) => { setCompetencia(e.target.value); setSaved(false); }}
                  placeholder="01/2025"
                  className="w-32"
                  maxLength={7}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-sm text-blue-800 flex-1">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Informe os valores do <strong>rodapé de cada holerite</strong> do Dominio:
                  Total Vencimentos, Total Descontos, Valor Líquido e FGTS do Mês.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aviso de classificações especiais */}
        {avisos.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <strong>Atenção — Classificação especial:</strong>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                {avisos.map((a) => (
                  <li key={a.id}>
                    {a.nome}: classificado como <strong>{CENTROS_CUSTO.find(c => c.value === a.cc)?.label}</strong>
                    {a.cc.startsWith("ADIANTAMENTO") && " — não vai para despesa operacional"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tabela de holerites */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Funcionários — {linhas.length} na lista
                </CardTitle>
                <CardDescription>
                  Preencha com os valores do rodapé do holerite de cada colaborador.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addLinha}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Cabeçalho da tabela */}
            <div className="hidden xl:grid xl:grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-2 pb-2 border-b">
              <div className="col-span-2">Nome</div>
              <div className="col-span-1">Cargo</div>
              <div className="col-span-2">Centro de Custo</div>
              <div className="text-right">Total Vencim.</div>
              <div className="text-right">Total Descon.</div>
              <div className="text-right font-bold text-foreground">Valor Líquido</div>
              <div className="text-right">FGTS do Mês</div>
              <div className="text-right">Sal.Contr.INSS</div>
              <div className="col-span-2">Obs.</div>
            </div>

            <div className="space-y-2 mt-2">
              {linhas.map((l) => (
                <HoleriteRow
                  key={l.id}
                  linha={l}
                  onChange={(f, v) => update(l.id, f, v)}
                  onRemove={() => removeLinha(l.id)}
                />
              ))}
            </div>

            {/* Totais */}
            <Separator className="my-3" />
            <div className="hidden xl:grid xl:grid-cols-12 gap-2 text-sm font-bold bg-slate-50 rounded-lg px-2 py-2">
              <div className="col-span-2 text-muted-foreground">TOTAIS</div>
              <div className="col-span-1" />
              <div className="col-span-2" />
              <div className="text-right">{formatCurrency(totalVencimentos)}</div>
              <div className="text-right text-red-600">-{formatCurrency(totalDescontos)}</div>
              <div className="text-right text-emerald-700">{formatCurrency(totalLiquido)}</div>
              <div className="text-right text-blue-600">{formatCurrency(totalFgts)}</div>
              <div className="col-span-3" />
            </div>
            {/* Totais mobile */}
            <div className="xl:hidden grid grid-cols-2 gap-3 mt-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Bruto</p>
                <p className="font-bold">{formatCurrency(totalVencimentos)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Líquido</p>
                <p className="font-bold text-emerald-700">{formatCurrency(totalLiquido)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">FGTS Total</p>
                <p className="font-bold text-blue-700">{formatCurrency(totalFgts)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Descontos</p>
                <p className="font-bold text-red-600">-{formatCurrency(totalDescontos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview dos lançamentos */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lançamentos Contábeis a Criar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {linhasValidas.map((l) => {
              const ccInfo = CENTROS_CUSTO.find((c) => c.value === l.cc);
              return (
                <div key={l.id} className="flex items-center gap-2 text-xs bg-white border rounded-lg px-3 py-2">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{l.nome}</p>
                    <div className="flex items-center gap-1 text-slate-600 mt-0.5">
                      <span>D: {ccInfo?.debitCode}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>C: 1.1.1.05 Banco Sicredi</span>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-700 shrink-0">{formatCurrency(l.valorLiquido)}</span>
                </div>
              );
            })}
            {totalFgts > 0 && (
              <div className="flex items-center gap-2 text-xs bg-white border rounded-lg px-3 py-2">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">FGTS Patronal consolidado</p>
                  <div className="flex items-center gap-1 text-slate-600 mt-0.5">
                    <span>D: 4.1.1.04 FGTS</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>C: 2.1.2.02 FGTS a Recolher</span>
                  </div>
                </div>
                <span className="font-bold text-blue-700 shrink-0">{formatCurrency(totalFgts)}</span>
              </div>
            )}

            <Separator />
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm text-muted-foreground">Total a baixar no banco</p>
                <p className="text-3xl font-bold text-emerald-700">{formatCurrency(totalLiquido)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {linhasValidas.length} funcionário{linhasValidas.length !== 1 ? "s" : ""}
                  {totalFgts > 0 && ` + FGTS ${formatCurrency(totalFgts)}`}
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleSalvar}
                disabled={saving || saved || totalLiquido === 0}
                className="gap-2"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                ) : saved ? (
                  <><CheckCircle2 className="h-4 w-4" />Lançamentos Criados</>
                ) : (
                  <><Upload className="h-4 w-4" />Importar Folha de {competencia}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

// ── Linha de holerite ────────────────────────────────────────────

function HoleriteRow({
  linha: l,
  onChange,
  onRemove,
}: {
  linha: LinhaHolerite;
  onChange: (field: keyof LinhaHolerite, val: string | number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-12 gap-2 items-center border rounded-lg p-2 bg-white">
      {/* Nome */}
      <Input
        className="col-span-2 xl:col-span-2 h-8 text-sm font-medium uppercase"
        placeholder="NOME DO FUNCIONÁRIO"
        value={l.nome}
        onChange={(e) => onChange("nome", e.target.value.toUpperCase())}
      />
      {/* Cargo */}
      <Input
        className="col-span-2 xl:col-span-1 h-8 text-xs"
        placeholder="Cargo"
        value={l.cargo}
        onChange={(e) => onChange("cargo", e.target.value)}
      />
      {/* Centro de Custo */}
      <div className="col-span-2 xl:col-span-2">
        <Select value={l.cc} onValueChange={(v) => onChange("cc", v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CENTROS_CUSTO.map((c) => (
              <SelectItem key={c.value} value={c.value} className="text-xs">
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Total Vencimentos */}
      <NumInput value={l.totalVencimentos} onChange={(v) => onChange("totalVencimentos", v)} placeholder="Total Vencim." />
      {/* Total Descontos */}
      <NumInput value={l.totalDescontos} onChange={(v) => onChange("totalDescontos", v)} placeholder="Total Desc." className="text-red-700" />
      {/* Valor Líquido */}
      <div className="h-8 flex items-center justify-end pr-2 text-sm font-bold text-emerald-700 bg-emerald-50 rounded border border-emerald-200">
        {formatCurrency(l.valorLiquido)}
      </div>
      {/* FGTS do Mês */}
      <NumInput value={l.fgtsMes} onChange={(v) => onChange("fgtsMes", v)} placeholder="FGTS" className="text-blue-700" />
      {/* Sal.Contr.INSS */}
      <NumInput value={l.salContrInss} onChange={(v) => onChange("salContrInss", v)} placeholder="Sal.Contr.INSS" />
      {/* Obs + botão */}
      <div className="col-span-2 xl:col-span-2 flex items-center gap-1">
        <Input
          className="h-8 text-xs"
          placeholder="Observação"
          value={l.observacao}
          onChange={(e) => onChange("observacao", e.target.value)}
        />
        <button
          onClick={onRemove}
          className="h-8 w-8 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      className={`h-8 text-sm text-right ${className || ""}`}
      placeholder={placeholder}
      value={value || ""}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}
