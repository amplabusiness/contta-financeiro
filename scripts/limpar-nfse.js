// Limpar todas as notas fiscais de teste
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function limpar() {
  try {
    console.log('🗑️  Deletando todas as NFS-e...');
    
    const { data, error: selectError } = await supabase
      .from('nfse')
      .select('id, numero_nfse, status');
    
    if (selectError) throw selectError;
    
    console.log(`📋 Encontradas ${data.length} NFS-e`);
    
    if (data.length === 0) {
      console.log('✅ Sem registros para deletar');
      return;
    }
    
    // Deletar todos os logs primeiro (foreign key constraint)
    const { error: logsError } = await supabase
      .from('nfse_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (logsError) console.log('⚠️  Aviso ao deletar logs:', logsError.message);
    
    // Deletar todas as nfse
    const { error: nfseError } = await supabase
      .from('nfse')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (nfseError) throw nfseError;
    
    console.log(`✅ ${data.length} NFS-e deletadas com sucesso!`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

await limpar();
console.log('✨ Limpeza concluída!');
