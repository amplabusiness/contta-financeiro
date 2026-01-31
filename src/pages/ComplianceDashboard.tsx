/**
 * ComplianceDashboard.tsx
 * 
 * Tela de dashboard de compliance e auditoria.
 * Visualização de audit log WORM, decisões Dr. Cícero e educação.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 01/02/2026
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Link2,
  Hash,
  Clock,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Download,
  Eye,
  Lock,
  Unlock,
  Activity,
  BookOpen,
  UserCheck,
  TrendingUp
} from 'lucide-react';
import { useAuditLog, type AuditLogEntry, formatAuditEvent } from '@/hooks/useAuditLog';
import { useEducationRequired } from '@/hooks/useEducationRequired';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

interface DrCiceroDecision {
  id: string;
  decision_type: string;
  entity_type: string;
  entity_id: string;
  decision: string;
  justification?: string;
  decision_hash: string;
  approver_name: string;
  authority_level: string;
  confidence_score: number;
  decided_at: string;
}

// ============================================================================
// COMPONENT: ComplianceDashboard
// ============================================================================

export default function ComplianceDashboard() {
  const { tenant } = useTenantConfig();
  const tenantId = tenant?.id;
  const { 
    getLogs, 
    getRecentLogs,
    verifyChainIntegrity, 
    getStatistics: getAuditStats,
    isLoading: auditLoading 
  } = useAuditLog();
  const { getStatistics: getEduStats } = useEducationRequired();

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [auditLogs, setAuditLogs] = useState<(AuditLogEntry & { chain_valid?: boolean })[]>([]);
  const [drCiceroDecisions, setDrCiceroDecisions] = useState<DrCiceroDecision[]>([]);
  const [chainIntegrity, setChainIntegrity] = useState<{
    is_valid: boolean;
    total_records: number;
    broken_links: number;
    verification_time_ms: number;
  } | null>(null);
  const [auditStats, setAuditStats] = useState<{
    total_records: number;
    total_blocks: number;
    events_by_type: Record<string, number>;
    recent_activity: number;
  } | null>(null);
  const [eduStats, setEduStats] = useState<{
    total_requirements: number;
    total_acknowledged: number;
    pending_critical: number;
    average_read_time: number;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    if (!tenantId) return;

    // Load recent audit logs
    const logs = await getRecentLogs(100);
    setAuditLogs(logs);

    // Load audit stats
    const stats = await getAuditStats();
    setAuditStats(stats);

    // Load education stats
    const eduStatsData = await getEduStats();
    setEduStats(eduStatsData);

    // Load Dr. Cícero decisions
    const { data: decisions } = await supabase
      .from('dr_cicero_decisions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('decided_at', { ascending: false })
      .limit(50);
    
    if (decisions) {
      setDrCiceroDecisions(decisions as DrCiceroDecision[]);
    }
  }, [tenantId, getRecentLogs, getAuditStats, getEduStats]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    const result = await verifyChainIntegrity();
    setChainIntegrity(result);
    setIsVerifying(false);
  };

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user_email && log.user_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      JSON.stringify(log.payload).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = eventFilter === 'all' || log.event_type === eventFilter;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Compliance & Auditoria
          </h1>
          <p className="text-muted-foreground mt-1">
            Trilha de auditoria imutável, decisões do Dr. Cícero e educação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData} disabled={auditLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", auditLoading && "animate-spin")} />
            Atualizar
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Chain Integrity */}
        <Card className={cn(
          "border-2",
          chainIntegrity?.is_valid === true ? "border-green-500" :
          chainIntegrity?.is_valid === false ? "border-red-500" :
          "border-transparent"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Integridade da Cadeia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chainIntegrity ? (
              <div className="flex items-center gap-2">
                {chainIntegrity.is_valid ? (
                  <>
                    <ShieldCheck className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold text-green-600">ÍNTEGRA</p>
                      <p className="text-xs text-muted-foreground">
                        {chainIntegrity.total_records.toLocaleString()} registros verificados
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-8 w-8 text-red-500" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">ALERTA</p>
                      <p className="text-xs text-red-500">
                        {chainIntegrity.broken_links} inconsistências encontradas
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-muted-foreground" />
                <div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleVerifyIntegrity}
                    disabled={isVerifying}
                  >
                    {isVerifying ? 'Verificando...' : 'Verificar Agora'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Records */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Registros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Hash className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {auditStats?.total_records.toLocaleString() || '-'}
                </p>
                <p className="text-xs text-muted-foreground">
                  em {auditStats?.total_blocks || 0} blocos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Atividade (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {auditStats?.recent_activity || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  eventos registrados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Education Compliance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Educação Obrigatória
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BookOpen className={cn(
                "h-8 w-8",
                eduStats?.pending_critical ? "text-red-500" : "text-green-500"
              )} />
              <div>
                <p className="text-2xl font-bold">
                  {eduStats?.total_acknowledged || 0}/{eduStats?.total_requirements || 0}
                </p>
                <p className={cn(
                  "text-xs",
                  eduStats?.pending_critical ? "text-red-500" : "text-muted-foreground"
                )}>
                  {eduStats?.pending_critical 
                    ? `${eduStats.pending_critical} críticos pendentes` 
                    : 'Todos reconhecidos'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="audit-log">Audit Log WORM</TabsTrigger>
          <TabsTrigger value="dr-cicero">Decisões Dr. Cícero</TabsTrigger>
          <TabsTrigger value="education">Educação</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Events by Type */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Eventos por Tipo (30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditStats?.events_by_type && Object.entries(auditStats.events_by_type)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([type, count]) => {
                      const total = Object.values(auditStats.events_by_type).reduce((a, b) => a + b, 0);
                      const percentage = (count / total) * 100;
                      return (
                        <div key={type} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Decisions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Últimas Decisões Dr. Cícero
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {drCiceroDecisions.slice(0, 5).map((decision) => (
                      <div 
                        key={decision.id} 
                        className="p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge variant={
                              decision.decision === 'approved' ? 'default' :
                              decision.decision === 'rejected' ? 'destructive' :
                              'secondary'
                            }>
                              {decision.decision}
                            </Badge>
                            <p className="text-sm font-medium mt-1">
                              {decision.decision_type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {decision.entity_type}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(decision.decided_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </p>
                            <Badge variant="outline" className="mt-1">
                              {decision.confidence_score}% confiança
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          <code className="text-[10px]">
                            {decision.decision_hash.substring(0, 16)}...
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit-log" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Audit Log Imutável (WORM)
                  </CardTitle>
                  <CardDescription>
                    Registros com hash encadeado - blockchain-style
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[200px]"
                    />
                  </div>
                  <Select value={eventFilter} onValueChange={setEventFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os eventos</SelectItem>
                      <SelectItem value="create">Criação</SelectItem>
                      <SelectItem value="update">Alteração</SelectItem>
                      <SelectItem value="delete">Exclusão</SelectItem>
                      <SelectItem value="approve">Aprovação</SelectItem>
                      <SelectItem value="classify">Classificação</SelectItem>
                      <SelectItem value="dr_cicero_decision">Dr. Cícero</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Hash</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const eventInfo = formatAuditEvent(log);
                      return (
                        <TableRow 
                          key={log.id}
                          className={cn(
                            log.chain_valid === false && "bg-red-50 dark:bg-red-900/10"
                          )}
                        >
                          <TableCell>
                            {log.chain_valid === false ? (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{eventInfo.icon}</span>
                              <Badge variant="outline">{eventInfo.label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {log.entity_type || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {log.user_email || 'Sistema'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {log.record_hash.substring(0, 12)}...
                            </code>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dr. Cícero Decisions Tab */}
        <TabsContent value="dr-cicero" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Decisões do Dr. Cícero
              </CardTitle>
              <CardDescription>
                Todas as decisões com assinatura hash verificável
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Decisão</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Autoridade</TableHead>
                      <TableHead>Confiança</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drCiceroDecisions.map((decision) => (
                      <TableRow key={decision.id}>
                        <TableCell>
                          <span className="capitalize text-sm">
                            {decision.decision_type.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            decision.decision === 'approved' ? 'default' :
                            decision.decision === 'rejected' ? 'destructive' :
                            'secondary'
                          }>
                            {decision.decision}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {decision.entity_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {decision.authority_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={decision.confidence_score} className="w-16 h-2" />
                            <span className="text-xs">{decision.confidence_score}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(decision.decided_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {decision.decision_hash.substring(0, 12)}...
                          </code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Education Tab */}
        <TabsContent value="education" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Requisitos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">
                  {eduStats?.total_requirements || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reconhecidos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-green-600">
                  {eduStats?.total_acknowledged || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tempo Médio Leitura</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">
                  {eduStats?.average_read_time || 0}s
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Relatório de Educação
              </CardTitle>
              <CardDescription>
                Requisitos educacionais e acknowledgments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Detalhes de educação serão exibidos aqui quando houver requisitos.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedLog(null)}>
          <Card className="max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detalhes do Registro</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ID</label>
                  <p className="font-mono text-sm">{selectedLog.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sequência</label>
                  <p className="font-mono text-sm">{selectedLog.sequence_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Evento</label>
                  <p>{selectedLog.event_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data/Hora</label>
                  <p>{format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Hash do Registro</label>
                <code className="block bg-muted p-2 rounded text-xs break-all">{selectedLog.record_hash}</code>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Hash Anterior</label>
                <code className="block bg-muted p-2 rounded text-xs break-all">{selectedLog.previous_hash}</code>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Payload</label>
                <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-48">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
