/**
 * Script para executar a criação de lançamentos de abertura
 * Usa RPC para chamar a função SECURITY DEFINER criada no banco
 * 
 * Fase: F1-01 - Saldo de Abertura
 * Conforme especificação: reoganizacao_28_01_2026.md
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente não configuradas');
    console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   CRIANDO LANÇAMENTOS DE ABERTURA - SALDO INICIAL 01/01/2025   ║');
    console.log('║                 Fase F1-01 - Execução via RPC                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Verificar quantos saldos pendentes existem
    const { data: pendentes, error: errPendentes } = await supabase
        .from('client_opening_balance')
        .select('id, amount')
        .eq('status', 'pending')
        .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421');

    if (errPendentes) {
        console.error('❌ Erro ao verificar pendentes:', errPendentes.message);
        process.exit(1);
    }

    console.log(`📊 Status antes da execução:`);
    console.log(`   Saldos pendentes: ${pendentes?.length || 0}`);
    console.log(`   Total pendente: R$ ${pendentes?.reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2)}`);
    console.log('');

    if (!pendentes || pendentes.length === 0) {
        console.log('✅ Não há saldos pendentes para processar!');
        process.exit(0);
    }

    console.log('🔄 Executando função criar_lancamento_abertura_batch()...');
    console.log('');

    // Chamar a função SECURITY DEFINER via RPC
    const { data, error } = await supabase.rpc('criar_lancamento_abertura_batch');

    if (error) {
        console.error('❌ Erro ao executar função:', error.message);
        console.error('   Detalhes:', error);
        process.exit(1);
    }

    // Processar resultado
    if (data && data.length > 0) {
        const result = data[0];
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║                         RESULTADO                              ║');
        console.log('╠════════════════════════════════════════════════════════════════╣');
        console.log(`║   ✅ Lançamentos criados: ${String(result.processados).padStart(5)}                             ║`);
        console.log(`║   ⚠️  Clientes sem conta: ${String(result.sem_conta).padStart(5)}                             ║`);
        console.log(`║   💰 Total lançado: R$ ${Number(result.total_valor).toFixed(2).padStart(10)}                       ║`);
        console.log('╚════════════════════════════════════════════════════════════════╝');
    } else {
        console.log('⚠️  Função executada mas sem dados de retorno');
        console.log('   Resultado:', data);
    }

    // Verificar status final
    const { data: processados, error: errProc } = await supabase
        .from('client_opening_balance')
        .select('id')
        .eq('status', 'processed')
        .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421');

    const { data: ainda_pendentes } = await supabase
        .from('client_opening_balance')
        .select('id, amount, competence')
        .eq('status', 'pending')
        .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421');

    console.log('');
    console.log('📊 Status após execução:');
    console.log(`   Processados: ${processados?.length || 0}`);
    console.log(`   Ainda pendentes: ${ainda_pendentes?.length || 0}`);

    if (ainda_pendentes && ainda_pendentes.length > 0) {
        console.log('');
        console.log('⚠️  Saldos que não puderam ser processados (sem conta analítica):');
        
        // Buscar nomes dos clientes
        for (const pend of ainda_pendentes.slice(0, 10)) {
            const { data: cliente } = await supabase
                .from('clients')
                .select('name')
                .eq('id', pend.id)
                .single();
            
            console.log(`   - ${pend.competence}: R$ ${Number(pend.amount).toFixed(2)}`);
        }
        
        if (ainda_pendentes.length > 10) {
            console.log(`   ... e mais ${ainda_pendentes.length - 10} registros`);
        }
    }

    console.log('');
    console.log('✅ Execução concluída!');
}

main().catch(console.error);
