import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { formatCurrency } from '@/data/expensesData'
import { Calendar, FileText, Filter, Edit2, Trash2, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { AccountingAuditService } from '@/services/AccountingAuditService'

interface DiarioEntry {
  numero_lancamento: string
  data_lancamento: string
  descricao: string
  tipo_lancamento: string
  numero_documento: string
  codigo_conta: string
  nome_conta: string
  debito: number
  credito: number
  historico: string
}

const LivroDiario = () => {
  const [entries, setEntries] = useState<DiarioEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [launchDate, setLaunchDate] = useState('')
  const [filterMode, setFilterMode] = useState<'range' | 'specific'>('range')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<DiarioEntry | null>(null)
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([])
  const [auditHistory, setAuditHistory] = useState<any[]>([])
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedEntryId, setSelectedEntryId] = useState<string>('')

  useEffect(() => {
    // Usar o ano inteiro para mostrar todos os lançamentos por padrão
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), 0, 1) // 1º de Janeiro
    const lastDay = new Date(now.getFullYear(), 11, 31) // 31 de Dezembro

    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])

    loadDiario(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0])
    loadChartOfAccounts()
  }, [])

  const loadChartOfAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type')
        .order('code')

      if (error) throw error
      setChartOfAccounts(data || [])
    } catch (error) {
      console.error('Erro ao carregar plano de contas:', error)
    }
  }

  const loadDiario = async (start?: string, end?: string) => {
    try {
      setLoading(true)

      let query = supabase
        .from('accounting_entries')
        .select(`
          id,
          entry_date,
          description,
          entry_type,
          document_number,
          accounting_entry_lines (
            id,
            debit,
            credit,
            description,
            chart_of_accounts (
              code,
              name
            )
          )
        `)
        .order('entry_date', { ascending: false })

      if (start) query = query.gte('entry_date', start)
      if (end) query = query.lte('entry_date', end)

      const { data, error } = await query
      if (error) throw error

      const diarioEntries: DiarioEntry[] = []
      
      data?.forEach((entry: any) => {
        entry.accounting_entry_lines?.forEach((line: any) => {
          diarioEntries.push({
            numero_lancamento: entry.id,
            data_lancamento: entry.entry_date,
            descricao: entry.description,
            tipo_lancamento: entry.entry_type,
            numero_documento: entry.document_number || '',
            codigo_conta: line.chart_of_accounts?.code || '',
            nome_conta: line.chart_of_accounts?.name || '',
            debito: line.debit || 0,
            credito: line.credit || 0,
            historico: line.description || entry.description
          })
        })
      })

      setEntries(diarioEntries)
    } catch (error) {
      console.error('Erro ao carregar diário:', error)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = () => {
    if (filterMode === 'specific' && launchDate) {
      loadDiario(launchDate, launchDate)
    } else {
      loadDiario(startDate, endDate)
    }
  }

  const handleClearFilter = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])
    setLaunchDate('')
    setSearchTerm('')
    setFilterMode('range')
    loadDiario(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0])
  }

  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.numero_lancamento]) acc[entry.numero_lancamento] = []
    acc[entry.numero_lancamento].push(entry)
    return acc
  }, {} as Record<string, DiarioEntry[]>)

  const filteredGroups = searchTerm
    ? Object.entries(groupedEntries).filter(([_, items]) =>
        items.some(item =>
          item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.nome_conta.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.codigo_conta.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.historico.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : Object.entries(groupedEntries)

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Livro Diário</h1>
          <p className="text-muted-foreground">Registro cronológico de todos os lançamentos contábeis</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={filterMode === 'range' ? 'default' : 'outline'}
                onClick={() => setFilterMode('range')}
                className="flex-1"
              >
                Período
              </Button>
              <Button
                variant={filterMode === 'specific' ? 'default' : 'outline'}
                onClick={() => setFilterMode('specific')}
                className="flex-1"
              >
                Dia Específico
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filterMode === 'range' ? (
                <>
                  <div>
                    <Label htmlFor="startDate">Data Inicial</Label>
                    <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="endDate">Data Final</Label>
                    <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="launchDate">Dia do Lançamento</Label>
                  <Input id="launchDate" type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
                </div>
              )}
              <div>
                <Label htmlFor="search">Buscar por Descrição</Label>
                <Input id="search" placeholder="Conta, descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleFilter} className="flex-1"><Filter className="mr-2 h-4 w-4" />Filtrar</Button>
              <Button onClick={handleClearFilter} variant="outline" className="flex-1">Limpar</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lançamentos Contábeis</CardTitle>
            <CardDescription>{filteredGroups.length} lançamento(s) encontrado(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {filteredGroups.map(([lancamentoId, items]) => {
                const totalDebito = items.reduce((sum, item) => sum + item.debito, 0)
                const totalCredito = items.reduce((sum, item) => sum + item.credito, 0)
                const firstItem = items[0]

                return (
                  <div key={lancamentoId} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between pb-3 border-b">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            <Calendar className="mr-1 h-3 w-3" />
                            {new Date(firstItem.data_lancamento).toLocaleDateString('pt-BR')}
                          </Badge>
                          {firstItem.numero_documento && (
                            <Badge variant="secondary"><FileText className="mr-1 h-3 w-3" />Doc: {firstItem.numero_documento}</Badge>
                          )}
                          <Badge>{firstItem.tipo_lancamento}</Badge>
                        </div>
                        <p className="text-sm font-medium">{firstItem.descricao}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Nº {lancamentoId.substring(0, 8)}</p>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Conta</TableHead>
                          <TableHead>Histórico</TableHead>
                          <TableHead className="text-right">Débito</TableHead>
                          <TableHead className="text-right">Crédito</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{item.codigo_conta}</TableCell>
                            <TableCell>{item.nome_conta}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.historico}</TableCell>
                            <TableCell className="text-right">{item.debito > 0 ? formatCurrency(item.debito) : '-'}</TableCell>
                            <TableCell className="text-right">{item.credito > 0 ? formatCurrency(item.credito) : '-'}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell colSpan={3}>Total do Lançamento</TableCell>
                          <TableCell className="text-right">{formatCurrency(totalDebito)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(totalCredito)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    {Math.abs(totalDebito - totalCredito) > 0.01 && (
                      <div className="flex items-center gap-2 text-destructive text-sm">
                        <FileText className="h-4 w-4" />
                        <span>Atenção: Lançamento desbalanceado!</span>
                      </div>
                    )}
                  </div>
                )
              })}

              {filteredGroups.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum lançamento encontrado no período selecionado.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default LivroDiario
