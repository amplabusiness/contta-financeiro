import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { formatCurrency } from '@/data/expensesData'
import { BookOpen, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

interface AccountSummary {
  id: string
  codigo: string
  nome: string
  tipo: string
  is_synthetic: boolean
  total_debito: number
  total_credito: number
  saldo: number
  movimentacoes: number
}

const GeneralLedgerAll = () => {
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  const loadAllAccounts = async (start?: string, end?: string) => {
    try {
      setLoading(true)

      // Buscar todas as contas ativas
      const { data: allAccounts, error: accountsError } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type, is_synthetic')
        .eq('is_active', true)
        .order('code')

      if (accountsError) throw accountsError
      if (!allAccounts || allAccounts.length === 0) {
        setAccounts([])
        return
      }

      // Buscar todos os lançamentos de uma vez
      let linesQuery = supabase
        .from('accounting_entry_lines')
        .select(`
          debit, 
          credit, 
          account_id,
          entry_id!inner(entry_date)
        `)

      if (start) {
        linesQuery = linesQuery.gte('entry_id.entry_date', start)
      }
      if (end) {
        linesQuery = linesQuery.lte('entry_id.entry_date', end)
      }

      const { data: allLines, error: linesError } = await linesQuery

      if (linesError) throw linesError

      // Criar mapa de totais por conta
      const accountTotals = new Map<string, { debit: number; credit: number; count: number }>()

      allLines?.forEach(line => {
        const current = accountTotals.get(line.account_id) || { debit: 0, credit: 0, count: 0 }
        current.debit += line.debit || 0
        current.credit += line.credit || 0
        current.count += 1
        accountTotals.set(line.account_id, current)
      })

      // Processar todas as contas
      const summaries: AccountSummary[] = []

      for (const account of allAccounts) {
        let totalDebito = 0
        let totalCredito = 0
        let movimentacoes = 0

        if (account.is_synthetic) {
          // Para contas sintéticas, somar os valores das contas filhas
          const childAccounts = allAccounts.filter(a => 
            a.code.startsWith(account.code + '.') && !a.is_synthetic
          )
          
          childAccounts.forEach(child => {
            const childTotals = accountTotals.get(child.id)
            if (childTotals) {
              totalDebito += childTotals.debit
              totalCredito += childTotals.credit
              movimentacoes += childTotals.count
            }
          })
        } else {
          // Para contas analíticas, usar os valores diretos
          const accountTotal = accountTotals.get(account.id)
          if (accountTotal) {
            totalDebito = accountTotal.debit
            totalCredito = accountTotal.credit
            movimentacoes = accountTotal.count
          }
        }

        // Determinar natureza baseada no tipo da conta
        const tipo = account.type.toUpperCase()
        const isDevedora = ['ATIVO', 'DESPESA'].includes(tipo)
        const saldo = isDevedora
          ? totalDebito - totalCredito
          : totalCredito - totalDebito

        summaries.push({
          id: account.id,
          codigo: account.code,
          nome: account.name,
          tipo: account.type,
          is_synthetic: account.is_synthetic,
          total_debito: totalDebito,
          total_credito: totalCredito,
          saldo: saldo,
          movimentacoes: movimentacoes
        })
      }

      setAccounts(summaries)
    } catch (error) {
      console.error('Erro ao carregar razão geral:', error)
      toast.error('Erro ao carregar dados')
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Definir datas padrão
    const hoje = new Date()
    const inicioAno = new Date(hoje.getFullYear(), 0, 1)
    
    setStartDate(inicioAno.toISOString().split('T')[0])
    setEndDate(hoje.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      loadAllAccounts(startDate, endDate)
    }
  }, [startDate, endDate])

  const handleRefresh = () => {
    loadAllAccounts(startDate, endDate)
  }

  const filteredAccounts = accounts.filter(acc => 
    acc.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.nome.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getAccountTypeColor = (type: string) => {
    const typeUpper = type.toUpperCase()
    switch (typeUpper) {
      case 'ATIVO': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
      case 'PASSIVO': return 'bg-red-500/10 text-red-700 dark:text-red-400'
      case 'RECEITA': return 'bg-green-500/10 text-green-700 dark:text-green-400'
      case 'DESPESA': return 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
      case 'PATRIMÔNIO LÍQUIDO': 
      case 'PATRIMONIO': 
      case 'PATRIMONIO LIQUIDO': 
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400'
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
    }
  }

  const getRowStyle = (codigo: string, isSynthetic: boolean) => {
    const level = codigo.split('.').length
    
    if (isSynthetic) {
      return level === 1 
        ? 'font-bold text-base bg-primary/5' 
        : 'font-semibold bg-muted/50'
    }
    
    return 'hover:bg-muted/50 cursor-pointer'
  }

  const handleAccountClick = (account: AccountSummary) => {
    if (!account.is_synthetic && account.movimentacoes > 0) {
      // Redirecionar para o Livro Razão individual com esta conta selecionada
      navigate(`/livro-razao?account=${account.id}`)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-8 w-8" />
              Razão Geral - Todas as Contas
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão consolidada de todas as contas contábeis do período
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={loading}>
            <ChevronRight className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Defina o período e pesquise contas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="search">Pesquisar Conta</Label>
                <Input
                  id="search"
                  placeholder="Código ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contas Contábeis</CardTitle>
            <CardDescription>
              {filteredAccounts.length} contas encontradas
              {searchTerm && ` (filtrado de ${accounts.length} contas)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma conta encontrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead className="w-[120px]">Tipo</TableHead>
                      <TableHead className="text-right w-[80px]">Mov.</TableHead>
                      <TableHead className="text-right w-[140px]">Débito</TableHead>
                      <TableHead className="text-right w-[140px]">Crédito</TableHead>
                      <TableHead className="text-right w-[140px]">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account) => (
                      <TableRow
                        key={account.id}
                        className={getRowStyle(account.codigo, account.is_synthetic)}
                        onClick={() => handleAccountClick(account)}
                      >
                        <TableCell className="font-mono">
                          {account.codigo}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {account.nome}
                            {account.is_synthetic && (
                              <Badge variant="outline" className="text-xs">
                                Sintética
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={getAccountTypeColor(account.tipo)}>
                            {account.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {account.movimentacoes > 0 ? account.movimentacoes : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {account.total_debito > 0 ? formatCurrency(account.total_debito) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {account.total_credito > 0 ? formatCurrency(account.total_credito) : '-'}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${
                          account.saldo > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : account.saldo < 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : ''
                        }`}>
                          {account.saldo !== 0 ? formatCurrency(Math.abs(account.saldo)) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
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

export default GeneralLedgerAll
