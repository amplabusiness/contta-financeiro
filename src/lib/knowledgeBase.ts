/**
 * BASE DE CONHECIMENTO COMPLETA - CONTTA FINANCEIRO
 * 
 * Integra todas as bases de conhecimento:
 * - eSocial (eventos de folha de pagamento)
 * - Nota Fiscal (CFOP, CST, NCM, LC 116)
 * - Indicadores MBA (análise financeira)
 * - Lançamentos Contábeis (administrativo, fiscal, trabalhista, jurídico, financeiro)
 * 
 * Autor: Dr. Cícero / Ampla Contabilidade
 * Data: 31/01/2026
 */

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

export interface EventoESocial {
  codigo: string;
  nome: string;
  tipo: 'TABELA' | 'PERIODICO' | 'NAO_PERIODICO';
  periodicidade: string;
  descricao?: string;
}

export interface IncidenciaTributaria {
  codigo: string;
  descricao: string;
  fgts: boolean;
  inss: boolean;
  irrf: boolean;
}

export interface CategoriaTrabalhador {
  codigo: string;
  descricao: string;
}

export interface MotivoAfastamento {
  codigo: string;
  descricao: string;
}

export interface MotivoDesligamento {
  codigo: string;
  descricao: string;
}

export interface CFOP {
  codigo: string;
  descricao: string;
  tipo: 'ENTRADA' | 'SAIDA';
  uf: 'INTERNA' | 'INTERESTADUAL' | 'EXTERIOR';
}

export interface CST {
  codigo: string;
  descricao: string;
  regime?: 'NORMAL' | 'SIMPLES';
  tipo?: 'ENTRADA' | 'SAIDA' | 'AMBOS';
}

export interface ServicoLC116 {
  codigo: string;
  descricao: string;
}

export interface IndicadorFinanceiro {
  nome: string;
  formula: string;
  interpretacao: string;
  ideal: string;
  categoria: 'liquidez' | 'rentabilidade' | 'endividamento' | 'atividade' | 'valuation';
}

export interface LancamentoContabil {
  nome: string;
  debito: string;
  credito: string;
  keywords: string[];
  categoria: 'administrativo' | 'fiscal' | 'trabalhista' | 'juridico' | 'financeiro';
  observacao?: string;
}

// =============================================================================
// BASE DE CONHECIMENTO eSocial
// =============================================================================

