import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { formatCurrency } from '@/data/expensesData'
import { Book, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface ChartAccount {
  id: string
  code: string
  name: string
  nature: string
  account_type: string
}

interface RazaoEntry {
  account_id: string
  codigo_conta: string
  nome_conta: string
  natureza: string
  data_lancamento: string
  numero_lancamento: number
  descricao: string
  debito: number
  credito: number
  historico: string
  cliente_nome: string
}

const LivroRazao = () => {
  const [accounts, setAccounts] = useState<ChartAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [entries, setEntries] = useState<RazaoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadAccounts()

    // Definir datas padrão (mês atual)
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (selectedAccount) {
      loadRazao(selectedAccount, startDate, endDate)
    }
  }, [selectedAccount])

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_analytical', true)
        .eq('is_active', true)
        .order('code')

      if (error) throw error

      setAccounts(data || [])

      // Selecionar primeira conta por padrão
      if (data && data.length > 0) {
        setSelectedAccount(data[0].id)
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRazao = async (accountId: string, start?: string, end?: string) => {
    try {
      setLoading(true)

      let query = supabase
        .from('vw_livro_razao')
        .select('*')
        .eq('account_id', accountId)
        .order('data_lancamento', { ascending: true })
        .order('numero_lancamento', { ascending: true })

      if (start) {
        query = query.gte('data_lancamento', start)
      }
      if (end) {
        query = query.lte('data_lancamento', end)
      }

      const { data, error } = await query

      if (error) throw error

      setEntries(data || [])
    } catch (error) {
      console.error('Erro ao carregar razão:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = () => {
    if (selectedAccount) {
      loadRazao(selectedAccount, startDate, endDate)
    }
  }

  // Calcular saldos
  const calculateBalance = (entries: RazaoEntry[], upToIndex: number) => {
    const account = accounts.find(a => a.id === selectedAccount)
    if (!account) return 0

    let balance = 0
    for (let i = 0; i <= upToIndex; i++) {
      const entry = entries[i]
      if (account.nature === 'DEVEDORA') {
        balance += entry.debito - entry.credito
      } else {
        balance += entry.credito - entry.debito
      }
    }

    return balance
  }

  const selectedAccountData = accounts.find(a => a.id === selectedAccount)

  // Filtrar por termo de busca
  const filteredEntries = entries.filter(entry => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      entry.descricao.toLowerCase().includes(searchLower) ||
      entry.historico?.toLowerCase().includes(searchLower) ||
      entry.cliente_nome?.toLowerCase().includes(searchLower)
    )
  })

  // Totais
  const totalDebito = filteredEntries.reduce((sum, e) => sum + (e.debito || 0), 0)
  const totalCredito = filteredEntries.reduce((sum, e) => sum + (e.credito || 0), 0)
  const saldoFinal = selectedAccountData?.nature === 'DEVEDORA'
    ? totalDebito - totalCredito
    : totalCredito - totalDebito

  if (loading && accounts.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Book className="h-8 w-8" />
            Livro Razão
          </h1>
          <p className="text-muted-foreground">
            Movimentação detalhada por conta contábil
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Conta Contábil</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onBlur={handleFilterChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onBlur={handleFilterChange}
                />
              </div>
            </div>
            <div className="mt-4">
              <Label>Buscar no Histórico</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição, histórico ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações da Conta */}
        {selectedAccountData && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Código</p>
                  <p className="text-lg font-bold font-mono">{selectedAccountData.code}</p>
                  <p className="text-sm mt-1">{selectedAccountData.name}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10">
              <CardContent className="pt-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Total Débito
                  </p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalDebito)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10">
              <CardContent className="pt-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Total Crédito
                  </p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(totalCredito)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className={saldoFinal >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}>
              <CardContent className="pt-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Saldo Final</p>
                  <p className={`text-xl font-bold ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(saldoFinal))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedAccountData.nature === 'DEVEDORA' ? 'Devedor' : 'Credor'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Movimentações */}
        <Card>
          <CardHeader>
            <CardTitle>Movimentações</CardTitle>
            <CardDescription>
              {filteredEntries.length} lançamento(s) no período
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <Book className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-lg font-medium">Nenhuma movimentação encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Não há lançamentos para esta conta no período selecionado
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Data</TableHead>
                      <TableHead className="w-20">Nº Lanç.</TableHead>
                      <TableHead>Descrição / Histórico</TableHead>
                      <TableHead className="text-right w-32">Débito</TableHead>
                      <TableHead className="text-right w-32">Crédito</TableHead>
                      <TableHead className="text-right w-32">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry, index) => {
                      const balance = calculateBalance(filteredEntries, index)

                      return (
                        <TableRow key={index} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">
                            {new Date(entry.data_lancamento).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            #{entry.numero_lancamento}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{entry.descricao}</p>
                              {entry.historico && (
                                <p className="text-xs text-muted-foreground">{entry.historico}</p>
                              )}
                              {entry.cliente_nome && (
                                <p className="text-xs text-blue-600 mt-0.5">
                                  Cliente: {entry.cliente_nome}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {entry.debito > 0 ? (
                              <span className="text-green-600">{formatCurrency(entry.debito)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {entry.credito > 0 ? (
                              <span className="text-blue-600">{formatCurrency(entry.credito)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(Math.abs(balance))}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {/* Linha de totais */}
                    <TableRow className="bg-muted font-bold">
                      <TableCell colSpan={3} className="text-right">
                        TOTAIS:
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(totalDebito)}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {formatCurrency(totalCredito)}
                      </TableCell>
                      <TableCell className={`text-right ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(saldoFinal))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default LivroRazao
