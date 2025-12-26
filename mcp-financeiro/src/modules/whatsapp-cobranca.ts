/**
 * Módulo de Integração WhatsApp para Cobrança
 *
 * Este módulo gerencia o envio de mensagens de cobrança via WhatsApp
 * seguindo a régua de cobrança da Ampla Contabilidade.
 *
 * INTEGRAÇÃO: Usa a infraestrutura existente do repositório SERPRO:
 * - Vercel Serverless: api/whatsapp-webhook.ts
 * - WhatsApp Cloud API: backend/src/services/whatsapp-cloud-api.service.ts
 * - Edge Functions: whatsapp-cloud-webhook, whatsapp-cloud-api
 *
 * Configurações em .env:
 * - WHATSAPP_APP_ID
 * - WHATSAPP_PHONE_NUMBER_ID
 * - WHATSAPP_ACCESS_TOKEN
 * - WHATSAPP_BUSINESS_ACCOUNT_ID
 * - WHATSAPP_VERIFY_TOKEN
 */

// ============================================
// CONFIGURAÇÃO WHATSAPP CLOUD API (META)
// ============================================

export interface WhatsAppCloudConfig {
  appId: string;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  verifyToken: string;
}

export const configPadrao: WhatsAppCloudConfig = {
  appId: process.env.WHATSAPP_APP_ID || "863606946419899",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "850316874841789",
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "1450054003127566",
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "ampla_whatsapp_token_2024"
};

// ============================================
// RÉGUA DE COBRANÇA
// ============================================

export const reguaCobranca = [
  {
    dias: 1,
    fase: "lembrete",
    acao: "Lembrete amigável",
    canal: "email",
    template: "template_lembrete"
  },
  {
    dias: 7,
    fase: "cobranca_amigavel",
    acao: "Cobrança gentil",
    canal: "whatsapp",
    template: "template_cobranca_amigavel"
  },
  {
    dias: 15,
    fase: "cobranca_firme",
    acao: "Contato direto",
    canal: "whatsapp",
    template: "template_cobranca_firme"
  },
  {
    dias: 30,
    fase: "negociacao",
    acao: "Negociação formal",
    canal: "whatsapp+telefone",
    template: "template_negociacao"
  },
  {
    dias: 60,
    fase: "suspensao",
    acao: "Suspensão + carta formal",
    canal: "whatsapp+email+correio",
    template: "template_suspensao"
  },
  {
    dias: 90,
    fase: "juridico",
    acao: "Encaminhamento jurídico",
    canal: "email+correio",
    template: "template_juridico"
  }
];

// ============================================
// TEMPLATES DE MENSAGENS
// ============================================

