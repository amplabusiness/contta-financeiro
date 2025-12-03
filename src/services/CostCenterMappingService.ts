import { supabase } from '@/integrations/supabase/client';

/**
 * Mapeamento de palavras-chave → centros de custo do Sérgio
 * Cada centro tem uma lista de palavras-chave que acionam seu mapeamento
 */
const KEYWORD_MAPPINGS: Record<string, string[]> = {
  'SERGIO': [
    'PIX SERGIO', 'PAGAMENTO SERGIO', 'CARNEIRO LEAO'
  ],
  'SERGIO.FILHOS.NAYARA': [
    'BABA', 'BABÁ', 'ESCOLA', 'NAYARA', 'CRECHE',
    'INFANTIL', 'PRE', 'MATERNAL'
  ],
  'SERGIO.FILHOS.VICTOR': [
    'VICTOR', 'VICTOR HUGO', 'LEGALIZACAO', 'LEGALIZAÇÃO',
    'VICTOR HUGO DE OLIVEIRA'
  ],
  'SERGIO.FILHOS.SERGIO_AUGUSTO': [
    'CLINICA AMPLA', 'CLÍNICA AMPLA', 'MEDICINA', 'SERGIO AUGUSTO',
    'AUGUSTO DE OLIVEIRA', 'TRABALHO'
  ],
  'SERGIO.CASA_CAMPO': [
    'LAGO BRISAS', 'BURITI ALEGRE', 'CONDOMINIO LAGO',
    'CONDOMÍNIO LAGO', 'CASA CAMPO', 'BRISAS'
  ],
  'SERGIO.IMOVEIS': [
    'IPTU', 'CONDOMINIO', 'CONDOMÍNIO', 'MARISTA',
    'APTO', 'APARTAMENTO', 'SALA', 'IMOVEL', 'PROPRIEDADE',
    '301', '302', '303', 'VILA ABAJA', 'ABAJA'
  ],
  'SERGIO.VEICULOS': [
    'IPVA', 'BMW', 'MOTO', 'BIZ', 'CG', 'CARRETINHA',
    'REBOQUE', 'DETRAN', 'COMBUSTIVEL', 'COMBUSTÍVEL',
    'GASOLINA', 'MANUTENCAO', 'MANUTENÇÃO', 'MECANICO', 'MECÂNICO'
  ],
  'SERGIO.PESSOAL': [
    'PLANO DE SAUDE', 'PLANO SAÚDE', 'SAUDE', 'SAÚDE',
    'PERSONAL', 'ACADEMIA', 'CRC', 'ANUIDADE',
    'DOCTOR', 'MEDICO', 'MÉDICO', 'DENTISTA'
  ],
  'SERGIO.TELEFONE': [
    'CLARO', 'VIVO', 'TIM', 'TELEFONE', 'CELULAR',
    'PLANO', 'TELEFONICA', 'TELECOMUNICACOES'
  ],
};

export interface CostCenterMapping {
  costCenterCode: string;
  costCenterId: string;
  chartAccountId: string;
  chartAccountCode: string;
  chartAccountName: string;
  found: boolean;
}

