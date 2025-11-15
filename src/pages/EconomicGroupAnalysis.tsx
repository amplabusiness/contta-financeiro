import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, AlertTriangle, TrendingDown, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EconomicGroupAnalysis = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
    toast({
      title: "Funcionalidade em Desenvolvimento",
      description: "A análise de grupos econômicos será implementada em breve.",
      variant: "default",
    });
  }, [toast]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise de Grupos Econômicos</h1>
          <p className="text-muted-foreground">Identificação e análise de grupos empresariais relacionados</p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Em Desenvolvimento</AlertTitle>
          <AlertDescription>
            Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
            <br />
            <br />
            <strong>Funcionalidades Planejadas:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Identificação automática de grupos econômicos através de sócios em comum</li>
              <li>Análise de concentração de receita por grupo</li>
              <li>Detecção de riscos de dependência econômica</li>
              <li>Mapeamento de relacionamentos entre empresas</li>
              <li>Dashboard visual de grupos empresariais</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Grupos Identificados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empresas Vinculadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Concentração de Risco
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A análise de grupos econômicos identifica relacionamentos entre empresas através de:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline">1</Badge>
                <div>
                  <p className="font-medium">Sócios em Comum</p>
                  <p className="text-sm text-muted-foreground">
                    Empresas que compartilham os mesmos sócios/administradores
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline">2</Badge>
                <div>
                  <p className="font-medium">Análise de Receita</p>
                  <p className="text-sm text-muted-foreground">
                    Consolidação de receita por grupo econômico
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline">3</Badge>
                <div>
                  <p className="font-medium">Detecção de Riscos</p>
                  <p className="text-sm text-muted-foreground">
                    Identificação de concentração de receita em poucos grupos
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EconomicGroupAnalysis;