export const templatesWhatsApp = {
  template_lembrete: {
    titulo: "Lembrete de Vencimento",
    mensagem: `Olá {cliente}! 👋

Este é um lembrete amigável de que o honorário referente a *{competencia}* no valor de *R$ {valor}* venceu ontem.

Para sua comodidade:
📱 PIX: {pix}
🔗 Boleto: {boleto_url}

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Atenciosamente,
*Ampla Contabilidade* 📊`,
    variaveis: ["cliente", "competencia", "valor", "pix", "boleto_url"]
  },

  template_cobranca_amigavel: {
    titulo: "Cobrança Amigável",
    mensagem: `Olá {cliente}!

Notamos que o honorário de *{competencia}* (R$ {valor}) está em aberto há *{dias} dias*.

Gostaríamos de verificar se houve algum problema com o boleto ou se podemos ajudar de alguma forma.

📱 PIX para pagamento: {pix}

Qualquer dúvida, estamos à disposição!

*Equipe Ampla Contabilidade*`,
    variaveis: ["cliente", "competencia", "valor", "dias", "pix"]
  },

  template_cobranca_firme: {
    titulo: "Cobrança - Atenção Necessária",
    mensagem: `Prezado(a) {cliente},

Entramos em contato para tratar do honorário de *{competencia}* no valor de *R$ {valor}*, vencido há *{dias} dias*.

⚠️ Pedimos que regularize o pagamento para evitar a *suspensão dos serviços*.

Em caso de dificuldades financeiras, estamos abertos a negociar um *parcelamento*.

📞 Ligue para: (62) 3932-1365
📱 PIX: {pix}

Atenciosamente,
*Ampla Contabilidade*`,
    variaveis: ["cliente", "competencia", "valor", "dias", "pix"]
  },

  template_negociacao: {
    titulo: "Proposta de Negociação",
    mensagem: `Prezado(a) {cliente},

Identificamos que o débito referente aos honorários está pendente há *{dias} dias*, totalizando *R$ {valor_total}*.

📋 *Proposta de Parcelamento:*
• {parcelas}x de R$ {valor_parcela}
• Entrada de R$ {entrada}
• Vencimento: todo dia {dia_vencimento}

Para aceitar esta proposta ou negociar outras condições, entre em contato:
📞 (62) 3932-1365

⚠️ *Importante:* Após 60 dias, os serviços serão suspensos.

*Ampla Contabilidade*`,
    variaveis: ["cliente", "dias", "valor_total", "parcelas", "valor_parcela", "entrada", "dia_vencimento"]
  },

  template_suspensao: {
    titulo: "Aviso de Suspensão",
    mensagem: `⚠️ *AVISO IMPORTANTE*

Prezado(a) {cliente},

Devido à inadimplência de *{dias} dias* referente ao(s) honorário(s) no valor total de *R$ {valor_total}*, informamos que os serviços contábeis serão *SUSPENSOS* a partir de *{data_suspensao}*.

📋 *Consequências da suspensão:*
• Interrupção de obrigações acessórias
• Não emissão de certidões negativas
• Impossibilidade de fechamento contábil

Para regularização, entre em contato:
📞 (62) 3932-1365
📧 contato@amplabusiness.com.br

Esta comunicação também será enviada por *carta registrada*.

*Ampla Contabilidade*`,
    variaveis: ["cliente", "dias", "valor_total", "data_suspensao"]
  },

  template_confirmacao_pagamento: {
    titulo: "Confirmação de Pagamento",
    mensagem: `✅ *Pagamento Confirmado!*

Olá {cliente}!

Confirmamos o recebimento do pagamento referente a *{competencia}* no valor de *R$ {valor}*.

📄 Nota Fiscal: {numero_nfse}
📅 Data: {data_pagamento}

Agradecemos a confiança!

*Ampla Contabilidade* 📊`,
    variaveis: ["cliente", "competencia", "valor", "numero_nfse", "data_pagamento"]
  },

  template_lembrete_vencimento: {
    titulo: "Lembrete de Vencimento Próximo",
    mensagem: `Olá {cliente}! 📅

Lembramos que o honorário de *{competencia}* no valor de *R$ {valor}* vence em *{dias_para_vencer} dias* ({data_vencimento}).

Para sua comodidade:
📱 PIX: {pix}
🔗 Boleto: {boleto_url}

Atenciosamente,
*Ampla Contabilidade*`,
    variaveis: ["cliente", "competencia", "valor", "dias_para_vencer", "data_vencimento", "pix", "boleto_url"]
  }
};

// ============================================
// TIPOS DE MENSAGEM WHATSAPP CLOUD API
// ============================================

export type TipoMensagemWhatsApp = "text" | "template" | "interactive" | "image" | "document";

export interface MensagemInterativa {
  tipo: "button" | "list";
  cabecalho?: string;
  corpo: string;
  rodape?: string;
  botoes?: Array<{ id: string; titulo: string }>;
  secoes?: Array<{ titulo: string; itens: Array<{ id: string; titulo: string; descricao?: string }> }>;
}

export interface TemplateMensagem {
  nome: string;
  idioma: string;
  componentes?: Array<{
    tipo: "header" | "body" | "button";
    parametros?: Array<{ tipo: "text" | "currency" | "date_time"; texto?: string; moeda?: { codigo: string; valor: number } }>;
  }>;
}

// ============================================
// FUNÇÕES DE ENVIO
// ============================================

