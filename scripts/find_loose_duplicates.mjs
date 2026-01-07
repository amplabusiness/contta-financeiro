
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function findLooseDuplicates() {
    console.log('🔍 Procurando duplicatas "frouxas" (mesmo valor, datas próximas)...');
    
    const accountId = '10d5892d-a843-4034-8d62-9fec95b8fd56'; // Sicredi

    // 1. Buscar todas as linhas de jan/2025
    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id, 
            debit, 
            credit, 
            description,
            created_at,
            accounting_entries!inner(id, entry_date, entry_type, description)
        `)
        .eq('account_id', accountId)
        .gte('accounting_entries.entry_date', '2025-01-01')
        .lte('accounting_entries.entry_date', '2025-01-31');

    if (error) {
        console.error('Erro ao buscar linhas:', error);
        return;
    }

    console.log(`Total de linhas encontradas: ${lines.length}`);

    // Separar em dois grupos: 
    // A: Lançamentos "originais" (geralmente data de criação antiga ou tipo bancário)
    // B: Lançamentos "manuais" (importados recentemente)
    
    // Uma regra heurística: Se entry_type for 'MANUAL' e created_at for recente (hoje/ontem), é candidato a ser removido se duplicar outro.
    // Mas o script de hoje setou entry_type='MANUAL'. Os anteriores podem ter outro tipo ou created_at mais antigo.
    
    // Vamos agrupar por valor para facilitar.
    const byAmount = {};

    for (const line of lines) {
        const amount = Number(line.debit) > 0 ? Number(line.debit) : Number(line.credit);
        const type = Number(line.debit) > 0 ? 'D' : 'C'; // D=Debit, C=Credit
        const key = `${amount.toFixed(2)}_${type}`;

        if (!byAmount[key]) byAmount[key] = [];
        byAmount[key].push(line);
    }

    let possibleDuplicates = [];

    for (const key in byAmount) {
        const group = byAmount[key];
        if (group.length < 2) continue;

        // Comparar todos contra todos no grupo
        // Queremos achar pares onde as datas são próximas (ex: +/- 5 dias)
        // E idealmente um parece ser "Sistema" e o outro "Banco/OFX"
        
        // Ordena por data
        group.sort((a, b) => new Date(a.accounting_entries.entry_date) - new Date(b.accounting_entries.entry_date));

        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const a = group[i];
                const b = group[j];

                const dateA = new Date(a.accounting_entries.entry_date);
                const dateB = new Date(b.accounting_entries.entry_date);
                const diffTime = Math.abs(dateB - dateA);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Se a diferença for pequena (ex: até 10 dias)
                if (diffDays <= 10) {
                    // Verificamos se as descrições são parecidas ou se um é claramente manual
                    possibleDuplicates.push({
                        amount: key.split('_')[0],
                        type: key.split('_')[1],
                        diffDays,
                        item1: {
                            id: a.id,
                            entry_id: a.accounting_entries.id,
                            date: a.accounting_entries.entry_date,
                            desc: a.description || a.accounting_entries.description,
                            created_at: a.created_at,
                            type: a.accounting_entries.entry_type
                        },
                        item2: {
                            id: b.id,
                            entry_id: b.accounting_entries.id,
                            date: b.accounting_entries.entry_date,
                            desc: b.description || b.accounting_entries.description,
                            created_at: b.created_at,
                            type: b.accounting_entries.entry_type
                        }
                    });
                }
            }
        }
    }

    console.log(`\nEncontrados ${possibleDuplicates.length} pares de possíveis duplicatas.`);
    
    // Filtro: Apenas se um deles for 'MANUAL' criado HOJE (ou muito recente)
    // Assumindo que hoje é > 2026-01-01 (na verdade 2026-01-07 pelo contexto)
    const todayStr = new Date().toISOString().split('T')[0];
    
    const duplicatesToRemove = possibleDuplicates.filter(pair => {
        // Verifica se algum dos itens foi criado hoje (indicando que foi o script de importação)
        const item1Created = new Date(pair.item1.created_at).toISOString().split('T')[0];
        const item2Created = new Date(pair.item2.created_at).toISOString().split('T')[0];
        const todayDate = new Date().toISOString().split('T')[0]; // Data atual do sistema

        // Logica: Queremos remover o item NOVO (MANUAL) se ele colide com um ANTIGO
        // Mas como estamos em 2026, ambos podem parecer 'velhos' se eu nao olhar o timestamp.
        // O created_at do Postgres é o que importa.
        
        // Vamos checar se created_at é recente (últimas 24h)
        const now = Date.now();
        const isRecent1 = (now - new Date(pair.item1.created_at).getTime()) < 24 * 60 * 60 * 1000;
        const isRecent2 = (now - new Date(pair.item2.created_at).getTime()) < 24 * 60 * 60 * 1000;

        if (isRecent1 && !isRecent2) {
            pair.toRemove = pair.item1;
            pair.keep = pair.item2;
            return true;
        }
        if (!isRecent1 && isRecent2) {
            pair.toRemove = pair.item2;
            pair.keep = pair.item1;
            return true;
        }
        // Se ambos recentes ou ambos antigos, requer análise manual, não deletar automaticamente
        return false; 
    });

    console.log(`Destes, ${duplicatesToRemove.length} são candidatos seguros para remoção (conflito Recente vs Antigo).`);

    if (duplicatesToRemove.length > 0) {
        console.log('\n--- Exemplos de Duplicatas ---');
        duplicatesToRemove.slice(0, 5).forEach(d => {
            console.log(`Valor: ${d.amount} (${d.type}) | Diff: ${d.diffDays} dias`);
            console.log(`   MANTER: [${d.keep.date}] ${d.keep.desc} (ID: ${d.keep.entry_id})`);
            console.log(`  REMOVER: [${d.toRemove.date}] ${d.toRemove.desc} (ID: ${d.toRemove.entry_id})`);
            console.log('');
        });

        // Uncomment to execute delete
        await deleteDuplicates(duplicatesToRemove);
    }
    
    await findWashTransactions(lines);
}

async function findWashTransactions(allLines) {
    console.log('\n🔍 Procurando transações "Wash" (Adiantamento vs Pagamento)...');
    
    // Filter for Recent Manual lines only
    const recentLines = allLines.filter(l => {
        // Check if created recently (last 24h) and is Manual
        // Note: entry_type is in accounting_entries
        const isRecent = (Date.now() - new Date(l.created_at).getTime()) < 24 * 60 * 60 * 1000;
        return isRecent && l.accounting_entries.entry_type === 'MANUAL';
    });
    
    console.log(`Analisando ${recentLines.length} linhas recentes...`);

    const byAbsAmount = {};
    for (const line of recentLines) {
        const amount = Number(line.debit) > 0 ? Number(line.debit) : Number(line.credit);
        const key = amount.toFixed(2);
        if (!byAbsAmount[key]) byAbsAmount[key] = [];
        byAbsAmount[key].push(line);
    }
    
    let washPairs = [];
    
    for (const key in byAbsAmount) {
        const group = byAbsAmount[key];
        // Look for 1 Debit and 1 Credit with matching descriptions pattern
        const debits = group.filter(l => Number(l.debit) > 0);
        const credits = group.filter(l => Number(l.credit) > 0);
        
        if (debits.length > 0 && credits.length > 0) {
            // Check descriptions
            for (const d of debits) {
                for (const c of credits) {
                     const descD = d.description || d.accounting_entries.description || '';
                     const descC = c.description || c.accounting_entries.description || '';
                     
                     if ((descD.includes('Adiantamento') && descC.includes('Pagamento')) || 
                         (descC.includes('Adiantamento') && descD.includes('Pagamento'))) {
                             washPairs.push({ debit: d, credit: c });
                         }
                }
            }
        }
    }
    
    console.log(`Encontrados ${washPairs.length} pares Wash.`);
    
    if (washPairs.length > 0) {
        const idsToDelete = [];
        washPairs.forEach(p => {
            console.log(`Wash: ${p.debit.debit} | ${p.debit.description} <-> ${p.credit.description}`);
            idsToDelete.push(p.debit.accounting_entries.id);
            idsToDelete.push(p.credit.accounting_entries.id);
        });
        
        // Remove duplicates from list
        const uniqueIds = [...new Set(idsToDelete)];
        await deleteDuplicatesList(uniqueIds);
    }
}

async function deleteDuplicatesList(ids) {
     console.log(`🗑️ Deletando ${ids.length} IDs...`);
     const { error } = await supabase
        .from('accounting_entries')
        .delete()
        .in('id', ids);
     if (error) console.error(error);
     else console.log('Deletado.');
}

// Função auxiliar para deletar
async function deleteDuplicates(list) {
    console.log(`🗑️ Removendo ${list.length} entradas duplicadas...`);
    const idsToRemove = list.map(d => d.toRemove.entry_id);
    
    // Deletar da accounting_entries (o cascade deve limpar as linhas)
    const { error } = await supabase
        .from('accounting_entries')
        .delete()
        .in('id', idsToRemove);

    if (error) console.error('Erro ao deletar:', error);
    else console.log('Sucesso! Limpeza concluída.');
}

findLooseDuplicates();
