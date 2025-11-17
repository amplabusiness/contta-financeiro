import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Repeat, Search } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

const ConvertProBonoToBarter = () => {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [foundClient, setFoundClient] = useState<any>(null);
  const [searchName, setSearchName] = useState("ANDRENA CASSIA DE OLIVEIRA");

  const [formData, setFormData] = useState({
    barter_monthly_credit: "1412.00", // 1 salário mínimo
    barter_description: "Serviços de salão de beleza",
    barter_start_date: "2025-01-01"
  });

  const searchClient = async () => {
    if (!searchName.trim()) {
      toast.error("Digite o nome do cliente");
      return;
    }

    try {
      setSearching(true);
      setFoundClient(null);

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .or("is_pro_bono.eq.true,monthly_fee.eq.0")
        .ilike("name", `%${searchName}%`)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error("Cliente não encontrado em Pro-Bono");
        } else {
          throw error;
        }
        return;
      }

      setFoundClient(data);
      toast.success("Cliente encontrado!");

    } catch (error: any) {
      console.error("Erro ao buscar cliente:", error);
      toast.error("Erro ao buscar cliente");
    } finally {
      setSearching(false);
    }
  };

  const convertToBarter = async () => {
    if (!foundClient) {
      toast.error("Busque um cliente primeiro");
      return;
    }

    const monthlyCredit = parseFloat(formData.barter_monthly_credit);
    if (!monthlyCredit || monthlyCredit <= 0) {
      toast.error("Informe o valor do crédito mensal");
      return;
    }

    if (!formData.barter_description) {
      toast.error("Informe a descrição da permuta");
      return;
    }

    if (!formData.barter_start_date) {
      toast.error("Informe a data de início");
      return;
    }

    try {
      setLoading(true);

      // Atualizar cliente
      const { error: updateError } = await supabase
        .from("clients")
        .update({
          // Remover Pro-Bono
          is_pro_bono: false,
          pro_bono_start_date: null,
          pro_bono_end_date: null,
          pro_bono_reason: null,
          monthly_fee: 0, // Permuta não tem honorário em dinheiro
          payment_day: null,

          // Adicionar Permuta
          is_barter: true,
          barter_monthly_credit: monthlyCredit,
          barter_description: formData.barter_description,
          barter_start_date: formData.barter_start_date,

          updated_at: new Date().toISOString()
        })
        .eq("id", foundClient.id);

      if (updateError) throw updateError;

      toast.success(`${foundClient.name} convertido para Permuta com sucesso!`);

      // Limpar formulário
      setFoundClient(null);
      setSearchName("");

    } catch (error: any) {
      console.error("Erro ao converter cliente:", error);
      toast.error("Erro ao converter cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Repeat className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Converter Pro-Bono para Permuta</h1>
            <p className="text-muted-foreground">
              Converta clientes Pro-Bono em clientes de Permuta/Escambo
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Buscar Cliente Pro-Bono</CardTitle>
            <CardDescription>
              Digite o nome do cliente que está em Pro-Bono e deseja converter para Permuta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="search_name">Nome do Cliente</Label>
                <Input
                  id="search_name"
                  placeholder="Ex: ANDRENA CASSIA DE OLIVEIRA"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchClient()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={searchClient} disabled={searching}>
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-2">Buscar</span>
                </Button>
              </div>
            </div>

            {foundClient && (
              <div className="p-4 bg-muted rounded-lg border border-border space-y-2">
                <h3 className="font-medium text-lg">{foundClient.name}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">CNPJ:</span>{" "}
                    {foundClient.cnpj || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    {foundClient.status === 'active' ? 'Ativo' : 'Inativo'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pro-Bono:</span>{" "}
                    {foundClient.is_pro_bono ? 'Sim' : 'Não'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Honorário Atual:</span>{" "}
                    {formatCurrency(foundClient.monthly_fee || 0)}
                  </div>
                  {foundClient.pro_bono_reason && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Motivo Pro-Bono:</span>{" "}
                      {foundClient.pro_bono_reason}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {foundClient && (
          <Card>
            <CardHeader>
              <CardTitle>Configurar Permuta</CardTitle>
              <CardDescription>
                Defina os detalhes do acordo de permuta para {foundClient.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthly_credit">
                    Crédito Mensal <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="monthly_credit"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="1412.00"
                    value={formData.barter_monthly_credit}
                    onChange={(e) =>
                      setFormData({ ...formData, barter_monthly_credit: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Valor mensal de crédito gerado (ex: R$ 1.412,00 = 1 salário mínimo)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">
                    Data de Início <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.barter_start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, barter_start_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Descrição dos Serviços Permutados <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Ex: Serviços de salão de beleza (corte, escova, manicure, pedicure, química)"
                  value={formData.barter_description}
                  onChange={(e) =>
                    setFormData({ ...formData, barter_description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-blue-900">Como funciona a Permuta:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Cliente recebe crédito mensal de {formatCurrency(parseFloat(formData.barter_monthly_credit || "0"))}</li>
                  <li>Créditos podem ser usados para consumir os serviços descritos</li>
                  <li>Saldo não utilizado acumula para o próximo mês</li>
                  <li>Cliente NUNCA recebe dinheiro, apenas créditos</li>
                  <li>Todo consumo é registrado e deduzido do saldo</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFoundClient(null);
                    setSearchName("");
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={convertToBarter} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Convertendo...
                    </>
                  ) : (
                    <>
                      <Repeat className="h-4 w-4 mr-2" />
                      Converter para Permuta
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ConvertProBonoToBarter;
