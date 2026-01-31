/**
 * useEducationRequired.ts
 * 
 * Hook para sistema de educação obrigatória.
 * Gerencia requisitos de aprendizado que bloqueiam ações até acknowledgment.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 01/02/2026
 * 
 * RECOMENDAÇÃO SÊNIOR #3: Flag "educação obrigatória" para erros críticos
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from './useTenantConfig';
import { useAuditLog } from './useAuditLog';

// ============================================================================
// TYPES
// ============================================================================

export type EducationSeverity = 'critical' | 'warning' | 'info';

export interface EducationRequirement {
  id: string;
  tenant_id: string;
  severity: EducationSeverity;
  error_code: string;
  error_title: string;
  error_description: string;
  education_content: string;
  entity_type?: string;
  entity_id?: string;
  references?: Array<{ title: string; url: string }>;
  min_read_time_seconds: number;
  verification_questions?: Array<{
    question: string;
    options: string[];
    correct_index: number;
  }>;
  is_blocking: boolean;
  requires_quiz_pass: boolean;
  created_at: string;
}

export interface EducationAcknowledgment {
  id: string;
  requirement_id: string;
  user_id: string;
  user_email: string;
  acknowledged_at: string;
  time_spent_seconds: number;
  quiz_passed?: boolean;
  ack_hash: string;
}

export interface PendingEducation extends EducationRequirement {
  // Campos adicionais para UI
  progress?: {
    started_at?: Date;
    time_spent: number;
    quiz_attempted: boolean;
    quiz_passed?: boolean;
  };
}

export interface CanProceedResult {
  can_proceed: boolean;
  blocking_count: number;
  blocking_requirements: string[];
}

// ============================================================================
// HOOK: useEducationRequired
// ============================================================================

export function useEducationRequired() {
  const { tenant } = useTenantConfig();
  const tenantId = tenant?.id;
  const { logEvent } = useAuditLog();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequirements, setPendingRequirements] = useState<PendingEducation[]>([]);
  const [currentRequirement, setCurrentRequirement] = useState<PendingEducation | null>(null);
  const [readingStartTime, setReadingStartTime] = useState<Date | null>(null);

  /**
   * Busca requisitos educacionais pendentes para o usuário atual
   */
  const fetchPendingRequirements = useCallback(async (
    entityType?: string,
    entityId?: string
  ): Promise<PendingEducation[]> => {
    if (!tenantId) {
      setError('Tenant não configurado');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error: rpcError } = await supabase.rpc('get_pending_education_requirements', {
        p_tenant_id: tenantId,
        p_user_id: user.id,
        p_entity_type: entityType || null,
        p_entity_id: entityId || null
      });

      if (rpcError) {
        throw rpcError;
      }

      const requirements = (data || []).map((r: EducationRequirement) => ({
        ...r,
        progress: {
          started_at: undefined,
          time_spent: 0,
          quiz_attempted: false
        }
      })) as PendingEducation[];

      setPendingRequirements(requirements);
      return requirements;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar requisitos';
      setError(errorMessage);
      console.error('[EducationRequired] Erro:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  /**
   * Verifica se pode prosseguir (sem requisitos bloqueantes pendentes)
   */
  const canProceed = useCallback(async (
    entityType?: string,
    entityId?: string
  ): Promise<CanProceedResult> => {
    if (!tenantId) {
      return { can_proceed: false, blocking_count: 0, blocking_requirements: [] };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { can_proceed: false, blocking_count: 0, blocking_requirements: [] };
      }

      const { data, error: rpcError } = await supabase.rpc('can_proceed_after_education', {
        p_tenant_id: tenantId,
        p_user_id: user.id,
        p_entity_type: entityType || null,
        p_entity_id: entityId || null
      });

      if (rpcError) {
        throw rpcError;
      }

      // A função retorna um array com um único resultado
      const result = Array.isArray(data) ? data[0] : data;

      return {
        can_proceed: result?.can_proceed ?? true,
        blocking_count: result?.blocking_count ?? 0,
        blocking_requirements: result?.blocking_requirements ?? []
      };
    } catch (err) {
      console.error('[EducationRequired] Erro ao verificar:', err);
      return { can_proceed: true, blocking_count: 0, blocking_requirements: [] };
    }
  }, [tenantId]);

  /**
   * Inicia leitura de um requisito educacional
   */
  const startReading = useCallback((requirement: PendingEducation) => {
    setCurrentRequirement(requirement);
    setReadingStartTime(new Date());
    
    // Log início da leitura
    logEvent('system', {
      action: 'education_started',
      requirement_id: requirement.id,
      error_code: requirement.error_code
    }, {
      entityType: 'education_requirement',
      entityId: requirement.id
    });
  }, [logEvent]);

  /**
   * Registra acknowledgment de requisito educacional
   */
  const acknowledgeRequirement = useCallback(async (
    requirementId: string,
    quizAnswers?: number[],
    userNotes?: string
  ): Promise<{ success: boolean; ack_hash?: string; quiz_passed?: boolean }> => {
    if (!tenantId || !readingStartTime) {
      setError('Requisitos não atendidos para acknowledgment');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Calcular tempo gasto
      const timeSpent = Math.floor((new Date().getTime() - readingStartTime.getTime()) / 1000);
      const userAgent = navigator.userAgent;
      const sessionId = sessionStorage.getItem('session_id') || 'unknown';

      // Verificar tempo mínimo de leitura
      const requirement = pendingRequirements.find(r => r.id === requirementId);
      if (requirement && timeSpent < requirement.min_read_time_seconds) {
        setError(`Por favor, leia o conteúdo por pelo menos ${requirement.min_read_time_seconds} segundos. Tempo atual: ${timeSpent}s`);
        return { success: false };
      }

      const { data, error: rpcError } = await supabase.rpc('acknowledge_education', {
        p_requirement_id: requirementId,
        p_user_id: user.id,
        p_user_email: user.email || 'unknown',
        p_time_spent_seconds: timeSpent,
        p_quiz_answers: quizAnswers ? JSON.stringify(quizAnswers) : null,
        p_user_notes: userNotes || null,
        p_ip_address: null,
        p_user_agent: userAgent,
        p_session_id: sessionId,
        p_acknowledgment_text: 'Declaro que li e compreendi o conteúdo educacional apresentado.'
      });

      if (rpcError) {
        throw rpcError;
      }

      // A função retorna um array com um único resultado
      const result = Array.isArray(data) ? data[0] : data;

      // Limpar estado
      setCurrentRequirement(null);
      setReadingStartTime(null);
      
      // Atualizar lista de pendentes
      setPendingRequirements(prev => prev.filter(r => r.id !== requirementId));

      return {
        success: true,
        ack_hash: result?.ack_hash,
        quiz_passed: result?.quiz_passed
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao reconhecer requisito';
      setError(errorMessage);
      console.error('[EducationRequired] Erro:', err);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, readingStartTime, pendingRequirements]);

  /**
   * Cria novo requisito educacional (para uso do sistema/Dr. Cícero)
   */
  const createRequirement = useCallback(async (
    severity: EducationSeverity,
    errorCode: string,
    errorTitle: string,
    errorDescription: string,
    educationContent: string,
    options?: {
      entityType?: string;
      entityId?: string;
      isBlocking?: boolean;
      references?: Array<{ title: string; url: string }>;
      minReadTime?: number;
      verificationQuestions?: Array<{
        question: string;
        options: string[];
        correct_index: number;
      }>;
      requiresQuiz?: boolean;
      requiredUserId?: string;
      expiresAt?: Date;
      createdBy?: string;
    }
  ): Promise<string | null> => {
    if (!tenantId) {
      setError('Tenant não configurado');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('create_education_requirement', {
        p_tenant_id: tenantId,
        p_severity: severity,
        p_error_code: errorCode,
        p_error_title: errorTitle,
        p_error_description: errorDescription,
        p_education_content: educationContent,
        p_entity_type: options?.entityType || null,
        p_entity_id: options?.entityId || null,
        p_is_blocking: options?.isBlocking ?? true,
        p_references: options?.references ? JSON.stringify(options.references) : '[]',
        p_min_read_time: options?.minReadTime ?? 30,
        p_verification_questions: options?.verificationQuestions 
          ? JSON.stringify(options.verificationQuestions) 
          : '[]',
        p_requires_quiz: options?.requiresQuiz ?? false,
        p_required_user_id: options?.requiredUserId || null,
        p_expires_at: options?.expiresAt?.toISOString() || null,
        p_created_by: options?.createdBy || 'system',
        p_context: '{}'
      });

      if (rpcError) {
        throw rpcError;
      }

      // Log criação
      await logEvent('system', {
        action: 'education_requirement_created',
        error_code: errorCode,
        severity
      }, {
        entityType: 'education_requirement',
        entityId: data as string
      });

      return data as string;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar requisito';
      setError(errorMessage);
      console.error('[EducationRequired] Erro:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, logEvent]);

  /**
   * Tempo de leitura atual
   */
  const getCurrentReadingTime = useCallback((): number => {
    if (!readingStartTime) return 0;
    return Math.floor((new Date().getTime() - readingStartTime.getTime()) / 1000);
  }, [readingStartTime]);

  /**
   * Busca estatísticas de educação
   */
  const getStatistics = useCallback(async (): Promise<{
    total_requirements: number;
    total_acknowledged: number;
    pending_critical: number;
    average_read_time: number;
  } | null> => {
    if (!tenantId) return null;

    try {
      // Total de requisitos
      const { count: totalRequirements } = await supabase
        .from('education_requirements')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      // Total de acks
      const { count: totalAcknowledged } = await supabase
        .from('education_acknowledgments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      // Pendentes críticos
      const { count: pendingCritical } = await supabase
        .from('education_requirements')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('severity', 'critical')
        .eq('is_blocking', true);

      // Média de tempo de leitura
      const { data: avgData } = await supabase
        .from('education_acknowledgments')
        .select('time_spent_seconds')
        .eq('tenant_id', tenantId);

      const avgReadTime = avgData && avgData.length > 0
        ? avgData.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0) / avgData.length
        : 0;

      return {
        total_requirements: totalRequirements || 0,
        total_acknowledged: totalAcknowledged || 0,
        pending_critical: pendingCritical || 0,
        average_read_time: Math.round(avgReadTime)
      };
    } catch (err) {
      console.error('[EducationRequired] Erro ao buscar estatísticas:', err);
      return null;
    }
  }, [tenantId]);

  // Buscar pendentes ao montar
  useEffect(() => {
    if (tenantId) {
      fetchPendingRequirements();
    }
  }, [tenantId, fetchPendingRequirements]);

  return {
    // State
    isLoading,
    error,
    pendingRequirements,
    currentRequirement,
    
    // Computed
    hasBlockingPending: pendingRequirements.some(r => r.is_blocking),
    criticalCount: pendingRequirements.filter(r => r.severity === 'critical').length,
    
    // Actions
    fetchPendingRequirements,
    canProceed,
    startReading,
    acknowledgeRequirement,
    createRequirement,
    getCurrentReadingTime,
    getStatistics,
    
    // Helpers
    clearError: () => setError(null),
    cancelReading: () => {
      setCurrentRequirement(null);
      setReadingStartTime(null);
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formata severidade para exibição
 */
export function formatSeverity(severity: EducationSeverity): {
  icon: string;
  color: string;
  label: string;
  bgColor: string;
} {
  const config: Record<EducationSeverity, { icon: string; color: string; label: string; bgColor: string }> = {
    critical: { 
      icon: '🚨', 
      color: 'text-red-600', 
      label: 'Crítico', 
      bgColor: 'bg-red-50 dark:bg-red-900/20' 
    },
    warning: { 
      icon: '⚠️', 
      color: 'text-yellow-600', 
      label: 'Atenção', 
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' 
    },
    info: { 
      icon: 'ℹ️', 
      color: 'text-blue-600', 
      label: 'Informativo', 
      bgColor: 'bg-blue-50 dark:bg-blue-900/20' 
    }
  };

  return config[severity];
}

/**
 * Formata tempo de leitura
 */
export function formatReadingTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}min ${remainingSeconds}s`;
}

/**
 * Gera código de erro padronizado
 */
export function generateErrorCode(
  category: 'ACCOUNTING' | 'CLASSIFICATION' | 'RECONCILIATION' | 'PERIOD' | 'SYSTEM',
  subCategory: string,
  sequence: number
): string {
  const categoryMap = {
    ACCOUNTING: 'ACC',
    CLASSIFICATION: 'CLS',
    RECONCILIATION: 'REC',
    PERIOD: 'PER',
    SYSTEM: 'SYS'
  };
  
  return `${categoryMap[category]}_${subCategory.toUpperCase()}_${String(sequence).padStart(3, '0')}`;
}
