import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  DollarSign,
  Users
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ParsedBoleto {
  tipo: string;
  numero_boleto: string;
  nosso_numero: string;
  client_name: string;
  data_vencimento: string;
  data_pagamento: string;
  valor_nominal: number;
  valor_pago: number;
  status: string;
  competencia?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function ImportBoletosLiquidados() {
  const [rawText, setRawText] = useState("");
  const [parsedBoletos, setParsedBoletos] = useState<ParsedBoleto[]>([]);
  const [isOpeningBalance, setIsOpeningBalance] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseDate = (dateStr: string): string => {
    // Formato: DD/MM/YYYY -> YYYY-MM-DD
    const parts = dateStr.trim().split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return dateStr;
  };

  const parseAmount = (amountStr: string): number => {
    // Formato: 12.143,72 -> 12143.72
    return parseFloat(
      amountStr
        .replace(/\./g, "")
        .replace(",", ".")
    );
  };

  const calculateCompetence = (vencimento: string): string => {
    // Competência é mês anterior ao vencimento
    const date = new Date(vencimento);
    date.setMonth(date.getMonth() - 1);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${year}`;
  };

  const parseRawText = () => {
    const lines = rawText.trim().split("\n").filter(line => line.trim());
    const boletos: ParsedBoleto[] = [];

    for (const line of lines) {
      // Formato esperado:
      // SIMPLES 0025200008 25/200008-1 ACTION SOLUCOES INDUSTRIAIS LTDA 10/02/2025 10/02/2025 12.143,72 12.143,72 LIQUIDADO COMPE
      // Dividir por tabs ou múltiplos espaços
      const parts = line.split(/\t+|\s{2,}/);

      if (parts.length < 8) {
        // Tentar outro formato
        const regex = /^(\w+)\s+(\d+)\s+([\d/-]+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)\s+([\d.,]+)\s+(.+)$/;
        const match = line.match(regex);

        if (match) {
          const vencimento = parseDate(match[5]);
          boletos.push({
            tipo: match[1],
            numero_boleto: match[2],
            nosso_numero: match[3],
            client_name: match[4].trim(),
            data_vencimento: vencimento,
            data_pagamento: parseDate(match[6]),
            valor_nominal: parseAmount(match[7]),
            valor_pago: parseAmount(match[8]),
            status: match[9].trim(),
            competencia: calculateCompetence(vencimento),
          });
        }
        continue;
      }

      // Parse com tabs
      const tipo = parts[0].trim();
      const numeroBoleto = parts[1].trim();
      const nossoNumero = parts[2].trim();
      const clientName = parts[3].trim();
      const vencimento = parseDate(parts[4].trim());
      const pagamento = parseDate(parts[5].trim());
      const valorNominal = parseAmount(parts[6].trim());
      const valorPago = parseAmount(parts[7].trim());
      const status = parts.slice(8).join(" ").trim();

      boletos.push({
        tipo,
        numero_boleto: numeroBoleto,
        nosso_numero: nossoNumero,
        client_name: clientName,
        data_vencimento: vencimento,
        data_pagamento: pagamento,
        valor_nominal: valorNominal,
        valor_pago: valorPago,
        status,
        competencia: calculateCompetence(vencimento),
      });
    }

    setParsedBoletos(boletos);

    if (boletos.length > 0) {
      toast.success(`${boletos.length} boletos identificados`);
    } else {
      toast.warning("Nenhum boleto identificado. Verifique o formato.");
    }
  };

  const handleImport = async () => {
    if (parsedBoletos.length === 0) {
      toast.error("Nenhum boleto para importar");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Preparar dados para importação
      const boletosJson = parsedBoletos.map(b => ({
        tipo: b.tipo,
        numero_boleto: b.numero_boleto,
        nosso_numero: b.nosso_numero,
        client_name: b.client_name,
        data_vencimento: b.data_vencimento,
        data_pagamento: b.data_pagamento,
        valor_nominal: b.valor_nominal,
        valor_pago: b.valor_pago,
        status: b.status,
        competencia: b.competencia,
      }));

      // Chamar função RPC
      const { data, error } = await supabase.rpc(
        'import_boletos_liquidados' as any,
        {
          p_boletos: boletosJson,
          p_is_opening_balance: isOpeningBalance,
          p_import_batch: `import_${new Date().toISOString().slice(0, 10)}_${Date.now()}`,
        }
      );

      if (error) throw error;

      const resultData = data?.[0] || { imported: 0, skipped: 0, errors: [] };

      setResult({
        imported: resultData.imported || 0,
        skipped: resultData.skipped || 0,
        errors: resultData.errors || [],
      });

      if (resultData.imported > 0) {
        toast.success(`${resultData.imported} boletos importados com sucesso!`);
      }

      if (resultData.skipped > 0) {
        toast.info(`${resultData.skipped} boletos já existentes (ignorados)`);
      }

      if (resultData.errors?.length > 0) {
        toast.warning(`${resultData.errors.length} erros durante importação`);
      }

    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(error.message || "Erro ao importar boletos");
      setResult({
        imported: 0,
        skipped: 0,
        errors: [error.message],
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalValor = parsedBoletos.reduce((sum, b) => sum + b.valor_pago, 0);

  // Agrupar por data de pagamento para mostrar resumo
  const byDate = parsedBoletos.reduce((acc, b) => {
    const date = b.data_pagamento;
    if (!acc[date]) {
      acc[date] = { count: 0, total: 0 };
    }
    acc[date].count++;
    acc[date].total += b.valor_pago;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Boletos Liquidados</h1>
          <p className="text-muted-foreground mt-2">
            Cole a lista de boletos liquidados do relatório bancário para identificar pagamentos individuais
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Entrada de dados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dados dos Boletos
              </CardTitle>
              <CardDescription>
                Cole a lista no formato: TIPO | NÚMERO | NOSSO Nº | CLIENTE | VENCIMENTO | PAGAMENTO | VALOR | STATUS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Cole aqui a lista de boletos do relatório bancário...

Exemplo:
SIMPLES	0025200008	25/200008-1	ACTION SOLUCOES INDUSTRIAIS LTDA	10/02/2025	10/02/2025	12.143,72	12.143,72	LIQUIDADO COMPE"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[300px] font-mono text-xs"
              />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="opening-balance"
                  checked={isOpeningBalance}
                  onCheckedChange={(checked) => setIsOpeningBalance(checked === true)}
                />
                <Label htmlFor="opening-balance" className="text-sm">
                  Marcar como Saldo de Abertura (período inicial do sistema)
                </Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={parseRawText} variant="outline" className="flex-1">
                  Analisar Texto
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading || parsedBoletos.length === 0}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar {parsedBoletos.length} Boletos
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resumo */}
          <div className="space-y-4">
            {parsedBoletos.length > 0 && (
              <>
                {/* Cards de resumo */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-2xl font-bold">{parsedBoletos.length}</p>
                          <p className="text-xs text-muted-foreground">Boletos</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold">{formatCurrency(totalValor)}</p>
                          <p className="text-xs text-muted-foreground">Valor Total</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Resumo por data */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Composição por Data de Pagamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(byDate)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([date, info]) => (
                          <div key={date} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                            <span className="font-medium">
                              {new Date(date).toLocaleDateString("pt-BR")}
                            </span>
                            <div className="flex items-center gap-4">
                              <Badge variant="secondary">{info.count} boletos</Badge>
                              <span className="font-mono">{formatCurrency(info.total)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Resultado da importação */}
            {result && (
              <Card className={result.imported > 0 ? "border-green-500" : "border-yellow-500"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {result.imported > 0 ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Importação Concluída
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        Resultado da Importação
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                      <p className="text-xs text-muted-foreground">Importados</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                      <p className="text-xs text-muted-foreground">Duplicados</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                      <p className="text-xs text-muted-foreground">Erros</p>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <ul className="list-disc list-inside text-sm">
                          {result.errors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {result.errors.length > 5 && (
                            <li>... e mais {result.errors.length - 5} erros</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href="/boletos-composicao">Ver Composição Diária</a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/bank-reconciliation">Reconciliar com Extrato</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Tabela de boletos parseados */}
        {parsedBoletos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Boletos Identificados ({parsedBoletos.length})</CardTitle>
              <CardDescription>
                Verifique os dados antes de importar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Boleto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedBoletos.map((boleto, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">
                          {boleto.numero_boleto}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={boleto.client_name}>
                          {boleto.client_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{boleto.competencia}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(boleto.data_vencimento).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          {new Date(boleto.data_pagamento).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(boleto.valor_pago)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {boleto.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
