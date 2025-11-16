import { Layout } from "@/components/Layout";
import { BoletoReportImporter } from "@/components/BoletoReportImporter";

export default function ImportBoletoReport() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Relatório de Boletos</h1>
          <p className="text-muted-foreground mt-2">
            Importe relatórios de boletos de honorários para popular o banco de dados com clientes, faturas e lançamentos contábeis
          </p>
        </div>
        <BoletoReportImporter />
      </div>
    </Layout>
  );
}
