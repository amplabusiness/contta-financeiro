import { useEffect, useState, useCallback } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { formatCurrency } from '@/data/expensesData'
import { Book, TrendingUp, TrendingDown, Search, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchParams } from 'react-router-dom'
import { usePeriod } from '@/contexts/PeriodContext'
import { Badge } from '@/components/ui/badge'

interface ChartAccount {
  id: string
  code: string
  name: string
  account_type: string
  nature: string
  is_analytical: boolean
}

interface LedgerEntry {
  line_id: string | null
  entry_id: string | null
  entry_date: string
  competence_date: string
  entry_number: number
  entry_type: string
  document_number: string | null
  description: string
  history: string | null
  debit: number
  credit: number
  running_balance: number
  source_type: string | null
  is_opening_balance: boolean
}

interface LedgerSummary {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  nature: string
  opening_balance: number
  total_debits: number
  total_credits: number
  closing_balance: number
  entry_count: number
}

const LivroRazao = () => {
  const { selectedYear, selectedMonth } = usePeriod()
  const [accounts, setAccounts] = useState<ChartAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [summary, setSummary] = useState<LedgerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchParams] = useSearchParams()

  // Inicializar datas com base no período selecionado
  useEffect(() => {
    const firstDay = new Date(selectedYear, selectedMonth - 1, 1)
    const lastDay = new Date(selectedYear, selectedMonth, 0)
    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])
  }, [selectedYear, selectedMonth])

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type, nature, is_analytical')
        .eq('is_active', true)
        .eq('is_analytical', true) // Apenas contas analíticas têm movimentação
        .order('code')

      if (error) throw error
      
      setAccounts(data || [])
      
      // Se há um parâmetro de conta na URL, selecionar automaticamente
      const accountParam = searchParams.get('account')
      if (accountParam && data) {
        const account = data.find(a => a.id === accountParam)
        if (account) {
          setSelectedAccount(accountParam)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error)
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  const loadLedger = useCallback(async (accountId: string, start: string, end: string) => {
    if (!accountId || !start || !end) return
    
    try {
      setLoadingLedger(true)
      console.log('[LivroRazao] Buscando razão do banco para conta:', accountId, 'período:', start, 'até', end)

      // Buscar razão detalhado via RPC
      const { data: ledgerData, error: ledgerError } = await supabase.rpc('get_account_ledger', {
        p_account_id: accountId,
        p_period_start: start,
        p_period_end: end
      })

      if (ledgerError) {
        console.error('[LivroRazao] Erro ao buscar razão:', ledgerError)
        throw ledgerError
      }

      // Buscar resumo via RPC
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_account_ledger_summary', {
        p_account_id: accountId,
        p_period_start: start,
        p_period_end: end
      })

      if (summaryError) {
        console.error('[LivroRazao] Erro ao buscar resumo:', summaryError)
        throw summaryError
      }

      console.log('[LivroRazao] Razão carregado:', ledgerData?.length, 'linhas')
      setEntries(ledgerData || [])
      setSummary(summaryData?.[0] || null)
    } catch (error: any) {
      console.error('Erro ao carregar razão:', error)
      setEntries([])
      setSummary(null)
    } finally {
      setLoadingLedger(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    if (selectedAccount && startDate && endDate) {
      loadLedger(selectedAccount, startDate, endDate)
    }
  }, [selectedAccount, startDate, endDate, loadLedger])

  const handleFilter = () => {
    if (selectedAccount && startDate && endDate) {
      loadLedger(selectedAccount, startDate, endDate)
    }
  }

  const selectedAccountData = accounts.find(a => a.id === selectedAccount)

  const formatEntryType = (type: string) => {
    const types: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      'saldo_inicial': { label: 'Saldo Inicial', variant: 'secondary' },
      'saldo_abertura': { label: 'Abertura', variant: 'secondary' },
      'pagamento_despesa': { label: 'Despesa', variant: 'destructive' },
      'receita_honorarios': { label: 'Receita', variant: 'default' },
      'adiantamento_socio': { label: 'Adiantamento', variant: 'outline' },
      'PROVISAO_RECEITA': { label: 'Provisão', variant: 'outline' },
    }
    return types[type] || { label: type, variant: 'outline' as const }
  }

  if (loading && accounts.length === 0) {
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
          <h1 className="text-3xl font-bold tracking-tight">Livro Razão</h1>
          <p className="text-muted-foreground">Movimentação detalhada por conta contábil</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="account">Conta Contábil</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger id="account">
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="endDate">Data Final</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleFilter}><Search className="mr-2 h-4 w-4" />Buscar Movimentação</Button>
            </div>
          </CardContent>
        </Card>

        {selectedAccountData && summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {summary.account_code} - {summary.account_name}
              </CardTitle>
              <CardDescription>
                Natureza: {summary.nature} | Tipo: {summary.account_type}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                  <p className="text-lg font-semibold">{formatCurrency(summary.opening_balance)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Débitos</p>
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(summary.total_debits)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Créditos</p>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(summary.total_credits)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Final</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.closing_balance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />Total Débito
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(summary?.total_debits || 0)}</div></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />Total Crédito
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(summary?.total_credits || 0)}</div></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Book className="h-4 w-4" />Saldo Final
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(Math.abs(summary?.closing_balance || 0))}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Movimentações</CardTitle>
            <CardDescription>
              {summary?.entry_count || 0} movimento(s) no período
              {loadingLedger && ' - Carregando...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedAccount ? (
              <div className="text-center py-8 text-muted-foreground">
                <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma conta contábil</p>
                <p className="text-sm">Use o filtro acima para escolher a conta que deseja visualizar</p>
              </div>
            ) : loadingLedger ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : entries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Nº Lanç.</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Histórico</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, idx) => {
                    const typeInfo = formatEntryType(entry.entry_type)
                    return (
                      <TableRow key={idx} className={entry.is_opening_balance ? 'bg-muted/50' : ''}>
                        <TableCell>
                          {entry.competence_date 
                            ? new Date(entry.competence_date).toLocaleDateString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {entry.entry_number > 0 ? entry.entry_number : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate" title={entry.description || ''}>
                          {entry.description || 'Sem descrição'}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Math.abs(entry.running_balance))}
                          {entry.running_balance !== 0 && (entry.running_balance > 0 ? ' D' : ' C')}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma movimentação encontrada no período selecionado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default LivroRazao
