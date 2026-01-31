/**
 * PremiumFeatures.tsx
 * 
 * Página de demonstração das funcionalidades premium do Contta:
 * - Painel de Impacto Contábil
 * - Agente Educador
 * - Data Lake
 * - Hierarquia de Agentes
 * 
 * @author Sistema Contta
 * @date 31/01/2026
 */

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Scale,
  GraduationCap,
  Database,
  Bot,
  Sparkles,
  Info,
  ArrowRight,
  Upload,
  FileText,
  CheckCircle2
} from 'lucide-react';

// Componentes Premium
import { ImpactPreviewPanel } from '@/components/ImpactPreviewPanel';
import { EducatorPanel } from '@/components/EducatorPanel';
import { useDataLake } from '@/hooks/useDataLake';
import { useImpactCalculation, ClassificationInput } from '@/hooks/useImpactCalculation';
import { AGENT_HIERARCHY, ALL_AGENTS } from '@/config/agentHierarchy';
import { MENU_SECTIONS } from '@/config/menuStructure';

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_TRANSACTION = {
  id: 'demo-001',
  amount: 5000,
  date: '2026-01-31',
  description: 'PIX RECEBIDO - CLIENTE EXEMPLO LTDA',
  is_income: true
};

const DEMO_CLASSIFICATION_INPUT: ClassificationInput = {
  transaction_id: 'demo-001',
  amount: 5000,
  is_income: true,
  target_accounts: [
    { account_id: 'demo-receita-001', amount: 5000 }
  ],
  source_type: 'classification'
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PremiumFeatures() {
  const [activeTab, setActiveTab] = useState('impacto');
  const { stats, files, uploadFile, isFileTypeSupported } = useDataLake();
  const [demoInput, setDemoInput] = useState<ClassificationInput | null>(null);

  // Handler para demonstração do painel de impacto
  const handleDemoImpact = () => {
    setDemoInput(DEMO_CLASSIFICATION_INPUT);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-amber-500" />
            Funcionalidades Premium
          </h1>
          <p className="text-muted-foreground mt-1">
            Novos recursos que elevam o Contta ao nível de sistema adulto
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          v2.0.0
        </Badge>
      </div>

      {/* ALERT INFO */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como usar estas funcionalidades</AlertTitle>
        <AlertDescription>
          Estes componentes serão automaticamente integrados na Super Conciliação.
          Esta página permite testar cada um individualmente.
        </AlertDescription>
      </Alert>

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="impacto" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Impacto
          </TabsTrigger>
          <TabsTrigger value="educador" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Educador
          </TabsTrigger>
          <TabsTrigger value="datalake" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Lake
          </TabsTrigger>
          <TabsTrigger value="agentes" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agentes
          </TabsTrigger>
        </TabsList>

        {/* TAB: IMPACTO CONTÁBIL */}
        <TabsContent value="impacto" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Painel de Impacto Contábil
              </CardTitle>
              <CardDescription>
                Visualize as consequências ANTES de confirmar uma classificação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Demo Transaction */}
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-medium mb-2">Transação de Exemplo</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Descrição:</span>
                    <p className="font-mono">{DEMO_TRANSACTION.description}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor:</span>
                    <p className="font-semibold text-green-600">
                      R$ {DEMO_TRANSACTION.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <Button onClick={handleDemoImpact} className="mt-4">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Simular Classificação
                </Button>
              </div>

              <Separator />

              {/* Impact Preview Panel */}
              <ImpactPreviewPanel
                classificationInput={demoInput}
                showEducationalTips={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: AGENTE EDUCADOR */}
        <TabsContent value="educador" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Agente Educador
                </CardTitle>
                <CardDescription>
                  Aprenda o "porquê" das regras contábeis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EducatorPanel showFeedback={true} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Como Funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <span className="text-lg">1️⃣</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Usuário tenta uma ação</h4>
                    <p className="text-sm text-muted-foreground">
                      Ex: Classificar PIX de sócio como receita
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <span className="text-lg">2️⃣</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Sistema bloqueia</h4>
                    <p className="text-sm text-muted-foreground">
                      Dr. Cícero identifica violação de regra
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <span className="text-lg">3️⃣</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Educador explica</h4>
                    <p className="text-sm text-muted-foreground">
                      Mostra o porquê, norma aplicável e exemplo correto
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-green-100">
                    <span className="text-lg">✅</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Usuário aprende</h4>
                    <p className="text-sm text-muted-foreground">
                      Não comete o mesmo erro novamente
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: DATA LAKE */}
        <TabsContent value="datalake" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Estatísticas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total de Arquivos</span>
                  <Badge variant="secondary">{stats?.totalFiles || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tamanho Total</span>
                  <Badge variant="secondary">
                    {stats?.totalSize 
                      ? `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`
                      : '0 MB'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pendentes Indexação</span>
                  <Badge variant={stats?.pendingIndex ? 'destructive' : 'default'}>
                    {stats?.pendingIndex || 0}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  <span className="text-sm font-medium">Por Categoria</span>
                  {stats?.byCategory && Object.entries(stats.byCategory).map(([cat, data]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{cat}</span>
                      <span>{data.count} arquivos</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upload Area */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload de Documentos
                </CardTitle>
                <CardDescription>
                  Arraste arquivos ou clique para enviar ao Data Lake
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Arraste arquivos aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Suportados: PDF, OFX, CSV, XML, Excel, Word
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept=".pdf,.ofx,.csv,.xml,.xlsx,.xls,.doc,.docx,.txt,.json"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (files) {
                        for (const file of Array.from(files)) {
                          const result = await uploadFile(file);
                          if (result.success) {
                            // toast.success removed - would need import
                            console.log('Upload OK:', file.name);
                          }
                        }
                      }
                    }}
                  />
                </div>

                {/* Recent Files */}
                {files.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h4 className="font-medium">Arquivos Recentes</h4>
                    {files.slice(0, 5).map(file => (
                      <div 
                        key={file.id}
                        className="flex items-center justify-between p-2 rounded bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{file.originalName}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {file.category}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Estrutura do Data Lake */}
          <Card>
            <CardHeader>
              <CardTitle>Estrutura de Pastas</CardTitle>
              <CardDescription>
                Organização automática dos documentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { name: 'banco', icon: '🏦', desc: 'Extratos e comprovantes' },
                  { name: 'clientes', icon: '👥', desc: 'Boletos e NFSe' },
                  { name: 'honorarios', icon: '📑', desc: 'Contratos e propostas' },
                  { name: 'fornecedores', icon: '🏢', desc: 'NFe e pagamentos' },
                  { name: 'fiscal', icon: '📋', desc: 'SPED e guias' },
                  { name: 'folha', icon: '💼', desc: 'Holerites e eSocial' },
                  { name: 'auditoria', icon: '🔍', desc: 'Pareceres e logs' },
                  { name: 'relatorios', icon: '📊', desc: 'Balancetes e DRE' },
                  { name: 'ia', icon: '🤖', desc: 'Knowledge base' },
                ].map(folder => (
                  <div 
                    key={folder.name}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-2xl">{folder.icon}</span>
                    <div>
                      <p className="font-medium capitalize">{folder.name}</p>
                      <p className="text-xs text-muted-foreground">{folder.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: AGENTES */}
        <TabsContent value="agentes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Hierarquia de Agentes de IA
              </CardTitle>
              <CardDescription>
                Dr. Cícero coordena todos os agentes especializados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Dr. Cícero */}
              <div className="flex flex-col items-center mb-8">
                <div className="p-6 rounded-xl bg-purple-100 dark:bg-purple-950/30 border-2 border-purple-300">
                  <div className="text-center">
                    <span className="text-4xl">🧠</span>
                    <h3 className="font-bold text-lg mt-2">Dr. Cícero</h3>
                    <p className="text-sm text-muted-foreground">BRAIN / GUARDIÃO</p>
                    <Badge className="mt-2 bg-purple-600">Autoridade Final</Badge>
                  </div>
                </div>
                <div className="w-0.5 h-8 bg-border" />
              </div>

              {/* Sub-agents */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { 
                    id: 'financial', 
                    name: 'Agente Financeiro', 
                    icon: '💰', 
                    color: 'green',
                    desc: 'Caixa, C/R, C/P',
                    tasks: ['Reconciliação', 'Previsão', 'Relatórios']
                  },
                  { 
                    id: 'accounting', 
                    name: 'Agente Contábil', 
                    icon: '📊', 
                    color: 'blue',
                    desc: 'Classificação e Plano de Contas',
                    tasks: ['Classificar', 'Reclassificar', 'Split']
                  },
                  { 
                    id: 'auditor', 
                    name: 'Agente Auditor', 
                    icon: '🔍', 
                    color: 'amber',
                    desc: 'Verificações e Alertas',
                    tasks: ['Banco x Contábil', 'Transitórias', 'DRE']
                  },
                  { 
                    id: 'educator', 
                    name: 'Agente Educador', 
                    icon: '🎓', 
                    color: 'pink',
                    desc: 'Ensino e Feedback',
                    tasks: ['Explica erro', 'Mostra impacto', 'Treina']
                  },
                ].map(agent => (
                  <div 
                    key={agent.id}
                    className={`p-4 rounded-lg border-2 border-${agent.color}-200 bg-${agent.color}-50 dark:bg-${agent.color}-950/20`}
                  >
                    <div className="text-center mb-3">
                      <span className="text-3xl">{agent.icon}</span>
                      <h4 className="font-semibold mt-1">{agent.name}</h4>
                      <p className="text-xs text-muted-foreground">{agent.desc}</p>
                    </div>
                    <Separator className="my-2" />
                    <ul className="space-y-1">
                      {agent.tasks.map(task => (
                        <li key={task} className="text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Nova Estrutura de Menus */}
          <Card>
            <CardHeader>
              <CardTitle>Nova Estrutura de Menus</CardTitle>
              <CardDescription>
                Organização focada em resolver problemas, não em módulos técnicos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {MENU_SECTIONS.slice(0, 8).map(section => (
                  <div 
                    key={section.id}
                    className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <h4 className="font-semibold flex items-center gap-2">
                      <section.icon className="h-4 w-4" />
                      {section.title}
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {section.items.slice(0, 4).map(item => (
                        <li key={item.id} className="text-xs text-muted-foreground flex items-center gap-1">
                          <item.icon className="h-3 w-3" />
                          {item.label}
                          {item.isNew && (
                            <Badge variant="secondary" className="text-[10px] px-1">NEW</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
