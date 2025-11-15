import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { formatCurrency } from '@/data/expensesData'
import { Calendar, FileText, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface DiarioEntry {
  numero_lancamento: number
  data_lancamento: string
  data_competencia: string
  descricao: string
  tipo_lancamento: string
  numero_documento: string
  codigo_conta: string
  nome_conta: string
  debito: number
  credito: number
  historico: string
  cliente_nome: string
}

const LivroDiario = () => {
  const [entries, setEntries] = useState<DiarioEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // Definir datas padrão (mês atual)
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])

    loadDiario(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0])
  }, [])

  const loadDiario = async (start?: string, end?: string) => {
    try {
      setLoading(true)

      // Buscar dados da view
      let query = supabase
        .from('vw_livro_diario')
        .select('*')
        .order('numero_lancamento', { ascending: false })
        .order('codigo_conta', { ascending: true })

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
      console.error('Erro ao carregar diário:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = () => {
    loadDiario(startDate, endDate)
  }

  const handleClearFilter = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])
    setSearchTerm('')

    loadDiario(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0])
  }

  // Agrupar por número de lançamento
  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.numero_lancamento]) {
      acc[entry.numero_lancamento] = []
    }
    acc[entry.numero_lancamento].push(entry)
    return acc
  }, {} as Record<number, DiarioEntry[]>)

  // Filtrar por termo de busca
  const filteredGroups = Object.entries(groupedEntries).filter(([_, items]) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return items.some(
      (entry) =>
        entry.descricao.toLowerCase().includes(searchLower) ||
        entry.nome_conta.toLowerCase().includes(searchLower) ||
        entry.historico?.toLowerCase().includes(searchLower) ||
        entry.cliente_nome?.toLowerCase().includes(searchLower)
    )
  })

  const getTipoLancamentoBadge = (tipo: string) => {
    const tipos: Record<string, { label: string; variant: any }> = {
      PROVISAO_RECEITA: { label: 'Provisão', variant: 'default' as const },
      BAIXA_RECEITA: { label: 'Baixa', variant: 'default' as const },
      DESPESA: { label: 'Despesa', variant: 'destructive' as const },
      PAGAMENTO: { label: 'Pagamento', variant: 'secondary' as const },
      MANUAL: { label: 'Manual', variant: 'outline' as const }
    }

    const config = tipos[tipo] || { label: tipo, variant: 'secondary' as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
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
            <FileText className="h-8 w-8" />
            Livro Diário
          </h1>
          <p className="text-muted-foreground">
            Registro cronológico de todos os lançamentos contábeis
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
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
                <Label>Buscar</Label>
                <Input
                  placeholder="Cliente, conta, histórico..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="invisible">Ações</Label>
                <div className="flex gap-2">
                  <Button onClick={handleFilter}>Filtrar</Button>
                  <Button variant="outline" onClick={handleClearFilter}>
                    Limpar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Total de Lançamentos</p>
                <p className="text-3xl font-bold">{Object.keys(groupedEntries).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Débito</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(entries.reduce((sum, e) => sum + (e.debito || 0), 0))}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/10">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Crédito</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(entries.reduce((sum, e) => sum + (e.credito || 0), 0))}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lançamentos */}
        <div className="space-y-4">
          {filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-lg font-medium">Nenhum lançamento encontrado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não há lançamentos contábeis no período selecionado
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredGroups.map(([numero, items]) => {
              const firstItem = items[0]
              const totalDebito = items.reduce((sum, item) => sum + (item.debito || 0), 0)
              const totalCredito = items.reduce((sum, item) => sum + (item.credito || 0), 0)

              return (
                <Card key={numero} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-lg">Lançamento #{numero}</CardTitle>
                          {getTipoLancamentoBadge(firstItem.tipo_lancamento)}
                        </div>
                        <CardDescription className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>
                              Data: {new Date(firstItem.data_lancamento).toLocaleDateString('pt-BR')}
                            </span>
                            {firstItem.data_competencia !== firstItem.data_lancamento && (
                              <span className="text-xs">
                                (Competência: {new Date(firstItem.data_competencia).toLocaleDateString('pt-BR')})
                              </span>
                            )}
                          </div>
                          <p className="font-medium">{firstItem.descricao}</p>
                          {firstItem.numero_documento && (
                            <p className="text-xs">Doc: {firstItem.numero_documento}</p>
                          )}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Totais</p>
                        <p className="text-sm font-semibold text-green-600">
                          D: {formatCurrency(totalDebito)}
                        </p>
                        <p className="text-sm font-semibold text-blue-600">
                          C: {formatCurrency(totalCredito)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start justify-between p-3 rounded ${
                            item.debito > 0 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-blue-50 dark:bg-blue-900/10'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {item.codigo_conta}
                              </span>
                              <span className="font-medium">{item.nome_conta}</span>
                            </div>
                            {item.historico && (
                              <p className="text-sm text-muted-foreground mt-1">{item.historico}</p>
                            )}
                            {item.cliente_nome && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Cliente: {item.cliente_nome}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {item.debito > 0 ? (
                              <div>
                                <p className="text-xs text-muted-foreground">Débito</p>
                                <p className="text-lg font-bold text-green-600">
                                  {formatCurrency(item.debito)}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-xs text-muted-foreground">Crédito</p>
                                <p className="text-lg font-bold text-blue-600">
                                  {formatCurrency(item.credito)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </Layout>
  )
}

export default LivroDiario
