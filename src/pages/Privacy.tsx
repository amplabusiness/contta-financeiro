import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">CONTTA</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="prose prose-slate max-w-none">
          <h2>1. Introdução</h2>
          <p>
            O CONTTA ("nós", "nosso" ou "Serviço") está comprometido em proteger a privacidade
            dos nossos usuários. Esta Política de Privacidade explica como coletamos, usamos,
            divulgamos e protegemos suas informações quando você usa nosso Serviço.
          </p>
          <p>
            Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
          </p>

          <h2>2. Dados que Coletamos</h2>
          <h3>2.1 Dados fornecidos por você:</h3>
          <ul>
            <li><strong>Dados de cadastro:</strong> nome, email, telefone, CNPJ/CPF, endereço</li>
            <li><strong>Dados da empresa:</strong> razão social, nome fantasia, inscrições, sócios</li>
            <li><strong>Dados financeiros:</strong> transações, faturas, extratos bancários, lançamentos contábeis</li>
            <li><strong>Dados de clientes:</strong> informações dos seus clientes que você cadastra no sistema</li>
          </ul>

          <h3>2.2 Dados coletados automaticamente:</h3>
          <ul>
            <li>Endereço IP e localização aproximada</li>
            <li>Tipo de navegador e dispositivo</li>
            <li>Páginas visitadas e tempo de uso</li>
            <li>Logs de acesso e atividades</li>
          </ul>

          <h2>3. Base Legal para Processamento</h2>
          <p>Processamos seus dados com base nas seguintes bases legais da LGPD:</p>
          <ul>
            <li><strong>Execução de contrato:</strong> para fornecer o Serviço contratado</li>
            <li><strong>Consentimento:</strong> para comunicações de marketing (quando aplicável)</li>
            <li><strong>Legítimo interesse:</strong> para melhorar o Serviço e prevenir fraudes</li>
            <li><strong>Obrigação legal:</strong> para cumprir exigências fiscais e regulatórias</li>
          </ul>

          <h2>4. Como Usamos seus Dados</h2>
          <ul>
            <li>Fornecer, operar e manter o Serviço</li>
            <li>Processar transações e enviar notificações relacionadas</li>
            <li>Melhorar e personalizar sua experiência</li>
            <li>Desenvolver novos produtos e funcionalidades</li>
            <li>Treinar modelos de IA para classificação automática</li>
            <li>Detectar e prevenir fraudes</li>
            <li>Cumprir obrigações legais</li>
          </ul>

          <h2>5. Compartilhamento de Dados</h2>
          <p>Podemos compartilhar seus dados com:</p>
          <ul>
            <li><strong>Processadores de pagamento:</strong> Stripe, para processar pagamentos</li>
            <li><strong>Provedores de infraestrutura:</strong> Supabase, Vercel, para hospedar o Serviço</li>
            <li><strong>Serviços de IA:</strong> Anthropic (Claude), para funcionalidades de IA</li>
            <li><strong>Autoridades:</strong> quando exigido por lei ou ordem judicial</li>
          </ul>
          <p>
            Não vendemos seus dados pessoais a terceiros.
          </p>

          <h2>6. Retenção de Dados</h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para
            fornecer o Serviço. Após o encerramento da conta:
          </p>
          <ul>
            <li>Dados financeiros: retidos por 5 anos (obrigação fiscal)</li>
            <li>Dados de cadastro: excluídos em até 30 dias</li>
            <li>Backups: excluídos em até 90 dias</li>
          </ul>

          <h2>7. Seus Direitos (LGPD)</h2>
          <p>Você tem direito a:</p>
          <ul>
            <li><strong>Acesso:</strong> solicitar cópia dos seus dados</li>
            <li><strong>Correção:</strong> corrigir dados incompletos ou incorretos</li>
            <li><strong>Exclusão:</strong> solicitar exclusão dos seus dados</li>
            <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado</li>
            <li><strong>Revogação:</strong> retirar consentimento a qualquer momento</li>
            <li><strong>Oposição:</strong> opor-se ao processamento em certas circunstâncias</li>
          </ul>
          <p>
            Para exercer esses direitos, entre em contato conosco pelo email: privacidade@contta.com.br
          </p>

          <h2>8. Segurança</h2>
          <p>Implementamos medidas técnicas e organizacionais para proteger seus dados:</p>
          <ul>
            <li>Criptografia em trânsito (TLS/SSL) e em repouso</li>
            <li>Controle de acesso baseado em funções (RBAC)</li>
            <li>Isolamento de dados por tenant (Row Level Security)</li>
            <li>Monitoramento e logs de auditoria</li>
            <li>Backups regulares e redundância</li>
            <li>Autenticação segura com Supabase Auth</li>
          </ul>

          <h2>9. Cookies</h2>
          <p>Usamos cookies e tecnologias similares para:</p>
          <ul>
            <li>Manter você autenticado</li>
            <li>Lembrar suas preferências</li>
            <li>Analisar o uso do Serviço</li>
          </ul>
          <p>
            Você pode gerenciar cookies nas configurações do seu navegador.
          </p>

          <h2>10. Transferência Internacional</h2>
          <p>
            Seus dados podem ser processados em servidores localizados fora do Brasil.
            Garantimos que essas transferências seguem as proteções adequadas conforme a LGPD.
          </p>

          <h2>11. Menores de Idade</h2>
          <p>
            O Serviço não é destinado a menores de 18 anos. Não coletamos intencionalmente
            dados de menores.
          </p>

          <h2>12. Alterações nesta Política</h2>
          <p>
            Podemos atualizar esta Política periodicamente. Notificaremos sobre alterações
            significativas por email ou através do Serviço.
          </p>

          <h2>13. Encarregado de Dados (DPO)</h2>
          <p>
            Nosso Encarregado de Proteção de Dados pode ser contatado em:
          </p>
          <ul>
            <li>Email: dpo@contta.com.br</li>
            <li>Endereço: [Endereço completo da empresa]</li>
          </ul>

          <h2>14. Contato</h2>
          <p>
            Para dúvidas sobre esta Política ou sobre o tratamento dos seus dados:
          </p>
          <ul>
            <li>Email: privacidade@contta.com.br</li>
            <li>Telefone: (11) 3000-0000</li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} CONTTA. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
