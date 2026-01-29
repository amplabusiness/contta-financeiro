/**
 * Mapear PIX pendentes para clientes no sistema
 * Baseado nas informações do usuário sobre grupos econômicos
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

async function main() {
  console.log('=== MAPEAMENTO PIX PENDENTES JANEIRO 2025 ===\n');

  // Buscar todos os clientes a receber (1.1.2.01.xxx)
  const { data: clientesContas, error: errContas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('tenant_id', TENANT_ID)
    .like('code', '1.1.2.01.%')
    .order('code');

  if (errContas) {
    console.error('Erro ao buscar contas:', errContas);
    return;
  }

  console.log(`Total de contas de clientes: ${clientesContas.length}\n`);

  // Termos de busca baseados nas informações do usuário
  const buscas = [
    // ACTION SOLUCOES - 2,85% faturamento
    { termo: 'ACTION', pagador: 'ACTION SOLUCOES', valor: 74761.78 },
    
    // MATA PRAGAS - 2,85% faturamento
    { termo: 'MATA PRAGAS', pagador: 'MATA PRAGAS', valor: 29660.14 },
    
    // JULIANA PERILLO - agropecuárias do EDSON DE SA
    { termo: 'EDSON', pagador: 'JULIANA PERILLO M DE SA', valor: 4043.05 },
    { termo: 'AGROPEC', pagador: 'JULIANA PERILLO M DE SA', valor: 4043.05 },
    
    // ENZO DE AQUINO - paga para CRYSTAL ECD
    { termo: 'CRYSTAL', pagador: 'ENZO DE AQUINO', valor: 5718.81 },
    { termo: 'ECD', pagador: 'ENZO DE AQUINO', valor: 5718.81 },
    
    // EMILIA GONCALVES - confecção que é sócia
    { termo: 'EMILIA', pagador: 'EMILIA GONCALVES BAZILIO', valor: 4236.00 },
    { termo: 'CONFEC', pagador: 'EMILIA GONCALVES BAZILIO', valor: 4236.00 },
    
    // CANAL PET - cliente já cadastrado
    { termo: 'CANAL PET', pagador: 'CANAL PET', valor: 706.00 },
    
    // Grupo A.I
    { termo: 'A.I EMPREEND', pagador: 'A.I EMPREENDIMENTOS', valor: 1125.00 },
    { termo: 'P.A. INDUSTRIA', pagador: 'A.I EMPREENDIMENTOS', valor: 1125.00 },
    { termo: 'CAGI INDUSTRIA', pagador: 'A.I EMPREENDIMENTOS', valor: 1125.00 },
    { termo: 'CLEITON CESARIO', pagador: 'A.I EMPREENDIMENTOS', valor: 1125.00 },
    { termo: 'GISELE DE MELO', pagador: 'A.I EMPREENDIMENTOS', valor: 1125.00 },
    
    // IVAIR GONCALVES - verificar
    { termo: 'IVAIR', pagador: 'IVAIR GONCALVES', valor: 2826.00 },
    
    // PAULA MILHOMEM - verificar
    { termo: 'PAULA', pagador: 'PAULA MILHOMEM', valor: 200.00 },
  ];

  console.log('--- BUSCA DE CLIENTES ---\n');

  const mapeamentos = [];

  for (const busca of buscas) {
    const encontrados = clientesContas.filter(c => 
      c.name.toUpperCase().includes(busca.termo.toUpperCase())
    );
    
    if (encontrados.length > 0) {
      console.log(`✅ "${busca.termo}" (Pagador: ${busca.pagador}):`);
      encontrados.forEach(c => {
        console.log(`   ${c.code} - ${c.name}`);
        mapeamentos.push({
          pagador: busca.pagador,
          valor_total: busca.valor,
          cliente_code: c.code,
          cliente_name: c.name,
          cliente_id: c.id
        });
      });
    } else {
      console.log(`❌ "${busca.termo}" - NÃO ENCONTRADO`);
    }
    console.log('');
  }

  // Buscar saldos dos clientes encontrados
  console.log('\n--- SALDOS DOS CLIENTES MAPEADOS ---\n');

  const codigosUnicos = [...new Set(mapeamentos.map(m => m.cliente_code))];
  
  for (const code of codigosUnicos) {
    const { data: saldo, error: errSaldo } = await supabase
      .from('account_balances')
      .select('debit, credit, balance')
      .eq('tenant_id', TENANT_ID)
      .eq('account_code', code)
      .eq('period_year', 2025)
      .eq('period_month', 1)
      .single();

    const cliente = mapeamentos.find(m => m.cliente_code === code);
    console.log(`${code} - ${cliente?.cliente_name}`);
    if (saldo) {
      console.log(`   Saldo: R$ ${Math.abs(saldo.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    } else {
      console.log(`   Sem saldo registrado`);
    }
  }

  // Verificar transações PIX na transitória
  console.log('\n\n--- PIX NA CONTA TRANSITÓRIA (para verificar valores exatos) ---\n');

  const { data: pixEntries, error: errPix } = await supabase
    .from('journal_entries')
    .select(`
      id, date, description, 
      journal_entry_lines(id, account_code, debit, credit, description)
    `)
    .eq('tenant_id', TENANT_ID)
    .eq('status', 'posted')
    .gte('date', '2025-01-01')
    .lte('date', '2025-01-31')
    .ilike('description', '%PIX%');

  if (pixEntries) {
    const pixTransitoria = [];
    
    for (const entry of pixEntries) {
      const linhaTransitoria = entry.journal_entry_lines?.find(l => l.account_code === '1.1.9.01');
      if (linhaTransitoria && linhaTransitoria.credit > 0) {
        pixTransitoria.push({
          id: entry.id,
          date: entry.date,
          description: entry.description,
          valor: linhaTransitoria.credit,
          linha_id: linhaTransitoria.id
        });
      }
    }

    pixTransitoria.sort((a, b) => b.valor - a.valor);

    console.log('PIX identificados (ordenados por valor):');
    for (const pix of pixTransitoria) {
      console.log(`${pix.date} | R$ ${pix.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | ${pix.description}`);
    }

    // Salvar para uso posterior
    console.log('\n\n--- RESUMO PARA PROCESSAMENTO ---\n');
    
    const grupos = {
      'ACTION SOLUCOES': { pix: [], clientes: [] },
      'MATA PRAGAS': { pix: [], clientes: [] },
      'JULIANA PERILLO (EDSON)': { pix: [], clientes: [] },
      'ENZO DE AQUINO (CRYSTAL)': { pix: [], clientes: [] },
      'EMILIA GONCALVES (CONFECCAO)': { pix: [], clientes: [] },
      'CANAL PET': { pix: [], clientes: [] },
      'A.I EMPREENDIMENTOS (GRUPO)': { pix: [], clientes: [] },
      'IVAIR GONCALVES': { pix: [], clientes: [] },
      'PAULA MILHOMEM': { pix: [], clientes: [] },
      'TAYLANE BELLE (REEMBOLSO)': { pix: [], clientes: [] },
    };

    // Mapear PIX para grupos
    for (const pix of pixTransitoria) {
      const desc = pix.description.toUpperCase();
      
      if (desc.includes('ACTION')) grupos['ACTION SOLUCOES'].pix.push(pix);
      else if (desc.includes('MATA PRAGAS')) grupos['MATA PRAGAS'].pix.push(pix);
      else if (desc.includes('JULIANA PERILLO')) grupos['JULIANA PERILLO (EDSON)'].pix.push(pix);
      else if (desc.includes('ENZO DE AQUINO') || desc.includes('ENZO AQUINO')) grupos['ENZO DE AQUINO (CRYSTAL)'].pix.push(pix);
      else if (desc.includes('EMILIA')) grupos['EMILIA GONCALVES (CONFECCAO)'].pix.push(pix);
      else if (desc.includes('CANAL PET')) grupos['CANAL PET'].pix.push(pix);
      else if (desc.includes('A.I EMPREEND') || desc.includes('A I EMPREEND')) grupos['A.I EMPREENDIMENTOS (GRUPO)'].pix.push(pix);
      else if (desc.includes('IVAIR')) grupos['IVAIR GONCALVES'].pix.push(pix);
      else if (desc.includes('PAULA')) grupos['PAULA MILHOMEM'].pix.push(pix);
      else if (desc.includes('TAYLANE')) grupos['TAYLANE BELLE (REEMBOLSO)'].pix.push(pix);
    }

    // Mapear clientes para grupos
    for (const map of mapeamentos) {
      if (map.pagador.includes('ACTION')) grupos['ACTION SOLUCOES'].clientes.push(map);
      else if (map.pagador.includes('MATA PRAGAS')) grupos['MATA PRAGAS'].clientes.push(map);
      else if (map.pagador.includes('JULIANA')) grupos['JULIANA PERILLO (EDSON)'].clientes.push(map);
      else if (map.pagador.includes('ENZO')) grupos['ENZO DE AQUINO (CRYSTAL)'].clientes.push(map);
      else if (map.pagador.includes('EMILIA')) grupos['EMILIA GONCALVES (CONFECCAO)'].clientes.push(map);
      else if (map.pagador.includes('CANAL PET')) grupos['CANAL PET'].clientes.push(map);
      else if (map.pagador.includes('A.I')) grupos['A.I EMPREENDIMENTOS (GRUPO)'].clientes.push(map);
      else if (map.pagador.includes('IVAIR')) grupos['IVAIR GONCALVES'].clientes.push(map);
      else if (map.pagador.includes('PAULA')) grupos['PAULA MILHOMEM'].clientes.push(map);
    }

    for (const [grupo, data] of Object.entries(grupos)) {
      const totalPix = data.pix.reduce((s, p) => s + p.valor, 0);
      if (data.pix.length > 0 || data.clientes.length > 0) {
        console.log(`\n${grupo}:`);
        console.log(`  PIX: ${data.pix.length} transações = R$ ${totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        console.log(`  Clientes: ${data.clientes.length}`);
        data.clientes.forEach(c => console.log(`    - ${c.cliente_code} ${c.cliente_name}`));
      }
    }
  }
}

main().catch(console.error);