export const EVENTOS_ESOCIAL: Record<string, EventoESocial> = {
  // Eventos de Tabela
  'S-1000': { codigo: 'S-1000', nome: 'Informações do Empregador', tipo: 'TABELA', periodicidade: 'Inicial/Alteração' },
  'S-1005': { codigo: 'S-1005', nome: 'Tabela de Estabelecimentos', tipo: 'TABELA', periodicidade: 'Inicial/Alteração' },
  'S-1010': { codigo: 'S-1010', nome: 'Tabela de Rubricas', tipo: 'TABELA', periodicidade: 'Inicial/Alteração', descricao: 'Define rubricas da folha com incidências tributárias' },
  'S-1020': { codigo: 'S-1020', nome: 'Tabela de Lotações Tributárias', tipo: 'TABELA', periodicidade: 'Inicial/Alteração' },
  'S-1070': { codigo: 'S-1070', nome: 'Tabela de Processos Administrativos/Judiciais', tipo: 'TABELA', periodicidade: 'Inicial/Alteração' },
  
  // Eventos Periódicos
  'S-1200': { codigo: 'S-1200', nome: 'Remuneração do Trabalhador Vinculado', tipo: 'PERIODICO', periodicidade: 'Mensal', descricao: 'Informações sobre remuneração de trabalhadores com vínculo' },
  'S-1210': { codigo: 'S-1210', nome: 'Pagamentos de Rendimentos', tipo: 'PERIODICO', periodicidade: 'Mensal', descricao: 'Informações sobre pagamentos efetuados' },
  'S-1260': { codigo: 'S-1260', nome: 'Comercialização da Produção Rural', tipo: 'PERIODICO', periodicidade: 'Mensal' },
  'S-1270': { codigo: 'S-1270', nome: 'Contratação de Avulsos', tipo: 'PERIODICO', periodicidade: 'Mensal' },
  'S-1280': { codigo: 'S-1280', nome: 'Informações Complementares', tipo: 'PERIODICO', periodicidade: 'Mensal' },
  'S-1298': { codigo: 'S-1298', nome: 'Reabertura dos Eventos Periódicos', tipo: 'PERIODICO', periodicidade: 'Eventual' },
  'S-1299': { codigo: 'S-1299', nome: 'Fechamento dos Eventos Periódicos', tipo: 'PERIODICO', periodicidade: 'Mensal', descricao: 'Fecha a folha do mês e gera DCTFWeb' },
  
  // Eventos Não Periódicos
  'S-2190': { codigo: 'S-2190', nome: 'Registro Preliminar do Trabalhador', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
  'S-2200': { codigo: 'S-2200', nome: 'Cadastramento Inicial/Admissão', tipo: 'NAO_PERIODICO', periodicidade: 'Evento', descricao: 'Admissão de empregado com vínculo' },
  'S-2205': { codigo: 'S-2205', nome: 'Alteração de Dados Cadastrais', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
  'S-2206': { codigo: 'S-2206', nome: 'Alteração de Contrato de Trabalho', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
  'S-2210': { codigo: 'S-2210', nome: 'CAT - Comunicação de Acidente de Trabalho', tipo: 'NAO_PERIODICO', periodicidade: 'Evento', descricao: 'Comunicação obrigatória de acidente' },
  'S-2220': { codigo: 'S-2220', nome: 'ASO - Monitoramento da Saúde', tipo: 'NAO_PERIODICO', periodicidade: 'Evento', descricao: 'Atestado de Saúde Ocupacional' },
  'S-2230': { codigo: 'S-2230', nome: 'Afastamento Temporário', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
  'S-2240': { codigo: 'S-2240', nome: 'Condições Ambientais - PPP', tipo: 'NAO_PERIODICO', periodicidade: 'Evento', descricao: 'Perfil Profissiográfico Previdenciário' },
  'S-2250': { codigo: 'S-2250', nome: 'Aviso Prévio', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
  'S-2298': { codigo: 'S-2298', nome: 'Reintegração', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
  'S-2299': { codigo: 'S-2299', nome: 'Desligamento', tipo: 'NAO_PERIODICO', periodicidade: 'Evento', descricao: 'Rescisão de contrato de trabalho' },
  'S-2300': { codigo: 'S-2300', nome: 'TSV - Início', tipo: 'NAO_PERIODICO', periodicidade: 'Evento', descricao: 'Trabalhador Sem Vínculo de Emprego' },
  'S-2306': { codigo: 'S-2306', nome: 'TSV - Alteração', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
  'S-2399': { codigo: 'S-2399', nome: 'TSV - Término', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
  'S-2400': { codigo: 'S-2400', nome: 'Benefício RPPS', tipo: 'NAO_PERIODICO', periodicidade: 'Evento' },
};

export const INCIDENCIAS_TRIBUTARIAS: Record<string, IncidenciaTributaria> = {
  '00': { codigo: '00', descricao: 'Não é base de cálculo', fgts: false, inss: false, irrf: false },
  '11': { codigo: '11', descricao: 'Base FGTS', fgts: true, inss: false, irrf: false },
  '12': { codigo: '12', descricao: 'Base FGTS 13º', fgts: true, inss: false, irrf: false },
  '21': { codigo: '21', descricao: 'Base Previdência', fgts: false, inss: true, irrf: false },
  '22': { codigo: '22', descricao: 'Base Previdência 13º', fgts: false, inss: true, irrf: false },
  '31': { codigo: '31', descricao: 'Base FGTS e Previdência', fgts: true, inss: true, irrf: false },
  '32': { codigo: '32', descricao: 'Base FGTS e Previdência 13º', fgts: true, inss: true, irrf: false },
  '91': { codigo: '91', descricao: 'Incidência suspensa - FGTS', fgts: false, inss: false, irrf: false },
  '92': { codigo: '92', descricao: 'Incidência suspensa - Previdência', fgts: false, inss: false, irrf: false },
  '93': { codigo: '93', descricao: 'Incidência suspensa - FGTS e Previdência', fgts: false, inss: false, irrf: false },
};

export const CATEGORIAS_TRABALHADOR: Record<string, CategoriaTrabalhador> = {
  '101': { codigo: '101', descricao: 'Empregado - Geral' },
  '102': { codigo: '102', descricao: 'Empregado - Trabalhador Rural por Pequeno Prazo' },
  '103': { codigo: '103', descricao: 'Empregado - Aprendiz' },
  '104': { codigo: '104', descricao: 'Empregado - Doméstico' },
  '105': { codigo: '105', descricao: 'Empregado - Contrato a Termo (Lei 9.601/98)' },
  '106': { codigo: '106', descricao: 'Trabalhador Temporário' },
  '107': { codigo: '107', descricao: 'Empregado - Contrato Verde e Amarelo' },
  '111': { codigo: '111', descricao: 'Empregado - Contrato Intermitente' },
  '201': { codigo: '201', descricao: 'Trabalhador Avulso Portuário' },
  '202': { codigo: '202', descricao: 'Trabalhador Avulso Não Portuário' },
  '301': { codigo: '301', descricao: 'Servidor Público - Titular de Cargo Efetivo' },
  '302': { codigo: '302', descricao: 'Servidor Público - Exercente de Cargo em Comissão' },
  '303': { codigo: '303', descricao: 'Agente Político' },
  '305': { codigo: '305', descricao: 'Servidor Público - Contrato Temporário' },
  '401': { codigo: '401', descricao: 'Dirigente Sindical - com Vínculo' },
  '501': { codigo: '501', descricao: 'Contribuinte Individual - Autônomo Geral' },
  '701': { codigo: '701', descricao: 'Contribuinte Individual - Diretor não Empregado' },
  '711': { codigo: '711', descricao: 'Contribuinte Individual - MEI' },
  '721': { codigo: '721', descricao: 'Contribuinte Individual - Transportador Autônomo' },
  '731': { codigo: '731', descricao: 'Contribuinte Individual - Cooperado Produção' },
  '734': { codigo: '734', descricao: 'Contribuinte Individual - Cooperado Trabalho' },
  '901': { codigo: '901', descricao: 'Estagiário' },
  '902': { codigo: '902', descricao: 'Médico Residente' },
  '903': { codigo: '903', descricao: 'Bolsista' },
  '905': { codigo: '905', descricao: 'Atleta não Profissional' },
};

export const MOTIVOS_AFASTAMENTO: Record<string, MotivoAfastamento> = {
  '01': { codigo: '01', descricao: 'Acidente/Doença do Trabalho' },
  '03': { codigo: '03', descricao: 'Acidente/Doença não relacionada ao trabalho' },
  '05': { codigo: '05', descricao: 'Afastamento/Licença prevista em regulamento' },
  '06': { codigo: '06', descricao: 'Aposentadoria por invalidez' },
  '11': { codigo: '11', descricao: 'Cárcere' },
  '12': { codigo: '12', descricao: 'Cargo Eletivo' },
  '14': { codigo: '14', descricao: 'Cessão/Requisição' },
  '15': { codigo: '15', descricao: 'Gozo de férias ou recesso' },
  '16': { codigo: '16', descricao: 'Licença remunerada' },
  '17': { codigo: '17', descricao: 'Licença Maternidade' },
  '18': { codigo: '18', descricao: 'Licença Maternidade - antecipação parto' },
  '19': { codigo: '19', descricao: 'Licença Maternidade - prorrogação (Empresa Cidadã)' },
  '20': { codigo: '20', descricao: 'Licença Maternidade - aborto não criminoso' },
  '21': { codigo: '21', descricao: 'Licença Maternidade - adoção/guarda judicial' },
  '22': { codigo: '22', descricao: 'Licença não remunerada ou sem vencimentos' },
  '25': { codigo: '25', descricao: 'Mulher Vítima de Violência Doméstica' },
  '27': { codigo: '27', descricao: 'Qualificação' },
  '29': { codigo: '29', descricao: 'Serviço Militar Obrigatório' },
  '30': { codigo: '30', descricao: 'Suspensão Disciplinar' },
  '33': { codigo: '33', descricao: 'Licença Paternidade' },
  '35': { codigo: '35', descricao: 'Licença para Tratamento de Saúde' },
};

export const MOTIVOS_DESLIGAMENTO: Record<string, MotivoDesligamento> = {
  '01': { codigo: '01', descricao: 'Rescisão com justa causa por iniciativa do empregador' },
  '02': { codigo: '02', descricao: 'Rescisão sem justa causa por iniciativa do empregador' },
  '03': { codigo: '03', descricao: 'Rescisão antecipada do contrato a termo pelo empregador' },
  '04': { codigo: '04', descricao: 'Rescisão antecipada do contrato a termo pelo empregado' },
  '05': { codigo: '05', descricao: 'Rescisão por culpa recíproca' },
  '06': { codigo: '06', descricao: 'Rescisão por término do contrato a termo' },
  '07': { codigo: '07', descricao: 'Pedido de demissão' },
  '09': { codigo: '09', descricao: 'Rescisão por falecimento do empregador individual' },
  '10': { codigo: '10', descricao: 'Rescisão por falecimento do empregado' },
  '11': { codigo: '11', descricao: 'Transferência para empresa do mesmo grupo' },
  '13': { codigo: '13', descricao: 'Desligamento por encerramento da empresa' },
  '15': { codigo: '15', descricao: 'Rescisão por acordo entre as partes (Art. 484-A CLT)' },
  '17': { codigo: '17', descricao: 'Rescisão indireta do contrato de trabalho' },
  '19': { codigo: '19', descricao: 'Aposentadoria por invalidez' },
  '20': { codigo: '20', descricao: 'Aposentadoria por idade/tempo de contribuição' },
};

// =============================================================================
// BASE DE CONHECIMENTO NOTA FISCAL
// =============================================================================

export const CFOP_PRINCIPAIS: Record<string, CFOP> = {
  // Entradas Internas
  '1.102': { codigo: '1.102', descricao: 'Compra para comercialização', tipo: 'ENTRADA', uf: 'INTERNA' },
  '1.403': { codigo: '1.403', descricao: 'Compra para comercialização c/ ST', tipo: 'ENTRADA', uf: 'INTERNA' },
  '1.551': { codigo: '1.551', descricao: 'Compra de bem para ativo imobilizado', tipo: 'ENTRADA', uf: 'INTERNA' },
  '1.556': { codigo: '1.556', descricao: 'Compra de material uso/consumo', tipo: 'ENTRADA', uf: 'INTERNA' },
  '1.201': { codigo: '1.201', descricao: 'Devolução de venda de produção própria', tipo: 'ENTRADA', uf: 'INTERNA' },
  '1.202': { codigo: '1.202', descricao: 'Devolução de venda de mercadoria', tipo: 'ENTRADA', uf: 'INTERNA' },
  '1.910': { codigo: '1.910', descricao: 'Entrada de bonificação/doação/brinde', tipo: 'ENTRADA', uf: 'INTERNA' },
  '1.949': { codigo: '1.949', descricao: 'Outra entrada não especificada', tipo: 'ENTRADA', uf: 'INTERNA' },
  
  // Entradas Interestaduais
  '2.102': { codigo: '2.102', descricao: 'Compra para comercialização', tipo: 'ENTRADA', uf: 'INTERESTADUAL' },
  '2.403': { codigo: '2.403', descricao: 'Compra para comercialização c/ ST', tipo: 'ENTRADA', uf: 'INTERESTADUAL' },
  
  // Entradas do Exterior
  '3.102': { codigo: '3.102', descricao: 'Compra para comercialização', tipo: 'ENTRADA', uf: 'EXTERIOR' },
  
  // Saídas Internas
  '5.101': { codigo: '5.101', descricao: 'Venda de produção do estabelecimento', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.102': { codigo: '5.102', descricao: 'Venda de mercadoria adquirida', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.401': { codigo: '5.401', descricao: 'Venda de produção c/ ST (substituto)', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.405': { codigo: '5.405', descricao: 'Venda de mercadoria c/ ST (substituído)', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.202': { codigo: '5.202', descricao: 'Devolução de compra para comercialização', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.411': { codigo: '5.411', descricao: 'Devolução de compra c/ ST', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.910': { codigo: '5.910', descricao: 'Remessa em bonificação/doação/brinde', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.911': { codigo: '5.911', descricao: 'Remessa de amostra grátis', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.912': { codigo: '5.912', descricao: 'Remessa para demonstração', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.915': { codigo: '5.915', descricao: 'Remessa para conserto/reparo', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.916': { codigo: '5.916', descricao: 'Retorno de mercadoria de conserto', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.933': { codigo: '5.933', descricao: 'Prestação de serviço c/ ISSQN', tipo: 'SAIDA', uf: 'INTERNA' },
  '5.949': { codigo: '5.949', descricao: 'Outra saída não especificada', tipo: 'SAIDA', uf: 'INTERNA' },
  
  // Saídas Interestaduais
  '6.102': { codigo: '6.102', descricao: 'Venda de mercadoria adquirida', tipo: 'SAIDA', uf: 'INTERESTADUAL' },
  '6.108': { codigo: '6.108', descricao: 'Venda para não contribuinte', tipo: 'SAIDA', uf: 'INTERESTADUAL' },
  
  // Saídas para Exterior
  '7.101': { codigo: '7.101', descricao: 'Venda de produção para exterior', tipo: 'SAIDA', uf: 'EXTERIOR' },
  '7.102': { codigo: '7.102', descricao: 'Venda de mercadoria para exterior', tipo: 'SAIDA', uf: 'EXTERIOR' },
};

export const CST_ICMS: Record<string, CST> = {
  '00': { codigo: '00', descricao: 'Tributada integralmente', regime: 'NORMAL' },
  '10': { codigo: '10', descricao: 'Tributada c/ cobrança de ICMS por ST', regime: 'NORMAL' },
  '20': { codigo: '20', descricao: 'Com redução de base de cálculo', regime: 'NORMAL' },
  '30': { codigo: '30', descricao: 'Isenta/não tributada c/ cobrança ST', regime: 'NORMAL' },
  '40': { codigo: '40', descricao: 'Isenta', regime: 'NORMAL' },
  '41': { codigo: '41', descricao: 'Não tributada', regime: 'NORMAL' },
  '50': { codigo: '50', descricao: 'Suspensão', regime: 'NORMAL' },
  '51': { codigo: '51', descricao: 'Diferimento', regime: 'NORMAL' },
  '60': { codigo: '60', descricao: 'ICMS cobrado anteriormente por ST', regime: 'NORMAL' },
  '70': { codigo: '70', descricao: 'Redução BC c/ cobrança ST', regime: 'NORMAL' },
  '90': { codigo: '90', descricao: 'Outros', regime: 'NORMAL' },
};

export const CSOSN_SIMPLES: Record<string, CST> = {
  '101': { codigo: '101', descricao: 'Tributada com permissão de crédito', regime: 'SIMPLES' },
  '102': { codigo: '102', descricao: 'Tributada sem permissão de crédito', regime: 'SIMPLES' },
  '103': { codigo: '103', descricao: 'Isenção por faixa de receita bruta', regime: 'SIMPLES' },
  '201': { codigo: '201', descricao: 'Tributada c/ crédito e ST', regime: 'SIMPLES' },
  '202': { codigo: '202', descricao: 'Tributada s/ crédito e c/ ST', regime: 'SIMPLES' },
  '203': { codigo: '203', descricao: 'Isenção faixa receita c/ ST', regime: 'SIMPLES' },
  '300': { codigo: '300', descricao: 'Imune', regime: 'SIMPLES' },
  '400': { codigo: '400', descricao: 'Não tributada pelo Simples', regime: 'SIMPLES' },
  '500': { codigo: '500', descricao: 'ICMS cobrado anteriormente por ST', regime: 'SIMPLES' },
  '900': { codigo: '900', descricao: 'Outros', regime: 'SIMPLES' },
};

export const CST_PIS_COFINS: Record<string, CST> = {
  '01': { codigo: '01', descricao: 'Operação Tributável - Alíquota Básica', tipo: 'SAIDA' },
  '02': { codigo: '02', descricao: 'Operação Tributável - Alíquota Diferenciada', tipo: 'SAIDA' },
  '04': { codigo: '04', descricao: 'Operação Tributável - Monofásica Revenda Alíq Zero', tipo: 'SAIDA' },
  '05': { codigo: '05', descricao: 'Operação Tributável - ST', tipo: 'SAIDA' },
  '06': { codigo: '06', descricao: 'Operação Tributável - Alíquota Zero', tipo: 'SAIDA' },
  '07': { codigo: '07', descricao: 'Operação Isenta da Contribuição', tipo: 'SAIDA' },
  '08': { codigo: '08', descricao: 'Operação sem Incidência', tipo: 'SAIDA' },
  '09': { codigo: '09', descricao: 'Operação com Suspensão', tipo: 'SAIDA' },
  '49': { codigo: '49', descricao: 'Outras Operações de Saída', tipo: 'SAIDA' },
  '50': { codigo: '50', descricao: 'Operação c/ Direito a Crédito - Vinc. Receita Tributada', tipo: 'ENTRADA' },
  '51': { codigo: '51', descricao: 'Operação c/ Direito a Crédito - Vinc. Receita Não Trib.', tipo: 'ENTRADA' },
  '52': { codigo: '52', descricao: 'Operação c/ Direito a Crédito - Vinc. Exportação', tipo: 'ENTRADA' },
  '70': { codigo: '70', descricao: 'Operação de Aquisição sem Direito a Crédito', tipo: 'ENTRADA' },
  '71': { codigo: '71', descricao: 'Operação de Aquisição com Isenção', tipo: 'ENTRADA' },
  '72': { codigo: '72', descricao: 'Operação de Aquisição com Suspensão', tipo: 'ENTRADA' },
  '73': { codigo: '73', descricao: 'Operação de Aquisição a Alíquota Zero', tipo: 'ENTRADA' },
  '98': { codigo: '98', descricao: 'Outras Operações de Entrada', tipo: 'ENTRADA' },
  '99': { codigo: '99', descricao: 'Outras Operações', tipo: 'AMBOS' },
};

export const SERVICOS_LC116: Record<string, ServicoLC116> = {
  '01': { codigo: '01', descricao: 'Serviços de informática e congêneres' },
  '02': { codigo: '02', descricao: 'Serviços de pesquisas e desenvolvimento' },
  '03': { codigo: '03', descricao: 'Serviços de locação, cessão de direito de uso' },
  '04': { codigo: '04', descricao: 'Serviços de saúde, assistência médica' },
  '05': { codigo: '05', descricao: 'Serviços de medicina veterinária' },
  '06': { codigo: '06', descricao: 'Serviços de cuidados pessoais, estética' },
  '07': { codigo: '07', descricao: 'Serviços de engenharia, arquitetura, construção civil' },
  '08': { codigo: '08', descricao: 'Serviços de educação, ensino, treinamento' },
  '09': { codigo: '09', descricao: 'Serviços de hospedagem, turismo, viagens' },
  '10': { codigo: '10', descricao: 'Serviços de intermediação' },
  '11': { codigo: '11', descricao: 'Serviços de guarda, estacionamento, vigilância' },
  '12': { codigo: '12', descricao: 'Serviços de diversões, lazer, entretenimento' },
  '13': { codigo: '13', descricao: 'Serviços de fonografia, fotografia, cinematografia' },
  '14': { codigo: '14', descricao: 'Serviços relativos a bens de terceiros' },
  '15': { codigo: '15', descricao: 'Serviços bancários ou financeiros' },
  '16': { codigo: '16', descricao: 'Serviços de transporte municipal' },
  '17': { codigo: '17', descricao: 'Serviços de apoio técnico, administrativo, jurídico, contábil' },
  '18': { codigo: '18', descricao: 'Serviços de regulação de sinistros, seguros' },
  '19': { codigo: '19', descricao: 'Serviços de distribuição de bilhetes de loteria' },
  '20': { codigo: '20', descricao: 'Serviços portuários, aeroportuários, rodoviários' },
  '21': { codigo: '21', descricao: 'Serviços de registros públicos, cartorários' },
  '22': { codigo: '22', descricao: 'Serviços de exploração de rodovia' },
  '23': { codigo: '23', descricao: 'Serviços de programação visual, design' },
  '24': { codigo: '24', descricao: 'Serviços de chaveiros, carimbos, placas' },
  '25': { codigo: '25', descricao: 'Serviços funerários' },
  '26': { codigo: '26', descricao: 'Serviços de correios, entrega' },
  '27': { codigo: '27', descricao: 'Serviços de assistência social' },
  '28': { codigo: '28', descricao: 'Serviços de avaliação de bens' },
  '29': { codigo: '29', descricao: 'Serviços de biblioteconomia' },
  '30': { codigo: '30', descricao: 'Serviços de biologia, biotecnologia, química' },
  '31': { codigo: '31', descricao: 'Serviços técnicos em edificações, eletrônica' },
  '32': { codigo: '32', descricao: 'Serviços de desenhos técnicos' },
  '33': { codigo: '33', descricao: 'Serviços de desembaraço aduaneiro, despachantes' },
  '34': { codigo: '34', descricao: 'Serviços de investigações particulares, detetives' },
  '35': { codigo: '35', descricao: 'Serviços de reportagem, assessoria de imprensa' },
  '36': { codigo: '36', descricao: 'Serviços de meteorologia' },
  '37': { codigo: '37', descricao: 'Serviços de artistas, atletas, modelos' },
  '38': { codigo: '38', descricao: 'Serviços de museologia' },
  '39': { codigo: '39', descricao: 'Serviços de ourivesaria e lapidação' },
  '40': { codigo: '40', descricao: 'Serviços de obras de arte sob encomenda' },
};

// =============================================================================
// BASE DE CONHECIMENTO INDICADORES MBA
// =============================================================================

export const INDICADORES_FINANCEIROS: IndicadorFinanceiro[] = [
  // Liquidez
  { nome: 'Liquidez Corrente', formula: 'Ativo Circulante / Passivo Circulante', interpretacao: '> 1 indica capacidade de pagar obrigações de curto prazo', ideal: '> 1,5', categoria: 'liquidez' },
  { nome: 'Liquidez Seca', formula: '(AC - Estoques) / PC', interpretacao: 'Exclui estoques por serem menos líquidos', ideal: '> 1,0', categoria: 'liquidez' },
  { nome: 'Liquidez Imediata', formula: 'Disponível / PC', interpretacao: 'Capacidade de pagamento imediato', ideal: '> 0,2', categoria: 'liquidez' },
  { nome: 'Liquidez Geral', formula: '(AC + RLP) / (PC + PNC)', interpretacao: 'Capacidade de pagamento total', ideal: '> 1,0', categoria: 'liquidez' },
  { nome: 'Capital Circulante Líquido', formula: 'AC - PC', interpretacao: 'Folga financeira de curto prazo', ideal: 'Positivo', categoria: 'liquidez' },
  
  // Rentabilidade
  { nome: 'ROE', formula: 'Lucro Líquido / Patrimônio Líquido', interpretacao: 'Retorno sobre capital próprio', ideal: '> 15%', categoria: 'rentabilidade' },
  { nome: 'ROA', formula: 'Lucro Líquido / Ativo Total', interpretacao: 'Retorno sobre ativos totais', ideal: '> 5%', categoria: 'rentabilidade' },
  { nome: 'ROI', formula: '(Ganho - Custo) / Custo', interpretacao: 'Retorno sobre investimento específico', ideal: '> 0', categoria: 'rentabilidade' },
  { nome: 'Margem Bruta', formula: '(Receita - CMV) / Receita', interpretacao: 'Lucro bruto por real de venda', ideal: 'Varia por setor', categoria: 'rentabilidade' },
  { nome: 'Margem Operacional', formula: 'Lucro Operacional / Receita', interpretacao: 'Eficiência operacional', ideal: '> 10%', categoria: 'rentabilidade' },
  { nome: 'Margem Líquida', formula: 'Lucro Líquido / Receita', interpretacao: 'Lucro final por real de venda', ideal: '> 5%', categoria: 'rentabilidade' },
  { nome: 'EBITDA', formula: 'Lucro Operacional + Depreciação + Amortização', interpretacao: 'Geração de caixa operacional', ideal: 'Positivo crescente', categoria: 'rentabilidade' },
  
  // Endividamento
  { nome: 'Endividamento Geral', formula: '(PC + PNC) / Ativo Total', interpretacao: 'Proporção de capital de terceiros', ideal: '< 60%', categoria: 'endividamento' },
  { nome: 'Composição Endividamento', formula: 'PC / (PC + PNC)', interpretacao: 'Concentração no curto prazo', ideal: '< 50%', categoria: 'endividamento' },
  { nome: 'Grau Alavancagem Financeira', formula: 'ROE / ROA', interpretacao: 'Efeito da dívida na rentabilidade', ideal: '> 1', categoria: 'endividamento' },
  { nome: 'Cobertura de Juros', formula: 'EBITDA / Despesas Financeiras', interpretacao: 'Capacidade de pagar juros', ideal: '> 3x', categoria: 'endividamento' },
  
  // Atividade
  { nome: 'PMR (Prazo Médio Recebimento)', formula: '(Contas a Receber / Receita) x 360', interpretacao: 'Dias para receber vendas', ideal: '< 45 dias', categoria: 'atividade' },
  { nome: 'PMP (Prazo Médio Pagamento)', formula: '(Fornecedores / Compras) x 360', interpretacao: 'Dias para pagar fornecedores', ideal: '> PMR', categoria: 'atividade' },
  { nome: 'PME (Prazo Médio Estocagem)', formula: '(Estoque / CMV) x 360', interpretacao: 'Dias de estoque', ideal: '< 60 dias', categoria: 'atividade' },
  { nome: 'Ciclo Operacional', formula: 'PME + PMR', interpretacao: 'Ciclo completo de operação', ideal: 'Menor possível', categoria: 'atividade' },
  { nome: 'Ciclo Financeiro', formula: 'PME + PMR - PMP', interpretacao: 'Necessidade de capital de giro', ideal: '< 30 dias', categoria: 'atividade' },
  { nome: 'Giro do Ativo', formula: 'Receita / Ativo Total', interpretacao: 'Vendas geradas por ativo', ideal: '> 1x', categoria: 'atividade' },
  
  // Valuation
  { nome: 'EV/EBITDA', formula: 'Enterprise Value / EBITDA', interpretacao: 'Múltiplo de valor da empresa', ideal: '< 10x', categoria: 'valuation' },
  { nome: 'P/L', formula: 'Preço por Ação / Lucro por Ação', interpretacao: 'Múltiplo de lucro', ideal: '< 15x', categoria: 'valuation' },
  { nome: 'P/VPA', formula: 'Preço por Ação / Valor Patrimonial por Ação', interpretacao: 'Múltiplo de patrimônio', ideal: '< 2x', categoria: 'valuation' },
  { nome: 'WACC', formula: 'Ke x (E/(D+E)) + Kd x (1-t) x (D/(D+E))', interpretacao: 'Custo médio ponderado de capital', ideal: 'Menor que ROA', categoria: 'valuation' },
];

// =============================================================================
// BASE DE CONHECIMENTO LANÇAMENTOS CONTÁBEIS
// =============================================================================

export const LANCAMENTOS_CONTABEIS: LancamentoContabil[] = [
  // ADMINISTRATIVO
  { nome: 'Material de Expediente', debito: '4.1.1.10', credito: '1.1.1.02', keywords: ['material', 'escritorio', 'expediente', 'papelaria'], categoria: 'administrativo' },
  { nome: 'Manutenção e Reparos', debito: '4.1.1.15', credito: '1.1.1.02', keywords: ['manutencao', 'reparo', 'conserto'], categoria: 'administrativo' },
  { nome: 'Serviços de Terceiros PJ', debito: '4.1.1.20', credito: '1.1.1.02', keywords: ['servico', 'terceiro', 'pj', 'prestador'], categoria: 'administrativo' },
  { nome: 'Viagens e Hospedagem', debito: '4.1.1.25', credito: '1.1.1.02', keywords: ['viagem', 'hotel', 'hospedagem', 'passagem', 'diaria'], categoria: 'administrativo' },
  { nome: 'Combustíveis', debito: '4.1.1.30', credito: '1.1.1.02', keywords: ['combustivel', 'gasolina', 'diesel', 'alcool', 'etanol', 'posto'], categoria: 'administrativo' },
  { nome: 'Correios e Malotes', debito: '4.1.1.35', credito: '1.1.1.02', keywords: ['correio', 'sedex', 'malote', 'frete', 'pac'], categoria: 'administrativo' },
  { nome: 'Software e Licenças', debito: '4.1.1.40', credito: '1.1.1.02', keywords: ['software', 'licenca', 'sistema', 'assinatura', 'saas'], categoria: 'administrativo' },
  { nome: 'Treinamento e Capacitação', debito: '4.1.1.45', credito: '1.1.1.02', keywords: ['treinamento', 'curso', 'capacitacao', 'certificacao'], categoria: 'administrativo' },
  { nome: 'Seguros', debito: '4.1.1.50', credito: '1.1.1.02', keywords: ['seguro', 'apolice', 'sinistro'], categoria: 'administrativo' },
  { nome: 'Despesas de Cartório', debito: '4.1.1.55', credito: '1.1.1.02', keywords: ['cartorio', 'registro', 'autenticacao', 'reconhecimento'], categoria: 'administrativo' },
  { nome: 'Publicidade e Propaganda', debito: '4.1.1.60', credito: '1.1.1.02', keywords: ['publicidade', 'propaganda', 'marketing', 'anuncio', 'midia'], categoria: 'administrativo' },
  { nome: 'Brindes', debito: '4.1.1.65', credito: '1.1.1.02', keywords: ['brinde', 'presente', 'promocional', 'mimo'], categoria: 'administrativo' },
  { nome: 'Limpeza e Conservação', debito: '4.1.1.70', credito: '1.1.1.02', keywords: ['limpeza', 'conservacao', 'zeladoria', 'faxina'], categoria: 'administrativo' },
  { nome: 'Vigilância e Segurança', debito: '4.1.1.75', credito: '1.1.1.02', keywords: ['vigilancia', 'seguranca', 'monitoramento', 'alarme'], categoria: 'administrativo' },
  { nome: 'Honorários Profissionais', debito: '4.1.1.80', credito: '1.1.1.02', keywords: ['honorario', 'contador', 'advogado', 'consultor'], categoria: 'administrativo' },
  
  // FISCAL
  { nome: 'ICMS a Recolher', debito: '4.3.1.01', credito: '2.1.2.01', keywords: ['icms', 'apuracao', 'imposto'], categoria: 'fiscal', observacao: 'Apuração mensal ICMS' },
  { nome: 'ICMS ST a Recolher', debito: '1.1.5.01', credito: '2.1.2.02', keywords: ['icms', 'st', 'substituicao', 'tributaria'], categoria: 'fiscal' },
  { nome: 'IPI a Recolher', debito: '4.3.1.02', credito: '2.1.2.03', keywords: ['ipi', 'apuracao', 'industria'], categoria: 'fiscal' },
  { nome: 'Crédito PIS/COFINS', debito: '1.1.5.02', credito: '2.1.2.04', keywords: ['pis', 'cofins', 'credito', 'nao cumulativo'], categoria: 'fiscal' },
  { nome: 'ISS a Recolher', debito: '4.3.1.03', credito: '2.1.2.05', keywords: ['iss', 'issqn', 'servico', 'municipal'], categoria: 'fiscal' },
  { nome: 'IRPJ a Recolher', debito: '4.3.2.01', credito: '2.1.2.06', keywords: ['irpj', 'imposto', 'renda', 'pessoa', 'juridica'], categoria: 'fiscal' },
  { nome: 'CSLL a Recolher', debito: '4.3.2.02', credito: '2.1.2.07', keywords: ['csll', 'contribuicao', 'social', 'lucro'], categoria: 'fiscal' },
  { nome: 'Simples Nacional', debito: '4.3.2.03', credito: '2.1.2.08', keywords: ['das', 'simples', 'nacional', 'darf'], categoria: 'fiscal' },
  { nome: 'DIFAL', debito: '4.3.1.04', credito: '2.1.2.09', keywords: ['difal', 'diferencial', 'aliquota', 'interestadual'], categoria: 'fiscal' },
  { nome: 'Parcelamento de Tributos', debito: '2.1.2.10', credito: '1.1.1.02', keywords: ['parcelamento', 'refis', 'pert', 'pgfn'], categoria: 'fiscal' },
  { nome: 'Compensação de Tributos', debito: '2.1.2.11', credito: '1.1.5.03', keywords: ['compensacao', 'perdcomp', 'credito', 'tributario'], categoria: 'fiscal' },
  
  // TRABALHISTA
  { nome: 'Provisão de Salários', debito: '4.1.2.01', credito: '2.1.1.01', keywords: ['salario', 'folha', 'remuneracao', 'vencimento'], categoria: 'trabalhista' },
  { nome: 'FGTS', debito: '4.1.2.02', credito: '2.1.1.02', keywords: ['fgts', 'fundo', 'garantia', 'gfip', 'sefip'], categoria: 'trabalhista' },
  { nome: 'INSS Patronal', debito: '4.1.2.03', credito: '2.1.1.03', keywords: ['inss', 'patronal', 'previdencia', 'contribuicao'], categoria: 'trabalhista' },
  { nome: 'Provisão de Férias', debito: '4.1.2.04', credito: '2.1.1.04', keywords: ['ferias', 'provisao', 'abono', 'terco'], categoria: 'trabalhista' },
  { nome: 'Provisão 13º Salário', debito: '4.1.2.05', credito: '2.1.1.05', keywords: ['13', 'decimo', 'terceiro', 'gratificacao'], categoria: 'trabalhista' },
  { nome: 'Rescisão Trabalhista', debito: '4.1.2.06', credito: '2.1.1.06', keywords: ['rescisao', 'desligamento', 'demissao', 'homologacao'], categoria: 'trabalhista' },
  { nome: 'Aviso Prévio', debito: '4.1.2.07', credito: '2.1.1.07', keywords: ['aviso', 'previo', 'indenizado', 'trabalhado'], categoria: 'trabalhista' },
  { nome: 'IRRF s/ Salários', debito: '2.1.1.01', credito: '2.1.2.12', keywords: ['irrf', 'retido', 'salario', 'fonte'], categoria: 'trabalhista' },
  { nome: 'Vale Transporte', debito: '4.1.2.08', credito: '1.1.1.02', keywords: ['vale', 'transporte', 'vt', 'bilhete', 'onibus'], categoria: 'trabalhista' },
  { nome: 'Vale Alimentação/Refeição', debito: '4.1.2.09', credito: '1.1.1.02', keywords: ['vale', 'alimentacao', 'refeicao', 'va', 'vr', 'alelo', 'ticket'], categoria: 'trabalhista' },
  { nome: 'Plano de Saúde', debito: '4.1.2.10', credito: '1.1.1.02', keywords: ['plano', 'saude', 'unimed', 'amil', 'bradesco'], categoria: 'trabalhista' },
  { nome: 'Pensão Alimentícia', debito: '2.1.1.01', credito: '2.1.1.08', keywords: ['pensao', 'alimenticia', 'judicial'], categoria: 'trabalhista' },
  { nome: 'Contribuição Sindical', debito: '2.1.1.01', credito: '2.1.1.09', keywords: ['contribuicao', 'sindical', 'sindicato'], categoria: 'trabalhista' },
  { nome: 'PLR', debito: '4.1.2.11', credito: '2.1.1.10', keywords: ['plr', 'participacao', 'lucros', 'resultados'], categoria: 'trabalhista' },
  { nome: 'Adiantamento Salarial', debito: '1.1.3.01', credito: '1.1.1.02', keywords: ['adiantamento', 'salarial', 'vale'], categoria: 'trabalhista' },
  { nome: 'Horas Extras', debito: '4.1.2.12', credito: '2.1.1.01', keywords: ['hora', 'extra', 'adicional', 'he'], categoria: 'trabalhista' },
  
  // JURÍDICO
  { nome: 'Provisão Contingência Trabalhista', debito: '4.1.5.01', credito: '2.2.1.01', keywords: ['contingencia', 'trabalhista', 'provisao', 'reclamacao'], categoria: 'juridico' },
  { nome: 'Provisão Contingência Tributária', debito: '4.1.5.02', credito: '2.2.1.02', keywords: ['contingencia', 'tributaria', 'fiscal', 'auto', 'infracao'], categoria: 'juridico' },
  { nome: 'Provisão Contingência Cível', debito: '4.1.5.03', credito: '2.2.1.03', keywords: ['contingencia', 'civel', 'judicial', 'processo'], categoria: 'juridico' },
  { nome: 'Depósito Judicial', debito: '1.2.4.01', credito: '1.1.1.02', keywords: ['deposito', 'judicial', 'recursal', 'cautelar'], categoria: 'juridico' },
  { nome: 'Honorários Sucumbência', debito: '4.1.1.85', credito: '1.1.1.02', keywords: ['honorario', 'sucumbencia', 'advogado', 'perda'], categoria: 'juridico' },
  { nome: 'Multas e Penalidades', debito: '4.1.5.04', credito: '1.1.1.02', keywords: ['multa', 'penalidade', 'infracao', 'auto'], categoria: 'juridico' },
  { nome: 'Acordos Judiciais', debito: '2.2.1.04', credito: '1.1.1.02', keywords: ['acordo', 'judicial', 'homologacao', 'transacao'], categoria: 'juridico' },
  { nome: 'Reversão de Provisão', debito: '2.2.1.01', credito: '3.2.3.01', keywords: ['reversao', 'provisao', 'baixa'], categoria: 'juridico' },
  { nome: 'Atualização Depósitos Judiciais', debito: '1.2.4.01', credito: '3.2.1.01', keywords: ['atualizacao', 'deposito', 'judicial', 'rendimento'], categoria: 'juridico' },
  
  // FINANCEIRO
  { nome: 'Empréstimo Bancário', debito: '1.1.1.02', credito: '2.1.3.01', keywords: ['emprestimo', 'contratacao', 'banco', 'liberacao'], categoria: 'financeiro' },
  { nome: 'Juros de Empréstimo', debito: '4.2.1.01', credito: '2.1.3.02', keywords: ['juros', 'emprestimo', 'financeiro', 'encargo'], categoria: 'financeiro' },
  { nome: 'Amortização Empréstimo', debito: '2.1.3.01', credito: '1.1.1.02', keywords: ['amortizacao', 'parcela', 'emprestimo', 'principal'], categoria: 'financeiro' },
  { nome: 'Leasing/Financiamento', debito: '1.2.3.01', credito: '2.2.2.01', keywords: ['leasing', 'financiamento', 'arrendamento', 'finame'], categoria: 'financeiro' },
  { nome: 'Aplicação Financeira', debito: '1.1.1.10', credito: '1.1.1.02', keywords: ['aplicacao', 'cdb', 'poupanca', 'investimento', 'renda fixa'], categoria: 'financeiro' },
  { nome: 'Rendimento de Aplicação', debito: '1.1.1.10', credito: '3.2.1.01', keywords: ['rendimento', 'juros', 'aplicacao', 'receita'], categoria: 'financeiro' },
  { nome: 'IOF', debito: '4.2.1.02', credito: '1.1.1.02', keywords: ['iof', 'imposto', 'operacao', 'financeira'], categoria: 'financeiro' },
  { nome: 'Variação Cambial Ativa', debito: '1.1.5.04', credito: '3.2.1.02', keywords: ['variacao', 'cambial', 'ativa', 'dolar', 'euro'], categoria: 'financeiro' },
  { nome: 'Variação Cambial Passiva', debito: '4.2.1.03', credito: '2.1.3.03', keywords: ['variacao', 'cambial', 'passiva', 'despesa'], categoria: 'financeiro' },
  { nome: 'Juros de Mora Recebidos', debito: '1.1.1.02', credito: '3.2.1.03', keywords: ['juros', 'mora', 'recebido', 'multa', 'atraso'], categoria: 'financeiro' },
  { nome: 'Juros de Mora Pagos', debito: '4.2.1.04', credito: '1.1.1.02', keywords: ['juros', 'mora', 'atraso', 'pago', 'multa'], categoria: 'financeiro' },
  { nome: 'Desconto Obtido', debito: '2.1.3.04', credito: '3.2.1.04', keywords: ['desconto', 'obtido', 'abatimento', 'bonificacao'], categoria: 'financeiro' },
  { nome: 'Desconto Concedido', debito: '4.2.1.05', credito: '1.1.2.01', keywords: ['desconto', 'concedido', 'abatimento', 'cliente'], categoria: 'financeiro' },
  { nome: 'Antecipação de Recebíveis', debito: '1.1.1.02', credito: '2.1.5.01', keywords: ['antecipacao', 'recebiveis', 'factoring', 'fomento'], categoria: 'financeiro' },
  { nome: 'Duplicatas Descontadas', debito: '1.1.1.02', credito: '2.1.5.02', keywords: ['duplicata', 'descontada', 'bordero', 'titulo'], categoria: 'financeiro' },
  { nome: 'Taxa Cartão de Crédito', debito: '4.2.1.06', credito: '1.1.2.02', keywords: ['cartao', 'credito', 'taxa', 'maquininha', 'mdr'], categoria: 'financeiro' },
  { nome: 'Adiantamento de Cliente', debito: '1.1.1.02', credito: '2.1.4.01', keywords: ['adiantamento', 'cliente', 'sinal', 'entrada'], categoria: 'financeiro' },
  { nome: 'Adiantamento a Fornecedor', debito: '1.1.3.02', credito: '1.1.1.02', keywords: ['adiantamento', 'fornecedor', 'pagamento', 'antecipado'], categoria: 'financeiro' },
  { nome: 'AVP Ativo', debito: '1.1.2.01', credito: '1.1.2.99', keywords: ['avp', 'ajuste', 'valor', 'presente', 'ativo'], categoria: 'financeiro' },
  { nome: 'AVP Passivo', debito: '2.1.3.99', credito: '2.1.3.05', keywords: ['avp', 'ajuste', 'valor', 'presente', 'passivo'], categoria: 'financeiro' },
];

// =============================================================================
// FUNÇÕES DE BUSCA E CONSULTA
// =============================================================================

/**
 * Busca evento eSocial por código
 */
export function buscarEventoESocial(codigo: string): EventoESocial | null {
  return EVENTOS_ESOCIAL[codigo.toUpperCase()] || null;
}

/**
 * Busca eventos eSocial por tipo
 */
export function buscarEventosPorTipo(tipo: 'TABELA' | 'PERIODICO' | 'NAO_PERIODICO'): EventoESocial[] {
  return Object.values(EVENTOS_ESOCIAL).filter(e => e.tipo === tipo);
}

/**
 * Busca categoria de trabalhador
 */
export function buscarCategoriaTrabalhador(codigo: string): CategoriaTrabalhador | null {
  return CATEGORIAS_TRABALHADOR[codigo] || null;
}

/**
 * Busca motivo de afastamento
 */
export function buscarMotivoAfastamento(codigo: string): MotivoAfastamento | null {
  return MOTIVOS_AFASTAMENTO[codigo] || null;
}

/**
 * Busca motivo de desligamento
 */
export function buscarMotivoDesligamento(codigo: string): MotivoDesligamento | null {
  return MOTIVOS_DESLIGAMENTO[codigo] || null;
}

/**
 * Busca CFOP por código
 */
export function buscarCFOP(codigo: string): CFOP | null {
  return CFOP_PRINCIPAIS[codigo] || null;
}

/**
 * Busca CFOPs por tipo de operação
 */
export function buscarCFOPsPorTipo(tipo: 'ENTRADA' | 'SAIDA', uf?: 'INTERNA' | 'INTERESTADUAL' | 'EXTERIOR'): CFOP[] {
  let cfops = Object.values(CFOP_PRINCIPAIS).filter(c => c.tipo === tipo);
  if (uf) {
    cfops = cfops.filter(c => c.uf === uf);
  }
  return cfops;
}

/**
 * Busca CST ICMS
 */
export function buscarCSTIcms(codigo: string): CST | null {
  return CST_ICMS[codigo] || null;
}

/**
 * Busca CSOSN Simples Nacional
 */
export function buscarCSOSN(codigo: string): CST | null {
  return CSOSN_SIMPLES[codigo] || null;
}

/**
 * Busca CST PIS/COFINS
 */
export function buscarCSTPisCofins(codigo: string): CST | null {
  return CST_PIS_COFINS[codigo] || null;
}

/**
 * Busca serviço LC 116
 */
export function buscarServicoLC116(codigo: string): ServicoLC116 | null {
  return SERVICOS_LC116[codigo] || null;
}

/**
 * Busca indicador financeiro por nome
 */
export function buscarIndicador(nome: string): IndicadorFinanceiro | null {
  return INDICADORES_FINANCEIROS.find(i => 
    i.nome.toLowerCase().includes(nome.toLowerCase())
  ) || null;
}

/**
 * Busca indicadores por categoria
 */
export function buscarIndicadoresPorCategoria(categoria: string): IndicadorFinanceiro[] {
  return INDICADORES_FINANCEIROS.filter(i => i.categoria === categoria);
}

/**
 * Busca lançamento contábil por keywords
 */
export function buscarLancamento(texto: string): LancamentoContabil | null {
  const palavras = texto.toLowerCase().split(/\s+/);
  
  let melhorMatch: LancamentoContabil | null = null;
  let melhorScore = 0;
  
  for (const lanc of LANCAMENTOS_CONTABEIS) {
    let score = 0;
    for (const palavra of palavras) {
      for (const keyword of lanc.keywords) {
        if (keyword.includes(palavra) || palavra.includes(keyword)) {
          score++;
        }
      }
    }
    
    if (score > melhorScore) {
      melhorScore = score;
      melhorMatch = lanc;
    }
  }
  
  return melhorScore >= 1 ? melhorMatch : null;
}

/**
 * Busca lançamentos por categoria
 */
export function buscarLancamentosPorCategoria(categoria: string): LancamentoContabil[] {
  return LANCAMENTOS_CONTABEIS.filter(l => l.categoria === categoria);
}

/**
 * Lista todas as categorias de lançamentos
 */
export function listarCategoriasLancamentos(): string[] {
  const categorias = new Set(LANCAMENTOS_CONTABEIS.map(l => l.categoria));
  return Array.from(categorias);
}

// =============================================================================
// EXPORTAÇÕES
// =============================================================================

export const KnowledgeBase = {
  // eSocial
  eventos: EVENTOS_ESOCIAL,
  incidencias: INCIDENCIAS_TRIBUTARIAS,
  categoriasTrabalhador: CATEGORIAS_TRABALHADOR,
  motivosAfastamento: MOTIVOS_AFASTAMENTO,
  motivosDesligamento: MOTIVOS_DESLIGAMENTO,
  
  // Nota Fiscal
  cfop: CFOP_PRINCIPAIS,
  cstIcms: CST_ICMS,
  csosn: CSOSN_SIMPLES,
  cstPisCofins: CST_PIS_COFINS,
  servicosLC116: SERVICOS_LC116,
  
  // MBA
  indicadores: INDICADORES_FINANCEIROS,
  
  // Lançamentos
  lancamentos: LANCAMENTOS_CONTABEIS,
  
  // Funções
  buscarEventoESocial,
  buscarEventosPorTipo,
  buscarCategoriaTrabalhador,
  buscarMotivoAfastamento,
  buscarMotivoDesligamento,
  buscarCFOP,
  buscarCFOPsPorTipo,
  buscarCSTIcms,
  buscarCSOSN,
  buscarCSTPisCofins,
  buscarServicoLC116,
  buscarIndicador,
  buscarIndicadoresPorCategoria,
  buscarLancamento,
  buscarLancamentosPorCategoria,
  listarCategoriasLancamentos,
};

export default KnowledgeBase;
