import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet } from "lucide-react";

export default function Terms() {
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
        <h1 className="text-3xl font-bold mb-2">Termos de Serviço</h1>
        <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="prose prose-slate max-w-none">
          <h2>1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e usar o CONTTA ("Serviço"), você concorda em cumprir e estar vinculado
            a estes Termos de Serviço. Se você não concordar com qualquer parte destes termos,
            não poderá acessar o Serviço.
          </p>

          <h2>2. Descrição do Serviço</h2>
          <p>
            O CONTTA é uma plataforma de gestão financeira e contábil para escritórios de contabilidade,
            oferecendo funcionalidades como:
          </p>
          <ul>
            <li>Gestão de contas a pagar e receber</li>
            <li>Conciliação bancária automática</li>
            <li>Lançamentos contábeis</li>
            <li>Relatórios financeiros e contábeis</li>
            <li>Inteligência artificial para classificação de transações</li>
          </ul>

          <h2>3. Cadastro e Conta</h2>
          <p>
            Para usar o Serviço, você deve criar uma conta fornecendo informações precisas e completas.
            Você é responsável por manter a confidencialidade de sua senha e por todas as atividades
            que ocorram em sua conta.
          </p>

          <h2>4. Planos e Pagamento</h2>
          <p>
            O CONTTA oferece diferentes planos de assinatura. Os preços e recursos de cada plano
            estão disponíveis em nossa página de preços. O pagamento é processado através do Stripe
            e pode ser feito via cartão de crédito, Pix ou boleto bancário.
          </p>
          <ul>
            <li>As assinaturas são renovadas automaticamente</li>
            <li>Você pode cancelar a qualquer momento</li>
            <li>Reembolsos seguem a política do plano contratado</li>
          </ul>

          <h2>5. Uso Aceitável</h2>
          <p>Você concorda em não usar o Serviço para:</p>
          <ul>
            <li>Violar qualquer lei aplicável</li>
            <li>Transmitir malware ou código malicioso</li>
            <li>Tentar acessar dados de outros usuários</li>
            <li>Sobrecarregar ou interferir no funcionamento do Serviço</li>
            <li>Revender ou sublicenciar o Serviço sem autorização</li>
          </ul>

          <h2>6. Propriedade Intelectual</h2>
          <p>
            O Serviço e todo o seu conteúdo, recursos e funcionalidades são de propriedade
            do CONTTA e estão protegidos por leis de direitos autorais, marcas registradas
            e outras leis de propriedade intelectual.
          </p>

          <h2>7. Dados e Privacidade</h2>
          <p>
            Seu uso do Serviço também é regido por nossa <Link to="/privacy" className="text-blue-600 hover:underline">Política de Privacidade</Link>.
            Você mantém a propriedade de todos os dados que inserir no Serviço.
          </p>

          <h2>8. Limitação de Responsabilidade</h2>
          <p>
            O CONTTA não será responsável por quaisquer danos indiretos, incidentais, especiais,
            consequenciais ou punitivos resultantes do uso ou incapacidade de usar o Serviço.
          </p>

          <h2>9. Modificações do Serviço</h2>
          <p>
            Reservamo-nos o direito de modificar ou descontinuar o Serviço a qualquer momento,
            com ou sem aviso prévio. Não seremos responsáveis perante você ou terceiros por
            qualquer modificação, suspensão ou descontinuação do Serviço.
          </p>

          <h2>10. Alterações nos Termos</h2>
          <p>
            Podemos atualizar estes Termos periodicamente. Notificaremos sobre alterações
            significativas por email ou através do Serviço. O uso continuado após as alterações
            constitui aceitação dos novos Termos.
          </p>

          <h2>11. Lei Aplicável</h2>
          <p>
            Estes Termos serão regidos e interpretados de acordo com as leis do Brasil.
            Qualquer disputa será resolvida nos tribunais competentes de São Paulo/SP.
          </p>

          <h2>12. Contato</h2>
          <p>
            Se você tiver dúvidas sobre estes Termos, entre em contato conosco:
          </p>
          <ul>
            <li>Email: suporte@contta.com.br</li>
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
