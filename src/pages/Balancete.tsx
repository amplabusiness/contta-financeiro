import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { formatCurrency } from '@/data/expensesData'
import { Scale, CheckCircle2, XCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface BalanceteEntry {
  codigo_conta: string
  nome_conta: string
  tipo_conta: string
  natureza: string
  total_debito: number
  total_credito: number
  saldo: number
}

const Balancete = () => {
  const [entries, setEntries] = useState<BalanceteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showOnlyWithMovement, setShowOnlyWithMovement] = useState(true)

  useEffect(() => {
    // Definir datas padrão (mês atual)
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])

    loadBalancete(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0])
  }, [])

  const loadBalancete = async (start?: string, end?: string) => {
    try {
      setLoading(true)

      // Buscar dados da view vw_balancete
      // Como a view não tem filtro de data, vamos buscar os lançamentos no período
      let query = supabase.rpc('get_balancete', {
        data_inicio: start || null,
        data_fim: end || null
      })

      // Se a função RPC não existir, usar a view diretamente
      const { data, error } = await supabase
        .from('vw_balancete')
        .select('*')
        .order('codigo_conta')

      if (error) {
        console.warn('Usando fallback para carregar balancete')
        // Fallback: calcular manualmente
        await loadBalanceteManual(start, end)
        return
      }

      setEntries(data || [])
    } catch (error) {
      console.error('Erro ao carregar balancete:', error)
      // Fallback
      await loadBalanceteManual(start, end)
    } finally {
      setLoading(false)
    }
  }

  const loadBalanceteManual = async (start?: string, end?: string) => {
    try {
      // Buscar todas as contas analíticas
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_analytical', true)
        .eq('is_active', true)
        .order('code')

      if (!accounts) return

      // Para cada conta, calcular débitos e créditos no período
      const balanceteData: BalanceteEntry[] = []

      for (const account of accounts) {
        let query = supabase
          .from('accounting_entry_items')
          .select('debit, credit, entry_id!inner(entry_date, is_draft)')
          .eq('account_id', account.id)
          .eq('entry_id.is_draft', false)

        const { data: items } = await query

        if (!items || items.length === 0) {
          balanceteData.push({
            codigo_conta: account.code,
            nome_conta: account.name,
            tipo_conta: account.account_type,
            natureza: account.nature,
            total_debito: 0,
            total_credito: 0,
            saldo: 0
          })
          continue
        }

        const totalDebito = items.reduce((sum, item) => sum + (item.debit || 0), 0)
        const totalCredito = items.reduce((sum, item) => sum + (item.credit || 0), 0)

        const saldo = account.nature === 'DEVEDORA'
          ? totalDebito - totalCredito
          : totalCredito - totalDebito

        balanceteData.push({
          codigo_conta: account.code,
          nome_conta: account.name,
          tipo_conta: account.account_type,
          natureza: account.nature,
          total_debito: totalDebito,
          total_credito: totalCredito,
          saldo: saldo
        })
      }

      setEntries(balanceteData)
    } catch (error) {
      console.error('Erro no fallback do balancete:', error)
    }
  }

  const handleFilter = () => {
    loadBalancete(startDate, endDate)
  }

  // Filtrar contas sem movimento se necessário
  const filteredEntries = showOnlyWithMovement
    ? entries.filter(e => e.total_debito > 0 || e.total_credito > 0)
    : entries

  // Calcular totais
  const totalDebito = filteredEntries.reduce((sum, e) => sum + e.total_debito, 0)
  const totalCredito = filteredEntries.reduce((sum, e) => sum + e.total_credito, 0)
  const diferenca = Math.abs(totalDebito - totalCredito)
  const isBalanced = diferenca < 0.01 // Tolerância de 1 centavo

  // Agrupar por tipo de conta
  const groupedByType = filteredEntries.reduce((acc, entry) => {
    if (!acc[entry.tipo_conta]) {
      acc[entry.tipo_conta] = []
    }
    acc[entry.tipo_conta].push(entry)
    return acc
  }, {} as Record<string, BalanceteEntry[]>)

  // Calcular saldos por grupo
  const groupTotals = Object.entries(groupedByType).map(([type, items]) => ({
    type,
    totalDebito: items.reduce((sum, item) => sum + item.total_debito, 0),
    totalCredito: items.reduce((sum, item) => sum + item.total_credito, 0),
    saldoDevedor: items.reduce((sum, item) => sum + (item.saldo > 0 ? item.saldo : 0), 0),
    saldoCredor: items.reduce((sum, item) => sum + (item.saldo < 0 ? Math.abs(item.saldo) : 0), 0)
  }))

  const typeLabels: Record<string, string> = {
    ATIVO: 'ATIVO',
    PASSIVO: 'PASSIVO',
    PATRIMONIO_LIQUIDO: 'PATRIMÔNIO LÍQUIDO',
    RECEITA: 'RECEITAS',
    DESPESA: 'DESPESAS'
  }

  if (loading) {
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
            <Scale className="h-8 w-8" />
            Balancete de Verificação
          </h1>
          <p className="text-muted-foreground">
            Demonstração dos saldos de todas as contas contábeis
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="invisible">Ações</Label>
                <Button onClick={handleFilter} className="w-full">
                  Atualizar Balancete
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="invisible">Opções</Label>
                <Button
                  variant="outline"
                  onClick={() => setShowOnlyWithMovement(!showOnlyWithMovement)}
                  className="w-full"
                >
                  {showOnlyWithMovement ? 'Mostrar Todas' : 'Com Movimento'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status de Verificação */}
        <Card className={isBalanced ? 'border-green-500' : 'border-red-500'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isBalanced ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
                <div>
                  <p className="text-lg font-bold">
                    {isBalanced ? 'Balancete Fechado' : 'Balancete Descasado'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isBalanced
                      ? 'Débitos e créditos estão balanceados'
                      : `Diferença: ${formatCurrency(diferenca)}`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total Débito</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalDebito)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total Crédito</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(totalCredito)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo por Grupo */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {groupTotals.map(group => (
            <Card key={group.type}>
              <CardContent className="pt-6">
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2">
                    {typeLabels[group.type] || group.type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    D: {formatCurrency(group.totalDebito)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    C: {formatCurrency(group.totalCredito)}
                  </p>
                  <p className="text-lg font-bold mt-2">
                    {formatCurrency(Math.max(group.saldoDevedor, group.saldoCredor))}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabela Detalhada */}
        {Object.entries(groupedByType).map(([type, items]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{typeLabels[type] || type}</CardTitle>
              <CardDescription>{items.length} conta(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Código</TableHead>
                    <TableHead>Nome da Conta</TableHead>
                    <TableHead className="w-24 text-center">Natureza</TableHead>
                    <TableHead className="w-32 text-right">Débito</TableHead>
                    <TableHead className="w-32 text-right">Crédito</TableHead>
                    <TableHead className="w-32 text-right">Saldo Devedor</TableHead>
                    <TableHead className="w-32 text-right">Saldo Credor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{entry.codigo_conta}</TableCell>
                      <TableCell>{entry.nome_conta}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={entry.natureza === 'DEVEDORA' ? 'default' : 'secondary'}>
                          {entry.natureza.charAt(0)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {entry.total_debito > 0 ? formatCurrency(entry.total_debito) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-blue-600">
                        {entry.total_credito > 0 ? formatCurrency(entry.total_credito) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {entry.saldo > 0 ? formatCurrency(entry.saldo) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {entry.saldo < 0 ? formatCurrency(Math.abs(entry.saldo)) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Subtotal */}
                  <TableRow className="bg-muted font-bold">
                    <TableCell colSpan={3} className="text-right">
                      SUBTOTAL {typeLabels[type]}:
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(items.reduce((s, e) => s + e.total_debito, 0))}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {formatCurrency(items.reduce((s, e) => s + e.total_credito, 0))}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(items.reduce((s, e) => s + (e.saldo > 0 ? e.saldo : 0), 0))}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {formatCurrency(items.reduce((s, e) => s + (e.saldo < 0 ? Math.abs(e.saldo) : 0), 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        {/* Totais Gerais */}
        <Card className="bg-primary/5">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Débito</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalDebito)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Crédito</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalCredito)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Saldo Devedor</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(filteredEntries.reduce((s, e) => s + (e.saldo > 0 ? e.saldo : 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Saldo Credor</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(filteredEntries.reduce((s, e) => s + (e.saldo < 0 ? Math.abs(e.saldo) : 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default Balancete
