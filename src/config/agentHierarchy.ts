/**
 * agentHierarchy.ts
 * 
 * Define a hierarquia de agentes de IA do sistema Contta.
 * Dr. Cícero é o Brain/Guardião central que coordena todos os outros.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 31/01/2026
 */

// ============================================================================
// TYPES
// ============================================================================

export type AgentRole = 
  | 'brain'           // Dr. Cícero - Coordenador central
  | 'financial'       // Agente Financeiro
  | 'accounting'      // Agente Contábil
  | 'auditor'         // Agente Auditor
  | 'educator';       // Agente Educador

export type AgentCapability = 
  | 'classify'
  | 'reclassify'
  | 'split'
  | 'approve'
  | 'reject'
  | 'audit'
  | 'explain'
  | 'suggest'
  | 'validate'
  | 'reconcile'
  | 'forecast'
  | 'report'
  | 'create_account'
  | 'block_transaction';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  capabilities: AgentCapability[];
  subAgents?: Agent[];
  requiresApproval?: AgentRole[];  // Quem pode aprovar ações deste agente
  edgeFunctionName?: string;       // Nome da Edge Function no Supabase
  icon: string;
  color: string;
}

export interface AgentAction {
  agentId: string;
  action: AgentCapability;
  context: Record<string, any>;
  requiresApproval: boolean;
  approverAgentId?: string;
}

export interface AgentResponse {
  success: boolean;
  agentId: string;
  action: AgentCapability;
  result?: any;
  explanation?: string;
  needsApproval?: boolean;
  pendingApprovalId?: string;
  error?: string;
}

// ============================================================================
// AGENT DEFINITIONS
// ============================================================================

/**
 * Dr. Cícero - O cérebro central do sistema
 * Coordena todos os outros agentes e tem poder de veto
 */
export const DR_CICERO_AGENT: Agent = {
  id: 'dr-cicero',
  name: 'Dr. Cícero',
  role: 'brain',
  description: 'Contador responsável e guardião das regras contábeis. Coordena todos os agentes e tem autoridade final sobre aprovações.',
  capabilities: [
    'approve',
    'reject',
    'validate',
    'explain',
    'block_transaction',
    'create_account'
  ],
  edgeFunctionName: 'dr-cicero-brain',
  icon: '🧠',
  color: '#8B5CF6' // purple
};

/**
 * Agente Financeiro
 * Cuida do operacional: caixa, contas a receber, contas a pagar
 */
export const FINANCIAL_AGENT: Agent = {
  id: 'financial',
  name: 'Agente Financeiro',
  role: 'financial',
  description: 'Gerencia operações financeiras diárias, fluxo de caixa e cobranças.',
  capabilities: [
    'reconcile',
    'forecast',
    'suggest',
    'report'
  ],
  requiresApproval: ['brain'],
  edgeFunctionName: 'financial-agent',
  icon: '💰',
  color: '#10B981', // green
  subAgents: [
    {
      id: 'financial-caixa',
      name: 'Caixa',
      role: 'financial',
      description: 'Controla entradas e saídas do caixa',
      capabilities: ['reconcile', 'report'],
      icon: '🏦',
      color: '#10B981'
    },
    {
      id: 'financial-receber',
      name: 'Contas a Receber',
      role: 'financial',
      description: 'Gerencia duplicatas e cobranças',
      capabilities: ['forecast', 'report', 'suggest'],
      icon: '📥',
      color: '#10B981'
    },
    {
      id: 'financial-pagar',
      name: 'Contas a Pagar',
      role: 'financial',
      description: 'Gerencia fornecedores e pagamentos',
      capabilities: ['forecast', 'report', 'suggest'],
      icon: '📤',
      color: '#10B981'
    }
  ]
};

/**
 * Agente Contábil
 * Cuida da classificação, reclassificação e plano de contas
 */
export const ACCOUNTING_AGENT: Agent = {
  id: 'accounting',
  name: 'Agente Contábil',
  role: 'accounting',
  description: 'Responsável pela classificação contábil, manutenção do plano de contas e geração de demonstrativos.',
  capabilities: [
    'classify',
    'reclassify',
    'split',
    'suggest',
    'validate',
    'report'
  ],
  requiresApproval: ['brain'],
  edgeFunctionName: 'accounting-agent',
  icon: '📊',
  color: '#3B82F6', // blue
  subAgents: [
    {
      id: 'accounting-classification',
      name: 'Classificação',
      role: 'accounting',
      description: 'Classifica transações automaticamente',
      capabilities: ['classify', 'suggest'],
      icon: '🏷️',
      color: '#3B82F6'
    },
    {
      id: 'accounting-reclassification',
      name: 'Reclassificação',
      role: 'accounting',
      description: 'Corrige classificações incorretas',
      capabilities: ['reclassify', 'split'],
      requiresApproval: ['brain'],
      icon: '🔄',
      color: '#3B82F6'
    },
    {
      id: 'accounting-chart',
      name: 'Plano de Contas',
      role: 'accounting',
      description: 'Gerencia estrutura do plano de contas',
      capabilities: ['create_account', 'validate'],
      requiresApproval: ['brain'],
      icon: '📋',
      color: '#3B82F6'
    }
  ]
};

/**
 * Agente Auditor
 * Verifica inconsistências e gera alertas
 */
