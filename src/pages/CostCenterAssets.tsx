import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

const CostCenterAssets = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Centro de Custo Ativo</h1>
          <p className="text-muted-foreground">
            Análise de ativos alocados por centro de custo
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Em Desenvolvimento
            </CardTitle>
            <CardDescription>
              Esta página ainda não possui funcionalidades implementadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                Página disponível para implementação futura
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CostCenterAssets;
