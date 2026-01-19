import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function AutomatedFileUpload() {
  const navigate = useNavigate();

  // Estados de carregamento
  const [uploading, setUploading] = useState(false);

  // Estados de dados principais
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [queueStatus, setQueueStatus] = useState<any[]>([]);

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  const loadQueueStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('file_processing_queue')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setQueueStatus(data || []);
    } catch (error) {
      console.error('Error loading queue status:', error);
    }
  };

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const handleFileUpload = async (file: File, fileType: 'boleto_report' | 'bank_statement') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const bucket = fileType === 'boleto_report' ? 'boleto-reports' : 'bank-statements';
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Add to processing queue
      const { error: queueError } = await supabase
        .from('file_processing_queue')
        .insert({
          file_path: filePath,
          file_type: fileType,
          uploaded_by: user.id,
          status: 'pending'
        });

      if (queueError) throw queueError;

      return { success: true, filePath };
    } catch (error: any) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleUpload = async () => {
    if (!boletoFile && !statementFile) {
      toast.error('Selecione pelo menos um arquivo');
      return;
    }

    setUploading(true);
    try {
      const uploads = [];

      if (boletoFile) {
        uploads.push(handleFileUpload(boletoFile, 'boleto_report'));
      }

      if (statementFile) {
        uploads.push(handleFileUpload(statementFile, 'bank_statement'));
      }

      await Promise.all(uploads);

      toast.success('Arquivos enviados para processamento automático!', {
        description: 'Os arquivos serão processados em breve automaticamente.'
      });

      setBoletoFile(null);
      setStatementFile(null);
      loadQueueStatus();
    } catch (error: any) {
      toast.error('Erro ao enviar arquivos', {
        description: error.message
      });
    } finally {
      setUploading(false);
    }
  };

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Upload Automático</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Envie arquivos para processamento automático - sem necessidade de cliques adicionais
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload de Arquivos</CardTitle>
            <CardDescription>
              Os arquivos serão processados automaticamente pelo sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                ✨ <strong>100% Automático:</strong> Após o upload, o sistema processará os arquivos automaticamente,
                fará a conciliação e criará os lançamentos contábeis. Nenhuma ação adicional necessária!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="boleto">Relatório de Boletos (XLS/XLSX)</Label>
              <Input
                id="boleto"
                type="file"
                accept=".xls,.xlsx"
                onChange={(e) => setBoletoFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
              {boletoFile && (
                <p className="text-sm text-muted-foreground">
                  ✓ {boletoFile.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="statement">Extrato Bancário (OFX/CSV/XLS/XLSX)</Label>
              <Input
                id="statement"
                type="file"
                accept=".ofx,.csv,.xls,.xlsx"
                onChange={(e) => setStatementFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
              {statementFile && (
                <p className="text-sm text-muted-foreground">
                  ✓ {statementFile.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || (!boletoFile && !statementFile)}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Enviando...' : 'Enviar para Processamento Automático'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fila de Processamento</CardTitle>
            <CardDescription>
              Arquivos recentemente enviados e seu status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={loadQueueStatus}
              variant="outline"
              className="w-full mb-4"
            >
              Atualizar Status
            </Button>

            {queueStatus.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum arquivo na fila
              </p>
            ) : (
              <div className="space-y-3">
                {queueStatus.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 border rounded-lg"
                  >
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.file_path.split('/').pop()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.file_type === 'boleto_report' ? 'Relatório de Boletos' : 'Extrato Bancário'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.uploaded_at).toLocaleString('pt-BR')}
                      </p>
                      {item.status === 'failed' && item.error_message && (
                        <p className="text-xs text-red-500 mt-1">
                          Erro: {item.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Como Funciona o Sistema Automático</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Você faz o upload dos arquivos</p>
              <p className="text-sm text-muted-foreground">
                Envie relatórios de boletos e extratos bancários
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Sistema processa automaticamente</p>
              <p className="text-sm text-muted-foreground">
                A cada execução programada, os arquivos são processados
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Conciliação automática</p>
              <p className="text-sm text-muted-foreground">
                Boletos são conciliados com o extrato bancário
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
              4
            </div>
            <div>
              <p className="font-medium">Lançamentos contábeis criados</p>
              <p className="text-sm text-muted-foreground">
                Sistema cria automaticamente os lançamentos de baixa
              </p>
            </div>
          </div>

          <Alert className="mt-4">
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>Agendamento:</strong> O sistema processa arquivos automaticamente de forma periódica.
              Configure o agendamento executando o cron job no Supabase.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      </div>
    </Layout>
  );
}
