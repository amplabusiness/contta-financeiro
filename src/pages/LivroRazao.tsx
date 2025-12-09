import { useEffect, useState, useCallback } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { formatCurrency } from '@/data/expensesData'
import { Book, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchParams } from 'react-router-dom'

interface ChartAccount {
  id: string
  code: string
  name: string
  type: string
  is_synthetic: boolean
}

interface RazaoEntry {
  data_lancamento: string
  numero_lancamento: string
  descricao: string
  debito: number
  credito: number
  saldo: number
}

const LivroRazao = () => {
  const [accounts, setAccounts] = useState<ChartAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [entries, setEntries] = useState<RazaoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchParams] = useSearchParams()

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
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

  const loadRazao = useCallback(async (accountId: string, start?: string, end?: string) => {
    try {
      setLoading(true)

      const account = accounts.find(a => a.id === accountId)
      if (!account) {
        setEntries([])
        return
      }

      // Determinar quais contas buscar
      let accountIds: string[] = []
      if (account.is_synthetic) {
        // Para contas sintéticas, buscar todas as contas filhas analíticas
        const childAccounts = accounts.filter(a => 
          a.code.startsWith(account.code + '.') && !a.is_synthetic
        )
        accountIds = childAccounts.map(a => a.id)
        
        // Se não houver contas filhas, usar a própria conta
        if (accountIds.length === 0) {
          accountIds = [accountId]
        }
      } else {
        // Para contas analíticas, usar apenas ela
        accountIds = [accountId]
      }

      // Calcular saldo inicial
      let saldoInicial = 0
      if (start && accountIds.length > 0) {
        const { data: saldoData, error: saldoError } = await supabase
          .from('accounting_entry_lines')
          .select('debit, credit, entry_id(entry_date)')
          .in('account_id', accountIds)

        if (saldoError) throw saldoError

        if (saldoData) {
          // Filtrar apenas lançamentos anterior à data inicial
          const saldoFiltrado = saldoData.filter((line: any) => {
            return line.entry_id && line.entry_id.entry_date < start
          })

          const totalDebito = saldoFiltrado.reduce((sum, line) => sum + (line.debit || 0), 0)
          const totalCredito = saldoFiltrado.reduce((sum, line) => sum + (line.credit || 0), 0)
          // Determinar natureza pelo CÓDIGO: 1=Ativo(devedora), 2=Passivo(credora), 3=Receita(credora), 4=Despesa(devedora)
          const primeiroDigito = account.code.charAt(0)
          const isDevedora = ['1', '4'].includes(primeiroDigito)
          saldoInicial = isDevedora ? totalDebito - totalCredito : totalCredito - totalDebito
        }
      }

      // Buscar lançamentos do período
      let query = supabase
        .from('accounting_entry_lines')
        .select(`
          debit,
          credit,
          description,
          account_id,
          entry_id(id, entry_date, description)
        `)
        .in('account_id', accountIds)
        .order('entry_id(entry_date)', { ascending: true })

      if (start) query = query.gte('entry_id.entry_date', start)
      if (end) query = query.lte('entry_id.entry_date', end)

      const { data, error } = await query
      if (error) {
        console.error('Erro na query Supabase:', error)
        throw new Error(`Erro ao carregar lançamentos: ${error.message}`)
      }

      if (!data) {
        setEntries([])
        return
      }

      // Determinar natureza pelo CÓDIGO: 1=Ativo(devedora), 2=Passivo(credora), 3=Receita(credora), 4=Despesa(devedora)
      const primeiroDigito = account.code.charAt(0)
      const isDevedora = ['1', '4'].includes(primeiroDigito)

      let saldoAcumulado = saldoInicial
      const razaoEntries: RazaoEntry[] = []

      if (Math.abs(saldoInicial) > 0.01) {
        razaoEntries.push({
          data_lancamento: start || '',
          numero_lancamento: '-',
          descricao: 'Saldo Inicial',
          debito: 0,
          credito: 0,
          saldo: saldoInicial
        })
      }

      data.forEach((line: any) => {
        if (!line.entry_id) {
          console.warn('Linha sem entry_id associado:', line)
          return
        }

        const debito = line.debit || 0
        const credito = line.credit || 0
        saldoAcumulado += isDevedora ? debito - credito : credito - debito

        // Se for conta sintética, incluir o código da conta filha na descrição
        let descricao = line.description || line.entry_id.description || 'Sem descrição'
        if (account.is_synthetic) {
          const childAccount = accounts.find(a => a.id === line.account_id)
          if (childAccount) {
            descricao = `[${childAccount.code}] ${descricao}`
          }
        }

        razaoEntries.push({
          data_lancamento: line.entry_id.entry_date,
          numero_lancamento: line.entry_id.id.substring(0, 8),
          descricao,
          debito,
          credito,
          saldo: saldoAcumulado
        })
      })

      setEntries(razaoEntries)
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Erro desconhecido ao carregar razão'
      console.error('Erro ao carregar razão:', errorMessage)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [accounts])

  useEffect(() => {
    loadAccounts()
    // Usar o ano inteiro por padrão
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), 0, 1) // 1º de Janeiro
    const lastDay = new Date(now.getFullYear(), 11, 31) // 31 de Dezembro
    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])
  }, [loadAccounts])

  useEffect(() => {
    if (selectedAccount) loadRazao(selectedAccount, startDate, endDate)
  }, [selectedAccount, startDate, endDate, loadRazao])

  const handleFilter = () => {
    if (selectedAccount) loadRazao(selectedAccount, startDate, endDate)
  }

  const selectedAccountData = accounts.find(a => a.id === selectedAccount)
  const totalDebito = entries.reduce((sum, entry) => sum + entry.debito, 0)
  const totalCredito = entries.reduce((sum, entry) => sum + entry.credito, 0)
  const saldoFinal = entries.length > 0 ? entries[entries.length - 1].saldo : 0

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
                        {account.is_synthetic && ' (Sintética)'}
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

        {selectedAccountData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Conta Selecionada
                {selectedAccountData.is_synthetic && (
                  <span className="text-sm font-normal text-muted-foreground">
                    (Consolidado de contas filhas)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Código</p>
                  <p className="text-lg font-mono font-semibold">{selectedAccountData.code}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="text-lg font-semibold">{selectedAccountData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="text-lg font-semibold">{selectedAccountData.type}</p>
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
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalDebito)}</div></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />Total Crédito
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalCredito)}</div></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Book className="h-4 w-4" />Saldo Final
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(Math.abs(saldoFinal))}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Movimentações</CardTitle>
            <CardDescription>{entries.length} movimento(s) no período</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedAccount ? (
              <div className="text-center py-8 text-muted-foreground">
                <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma conta contábil</p>
                <p className="text-sm">Use o filtro acima para escolher a conta que deseja visualizar</p>
              </div>
            ) : entries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Nº Lanç.</TableHead>
                    <TableHead>Histórico</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {entry.numero_lancamento !== '-'
                          ? new Date(entry.data_lancamento).toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{entry.numero_lancamento}</TableCell>
                      <TableCell>{entry.descricao}</TableCell>
                      <TableCell className="text-right">{entry.debito > 0 ? formatCurrency(entry.debito) : '-'}</TableCell>
                      <TableCell className="text-right">{entry.credito > 0 ? formatCurrency(entry.credito) : '-'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Math.abs(entry.saldo))}
                        {entry.saldo !== 0 && (entry.saldo > 0 ? ' D' : ' C')}
                      </TableCell>
                    </TableRow>
                  ))}
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
