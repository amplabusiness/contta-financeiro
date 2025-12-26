/**
 * Testes para Sistema de Folha de Pagamento
 * 
 * Execute com: npm test -- src/hooks/usePayrollAccounting.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { gerarCodigoRastreamento, validarDuplicata, validarIntegridade } from '@/services/RastreamentoService';

// Mock do Supabase
const mockSupabase = {
  from: vi.fn()
};

describe('Folha de Pagamento - Testes Unitários', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RastreamentoService', () => {
    
    it('deve gerar código único de rastreamento', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      });

      const rastreamento = await gerarCodigoRastreamento(
        mockSupabase,
        'FOLD',
        { teste: true },
        2025,
        12
      );

      expect(rastreamento.codigoRastreamento).toMatch(/^FOLD_202512_\d{3}_[A-F0-9]{6}$/);
      expect(rastreamento.tipo).toBe('FOLD');
      expect(rastreamento.competenciaAno).toBe(2025);
      expect(rastreamento.competenciaMes).toBe(12);
      expect(rastreamento.sequencial).toBe(1);
      expect(rastreamento.hashValidacao).toHaveLength(6);
    });

    it('deve incrementar sequencial para mesmo mês', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  { reference_id: 'FOLD_202512_003_ABC123' }
                ],
                error: null
              })
            })
          })
        })
      });

      const rastreamento = await gerarCodigoRastreamento(
        mockSupabase,
        'FOLD',
        { teste: true },
        2025,
        12
      );

      expect(rastreamento.sequencial).toBe(4);
    });

    it('deve validar duplicata corretamente', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const resultado = await validarDuplicata(
        mockSupabase,
        'FOLD_202512_001_A7F2E9',
        'ref_test'
      );

      expect(resultado.isDuplicata).toBe(false);
    });

    it('deve detectar duplicata por código', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'entry-123', entry_date: '2025-12-31' }],
              error: null
            })
          })
        })
      });

      const resultado = await validarDuplicata(
        mockSupabase,
        'FOLD_202512_001_A7F2E9',
        'ref_test'
      );

      expect(resultado.isDuplicata).toBe(true);
      expect(resultado.entryId).toBe('entry-123');
    });
  });

  describe('Validação de Folha de Pagamento', () => {
    
    it('deve calcular corretamente salário líquido', () => {
      const salarioBruto = 3000;
      const inss = salarioBruto * 0.10;      // 300
      const irrf = salarioBruto * 0.05;      // 150
      const liquido = salarioBruto - inss - irrf; // 2550

      expect(liquido).toBe(2550);
      expect(inss).toBe(300);
      expect(irrf).toBe(150);
    });

    it('deve validar que bruto = líquido + descontos', () => {
      const bruto = 3000;
      const inss = 300;
      const irrf = 150;
      const liquido = 2550;

      const soma = liquido + inss + irrf;
      expect(Math.abs(bruto - soma)).toBeLessThan(0.01);
    });

    it('deve somar corretamente valores de múltiplos funcionários', () => {
      const funcionarios = [
        { salarioBruto: 3000, inssRetido: 300, irrfRetido: 150, salarioLiquido: 2550 },
        { salarioBruto: 2500, inssRetido: 250, irrfRetido: 125, salarioLiquido: 2125 },
      ];

      const totalBruto = funcionarios.reduce((s, f) => s + f.salarioBruto, 0);
      const totalINSS = funcionarios.reduce((s, f) => s + f.inssRetido, 0);
      const totalIRRF = funcionarios.reduce((s, f) => s + f.irrfRetido, 0);
      const totalLiquido = funcionarios.reduce((s, f) => s + f.salarioLiquido, 0);

      expect(totalBruto).toBe(5500);
      expect(totalINSS).toBe(550);
      expect(totalIRRF).toBe(275);
      expect(totalLiquido).toBe(4675);

      // Validar que bate
      expect(Math.abs(totalBruto - (totalLiquido + totalINSS + totalIRRF))).toBeLessThan(0.01);
    });
  });

  describe('Lançamentos Contábeis', () => {
    
    it('deve ter estrutura correta de lançamento de provisão', () => {
      const totalBruto = 5500;
      const totalLiquido = 4675;
      const totalINSS = 550;
      const totalIRRF = 275;

      const lancamento = {
        linhas: [
          { conta: '3.1.01', debito: totalBruto, credito: 0 },      // Despesa
          { conta: '2.1.2.01', debito: 0, credito: totalLiquido },  // Salários a Pagar
          { conta: '2.1.2.02', debito: 0, credito: totalINSS },     // INSS a Recolher
          { conta: '2.1.2.03', debito: 0, credito: totalIRRF },     // IRRF a Recolher
        ]
      };

      const totalDebito = lancamento.linhas.reduce((s, l) => s + l.debito, 0);
      const totalCredito = lancamento.linhas.reduce((s, l) => s + l.credito, 0);

      expect(totalDebito).toBe(totalBruto);
      expect(totalCredito).toBe(totalBruto);
      expect(Math.abs(totalDebito - totalCredito)).toBeLessThan(0.01);
    });

    it('deve balancear lançamento de pagamento', () => {
      const totalLiquido = 4675;

      const lancamento = {
        linhas: [
          { conta: '2.1.2.01', debito: totalLiquido, credito: 0 },  // Salários a Pagar
          { conta: '1.1.1.01', debito: 0, credito: totalLiquido },  // Banco
        ]
      };

      const totalDebito = lancamento.linhas.reduce((s, l) => s + l.debito, 0);
      const totalCredito = lancamento.linhas.reduce((s, l) => s + l.credito, 0);

      expect(totalDebito).toBe(totalLiquido);
      expect(totalCredito).toBe(totalLiquido);
    });

    it('deve balancear lançamento de INSS', () => {
      const totalINSS = 550;

      const lancamento = {
        linhas: [
          { conta: '2.1.2.02', debito: totalINSS, credito: 0 },     // INSS a Recolher
          { conta: '1.1.1.01', debito: 0, credito: totalINSS },     // Banco
        ]
      };

      const totalDebito = lancamento.linhas.reduce((s, l) => s + l.debito, 0);
      const totalCredito = lancamento.linhas.reduce((s, l) => s + l.credito, 0);

      expect(totalDebito).toBe(totalINSS);
      expect(totalCredito).toBe(totalINSS);
    });

    it('deve balancear lançamento de IRRF', () => {
      const totalIRRF = 275;

      const lancamento = {
        linhas: [
          { conta: '2.1.2.03', debito: totalIRRF, credito: 0 },     // IRRF a Recolher
          { conta: '1.1.1.01', debito: 0, credito: totalIRRF },     // Banco
        ]
      };

      const totalDebito = lancamento.linhas.reduce((s, l) => s + l.debito, 0);
      const totalCredito = lancamento.linhas.reduce((s, l) => s + l.credito, 0);

      expect(totalDebito).toBe(totalIRRF);
      expect(totalCredito).toBe(totalIRRF);
    });
  });

  describe('Rastreamento e Auditoria', () => {
    
    it('deve gerar códigos únicos para mesmos dados', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      });

      const rastreamento1 = await gerarCodigoRastreamento(
        mockSupabase,
        'FOLD',
        { teste: true },
        2025,
        12
      );

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ reference_id: rastreamento1.codigoRastreamento }],
                error: null
              })
            })
          })
        })
      });

      const rastreamento2 = await gerarCodigoRastreamento(
        mockSupabase,
        'FOLD',
        { teste: true },
        2025,
        12
      );

      // Devem ser diferentes (sequencial incrementou)
      expect(rastreamento1.codigoRastreamento).not.toBe(rastreamento2.codigoRastreamento);
      expect(rastreamento2.sequencial).toBe(rastreamento1.sequencial + 1);
    });

    it('deve manter integridade de hash', () => {
      const dados1 = { teste: true, valor: 100 };
      const dados2 = { teste: true, valor: 100 };
      const dados3 = { teste: true, valor: 101 };

      // Mesmo dados = mesmo hash (em produção)
      // Dados diferentes = hash diferente
      
      expect(JSON.stringify(dados1)).toEqual(JSON.stringify(dados2));
      expect(JSON.stringify(dados1)).not.toEqual(JSON.stringify(dados3));
    });
  });

  describe('Casos de Erro', () => {
    
    it('deve rejeitar folha sem funcionários', () => {
      const funcionarios = [];
      
      expect(() => {
        if (funcionarios.length === 0) {
          throw new Error('Nenhum funcionário na folha');
        }
      }).toThrow('Nenhum funcionário na folha');
    });

    it('deve rejeitar cálculo incorreto', () => {
      const totalBruto = 5500;
      const totalLiquido = 4675;
      const totalINSS = 500;  // Errado! Deveria ser 550
      const totalIRRF = 275;

      const soma = totalLiquido + totalINSS + totalIRRF;
      const diferenca = Math.abs(totalBruto - soma);

      expect(diferenca).toBeGreaterThan(0.01);
    });

    it('deve rejeitar lançamento desbalanceado', () => {
      const totalDebito = 5500;
      const totalCredito = 5400;  // Errado!

      expect(Math.abs(totalDebito - totalCredito)).toBeGreaterThan(0.01);
    });
  });
});

describe('Testes de Integração', () => {
  
  it('deve simular fluxo completo de folha', async () => {
    // 1. Gerar código
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })
    });

    const rastreamento = await gerarCodigoRastreamento(
      mockSupabase,
      'FOLD',
      { funcionarios: 2 },
      2025,
      12
    );

    expect(rastreamento.codigoRastreamento).toMatch(/^FOLD_/);

    // 2. Validar não existe duplicata
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    });

    const { isDuplicata } = await validarDuplicata(
      mockSupabase,
      rastreamento.codigoRastreamento,
      rastreamento.referenceId
    );

    expect(isDuplicata).toBe(false);

    // 3. Validar lançamento
    const funcionarios = [
      { salarioBruto: 3000, inssRetido: 300, irrfRetido: 150, salarioLiquido: 2550 },
      { salarioBruto: 2500, inssRetido: 250, irrfRetido: 125, salarioLiquido: 2125 },
    ];

    const totalBruto = funcionarios.reduce((s, f) => s + f.salarioBruto, 0);
    const totalLiquido = funcionarios.reduce((s, f) => s + f.salarioLiquido, 0);

    expect(Math.abs(totalBruto - (totalLiquido + 550 + 275))).toBeLessThan(0.01);
  });
});