export interface MensagemCobranca {
  telefone: string;
  template: keyof typeof templatesWhatsApp;
  variaveis: Record<string, string>;
  clienteId: string;
  faturaId?: string;
}

export function montarMensagem(
  templateKey: keyof typeof templatesWhatsApp,
  variaveis: Record<string, string>
): string {
  const template = templatesWhatsApp[templateKey];
  let mensagem = template.mensagem;

  for (const [chave, valor] of Object.entries(variaveis)) {
    mensagem = mensagem.replace(new RegExp(`\\{${chave}\\}`, "g"), valor);
  }

  return mensagem;
}

export function formatarTelefone(telefone: string): string {
  // Remove tudo que não for número
  const numeros = telefone.replace(/\D/g, "");

  // Se não começar com 55, adiciona
  if (!numeros.startsWith("55")) {
    return "55" + numeros;
  }

  return numeros;
}

export function determinarFaseCobranca(diasAtraso: number): typeof reguaCobranca[0] | null {
  // Encontra a fase apropriada baseada nos dias de atraso
  const fasesOrdenadas = [...reguaCobranca].sort((a, b) => b.dias - a.dias);

  for (const fase of fasesOrdenadas) {
    if (diasAtraso >= fase.dias) {
      return fase;
    }
  }

  return null;
}

// ============================================
// ENVIO VIA WHATSAPP CLOUD API (META)
// ============================================

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

/**
 * Envia mensagem de texto simples via WhatsApp Cloud API
 */
export async function enviarTextoCloudAPI(
  config: WhatsAppCloudConfig,
  telefone: string,
  texto: string
): Promise<{ sucesso: boolean; messageId?: string; erro?: string }> {
  try {
    const telefoneFormatado = formatarTelefone(telefone);

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: telefoneFormatado,
          type: "text",
          text: { body: texto }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { sucesso: false, erro: data.error?.message || "Erro ao enviar" };
    }

    return { sucesso: true, messageId: data.messages?.[0]?.id };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Envia mensagem com template aprovado via WhatsApp Cloud API
 */
export async function enviarTemplateCloudAPI(
  config: WhatsAppCloudConfig,
  telefone: string,
  template: TemplateMensagem
): Promise<{ sucesso: boolean; messageId?: string; erro?: string }> {
  try {
    const telefoneFormatado = formatarTelefone(telefone);

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: telefoneFormatado,
          type: "template",
          template: {
            name: template.nome,
            language: { code: template.idioma },
            components: template.componentes?.map(c => ({
              type: c.tipo,
              parameters: c.parametros?.map(p => ({
                type: p.tipo,
                text: p.texto,
                currency: p.moeda
              }))
            }))
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { sucesso: false, erro: data.error?.message || "Erro ao enviar template" };
    }

    return { sucesso: true, messageId: data.messages?.[0]?.id };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Envia mensagem interativa (botões/lista) via WhatsApp Cloud API
 */
export async function enviarInterativaCloudAPI(
  config: WhatsAppCloudConfig,
  telefone: string,
  mensagem: MensagemInterativa
): Promise<{ sucesso: boolean; messageId?: string; erro?: string }> {
  try {
    const telefoneFormatado = formatarTelefone(telefone);

    const interactivePayload: any = {
      type: mensagem.tipo === "button" ? "button" : "list",
      body: { text: mensagem.corpo }
    };

    if (mensagem.cabecalho) {
      interactivePayload.header = { type: "text", text: mensagem.cabecalho };
    }

    if (mensagem.rodape) {
      interactivePayload.footer = { text: mensagem.rodape };
    }

    if (mensagem.tipo === "button" && mensagem.botoes) {
      interactivePayload.action = {
        buttons: mensagem.botoes.map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.titulo }
        }))
      };
    }

    if (mensagem.tipo === "list" && mensagem.secoes) {
      interactivePayload.action = {
        button: "Ver opções",
        sections: mensagem.secoes.map(s => ({
          title: s.titulo,
          rows: s.itens.map(i => ({
            id: i.id,
            title: i.titulo,
            description: i.descricao
          }))
        }))
      };
    }

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: telefoneFormatado,
          type: "interactive",
          interactive: interactivePayload
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { sucesso: false, erro: data.error?.message || "Erro ao enviar" };
    }

    return { sucesso: true, messageId: data.messages?.[0]?.id };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Envia documento (PDF boleto) via WhatsApp Cloud API
 */
