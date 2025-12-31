import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Progress } from '@/components/ui/progress'
import { parseCSV, parseBoletosCSV, parseExtratoBancarioCSV, parseBrazilianCurrency } from '@/lib/csvParser'

interface ImportResult {
  success: boolean
  imported: number
  total: number
  errors?: string[]
}

type FileType = 'ofx' | 'cnab' | 'nfe' | 'csv'

export function FileImporter() {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileType, setFileType] = useState<FileType>('ofx')
  const { toast } = useToast()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/x-ofx': ['.ofx'],
      'text/plain': ['.txt', '.ret'],
      'text/xml': ['.xml'],
      'text/csv': ['.csv']
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

      let functionName = ''
      let requestBody: any = {}

      // Determine file type and function
      if (file.name.endsWith('.ofx') || content.includes('<OFX>')) {
        functionName = 'parse-ofx-statement'
        requestBody = { ofx_content: content }
      } else if (file.name.endsWith('.ret') || file.name.endsWith('.txt')) {
        functionName = 'parse-cnab-file'
        requestBody = { cnab_content: content }
      } else if (file.name.endsWith('.xml')) {
        // NFe XML - could be processed here or sent to a function
        toast({
          title: 'NFe import',
          description: 'NFe import will be available soon'
        })
        setImporting(false)
        return
      } else if (file.name.endsWith('.csv')) {
        // Processar CSV localmente usando o parser
        const parseResult = parseCSV(content)

        if (!parseResult.success) {
          throw new Error(parseResult.error || 'Erro ao processar CSV')
        }

        // Detectar tipo de CSV (boletos ou extrato)
        const headers = parseResult.headers.join(' ').toLowerCase()
        const isBoleto = headers.includes('nosso') || headers.includes('sacado') || headers.includes('pagador')

        if (isBoleto) {
          const { boletos } = parseBoletosCSV(content)

          // Enviar para edge function de processamento
          const { data, error } = await supabase.functions.invoke('process-boletos-csv', {
            body: { boletos }
          })

          if (error) throw error

          clearInterval(progressInterval)
          setProgress(100)
          setResult({
            success: true,
            imported: data?.imported || boletos.length,
            total: boletos.length
          })

          toast({
            title: 'Boletos importados!',
            description: `${boletos.length} boletos processados`
          })
        } else {
          const { transacoes } = parseExtratoBancarioCSV(content)

          // Enviar para edge function de processamento
          const { data, error } = await supabase.functions.invoke('process-extrato-csv', {
            body: { transacoes }
          })

          if (error) throw error

          clearInterval(progressInterval)
          setProgress(100)
          setResult({
            success: true,
            imported: data?.imported || transacoes.length,
            total: transacoes.length
          })

          toast({
            title: 'Extrato importado!',
            description: `${transacoes.length} transações processadas`
          })
        }

        setImporting(false)
        return
      }

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: requestBody
      })

      if (error) throw error

      if (data?.success) {
        clearInterval(progressInterval);
        setProgress(100);
        setResult({
          success: true,
          imported: data?.imported || 0,
          total: data?.total_parsed || data?.total_transactions || 0
        })

        toast({
          title: 'Import successful!',
          description: `${data.imported} transactions imported`
        })
      } else {
        throw new Error(data.error || 'Import failed')
      }

    } catch (error: any) {
      clearInterval(progressInterval);
      setProgress(0);
      console.error('Import error:', error)

      setResult({
        success: false,
        imported: 0,
        total: 0,
        errors: [error.message]
      })

      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={fileType === 'ofx' ? 'default' : 'outline'}
          onClick={() => setFileType('ofx')}
          size="sm"
        >
          OFX
        </Button>
        <Button
          variant={fileType === 'cnab' ? 'default' : 'outline'}
          onClick={() => setFileType('cnab')}
          size="sm"
        >
          CNAB
        </Button>
        <Button
          variant={fileType === 'nfe' ? 'default' : 'outline'}
          onClick={() => setFileType('nfe')}
          size="sm"
        >
          NFe
        </Button>
        <Button
          variant={fileType === 'csv' ? 'default' : 'outline'}
          onClick={() => setFileType('csv')}
          size="sm"
        >
          CSV
        </Button>
      </div>

      <Card
        {...getRootProps()}
        className={`p-8 border-2 border-dashed cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center text-center">
          {importing ? (
            <div className="w-full max-w-md space-y-3">
              <Upload className="h-12 w-12 text-primary mx-auto" />
              <p className="text-sm font-medium">Importando arquivo...</p>
              <p className="text-xs text-muted-foreground mb-2">
                Processando {fileType.toUpperCase()}
              </p>
              <Progress value={progress} className="w-full h-2" />
              <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">
                Drop your {fileType.toUpperCase()} file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supported formats: {fileType === 'ofx' && '.ofx'}
                {fileType === 'cnab' && '.txt, .ret'}
                {fileType === 'nfe' && '.xml'}
                {fileType === 'csv' && '.csv'}
              </p>
            </>
          )}
        </div>
      </Card>

      {result && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
            )}

            <div className="flex-1">
              <h4 className="font-medium mb-1">
                {result.success ? 'Import Successful' : 'Import Failed'}
              </h4>

              {result.success ? (
                <p className="text-sm text-muted-foreground">
                  {result.imported} of {result.total} transactions imported
                  {result.imported < result.total && (
                    <span className="text-yellow-600">
                      {' '}
                      ({result.total - result.imported} duplicates skipped)
                    </span>
                  )}
                </p>
              ) : (
                <div className="text-sm text-red-600">
                  {result.errors?.map((error, i) => (
                    <p key={i}>{error}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
