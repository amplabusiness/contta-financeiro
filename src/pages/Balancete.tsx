import { useEffect, useState, useCallback } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { formatCurrency } from '@/data/expensesData'
import { Scale, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface BalanceteEntry {
  codigo_conta: string
  nome_conta: string
  tipo_conta: string
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

  const loadBalancete = useCallback(async (start?: string, end?: string) => {
    try {
      setLoading(true)

      // Buscar todas as contas analíticas (não sintéticas)
      const { data: accounts, error: accountsError } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type, is_synthetic')
        .eq('is_active', true)
        .eq('is_synthetic', false)
        .order('code')

      if (accountsError) throw accountsError
      if (!accounts) {
        setEntries([])
        return
      }

      const balanceteData: BalanceteEntry[] = []

      // Para cada conta, buscar lançamentos no período
      for (const account of accounts) {
        let query = supabase
          .from('accounting_entry_lines')
          .select('debit, credit, entry_id!inner(entry_date)')
          .eq('account_id', account.id)

        // Aplicar filtro de data se fornecido
        if (start) {
          query = query.gte('entry_id.entry_date', start)
        }
        if (end) {
          query = query.lte('entry_id.entry_date', end)
        }

        const { data: lines } = await query

        const totalDebito = lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0
        const totalCredito = lines?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0

        // Determinar natureza baseada no tipo da conta
        const isDevedora = ['ATIVO', 'DESPESA'].includes(account.type)
        const saldo = isDevedora
          ? totalDebito - totalCredito
          : totalCredito - totalDebito

        // Se mostrar apenas com movimento, pular contas sem movimento
        if (showOnlyWithMovement && totalDebito === 0 && totalCredito === 0) {
          continue
        }

        balanceteData.push({
          codigo_conta: account.code,
          nome_conta: account.name,
          tipo_conta: account.type,
          total_debito: totalDebito,
          total_credito: totalCredito,
          saldo: saldo
        })
      }

      setEntries(balanceteData)
    } catch (error) {
      console.error('Erro ao carregar balancete:', error)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [showOnlyWithMovement])

  useEffect(() => {
    // Definir datas padrão
    const hoje = new Date()
    const inicioAno = new Date(hoje.getFullYear(), 0, 1)
    
    setStartDate(inicioAno.toISOString().split('T')[0])
    setEndDate(hoje.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      loadBalancete(startDate, endDate)
    }
  }, [startDate, endDate, loadBalancete])

  const handleRefresh = () => {
    loadBalancete(startDate, endDate)
  }

  // Calcular totais
  const totalDebito = entries.reduce((sum, entry) => sum + entry.total_debito, 0)
  const totalCredito = entries.reduce((sum, entry) => sum + entry.total_credito, 0)
  const totalSaldoDevedor = entries.reduce((sum, entry) => sum + (entry.saldo > 0 ? entry.saldo : 0), 0)
  const totalSaldoCredor = entries.reduce((sum, entry) => sum + (entry.saldo < 0 ? Math.abs(entry.saldo) : 0), 0)
  const isBalanced = Math.abs(totalDebito - totalCredito) < 0.01

  // Agrupar por tipo de conta
  const groupedByType = entries.reduce((acc, entry) => {
    if (!acc[entry.tipo_conta]) {
      acc[entry.tipo_conta] = []
    }
    acc[entry.tipo_conta].push(entry)
    return acc
  }, {} as Record<string, BalanceteEntry[]>)

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'ATIVO': 'Ativo',
      'PASSIVO': 'Passivo',
      'PATRIMONIO_LIQUIDO': 'Patrimônio Líquido',
      'RECEITA': 'Receita',
      'DESPESA': 'Despesa'
    }
    return labels[type] || type
  }

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Balancete de Verificação</h1>
            <p className="text-muted-foreground">Demonstração dos saldos de todas as contas contábeis</p>
          </div>
          <Button onClick={handleRefresh}>
            <Scale className="mr-2 h-4 w-4" />
            Atualizar Balancete
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Período</CardTitle>
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
              <div className="flex items-end">
                <Button
                  variant={showOnlyWithMovement ? "default" : "outline"}
                  onClick={() => setShowOnlyWithMovement(!showOnlyWithMovement)}
                  className="w-full"
                >
                  {showOnlyWithMovement ? "Mostrar Todas" : "Apenas com Movimento"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status do Balancete */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isBalanced ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Balancete Fechado
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Balancete Desbalanceado
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isBalanced
                ? "Débitos e créditos estão balanceados"
                : `Diferença: ${formatCurrency(Math.abs(totalDebito - totalCredito))}`}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Débito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalDebito)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Crédito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCredito)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Saldo Devedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSaldoDevedor)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Saldo Credor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSaldoCredor)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela do Balancete */}
        <Card>
          <CardHeader>
            <CardTitle>Balancete por Tipo de Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(groupedByType).map(([type, typeEntries]) => (
                <div key={type} className="space-y-2">
                  <h3 className="text-lg font-semibold text-primary">{getTypeLabel(type)}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome da Conta</TableHead>
                        <TableHead className="text-right">Débito</TableHead>
                        <TableHead className="text-right">Crédito</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typeEntries.map((entry) => (
                        <TableRow key={entry.codigo_conta}>
                          <TableCell className="font-mono">{entry.codigo_conta}</TableCell>
                          <TableCell>{entry.nome_conta}</TableCell>
                          <TableCell className="text-right">
                            {entry.total_debito > 0 ? formatCurrency(entry.total_debito) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.total_credito > 0 ? formatCurrency(entry.total_credito) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.saldo !== 0 && (
                              <Badge variant={entry.saldo > 0 ? "default" : "secondary"}>
                                {formatCurrency(Math.abs(entry.saldo))}
                                {entry.saldo > 0 ? ' D' : ' C'}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Subtotal por tipo */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={2}>Subtotal {getTypeLabel(type)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(typeEntries.reduce((sum, e) => sum + e.total_debito, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(typeEntries.reduce((sum, e) => sum + e.total_credito, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Math.abs(typeEntries.reduce((sum, e) => sum + e.saldo, 0)))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ))}

              {/* Totais Gerais */}
              <Table>
                <TableBody>
                  <TableRow className="bg-primary/10 font-bold text-lg">
                    <TableCell colSpan={2}>TOTAIS GERAIS</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalDebito)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalCredito)}</TableCell>
                    <TableCell className="text-right">
                      {isBalanced ? (
                        <Badge variant="default" className="bg-green-500">
                          Balanceado ✓
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          Dif: {formatCurrency(Math.abs(totalDebito - totalCredito))}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default Balancete