export async function enviarDocumentoCloudAPI(
  config: WhatsAppCloudConfig,
  telefone: string,
  documentoUrl: string,
  nomeArquivo: string,
  legenda?: string
): Promise<{ sucesso: boolean; messageId?: string; erro?: string }> {
  try {
    const telefoneFormatado = formatarTelefone(telefone);

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: telefoneFormatado,
          type: "document",
          document: {
            link: documentoUrl,
            filename: nomeArquivo,
            caption: legenda
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { sucesso: false, erro: data.error?.message || "Erro ao enviar documento" };
    }

    return { sucesso: true, messageId: data.messages?.[0]?.id };
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

// ============================================
// FUNÇÃO PRINCIPAL DE ENVIO DE COBRANÇA
// ============================================

export async function enviarCobranca(
  config: WhatsAppCloudConfig,
  mensagem: MensagemCobranca
): Promise<{ sucesso: boolean; messageId?: string; erro?: string }> {
  const texto = montarMensagem(mensagem.template, mensagem.variaveis);
  return enviarTextoCloudAPI(config, mensagem.telefone, texto);
}

/**
 * Envia cobrança com botões de ação
 */
export async function enviarCobrancaInterativa(
  config: WhatsAppCloudConfig,
  mensagem: MensagemCobranca
): Promise<{ sucesso: boolean; messageId?: string; erro?: string }> {
  const texto = montarMensagem(mensagem.template, mensagem.variaveis);

  return enviarInterativaCloudAPI(config, mensagem.telefone, {
    tipo: "button",
    corpo: texto,
    rodape: "Ampla Contabilidade",
    botoes: [
      { id: "pagar_pix", titulo: "💰 Pagar via PIX" },
      { id: "ver_boleto", titulo: "📄 Ver Boleto" },
      { id: "falar_atendente", titulo: "💬 Falar Conosco" }
    ]
  });
}

// ============================================
// PROCESSAMENTO EM LOTE
// ============================================

export interface ClienteInadimplente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  valorDevido: number;
  diasAtraso: number;
  competencias: string[];
  ultimaCobranca?: Date;
}

export async function processarCobrancasEmLote(
  config: WhatsAppCloudConfig,
  clientes: ClienteInadimplente[],
  pixEmpresa: string
): Promise<{
  enviados: number;
  erros: number;
  detalhes: Array<{ cliente: string; sucesso: boolean; erro?: string }>;
}> {
  const resultados: Array<{ cliente: string; sucesso: boolean; erro?: string }> = [];

  for (const cliente of clientes) {
    const fase = determinarFaseCobranca(cliente.diasAtraso);

    if (!fase || fase.canal === "email" || fase.canal === "correio") {
      continue; // Pula se não for fase de WhatsApp
    }

    const mensagem: MensagemCobranca = {
      telefone: cliente.telefone,
      template: fase.template as keyof typeof templatesWhatsApp,
      variaveis: {
        cliente: cliente.nome,
        competencia: cliente.competencias.join(", "),
        valor: cliente.valorDevido.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        valor_total: cliente.valorDevido.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        dias: cliente.diasAtraso.toString(),
        pix: pixEmpresa
      },
      clienteId: cliente.id
    };

    const resultado = await enviarCobranca(config, mensagem);

    resultados.push({
      cliente: cliente.nome,
      sucesso: resultado.sucesso,
      erro: resultado.erro
    });

    // Aguarda 2 segundos entre envios para evitar bloqueio
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return {
    enviados: resultados.filter((r) => r.sucesso).length,
    erros: resultados.filter((r) => !r.sucesso).length,
    detalhes: resultados
  };
}

export default {
  reguaCobranca,
  templatesWhatsApp,
  montarMensagem,
  formatarTelefone,
  determinarFaseCobranca,
  enviarCobranca,
  processarCobrancasEmLote
};
