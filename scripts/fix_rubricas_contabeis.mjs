/**
 * CORRIGIR VINCULAÇÃO DAS RUBRICAS eSocial AO PLANO DE CONTAS
 *
 * Este script corrige as contas de débito e crédito para cada rubrica da folha de pagamento
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeamento das rubricas para contas contábeis
const MAPEAMENTO = [
  // PROVENTOS - Débito = Despesa, Crédito = Passivo (Salários a Pagar)
  { codigo: '1000', debito: '4.1.1.01.01', credito: '2.1.2.01', desc: 'Salário Base -> Salários a Pagar' },
  { codigo: '1001', debito: '4.1.1.01.01', credito: '2.1.2.01', desc: 'Salário Hora' },
  { codigo: '1002', debito: '4.1.1.01.01', credito: '2.1.2.01', desc: 'Salário Tarefa' },
  { codigo: '1003', debito: '4.1.1.01.07', credito: '2.1.2.01', desc: 'Comissão' },
  { codigo: '1010', debito: '4.1.1.01.05', credito: '2.1.2.01', desc: 'Adicional Insalubridade' },
  { codigo: '1011', debito: '4.1.1.01.06', credito: '2.1.2.01', desc: 'Adicional Periculosidade' },
  { codigo: '1012', debito: '4.1.1.01.04', credito: '2.1.2.01', desc: 'Adicional Noturno' },
  { codigo: '1020', debito: '4.1.1.01.02', credito: '2.1.2.01', desc: 'Hora Extra 50%' },
  { codigo: '1021', debito: '4.1.1.01.02', credito: '2.1.2.01', desc: 'Hora Extra 100%' },
  { codigo: '1030', debito: '4.1.1.01.03', credito: '2.1.2.01', desc: 'DSR' },
  { codigo: '1040', debito: '4.1.1.01.08', credito: '2.1.2.01', desc: 'Gratificação de Função' },
  { codigo: '1041', debito: '4.1.1.01.08', credito: '2.1.2.01', desc: '13º Salário' },
  { codigo: '1050', debito: '4.1.1.07', credito: '2.1.2.01', desc: 'Férias Gozadas' },
  { codigo: '1051', debito: '4.1.1.07', credito: '2.1.2.01', desc: '1/3 Férias' },
  { codigo: '1060', debito: '4.1.1.07', credito: '2.1.2.01', desc: 'Abono Pecuniário' },
  { codigo: '1080', debito: '4.1.1.09', credito: '2.1.2.01', desc: 'Vale Transporte' },
  { codigo: '1090', debito: '4.1.1.10', credito: '2.1.2.01', desc: 'Vale Alimentação' },

  // DESCONTOS - Débito = Salários a Pagar, Crédito = Obrigação a Recolher
  { codigo: '2000', debito: '2.1.2.01', credito: '2.1.2.03', desc: 'INSS Descontado' },
  { codigo: '2001', debito: '2.1.2.01', credito: '2.1.3.02', desc: 'IRRF Descontado' },
  { codigo: '2010', debito: '2.1.2.01', credito: '4.1.1.09', desc: 'Desc Vale Transporte 6%' },
  { codigo: '2011', debito: '2.1.2.01', credito: '4.1.1.10', desc: 'Desc Vale Alimentação' },
  { codigo: '2040', debito: '2.1.2.01', credito: '1.1.3.99', desc: 'Adiantamento Salarial' }, // Baixa de adiantamento
  { codigo: '2050', debito: '2.1.2.01', credito: '2.1.2.01', desc: 'Consignado' }, // Repasse
  { codigo: '2060', debito: '2.1.2.01', credito: '2.1.2.01', desc: 'Pensão Alimentícia' },
  { codigo: '2070', debito: '2.1.2.01', credito: '4.1.1.11', desc: 'Plano Saúde' },

  // RESCISÃO
  { codigo: '3000', debito: '4.1.1.05', credito: '2.1.2.01', desc: 'Saldo Salário Rescisão' },
  { codigo: '3001', debito: '4.1.1.05', credito: '2.1.2.01', desc: 'Aviso Prévio Indenizado' },
  { codigo: '3010', debito: '4.1.1.07', credito: '2.1.2.01', desc: 'Férias Vencidas Rescisão' },
  { codigo: '3011', debito: '4.1.1.07', credito: '2.1.2.01', desc: 'Férias Proporcionais Rescisão' },
  { codigo: '3012', debito: '4.1.1.07', credito: '2.1.2.01', desc: '1/3 Férias Rescisão' },
  { codigo: '3020', debito: '4.1.1.01.08', credito: '2.1.2.01', desc: '13º Proporcional Rescisão' },
  { codigo: '3030', debito: '4.1.1.05', credito: '2.1.2.01', desc: 'Multa 40% FGTS' },
  { codigo: '3031', debito: '4.1.1.05', credito: '2.1.2.01', desc: 'Multa 20% FGTS' },

  // POR FORA (9XXX) - NÃO são despesa, são adiantamento a sócios
  { codigo: '9000', debito: '1.1.3.04.99', credito: '1.1.1.05', desc: 'Complemento Por Fora' },
  { codigo: '9001', debito: '1.1.3.04.99', credito: '1.1.1.05', desc: 'Bonificação Por Fora' },
  { codigo: '9002', debito: '1.1.3.04.99', credito: '1.1.1.05', desc: 'Ajuda Custo Por Fora' },
  { codigo: '9003', debito: '1.1.3.04.99', credito: '1.1.1.05', desc: 'Comissão Por Fora' },
  { codigo: '9004', debito: '1.1.3.04.99', credito: '1.1.1.05', desc: 'Gratificação Por Fora' },
  { codigo: '9010', debito: '1.1.3.04.99', credito: '1.1.1.05', desc: 'Reembolso Por Fora' },
];

async function buscarConta(code) {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', code)
    .single();

  if (error || !data) {
    console.log(`⚠️  Conta ${code} não encontrada!`);
    return null;
  }
  return data;
}

async function main() {
  console.log('═'.repeat(80));
  console.log('CORRIGIR VINCULAÇÃO DAS RUBRICAS eSocial');
  console.log('═'.repeat(80));

  let atualizadas = 0;
  let erros = 0;

  for (const mapa of MAPEAMENTO) {
    const contaDebito = await buscarConta(mapa.debito);
    const contaCredito = await buscarConta(mapa.credito);

    if (!contaDebito || !contaCredito) {
      console.log(`❌ ${mapa.codigo} - ${mapa.desc}: Conta não encontrada`);
      erros++;
      continue;
    }

    const { error } = await supabase
      .from('esocial_rubricas')
      .update({
        account_debit_id: contaDebito.id,
        account_credit_id: contaCredito.id
      })
      .eq('codigo', mapa.codigo);

    if (error) {
      console.log(`❌ ${mapa.codigo} - ${mapa.desc}: ${error.message}`);
      erros++;
    } else {
      console.log(`✅ ${mapa.codigo} - ${mapa.desc}`);
      console.log(`   D: ${contaDebito.code} - ${contaDebito.name}`);
      console.log(`   C: ${contaCredito.code} - ${contaCredito.name}`);
      atualizadas++;
    }
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log(`Rubricas atualizadas: ${atualizadas}`);
  console.log(`Erros: ${erros}`);
  console.log('═'.repeat(80));
}

main().catch(console.error);
