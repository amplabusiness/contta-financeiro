// Re-export do client principal para evitar múltiplas instâncias GoTrueClient.
// Todos os imports devem usar @/integrations/supabase/client diretamente,
// mas este arquivo existe como fallback para imports legados.
export { supabase } from '@/integrations/supabase/client';
