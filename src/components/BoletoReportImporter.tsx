import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'

interface BoletoData {
  cart: string;
  numeroDoc: string;
  nossoNumero: string;
  pagador: string;
  dataVencimento: string;
  dataLiquidacao: string | null;
  valor: number;
  valorLiquidacao: number;
  situacao: string;
}

interface ProcessingResult {
  total: number
  provisioned: number
  settled: number
  errors: string[]
  entriesCreated: number
}

export function BoletoReportImporter() {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const { toast } = useToast()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return

      const file = acceptedFiles[0]
      await handleFileImport(file)
    }
  })

  const handleFileImport = async (file: File) => {
    setImporting(true)
    setProgress(0)
    setResult(null)
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const content = await file.text()

      // Parse CSV
      const boletos = parseCSV(content)

      if (boletos.length === 0) {
        throw new Error('Nenhum boleto encontrado no arquivo')
      }

      console.log(`Enviando ${boletos.length} boletos para processamento...`)

      // Chamar Edge Function para processar
      const { data, error } = await supabase.functions.invoke('process-boleto-report', {
        body: {
          boletos,
          fileName: file.name
        }
      })

      if (error) throw error

      clearInterval(progressInterval);
      setProgress(100);

      if (data.success) {
        setResult(data.data)

        toast({
          title: 'Relatório processado com sucesso!',
          description: `${data.data.entriesCreated} lançamentos contábeis criados`
        })
      } else {
        throw new Error(data.error || 'Erro ao processar relatório')
      }

    } catch (error) {
      clearInterval(progressInterval);
      setProgress(0);
      console.error('Erro ao importar relatório:', error)

      toast({
        title: 'Erro ao importar relatório',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })

      setResult({
        total: 0,
        provisioned: 0,
        settled: 0,
        errors: [error.message],
        entriesCreated: 0
      })
    } finally {
      setImporting(false)
    }
  }

  const parseCSV = (content: string): BoletoData[] => {
    return [];
  }

  const findColumn = (headers: string[], possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name))
      if (index >= 0) return index
    }
    return -1
  }

  const parseCSVLine = (line: string): string[] => {
    const cols: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    cols.push(current.trim())
    return cols
  }

  const parseDate = (dateStr: string): string | undefined => {
    if (!dateStr) return undefined

    // Tentar formatos: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
    const formats = [
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
    ]

    for (const format of formats) {
      const match = dateStr.match(format)
      if (match) {
        if (format === formats[0] || format === formats[2]) {
          // DD/MM/YYYY ou DD-MM-YYYY
          return `${match[3]}-${match[2]}-${match[1]}`
        } else {
          // YYYY-MM-DD
          return dateStr
        }
      }
    }

    return undefined
  }

  const parseAmount = (amountStr: string): number => {
    if (!amountStr) return 0

    // Remove símbolos de moeda e espaços
    let cleaned = amountStr.replace(/[R$\s]/g, '')

    // Substitui vírgula por ponto
    cleaned = cleaned.replace(',', '.')

    return parseFloat(cleaned) || 0
  }

  const parseCompetence = (competenceStr: string): string => {
    if (!competenceStr) return getCurrentCompetence()

    // Formatos aceitos: MM/YYYY, YYYY-MM, MM-YYYY
    const match = competenceStr.match(/(\d{2})[/-](\d{4})/)
    if (match) {
      return `${match[1]}/${match[2]}`
    }

    const match2 = competenceStr.match(/(\d{4})[/-](\d{2})/)
    if (match2) {
      return `${match2[2]}/${match2[1]}`
    }

    return getCurrentCompetence()
  }

  const getCurrentCompetence = (): string => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    return `${month}/${year}`
  }

  const parseStatus = (statusStr: string, paymentDateStr: string): 'EMITIDO' | 'PAGO' | 'VENCIDO' | 'CANCELADO' => {
    if (!statusStr) {
      return paymentDateStr ? 'PAGO' : 'EMITIDO'
    }

    const status = statusStr.toLowerCase()

    if (status.includes('pago') || status.includes('paid') || status.includes('liquidado')) {
      return 'PAGO'
    }
    if (status.includes('cancelado') || status.includes('cancelled')) {
      return 'CANCELADO'
    }
    if (status.includes('vencido') || status.includes('overdue')) {
      return 'VENCIDO'
    }

    return 'EMITIDO'
  }

  const parsePaymentMethod = (methodStr: string): 'BOLETO' | 'PIX' | 'TED' | 'DINHEIRO' | undefined => {
    if (!methodStr) return undefined

    const method = methodStr.toLowerCase()

    if (method.includes('pix')) return 'PIX'
    if (method.includes('ted') || method.includes('transferencia')) return 'TED'
    if (method.includes('dinheiro') || method.includes('cash')) return 'DINHEIRO'
    if (method.includes('boleto')) return 'BOLETO'

    return 'BOLETO'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Relatório de Boletos</CardTitle>
        <CardDescription>
          Importe relatório CSV/Excel de boletos emitidos (12 meses). O sistema criará automaticamente:
          <ul className="list-disc list-inside mt-2 text-xs">
            <li>Provisão de receita (quando emitido) - regime de competência</li>
            <li>Baixa de receita (quando pago) - entrada no banco/caixa</li>
            <li>Lançamentos contábeis em partidas dobradas</li>
          </ul>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Card
          {...getRootProps()}
          className={`p-8 border-2 border-dashed cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'
          }`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center justify-center text-center">
            {importing ? (
              <div className="w-full max-w-md">
                <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">Importando relatório...</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Criando lançamentos contábeis automáticos
                </p>
                <Progress value={progress} className="w-full h-2" />
                <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}%</p>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-1">
                  Arraste o arquivo CSV/Excel aqui ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: .csv, .xlsx, .xls
                </p>
              </>
            )}
          </div>
        </Card>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Formato do CSV:</strong> O arquivo deve conter colunas como: Cliente, CNPJ, Número do Boleto,
            Data de Emissão, Vencimento, Data Pagamento, Competência, Valor, Status
          </AlertDescription>
        </Alert>

        {result && (
          <Card className={result.errors.length > 0 ? 'border-yellow-500' : 'border-green-500'}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {result.errors.length === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                )}

                <div className="flex-1 space-y-2">
                  <h4 className="font-medium">
                    {result.errors.length === 0 ? 'Importação Concluída!' : 'Importação Concluída com Avisos'}
                  </h4>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="text-xs text-muted-foreground">Total Processado</p>
                      <p className="text-lg font-bold">{result.total}</p>
                    </div>
                    <div className="bg-blue-500/10 p-3 rounded">
                      <p className="text-xs text-muted-foreground">Provisionados</p>
                      <p className="text-lg font-bold text-blue-600">{result.provisioned}</p>
                    </div>
                    <div className="bg-green-500/10 p-3 rounded">
                      <p className="text-xs text-muted-foreground">Baixados</p>
                      <p className="text-lg font-bold text-green-600">{result.settled}</p>
                    </div>
                    <div className="bg-purple-500/10 p-3 rounded">
                      <p className="text-xs text-muted-foreground">Lançamentos</p>
                      <p className="text-lg font-bold text-purple-600">{result.entriesCreated}</p>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                      <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                        {result.errors.length} aviso(s):
                      </p>
                      <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                        {result.errors.slice(0, 5).map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li>• ... e mais {result.errors.length - 5} avisos</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )
}
