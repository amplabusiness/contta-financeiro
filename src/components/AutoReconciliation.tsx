import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, Loader2, Eye, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { formatCurrency } from '@/data/expensesData'

interface UnmatchedTransaction {
  id: string
  transaction_date: string
  description: string
  amount: number
  bank_reference?: string
}

interface ReconciliationSuggestion {
  transaction: UnmatchedTransaction
  invoice: unknown
  confidenceScore: number
  matchCriteria: unknown
}

export function AutoReconciliation() {
  const [reconciling, setReconciling] = useState(false)
  const [unmatchedCount, setUnmatchedCount] = useState(0)
  const [unmatchedTransactions, setUnmatchedTransactions] = useState<UnmatchedTransaction[]>([])
  const [suggestions, setSuggestions] = useState<ReconciliationSuggestion[]>([])
  const [showSuggestionsDialog, setShowSuggestionsDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadUnmatchedTransactions()
  }, [])

  const loadUnmatchedTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .gt('amount', 0) // Apenas entradas (créditos)
        .is('invoice_id', null) // Não conciliadas
        .order('transaction_date', { ascending: false })
        .limit(50)

      if (error) throw error

      setUnmatchedTransactions(data || [])
      setUnmatchedCount(data?.length || 0)
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
    }
  }

  const handleAutoReconcile = async () => {
    setReconciling(true)

    try {
      // Chamar Edge Function para conciliação automática
      const { data, error } = await supabase.functions.invoke('auto-reconciliation', {
        body: {
          action: 'reconcile_bank_statement',
          data: {
            startDate: getStartDate(),
            endDate: new Date().toISOString().split('T')[0]
          }
        }
      })

      if (error) throw error

      if (data.success) {
        const result = data.data

        toast({
          title: 'Conciliação automática concluída!',
          description: `${result.matched} transações conciliadas automaticamente`
        })

        // Atualizar lista
        await loadUnmatchedTransactions()

        // Mostrar transações não conciliadas se houver
        if (result.unmatchedTransactions.length > 0) {
          setSuggestions(
            result.unmatchedTransactions
              .filter((item: any) => item.possibleMatches?.length > 0)
              .map((item: any) => ({
                transaction: item.transaction,
                invoice: item.possibleMatches[0].invoice,
                confidenceScore: item.possibleMatches[0].confidenceScore,
                matchCriteria: item.possibleMatches[0].matchCriteria
              }))
          )

          if (result.unmatchedTransactions.length > 0) {
            setShowSuggestionsDialog(true)
          }
        }
      } else {
        throw new Error(data.error || 'Erro na conciliação')
      }
    } catch (error: any) {
      console.error('Erro na conciliação:', error)

      toast({
        title: 'Erro na conciliação automática',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setReconciling(false)
    }
  }

  const handleManualReconcile = async (transactionId: string, invoiceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('auto-reconciliation', {
        body: {
          action: 'manual_reconciliation',
          data: { transactionId, invoiceId }
        }
      })

      if (error) throw error

      if (data.success) {
        toast({
          title: 'Conciliação manual realizada!',
          description: 'Lançamento contábil criado'
        })

        await loadUnmatchedTransactions()
        setSuggestions(prev => prev.filter(s => s.transaction.id !== transactionId))
      }
    } catch (error: any) {
      toast({
        title: 'Erro na conciliação manual',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleViewTransaction = (transaction: UnmatchedTransaction) => {
    setSelectedTransaction(transaction)
  }

  const getStartDate = (): string => {
    const date = new Date()
    date.setMonth(date.getMonth() - 3) // Últimos 3 meses
    return date.toISOString().split('T')[0]
  }

  const getConfidenceBadge = (score: number) => {
    if (score >= 90) {
      return <Badge className="bg-green-500">Alta ({score}%)</Badge>
    } else if (score >= 70) {
      return <Badge className="bg-yellow-500">Média ({score}%)</Badge>
    } else {
      return <Badge variant="secondary">Baixa ({score}%)</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conciliação Automática</CardTitle>
              <CardDescription>
                Identifique automaticamente pagamentos de honorários no extrato bancário
              </CardDescription>
            </div>
            <Button
              onClick={handleAutoReconcile}
              disabled={reconciling || unmatchedCount === 0}
            >
              {reconciling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conciliando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Conciliar Automaticamente
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Transações Pendentes</p>
                  <p className="text-3xl font-bold">{unmatchedCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-500/10">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Total a Conciliar</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(
                      unmatchedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-500/10">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Sugestões Disponíveis</p>
                  <p className="text-3xl font-bold text-green-600">{suggestions.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {unmatchedCount === 0 && (
            <div className="text-center py-8">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
              <p className="text-lg font-medium">Todas as transações estão conciliadas!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Nenhuma transação bancária pendente de conciliação
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {unmatchedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transações Não Conciliadas</CardTitle>
            <CardDescription>
              Entradas bancárias que ainda não foram associadas a honorários
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {new Date(transaction.transaction_date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatCurrency(Math.abs(transaction.amount))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {transaction.bank_reference || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewTransaction(transaction)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Sugestões */}
      <Dialog open={showSuggestionsDialog} onOpenChange={setShowSuggestionsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sugestões de Conciliação</DialogTitle>
            <DialogDescription>
              O sistema encontrou possíveis correspondências para as transações abaixo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <Card key={index} className="border-blue-200">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">Transação Bancária</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(suggestion.transaction.transaction_date).toLocaleDateString('pt-BR')} -{' '}
                          {suggestion.transaction.description}
                        </p>
                        <p className="text-lg font-bold text-green-600 mt-1">
                          {formatCurrency(Math.abs(suggestion.transaction.amount))}
                        </p>
                      </div>
                      {getConfidenceBadge(suggestion.confidenceScore)}
                    </div>

                    <div className="flex items-center gap-2 text-blue-600">
                      <LinkIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">Corresponde a:</span>
                    </div>

                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium">{suggestion.invoice.clients?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Honorário - Competência: {suggestion.invoice.competence}
                      </p>
                      <p className="text-sm font-semibold mt-1">
                        {formatCurrency(Number(suggestion.invoice.amount))}
                      </p>

                      {suggestion.matchCriteria && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {suggestion.matchCriteria.exactAmount && (
                            <Badge variant="secondary" className="text-xs">Valor Exato</Badge>
                          )}
                          {suggestion.matchCriteria.nameInDescription && (
                            <Badge variant="secondary" className="text-xs">Nome no Histórico</Badge>
                          )}
                          {suggestion.matchCriteria.dateProximity && (
                            <Badge variant="secondary" className="text-xs">Data Próxima</Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() =>
                        handleManualReconcile(suggestion.transaction.id, suggestion.invoice.id)
                      }
                    >
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Confirmar Conciliação
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