export const AUDITOR_AGENT: Agent = {
  id: 'auditor',
  name: 'Agente Auditor',
  role: 'auditor',
  description: 'Verifica integridade dos dados, detecta inconsistências e garante conformidade com normas contábeis.',
  capabilities: [
    'audit',
    'validate',
    'report',
    'block_transaction'
  ],
  requiresApproval: ['brain'],
  edgeFunctionName: 'auditor-agent',
  icon: '🔍',
  color: '#F59E0B', // amber
  subAgents: [
    {
      id: 'auditor-bank',
      name: 'Banco x Contábil',
      role: 'auditor',
      description: 'Concilia saldo bancário com contabilidade',
      capabilities: ['audit', 'report'],
      icon: '🏦',
      color: '#F59E0B'
    },
    {
      id: 'auditor-transitorias',
      name: 'Transitórias',
      role: 'auditor',
      description: 'Monitora saldo das contas transitórias',
      capabilities: ['audit', 'validate'],
      icon: '⏳',
      color: '#F59E0B'
    },
    {
      id: 'auditor-dre',
      name: 'DRE x Contratos',
      role: 'auditor',
      description: 'Verifica receitas vs contratos ativos',
      capabilities: ['audit', 'report'],
      icon: '📈',
      color: '#F59E0B'
    }
  ]
};

/**
 * Agente Educador
 * Explica decisões e treina o usuário
 */
export const EDUCATOR_AGENT: Agent = {
  id: 'educator',
  name: 'Agente Educador',
  role: 'educator',
  description: 'Explica o "porquê" das regras contábeis, mostra impacto das decisões e treina usuários.',
  capabilities: [
    'explain',
    'suggest'
  ],
  edgeFunctionName: 'educator-agent',
  icon: '🎓',
  color: '#EC4899', // pink
  subAgents: [
    {
      id: 'educator-explainer',
      name: 'Explica Erro',
      role: 'educator',
      description: 'Explica por que uma ação foi bloqueada ou corrigida',
      capabilities: ['explain'],
      icon: '❓',
      color: '#EC4899'
    },
    {
      id: 'educator-impact',
      name: 'Mostra Impacto',
      role: 'educator',
      description: 'Visualiza consequências antes de confirmar',
      capabilities: ['explain', 'suggest'],
      icon: '📊',
      color: '#EC4899'
    },
    {
      id: 'educator-trainer',
      name: 'Treina Usuário',
      role: 'educator',
      description: 'Oferece dicas e boas práticas contextuais',
      capabilities: ['explain', 'suggest'],
      icon: '📚',
      color: '#EC4899'
    }
  ]
};

// ============================================================================
// HIERARCHY
// ============================================================================

/**
 * Hierarquia completa de agentes
 * Dr. Cícero no topo, demais agentes subordinados
 */
export const AGENT_HIERARCHY: Agent = {
  ...DR_CICERO_AGENT,
  subAgents: [
    FINANCIAL_AGENT,
    ACCOUNTING_AGENT,
    AUDITOR_AGENT,
    EDUCATOR_AGENT
  ]
};

/**
 * Lista plana de todos os agentes
 */
export const ALL_AGENTS: Agent[] = [
  DR_CICERO_AGENT,
  FINANCIAL_AGENT,
  ...FINANCIAL_AGENT.subAgents || [],
  ACCOUNTING_AGENT,
  ...ACCOUNTING_AGENT.subAgents || [],
  AUDITOR_AGENT,
  ...AUDITOR_AGENT.subAgents || [],
  EDUCATOR_AGENT,
  ...EDUCATOR_AGENT.subAgents || []
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Encontra um agente pelo ID
 */
export function findAgentById(id: string): Agent | null {
  return ALL_AGENTS.find(a => a.id === id) || null;
}

/**
 * Encontra agentes por capability
 */
export function findAgentsByCapability(capability: AgentCapability): Agent[] {
  return ALL_AGENTS.filter(a => a.capabilities.includes(capability));
}

/**
 * Verifica se um agente pode executar uma ação
 */
export function canAgentPerform(agentId: string, action: AgentCapability): boolean {
  const agent = findAgentById(agentId);
  return agent?.capabilities.includes(action) ?? false;
}

/**
 * Verifica se ação requer aprovação do Dr. Cícero
 */
export function requiresDrCiceroApproval(agentId: string, action: AgentCapability): boolean {
  const agent = findAgentById(agentId);
  if (!agent) return true; // Por segurança, requer aprovação
  
  // Ações que sempre requerem aprovação
  const alwaysRequiresApproval: AgentCapability[] = [
    'create_account',
    'reclassify',
    'split',
    'block_transaction'
  ];
  
  if (alwaysRequiresApproval.includes(action)) return true;
  
  // Verifica se o agente tem Dr. Cícero como aprovador
  return agent.requiresApproval?.includes('brain') ?? false;
}

/**
 * Obtém o agente responsável por uma ação específica
 */
export function getResponsibleAgent(action: AgentCapability): Agent {
  // Mapeamento de ações para agentes principais
  const actionAgentMap: Record<AgentCapability, string> = {
    classify: 'accounting-classification',
    reclassify: 'accounting-reclassification',
    split: 'accounting-reclassification',
    approve: 'dr-cicero',
    reject: 'dr-cicero',
    audit: 'auditor',
    explain: 'educator',
    suggest: 'accounting',
    validate: 'auditor',
    reconcile: 'financial-caixa',
    forecast: 'financial',
    report: 'financial',
    create_account: 'accounting-chart',
    block_transaction: 'dr-cicero'
  };
  
  const agentId = actionAgentMap[action];
  return findAgentById(agentId) || DR_CICERO_AGENT;
}

/**
 * Gera contexto para chamar um agente
 */
export function buildAgentContext(
  action: AgentCapability,
  data: Record<string, any>
): AgentAction {
  const agent = getResponsibleAgent(action);
  const needsApproval = requiresDrCiceroApproval(agent.id, action);
  
  return {
    agentId: agent.id,
    action,
    context: data,
    requiresApproval: needsApproval,
    approverAgentId: needsApproval ? 'dr-cicero' : undefined
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default AGENT_HIERARCHY;
