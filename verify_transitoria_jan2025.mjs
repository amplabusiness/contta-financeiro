/**
 * Script para verificar a movimentação da conta Transitória em Janeiro 2025
 * Compara com o extrato bancário para identificar discrepâncias
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'fs';

const supabase = createClient(
  'https://evdolpjsojkvjvakxigj.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const TRANSITORIA_ID = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
const BANCO_SICREDI_ID = '10d5892d-a843-4034-8d62-9fec95b8fd56';

async function main() {
  console.log('='.repeat(70));
  console.log('VERIFICAÇÃO DA CONTA TRANSITÓRIA - JANEIRO 2025');
  console.log('='.repeat(70));
  console.log('');

  // 1. Ler o extrato bancário
  console.log('1. LENDO EXTRATO BANCÁRIO...');
  const extratoPath = './banco/extrato 12-2024 A 11-2025.xls';
  const workbook = XLSX.readFile(extratoPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const extratoRows = data.slice(1)
    .filter(r => r[0] && r[0].includes('/01/2025'))
    .map(r => ({
      data: r[0],
      descricao: r[1],
      documento: r[2],
      valor: Number(r[3]) || 0
    }));
  
  const entradasExtrato = extratoRows.filter(r => r.valor > 0);
  const saidasExtrato = extratoRows.filter(r => r.valor < 0);
  const totalEntradasExtrato = entradasExtrato.reduce((s, r) => s + r.valor, 0);
  const totalSaidasExtrato = Math.abs(saidasExtrato.reduce((s, r) => s + r.valor, 0));
  
  console.log(`   Entradas no extrato: ${entradasExtrato.length} = R$ ${totalEntradasExtrato.toFixed(2)}`);
  console.log(`   Saídas no extrato: ${saidasExtrato.length} = R$ ${totalSaidasExtrato.toFixed(2)}`);
  console.log('');

  // Identificar PIX e Boletos no extrato
  const pixExtrato = entradasExtrato.filter(r => 
    r.descricao?.toLowerCase().includes('pix') || 
    r.descricao?.toLowerCase().includes('transf') ||
    r.descricao?.toLowerCase().includes('ted')
  );
  const boletosExtrato = entradasExtrato.filter(r => 
    r.descricao?.toLowerCase().includes('boleto') ||
    r.descricao?.toLowerCase().includes('cobrança') ||
    r.descricao?.toLowerCase().includes('cob/')
  );
  const outrosExtrato = entradasExtrato.filter(r => 
    !pixExtrato.includes(r) && !boletosExtrato.includes(r)
  );

  const totalPixExtrato = pixExtrato.reduce((s, r) => s + r.valor, 0);
  const totalBoletosExtrato = boletosExtrato.reduce((s, r) => s + r.valor, 0);
  const totalOutrosExtrato = outrosExtrato.reduce((s, r) => s + r.valor, 0);

  console.log('   ENTRADAS POR TIPO NO EXTRATO:');
  console.log(`   - PIX/Transferências: ${pixExtrato.length} = R$ ${totalPixExtrato.toFixed(2)}`);
  console.log(`   - Boletos: ${boletosExtrato.length} = R$ ${totalBoletosExtrato.toFixed(2)}`);
  console.log(`   - Outros: ${outrosExtrato.length} = R$ ${totalOutrosExtrato.toFixed(2)}`);
  console.log('');

  // 2. Buscar dados do banco
  console.log('2. BUSCANDO DADOS DO BANCO DE DADOS...');
  
  // 2.1 Items da Transitória
  const { data: transitItems, error: err1 } = await supabase
    .from('accounting_entry_items')
    .select('*, entry:accounting_entries(internal_code, description)')
    .eq('tenant_id', TENANT_ID)
    .eq('account_id', TRANSITORIA_ID)
    .gte('date', '2025-01-01')
    .lte('date', '2025-01-31');

  if (err1) {
    console.log('   ERRO ao buscar items da transitória:', err1.message);
    return;
  }

  const creditItemsTransit = transitItems?.filter(i => i.type === 'credit') || [];
  const debitItemsTransit = transitItems?.filter(i => i.type === 'debit') || [];
  
  console.log(`   Items transitória: ${transitItems?.length || 0} registros`);
  console.log(`   - Créditos (entradas): ${creditItemsTransit.length} = R$ ${creditItemsTransit.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)}`);
  console.log(`   - Débitos (saídas): ${debitItemsTransit.length} = R$ ${debitItemsTransit.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)}`);
  console.log('');

  // 2.2 Lines da Transitória
  const { data: transitLines, error: err2 } = await supabase
    .from('accounting_entry_lines')
    .select('*, entry:accounting_entries(internal_code, description)')
    .eq('tenant_id', TENANT_ID)
    .eq('account_id', TRANSITORIA_ID)
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  if (err2) {
    console.log('   ERRO ao buscar lines da transitória:', err2.message);
    return;
  }

  const creditLinesTransit = transitLines?.filter(i => Number(i.credit) > 0) || [];
  const debitLinesTransit = transitLines?.filter(i => Number(i.debit) > 0) || [];
  
  console.log(`   Lines transitória: ${transitLines?.length || 0} registros`);
  console.log(`   - Créditos (entradas): ${creditLinesTransit.length} = R$ ${creditLinesTransit.reduce((s, i) => s + Number(i.credit), 0).toFixed(2)}`);
  console.log(`   - Débitos (saídas): ${debitLinesTransit.length} = R$ ${debitLinesTransit.reduce((s, i) => s + Number(i.debit), 0).toFixed(2)}`);
  console.log('');

  // 3. Análise detalhada
  console.log('='.repeat(70));
  console.log('3. ANÁLISE DETALHADA');
  console.log('='.repeat(70));
  console.log('');

  // Separar items por tipo
  const boletosItems = debitItemsTransit.filter(i => i.entry?.internal_code?.includes('COB'));
  const pixClassItems = debitItemsTransit.filter(i => i.entry?.internal_code?.startsWith('PIX_CLASS'));
  const outrosItems = debitItemsTransit.filter(i => 
    !i.entry?.internal_code?.includes('COB') && 
    !i.entry?.internal_code?.startsWith('PIX_CLASS')
  );

  const totalBoletos = boletosItems.reduce((s, i) => s + Number(i.amount), 0);
  const totalPixClassItems = pixClassItems.reduce((s, i) => s + Number(i.amount), 0);
  const totalOutros = outrosItems.reduce((s, i) => s + Number(i.amount), 0);

  console.log('   ITEMS - DÉBITOS DA TRANSITÓRIA (classificados):');
  console.log(`   - Boletos (COB): ${boletosItems.length} = R$ ${totalBoletos.toFixed(2)}`);
  console.log(`   - PIX_CLASS: ${pixClassItems.length} = R$ ${totalPixClassItems.toFixed(2)}`);
  console.log(`   - Outros: ${outrosItems.length} = R$ ${totalOutros.toFixed(2)}`);
  console.log('');

  // Separar lines por tipo
  const pixClassLines = debitLinesTransit.filter(i => i.entry?.internal_code?.startsWith('PIX_CLASS'));
  const outrosLines = debitLinesTransit.filter(i => !i.entry?.internal_code?.startsWith('PIX_CLASS'));

  const totalPixClassLines = pixClassLines.reduce((s, i) => s + Number(i.debit), 0);
  const totalOutrosLines = outrosLines.reduce((s, i) => s + Number(i.debit), 0);

  console.log('   LINES - DÉBITOS DA TRANSITÓRIA (classificados):');
  console.log(`   - PIX_CLASS: ${pixClassLines.length} = R$ ${totalPixClassLines.toFixed(2)}`);
  console.log(`   - Outros: ${outrosLines.length} = R$ ${totalOutrosLines.toFixed(2)}`);
  console.log('');

  // 4. Cálculo do saldo
  console.log('='.repeat(70));
  console.log('4. CÁLCULO DO SALDO DA TRANSITÓRIA');
  console.log('='.repeat(70));
  console.log('');

  const totalEntradas = creditItemsTransit.reduce((s, i) => s + Number(i.amount), 0) + 
                       creditLinesTransit.reduce((s, i) => s + Number(i.credit), 0);
  const totalSaidas = debitItemsTransit.reduce((s, i) => s + Number(i.amount), 0) + 
                     debitLinesTransit.reduce((s, i) => s + Number(i.debit), 0);
  const saldo = totalEntradas - totalSaidas;

  console.log(`   Total Entradas (items + lines): R$ ${totalEntradas.toFixed(2)}`);
  console.log(`   Total Saídas (items + lines): R$ ${totalSaidas.toFixed(2)}`);
  console.log(`   SALDO: R$ ${saldo.toFixed(2)}`);
  console.log('');

  if (saldo !== 0) {
    console.log('   ⚠️  DISCREPÂNCIA ENCONTRADA!');
    console.log('');
  } else {
    console.log('   ✅ Transitória está zerada - OK!');
    console.log('');
  }

  // 5. Listar "Outros" que estão causando a discrepância
  if (outrosItems.length > 0 || outrosLines.length > 0) {
    console.log('='.repeat(70));
    console.log('5. DETALHES DOS "OUTROS" (não são boletos nem PIX_CLASS)');
    console.log('='.repeat(70));
    console.log('');
    
    console.log('   ITEMS:');
    outrosItems.forEach(i => {
      console.log(`   ${i.date} | R$ ${i.amount} | ${i.entry?.internal_code || 'sem código'} | ${i.description?.substring(0, 40) || 'sem descrição'}`);
    });
    
    console.log('');
    console.log('   LINES:');
    outrosLines.forEach(i => {
      console.log(`   ${i.entry_date} | R$ ${i.debit} | ${i.entry?.internal_code || 'sem código'} | ${i.entry?.description?.substring(0, 40) || 'sem descrição'}`);
    });
  }

  // 6. Verificação final: comparar com extrato
  console.log('');
  console.log('='.repeat(70));
  console.log('6. VERIFICAÇÃO CRUZADA EXTRATO vs BANCO');
  console.log('='.repeat(70));
  console.log('');

  console.log('   EXTRATO:');
  console.log(`   - PIX/Transferências: R$ ${totalPixExtrato.toFixed(2)}`);
  console.log(`   - Boletos: R$ ${totalBoletosExtrato.toFixed(2)}`);
  console.log(`   - Outros: R$ ${totalOutrosExtrato.toFixed(2)}`);
  console.log(`   - TOTAL: R$ ${totalEntradasExtrato.toFixed(2)}`);
  console.log('');
  
  console.log('   BANCO DE DADOS (classificações):');
  console.log(`   - PIX_CLASS (lines): R$ ${totalPixClassLines.toFixed(2)}`);
  console.log(`   - Boletos (items): R$ ${totalBoletos.toFixed(2)}`);
  console.log(`   - Outros (items): R$ ${totalOutros.toFixed(2)}`);
  console.log(`   - TOTAL classificado: R$ ${(totalPixClassLines + totalBoletos + totalOutros).toFixed(2)}`);
  console.log('');

  // Comparações
  const diffPix = totalPixExtrato - totalPixClassLines;
  const diffBoletos = totalBoletosExtrato - totalBoletos;
  
  console.log('   DIFERENÇAS:');
  console.log(`   - PIX: Extrato R$ ${totalPixExtrato.toFixed(2)} vs DB R$ ${totalPixClassLines.toFixed(2)} = Diferença R$ ${diffPix.toFixed(2)}`);
  console.log(`   - Boletos: Extrato R$ ${totalBoletosExtrato.toFixed(2)} vs DB R$ ${totalBoletos.toFixed(2)} = Diferença R$ ${diffBoletos.toFixed(2)}`);
  
  console.log('');
  console.log('='.repeat(70));
  console.log('FIM DA VERIFICAÇÃO');
  console.log('='.repeat(70));
}

main().catch(console.error);