export class CostCenterMappingService {
  private static instance: CostCenterMappingService;
  private costCenterCache: Map<string, string> = new Map();
  private chartAccountCache: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): CostCenterMappingService {
    if (!CostCenterMappingService.instance) {
      CostCenterMappingService.instance = new CostCenterMappingService();
    }
    return CostCenterMappingService.instance;
  }

  /**
   * Obter ID do centro de custo pelo código
   */
  async getCostCenterId(code: string): Promise<string | null> {
    if (this.costCenterCache.has(code)) {
      return this.costCenterCache.get(code) || null;
    }

    try {
      const { data, error } = await supabase
        .from('cost_centers')
        .select('id')
        .eq('code', code)
        .limit(1)
        .single();

      if (error) {
        console.error(`Erro ao buscar centro ${code}:`, error);
        return null;
      }

      if (data) {
        this.costCenterCache.set(code, data.id);
        return data.id;
      }
    } catch (e) {
      console.error(`Erro ao buscar centro ${code}:`, e);
    }

    this.costCenterCache.set(code, null);
    return null;
  }

  /**
   * Obter conta do plano de contas pelo código
   */
  async getChartAccount(code: string): Promise<any | null> {
    if (this.chartAccountCache.has(code)) {
      return this.chartAccountCache.get(code);
    }

    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type')
        .eq('code', code)
        .limit(1)
        .single();

      if (error) {
        console.error(`Erro ao buscar conta ${code}:`, error);
        return null;
      }

      if (data) {
        this.chartAccountCache.set(code, data);
        return data;
      }
    } catch (e) {
      console.error(`Erro ao buscar conta ${code}:`, e);
    }

    return null;
  }

  /**
   * Mapear uma descrição de despesa para o centro de custo apropriado
   * Retorna o código do centro de custo com melhor match
   */
  mapDescriptionToCostCenter(description: string): { code: string; found: boolean } {
    const upperDescription = (description || '').toUpperCase();
    
    let bestMatch = 'SERGIO'; // Padrão para despesas do Sérgio
    let maxMatches = 0;

    // Procurar melhor match nas palavras-chave
    for (const [costCenter, keywords] of Object.entries(KEYWORD_MAPPINGS)) {
      const matches = keywords.filter(kw => upperDescription.includes(kw)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = costCenter;
      }
    }

    return {
      code: bestMatch,
      found: maxMatches > 0
    };
  }

  /**
   * Mapear uma despesa completa: descrição → centro de custo → conta contábil
   */
  async mapExpenseToAccounting(description: string, costCenterCode?: string): Promise<CostCenterMapping | null> {
    try {
      // 1. Determinar centro de custo
      let finalCostCenterCode = costCenterCode;
      let found = false;

      if (!costCenterCode) {
        const result = this.mapDescriptionToCostCenter(description);
        finalCostCenterCode = result.code;
        found = result.found;
      } else {
        found = true;
      }

      // 2. Obter ID do centro de custo
      const costCenterId = await this.getCostCenterId(finalCostCenterCode);
      if (!costCenterId) {
        console.error(`Centro de custo ${finalCostCenterCode} não encontrado`);
        return null;
      }

      // 3. Buscar conta padrão do centro de custo
      const { data: costCenterData } = await supabase
        .from('cost_centers')
        .select('default_chart_account_id')
        .eq('id', costCenterId)
        .limit(1)
        .single();

      const chartAccountId = costCenterData?.default_chart_account_id;
      if (!chartAccountId) {
        console.error(`Centro ${finalCostCenterCode} sem conta padrão`);
        return null;
      }

      // 4. Obter detalhes da conta contábil
      const { data: chartAccount } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type')
        .eq('id', chartAccountId)
        .limit(1)
        .single();

      if (!chartAccount) {
        console.error(`Conta ${chartAccountId} não encontrada`);
        return null;
      }

      return {
        costCenterCode: finalCostCenterCode,
        costCenterId,
        chartAccountId: chartAccount.id,
        chartAccountCode: chartAccount.code,
        chartAccountName: chartAccount.name,
        found
      };
    } catch (error) {
      console.error('Erro ao mapear despesa:', error);
      return null;
    }
  }

  /**
   * Validar se expense tem cost_center_id e account_id obrigatórios
   */
  validateExpense(expense: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!expense.cost_center_id) {
      errors.push('Centro de custo é obrigatório');
    }

    if (!expense.account_id) {
      errors.push('Conta contábil é obrigatória');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Limpar caches (útil para testes ou refresh manual)
   */
  clearCache(): void {
    this.costCenterCache.clear();
    this.chartAccountCache.clear();
  }

  /**
   * Obter lista de centros de custo do Sérgio com suas contas padrão
   */
  async getSergioCostCenters(): Promise<Array<{
    code: string;
    name: string;
    defaultAccount: string;
  }>> {
    try {
      const { data } = await supabase
        .from('cost_centers')
        .select('code, name, default_chart_account_id')
        .like('code', 'SERGIO%')
        .order('code');

      if (!data) return [];

      return data.map((cc: any) => ({
        code: cc.code,
        name: cc.name,
        defaultAccount: cc.default_chart_account_id
      }));
    } catch (error) {
      console.error('Erro ao buscar centros do Sérgio:', error);
      return [];
    }
  }

  /**
   * Obter saldo de adiantamentos do Sérgio por centro de custo
   */
  async getSergiAdvancesBalance(): Promise<Array<{
    costCenterCode: string;
    costCenterName: string;
    totalAdvances: number;
    accountCode: string;
  }>> {
    try {
      const { data } = await supabase
        .from('vw_sergio_advances_balance')
        .select('*');

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar saldo de adiantamentos:', error);
      return [];
    }
  }
}

export default CostCenterMappingService.getInstance();
