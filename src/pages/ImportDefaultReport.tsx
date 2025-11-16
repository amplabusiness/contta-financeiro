import { Layout } from "@/components/Layout";
import { DefaultReportImporter } from "@/components/DefaultReportImporter";

export default function ImportDefaultReport() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Relatório de Inadimplência</h1>
          <p className="text-muted-foreground mt-2">
            Importe planilhas com dados de clientes inadimplentes para atualizar o sistema
          </p>
        </div>
        <DefaultReportImporter />
      </div>
    </Layout>
  );
}
