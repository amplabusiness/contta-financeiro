import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Helper para consultar o AI Accountant sobre estrutura de lançamentos
 * Especializado em reconciliação de honorários com SICREDI
 */

export interface AccountingConsultation {
  scenario: string;
  question: string;
  analysis: string;
}

export async function consultarContadorParaReconciliacao(
  scenario: number,
  details: {
    transactionDate: string;
    amount: number;
    clients: Array<{ name: string; competence: string; amount?: number }>;
    bankName?: string;
  }
): Promise<string | null> {
  try {
    let query = "";

    if (scenario === 1) {
      query = `
        CENÁRIO 1: Reconciliação Simples com Fatura Existente
        
        Transação: ${details.transactionDate} | R$ ${details.amount.toFixed(2)}
        Banco: ${details.bankName || "SICREDI"}
        Cliente: ${details.clients[0]?.name || "Cliente"}
        Competência da Fatura: ${details.clients[0]?.competence || "MM/YYYY"}
        
        Questão: Qual é a estrutura correta dos lançamentos contábeis para registrar o recebimento dessa fatura?
        
        Especificamente:
        1. Qual conta bancária usar? (Sugestão: 1.1.1.02 - Banco Sicredi C/C)
        2. Qual conta do cliente usar? (Sugestão: 1.1.2.01.XXX - Cliente a Receber)
        3. A competência da fatura deve ser mantida original ou mudar para a data do pagamento?
        4. Qual é a partida dobrada correta?
      `;
    } else if (scenario === 2) {
      query = `
        CENÁRIO 2: Alterar Cliente da Fatura Durante Reconciliação
        
        Transação: ${details.transactionDate} | R$ ${details.amount.toFixed(2)}
        Banco: ${details.bankName || "SICREDI"}
        Cliente Original da Fatura: ${details.clients[0]?.name || "Cliente A"}
        Cliente Alterado Para: ${details.clients[1]?.name || "Cliente B"}
        Competência da Fatura: ${details.clients[0]?.competence || "MM/YYYY"}
        
        Questão: Quando alteramos o cliente de uma fatura durante a reconciliação, quais são as implicações contábeis?
        
        Aspectos:
        1. A fatura original (Cliente A) deve permanecer "pendente"?
        2. Ou devemos mover a fatura para Cliente B?
        3. Qual é o melhor procedimento contábil?
        4. Há necessidade de lançamento de ajuste?
      `;
    } else if (scenario === 3) {
      query = `
        CENÁRIO 3: Criar Nova Fatura Sem Correspondência (Recebimento Sem Fatura Prévia)
        
        Transação: ${details.transactionDate} | R$ ${details.amount.toFixed(2)}
        Banco: ${details.bankName || "SICREDI"}
        Cliente: ${details.clients[0]?.name || "Cliente"}
        Competência: ${details.clients[0]?.competence || "MM/YYYY"}
        
        Questão: Como contabilizar um recebimento quando não existe fatura prévia?
        
        Situação: Recebemos R$ ${details.amount.toFixed(2)} de um cliente, mas não tínhamos fatura emitida.
        Vamos criar a fatura retroativamente com competência ${details.clients[0]?.competence}.
        
        Questões:
        1. Devemos criar a fatura como "paga" ou "pendente"?
        2. Qual é a sequência correta dos lançamentos?
        3. A competência da fatura afeta alguma coisa na DRE do período?
      `;
    } else if (scenario === 4) {
      const lineDetails = details.clients
        .map((c, i) => `  Linha ${i + 1}: ${c.name} | R$ ${(c.amount || 0).toFixed(2)} | Competência: ${c.competence}`)
        .join("\n");

      query = `
        CENÁRIO 4: Dividir Transação Única entre Múltiplos Clientes
        
        Transação Total: ${details.transactionDate} | R$ ${details.amount.toFixed(2)}
        Banco: ${details.bankName || "SICREDI"}
        
        Distribuição:
${lineDetails}
        
        Questão: Como contabilizar uma transação bancária única que pertence a múltiplos clientes?
        
        Aspectos Críticos:
        1. Devemos criar 1 lançamento ou múltiplos?
        2. Qual é a estrutura correta?
        3. Como garantir rastreabilidade/auditoria?
        4. Qual é a melhor prática contábil para isso?
        5. A competência de cada fatura deve ser mantida separadamente?
        
        Exemplo esperado:
        - 1 transação bancária de entrada: D: 1.1.1.02 (Banco SICREDI) | C: Múltiplos Clientes
        - Ou: Múltiplas transações (1 por cliente)?
      `;
    }

    const { data, error } = await supabase.functions.invoke("ai-accountant-agent", {
      body: {
        type: "analyze_transaction",
        data: {
          description: query,
          amount: details.amount,
          date: details.transactionDate,
          transaction_type: "credit",
        },
      },
    });

    if (error) {
      console.error("Erro ao consultar AI Accountant:", error);
      toast.error("Erro ao consultar Contador IA");
      return null;
    }

    return data.analysis;
  } catch (error) {
    console.error("Erro ao processar consulta ao Contador IA:", error);
    return null;
  }
}

/**
 * Guia contábil baseado nas respostas do Contador IA
 */
export const ACCOUNTING_GUIDELINES = {
  bankAccount: {
    code: "1.1.1.02",
    name: "Banco Sicredi C/C",
    description:
      "Conta analítica que recebe lançamentos diretos de recebimentos",
  },
  clientAccount: {
    code: "1.1.2.01",
    name: "Clientes a Receber",
    description:
      "Conta sintética com subconta por cliente (1.1.2.01.XXX onde XXX é ID do cliente)",
  },
  receivable: {
    structure:
      "D: 1.1.1.02 (Banco) | C: 1.1.2.01.{clientId} (Cliente a Receber)",
    competenceRule:
      "Competência mantém data original da fatura; data do lançamento é data da transação",
  },
};
