/**
 * useTenantConfig - Hook para carregar configurações do tenant atual
 *
 * Este hook fornece acesso aos dados do escritório/empresa do tenant logado,
 * carregando da tabela accounting_office com base no tenant_id do usuário.
 *
 * EXEMPLO DE USO:
 *
 * ```tsx
 * const { officeData, tenant, loading, error, refetch } = useTenantConfig();
 *
 * // Usar dados do escritório em templates
 * <p>{officeData?.razao_social}</p>
 * <p>CNPJ: {officeData?.cnpj}</p>
 *
 * // Verificar se onboarding foi completado
 * if (!tenant?.onboarding_completed) {
 *   navigate('/onboarding');
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TenantData {
  id: string;
  name: string;
  slug: string;
  cnpj?: string;
  plan?: string;
  status?: string;
  onboarding_completed: boolean;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface OfficeData {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  crc_number?: string;
  crc_state?: string;
  responsavel_tecnico?: string;
  responsavel_crc?: string;
  responsavel_cpf?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  celular?: string;
  email?: string;
  website?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta?: string;
  pix_key?: string;
  natureza_juridica?: string;
  regime_tributario?: string;
  porte?: string;
  cnae_principal?: string;
  descricao_cnae?: string;
  capital_social?: number;
  data_abertura?: string;
  situacao_cadastral?: string;
  inscricao_municipal?: string;
  logo_url?: string;
  tenant_id: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface UseTenantConfigReturn {
  tenant: TenantData | null;
  officeData: OfficeData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isOnboardingComplete: boolean;
  hasOfficeData: boolean;
}

// Cache global para evitar múltiplas requisições
let cachedTenant: TenantData | null = null;
let cachedOfficeData: OfficeData | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export function useTenantConfig(): UseTenantConfigReturn {
  const [tenant, setTenant] = useState<TenantData | null>(cachedTenant);
  const [officeData, setOfficeData] = useState<OfficeData | null>(cachedOfficeData);
  const [loading, setLoading] = useState(!cachedTenant);
  const [error, setError] = useState<string | null>(null);

  const fetchTenantConfig = useCallback(async (forceRefresh = false) => {
    // Verificar cache
    const now = Date.now();
    if (!forceRefresh && cachedTenant && (now - cacheTimestamp) < CACHE_TTL) {
      setTenant(cachedTenant);
      setOfficeData(cachedOfficeData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verificar se há usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        setLoading(false);
        return;
      }

      // Buscar tenant do usuário via tenant_users
      const { data: tenantUser, error: tenantUserError } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (tenantUserError || !tenantUser) {
        setError('Tenant não encontrado para o usuário');
        setLoading(false);
        return;
      }

      // Buscar dados do tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantUser.tenant_id)
        .single();

      if (tenantError || !tenantData) {
        setError('Erro ao carregar dados do tenant');
        setLoading(false);
        return;
      }

      // Buscar dados do escritório (accounting_office)
      const { data: office, error: officeError } = await supabase
        .from('accounting_office')
        .select('*')
        .eq('tenant_id', tenantUser.tenant_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      // Office pode não existir ainda (antes do onboarding)
      if (officeError) {
        console.warn('Erro ao carregar accounting_office:', officeError);
      }

      // Atualizar cache
      cachedTenant = tenantData as TenantData;
      cachedOfficeData = office as OfficeData | null;
      cacheTimestamp = now;

      setTenant(cachedTenant);
      setOfficeData(cachedOfficeData);
    } catch (err: any) {
      console.error('Erro ao carregar configuração do tenant:', err);
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar dados na montagem
  useEffect(() => {
    fetchTenantConfig();
  }, [fetchTenantConfig]);

  // Escutar mudanças de autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // Limpar cache e recarregar
        cachedTenant = null;
        cachedOfficeData = null;
        cacheTimestamp = 0;
        fetchTenantConfig(true);
      } else if (event === 'SIGNED_OUT') {
        // Limpar tudo
        cachedTenant = null;
        cachedOfficeData = null;
        cacheTimestamp = 0;
        setTenant(null);
        setOfficeData(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchTenantConfig]);

  const refetch = useCallback(async () => {
    await fetchTenantConfig(true);
  }, [fetchTenantConfig]);

  return {
    tenant,
    officeData,
    loading,
    error,
    refetch,
    isOnboardingComplete: tenant?.onboarding_completed ?? false,
    hasOfficeData: !!officeData,
  };
}

// Função utilitária para limpar cache (usar após salvar dados do onboarding)
export function clearTenantConfigCache() {
  cachedTenant = null;
  cachedOfficeData = null;
  cacheTimestamp = 0;
}

export default useTenantConfig;
