/**
 * Classificador automático de lançamentos contábeis
 * Baseado em padrões de descrição de extratos OFX e documentos fiscais
 */

import fs from 'fs';
import path from 'path';

// Carregar base de conhecimento
const knowledgePath = path.join(process.cwd(), 'data', 'accounting_knowledge_base.json');
const knowledgeBase = JSON.parse(fs.readFileSync(knowledgePath, 'utf-8'));

// ============================================================
// PADRÕES DE CLASSIFICAÇÃO AUTOMÁTICA
// ============================================================

const CLASSIFICACAO_AUTOMATICA = {
  // ========== ENTRADAS (Créditos no extrato bancário) ==========
  ENTRADAS: {
    // Recebimentos de clientes
    RECEBIMENTO_CLIENTE: {
      patterns: [
        /PIX\s*(?:REC|RECEBIDO|RECEB)/i,
        /TED\s*(?:REC|RECEBIDO|CRED)/i,
        /DEP(?:OSITO)?.*(?:PIX|TED|DOC)/i,
        /TRANSF.*(?:REC|RECEB|CRED)/i,
        /PAGAMENTO\s*(?:REC|RECEB)/i
      ],
      classificacao: {
        debito: { codigo: "2.1.9.01", nome: "Transitória Créditos", id: "28085461-9e5a-4fb4-847d-c9fc047fe0a1" },
        credito: { codigo: "1.1.2.01", nome: "Clientes a Receber" },
        historico_template: "Classificação: Recebimento {cliente} - {descricao}"
      }
    },

    // Rendimentos financeiros
    RENDIMENTO_APLICACAO: {
      patterns: [
        /RENDIMENT/i,
        /JUROS\s*(?:CRED|S\/\s*APLIC)/i,
        /CREDITO\s*(?:POUPAN|CDB|LCI|LCA)/i
      ],
      classificacao: {
        debito: { codigo: "2.1.9.01", nome: "Transitória Créditos" },
        credito: { codigo: "3.2.1.01", nome: "Receitas Financeiras" },
        historico_template: "Classificação: Rendimento financeiro - {descricao}"
      }
    },

    // Resgate de aplicação
    RESGATE_APLICACAO: {
      patterns: [
        /RESGATE/i,
        /APLIC.*(?:RESGATE|LIQUID)/i
      ],
      classificacao: {
        debito: { codigo: "2.1.9.01", nome: "Transitória Créditos" },
        credito: { codigo: "1.1.3.01", nome: "Aplicações Financeiras" },
        historico_template: "Classificação: Resgate de aplicação - {descricao}"
      }
    },

    // Estornos
    ESTORNO: {
      patterns: [
        /ESTORNO/i,
        /DEVOLU[CÇ][AÃ]O/i,
        /CANCEL/i
      ],
      classificacao: {
        debito: { codigo: "2.1.9.01", nome: "Transitória Créditos" },
        credito: { codigo: "VERIFICAR", nome: "Conta Original do Débito" },
        historico_template: "Classificação: Estorno/Devolução - {descricao}"
      }
    },

    // Depósito em dinheiro
    DEPOSITO_DINHEIRO: {
      patterns: [
        /DEP(?:OSITO)?.*DINHEIRO/i,
        /DEP(?:OSITO)?.*ESPECIE/i,
        /DEPOSITO\s*(?!.*PIX)(?!.*TED)/i
      ],
      classificacao: {
        debito: { codigo: "2.1.9.01", nome: "Transitória Créditos" },
        credito: { codigo: "1.1.1.01", nome: "Caixa" },
        historico_template: "Classificação: Depósito em dinheiro - {descricao}"
      }
    }
  },

  // ========== SAÍDAS (Débitos no extrato bancário) ==========
  SAIDAS: {
    // Tarifas bancárias
    TARIFA_BANCARIA: {
      patterns: [
        /TARIFA/i,
        /TAR\s*(?:COM|COB|LIQ|TED|PIX|DOC|MANUT)/i,
        /TAXA\s*(?:MANUT|SERV)/i,
        /CUST[OÓ]DIA/i,
        /ANUIDADE/i
      ],
      classificacao: {
        debito: { codigo: "4.2.1.01", nome: "Despesas Bancárias" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos", id: "3e1fd22f-fba2-4cc2-b628-9d729233bca0" },
        historico_template: "Classificação: Tarifa bancária - {descricao}"
      },
      auto_classificar: true  // Pode ser classificado automaticamente
    },

    // IOF
    IOF: {
      patterns: [
        /IOF/i,
        /IMP.*OPER.*FIN/i
      ],
      classificacao: {
        debito: { codigo: "4.2.1.04", nome: "IOF" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: IOF - {descricao}"
      },
      auto_classificar: true
    },

    // Energia elétrica
    ENERGIA_ELETRICA: {
      patterns: [
        /ENERGIA/i,
        /CELG/i,
        /ENEL/i,
        /CEMIG/i,
        /LIGHT/i,
        /COPEL/i,
        /ELETROPAULO/i,
        /CPFL/i
      ],
      classificacao: {
        debito: { codigo: "4.1.1.02", nome: "Despesas com Energia Elétrica" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Energia elétrica - {descricao}"
      },
      auto_classificar: true
    },

    // Água e esgoto
    AGUA_ESGOTO: {
      patterns: [
        /AGUA/i,
        /SANEAGO/i,
        /SABESP/i,
        /COPASA/i,
        /CEDAE/i,
        /CORSAN/i,
        /SANEPAR/i
      ],
      classificacao: {
        debito: { codigo: "4.1.1.03", nome: "Despesas com Água e Esgoto" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Água e esgoto - {descricao}"
      },
      auto_classificar: true
    },

    // Telefone/Internet
    TELEFONE_INTERNET: {
      patterns: [
        /TELEFONE/i,
        /INTERNET/i,
        /VIVO/i,
        /CLARO/i,
        /TIM/i,
        /\bOI\b/i,
        /NET\s/i,
        /TELECOM/i,
        /ALGAR/i
      ],
      classificacao: {
        debito: { codigo: "4.1.1.04", nome: "Despesas com Comunicação" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Telefone/Internet - {descricao}"
      },
      auto_classificar: true
    },

    // Aluguel
    ALUGUEL: {
      patterns: [
        /ALUGUEL/i,
        /LOCA[CÇ][AÃ]O/i,
        /IMOBILI[AÁ]RIA/i
      ],
      classificacao: {
        debito: { codigo: "4.1.1.01", nome: "Despesas com Aluguel" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Aluguel - {descricao}"
      }
    },

    // Simples Nacional / DAS
    SIMPLES_NACIONAL: {
      patterns: [
        /DAS\s*(?:SIMPLES)?/i,
        /SIMPLES\s*NACIONAL/i,
        /\bMEI\b/i,
        /PGDAS/i
      ],
      classificacao: {
        debito: { codigo: "4.3.1.03", nome: "Simples Nacional" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Simples Nacional/DAS - {descricao}"
      },
      auto_classificar: true
    },

    // DARF (Impostos Federais)
    DARF_IMPOSTO: {
      patterns: [
        /DARF/i,
        /RECEITA\s*FEDERAL/i,
        /PGTO\s*(?:IRPJ|CSLL|PIS|COFINS)/i
      ],
      classificacao: {
        debito: { codigo: "2.1.5.xx", nome: "Impostos a Recolher" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: DARF - {descricao}"
      }
    },

    // GPS/INSS
    GPS_INSS: {
      patterns: [
        /GPS/i,
        /INSS/i,
        /PREVID[EÊ]NCIA/i
      ],
      classificacao: {
        debito: { codigo: "2.1.4.01", nome: "INSS a Recolher" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: GPS/INSS - {descricao}"
      },
      auto_classificar: true
    },

    // FGTS
    FGTS: {
      patterns: [
        /FGTS/i,
        /GRF/i,
        /FUNDO\s*GARANT/i
      ],
      classificacao: {
        debito: { codigo: "2.1.4.02", nome: "FGTS a Recolher" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: FGTS - {descricao}"
      },
      auto_classificar: true
    },

    // ISS
    ISS: {
      patterns: [
        /\bISS\b/i,
        /ISSQN/i,
        /\bDAM\b/i,
        /IMPOSTO\s*(?:SOBRE\s*)?SERVI[CÇ]O/i
      ],
      classificacao: {
        debito: { codigo: "2.1.5.04", nome: "ISS a Recolher" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: ISS - {descricao}"
      }
    },

    // Salário/Folha
    SALARIO: {
      patterns: [
        /SAL[AÁ]RIO/i,
        /FOLHA/i,
        /PGTO.*FUNC/i,
        /REMUNERA[CÇ][AÃ]O/i
      ],
      classificacao: {
        debito: { codigo: "2.1.3.01", nome: "Salários a Pagar" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Salário - {descricao}"
      }
    },

    // Pró-labore
    PRO_LABORE: {
      patterns: [
        /PR[OÓ].?LABORE/i,
        /PROLABORE/i,
        /RETIRADA.*S[OÓ]CIO/i
      ],
      classificacao: {
        debito: { codigo: "2.1.3.04", nome: "Pró-labore a Pagar" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Pró-labore - {descricao}"
      }
    },

    // Férias
    FERIAS: {
      patterns: [
        /F[EÉ]RIAS/i
      ],
      classificacao: {
        debito: { codigo: "2.1.3.02", nome: "Férias a Pagar" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Férias - {descricao}"
      }
    },

    // 13º Salário
    DECIMO_TERCEIRO: {
      patterns: [
        /13.?\s*SAL/i,
        /D[EÉ]CIMO\s*TERCEIRO/i,
        /GRATIFICA[CÇ][AÃ]O\s*NATALIN/i
      ],
      classificacao: {
        debito: { codigo: "2.1.3.03", nome: "13º Salário a Pagar" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: 13º Salário - {descricao}"
      }
    },

    // Combustível
    COMBUSTIVEL: {
      patterns: [
        /COMBUST[IÍ]VEL/i,
        /GASOLINA/i,
        /[AÁ]LCOOL/i,
        /DIESEL/i,
        /POSTO/i,
        /SHELL/i,
        /IPIRANGA/i,
        /PETROBRAS/i,
        /\bBR\s/i
      ],
      classificacao: {
        debito: { codigo: "4.1.1.06", nome: "Despesas com Combustível" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Combustível - {descricao}"
      }
    },

    // Honorários contábeis
    HONORARIOS_CONTABEIS: {
      patterns: [
        /CONTABILIDADE/i,
        /HONOR[AÁ]RIO.*CONT/i,
        /ESCRIT[OÓ]RIO\s*CONT/i
      ],
      classificacao: {
        debito: { codigo: "4.1.2.03", nome: "Honorários Contábeis" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Honorários contábeis - {descricao}"
      }
    },

    // Honorários advocatícios
    HONORARIOS_ADVOCATICIOS: {
      patterns: [
        /ADVOC[AÁ]CIA/i,
        /HONOR[AÁ]RIO.*ADV/i,
        /JUR[IÍ]DICO/i,
        /ADVOGADO/i
      ],
      classificacao: {
        debito: { codigo: "4.1.2.04", nome: "Honorários Advocatícios" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Honorários advocatícios - {descricao}"
      }
    },

    // Seguros
    SEGURO: {
      patterns: [
        /SEGURO/i,
        /AP[OÓ]LICE/i,
        /SEGURADORA/i
      ],
      classificacao: {
        debito: { codigo: "4.1.2.02", nome: "Despesas com Seguros" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Seguro - {descricao}"
      }
    },

    // Aplicação financeira
    APLICACAO_FINANCEIRA: {
      patterns: [
        /APLICA[CÇ][AÃ]O/i,
        /INVESTIMENT/i,
        /CDB/i,
        /LCI/i,
        /LCA/i,
        /POUPAN[CÇ]A/i
      ],
      classificacao: {
        debito: { codigo: "1.1.3.01", nome: "Aplicações Financeiras" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Aplicação financeira - {descricao}"
      }
    },

    // Transferência entre contas próprias
    TRANSFERENCIA_PROPRIA: {
      patterns: [
        /TRANSF.*(?:MESMA|PR[OÓ]PRI)/i,
        /ENTRE\s*CONTAS/i
      ],
      classificacao: {
        debito: { codigo: "1.1.1.xx", nome: "Outro Banco/Conta" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Transferência entre contas próprias - {descricao}"
      }
    },

    // Pagamento genérico de fornecedor
    PAGAMENTO_FORNECEDOR: {
      patterns: [
        /PIX\s*(?:ENV|TRANS|PGTO)/i,
        /TED\s*(?:ENV|PGTO|SAI)/i,
        /PAG(?:AMENTO)?/i
      ],
      classificacao: {
        debito: { codigo: "2.1.1.xx", nome: "Fornecedores" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Pagamento - {descricao}"
      },
      prioridade: 99  // Baixa prioridade (catch-all)
    },

    // Saque
    SAQUE: {
      patterns: [
        /SAQUE/i,
        /RETIRADA.*(?:DINHEIRO|ESP[EÉ]CIE)/i
      ],
      classificacao: {
        debito: { codigo: "1.1.1.01", nome: "Caixa" },
        credito: { codigo: "1.1.9.01", nome: "Transitória Débitos" },
        historico_template: "Classificação: Saque - {descricao}"
      }
    }
  }
};

// ============================================================
// FUNÇÃO DE CLASSIFICAÇÃO
// ============================================================

/**
 * Classifica uma transação bancária baseada na descrição
 * @param {string} descricao - Descrição da transação (do OFX)
 * @param {number} valor - Valor da transação (positivo = entrada, negativo = saída)
 * @returns {object} Classificação sugerida
 */
function classificarTransacao(descricao, valor) {
  const tipoMovimento = valor >= 0 ? 'ENTRADAS' : 'SAIDAS';
  const categorias = CLASSIFICACAO_AUTOMATICA[tipoMovimento];
  
  let melhorMatch = null;
  let melhorPrioridade = 999;
  
  for (const [tipo, config] of Object.entries(categorias)) {
    const prioridade = config.prioridade || 1;
    
    for (const pattern of config.patterns) {
      if (pattern.test(descricao)) {
        if (prioridade < melhorPrioridade) {
          melhorPrioridade = prioridade;
          melhorMatch = {
            tipo,
            ...config.classificacao,
            auto_classificar: config.auto_classificar || false,
            confianca: prioridade === 1 ? 'ALTA' : prioridade < 50 ? 'MEDIA' : 'BAIXA',
            historico: config.classificacao.historico_template
              .replace('{descricao}', descricao)
              .replace('{cliente}', 'A IDENTIFICAR')
          };
        }
        break;  // Encontrou match para este tipo, passar para próximo
      }
    }
  }
  
  if (!melhorMatch) {
    return {
      tipo: 'NAO_IDENTIFICADO',
      debito: valor >= 0 
        ? { codigo: "2.1.9.01", nome: "Transitória Créditos" }
        : { codigo: "VERIFICAR", nome: "A classificar pelo Dr. Cícero" },
      credito: valor >= 0
        ? { codigo: "VERIFICAR", nome: "A classificar pelo Dr. Cícero" }
        : { codigo: "1.1.9.01", nome: "Transitória Débitos" },
      auto_classificar: false,
      confianca: 'REQUER_ANALISE',
      historico: `Pendente classificação: ${descricao}`
    };
  }
  
  return melhorMatch;
}

/**
 * Processa um lote de transações e retorna sugestões de classificação
 */
function processarLoteTransacoes(transacoes) {
  return transacoes.map(t => ({
    ...t,
    classificacao_sugerida: classificarTransacao(t.descricao, t.valor)
  }));
}

// ============================================================
// EXPORTAR BASE COMPLETA
// ============================================================

const CLASSIFICADOR_CONTABIL = {
  versao: '1.0.0',
  atualizado_em: new Date().toISOString(),
  
  // Padrões de classificação
  padroes: CLASSIFICACAO_AUTOMATICA,
  
  // Funções
  classificarTransacao,
  processarLoteTransacoes,
  
  // Contas transitórias (Ampla)
  contas_transitorias: {
    DEBITOS: {
      codigo: "1.1.9.01",
      nome: "Transitória Débitos (ATIVO)",
      id: "3e1fd22f-fba2-4cc2-b628-9d729233bca0",
      uso: "Saídas de dinheiro aguardando classificação"
    },
    CREDITOS: {
      codigo: "2.1.9.01",
      nome: "Transitória Créditos (PASSIVO)",
      id: "28085461-9e5a-4fb4-847d-c9fc047fe0a1",
      uso: "Entradas de dinheiro aguardando classificação"
    }
  },
  
  // Banco principal
  banco_principal: {
    codigo: "1.1.1.05",
    nome: "Banco Sicredi",
    id: "10d5892d-a843-4034-8d62-9fec95b8fd56"
  }
};

// ============================================================
// TESTES
// ============================================================

function testar() {
  console.log('='.repeat(60));
  console.log('TESTE DO CLASSIFICADOR AUTOMÁTICO');
  console.log('='.repeat(60));
  
  const exemploTransacoes = [
    { descricao: "PIX RECEBIDO - CLIENTE ABC LTDA", valor: 5000.00 },
    { descricao: "TARIFA COBRANCA-COB000123", valor: -9.45 },
    { descricao: "PAGAMENTO PIX - SERGIO CARNEIRO", valor: -13698.01 },
    { descricao: "TED RECEBIDO - ACTION SOLUCOES", valor: 70046.90 },
    { descricao: "DAS SIMPLES NACIONAL", valor: -1500.00 },
    { descricao: "GPS INSS REF 01/2025", valor: -2500.00 },
    { descricao: "ENERGIA CELG REF 12/2024", valor: -450.00 },
    { descricao: "RENDIMENTO POUPANCA", valor: 125.30 },
    { descricao: "APLICACAO CDB", valor: -10000.00 },
    { descricao: "RESGATE CDB", valor: 10500.00 },
    { descricao: "PRO-LABORE SERGIO", valor: -8000.00 },
    { descricao: "PAGAMENTO NF 12345 - FORNECEDOR XYZ", valor: -3500.00 }
  ];
  
  console.log('\nResultados da classificação:\n');
  
  for (const t of exemploTransacoes) {
    const resultado = classificarTransacao(t.descricao, t.valor);
    console.log(`📄 "${t.descricao}" (R$ ${t.valor.toFixed(2)})`);
    console.log(`   ✓ Tipo: ${resultado.tipo}`);
    console.log(`   ✓ D: ${resultado.debito.codigo} - ${resultado.debito.nome}`);
    console.log(`   ✓ C: ${resultado.credito.codigo} - ${resultado.credito.nome}`);
    console.log(`   ✓ Confiança: ${resultado.confianca}`);
    console.log(`   ✓ Auto: ${resultado.auto_classificar ? 'SIM' : 'NÃO (requer aprovação)'}`);
    console.log();
  }
}

// Salvar classificador
const outputPath = path.join(process.cwd(), 'data', 'accounting_classifier.json');
fs.writeFileSync(outputPath, JSON.stringify(CLASSIFICADOR_CONTABIL, (key, value) => {
  // Converter RegExp para string
  if (value instanceof RegExp) {
    return value.toString();
  }
  // Remover funções da serialização
  if (typeof value === 'function') {
    return undefined;
  }
  return value;
}, 2), 'utf-8');

console.log(`✅ Classificador salvo em: ${outputPath}`);

// Executar testes
testar();

export { CLASSIFICACAO_AUTOMATICA, classificarTransacao, processarLoteTransacoes, CLASSIFICADOR_CONTABIL };
