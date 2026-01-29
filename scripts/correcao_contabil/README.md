# Scripts de Correção Contábil

Scripts organizados para correção de anomalias contábeis no sistema Ampla.

## Lista de Scripts

| # | Script | Fase | Função |
|---|--------|------|--------|
| 01 | `01_criar_conta_transitoria.mjs` | Setup | Criar conta 1.1.9.01 (Recebimentos a Conciliar) |
| 02 | `02_limpar_duplicatas_banco_sicredi.mjs` | Fase 1 | Remover entries boleto_sicredi duplicados |
| 03 | `03_reclassificar_sintetica_para_analiticas.mjs` | Fase 1 | Mover lançamentos da sintética 1.1.2.01 |
| 04 | `04_validar_equacao_contabil.mjs` | Validacao | Verificar Debitos = Creditos |
| 05 | `05_diagnosticar_equacao_contabil.mjs` | Fase 2 | Analisar origem da diferenca |
| 06 | `06_limpar_entries_desbalanceados.mjs` | Fase 2 | Remover entries com D != C |
| 07 | `07_tratar_sintetica_genericos.mjs` | Fase 2 | Tratar lancamentos genericos |
| 08 | `08_diagnostico_profundo.mjs` | Fase 3 | Encontrar linhas orfas e entries vazios |
| 09 | `09_limpar_anomalias.mjs` | Fase 3 | Limpar todas as anomalias |
| 10 | `10_analise_duplicatas_2025.mjs` | Analise | Analisar duplicatas de todo ano 2025 |
| 11 | `11_limpeza_total_loop.mjs` | Correcao | Limpeza em loop ate zerar anomalias |
| 12 | `12_verificar_integridade.mjs` | Validacao | Verificacao completa de integridade |

## Execucao Rapida (Recomendada)

```bash
cd "c:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1"

# 1. Verificar integridade atual
node scripts/correcao_contabil/12_verificar_integridade.mjs

# 2. Se houver problemas, executar limpeza total automatica
node scripts/correcao_contabil/11_limpeza_total_loop.mjs

# 3. Verificar novamente
node scripts/correcao_contabil/12_verificar_integridade.mjs
```

## Execucao Detalhada (Passo a Passo)

```bash
# 1. Diagnostico profundo (identificar problemas)
node scripts/correcao_contabil/08_diagnostico_profundo.mjs

# 2. Simular limpeza (ver o que sera feito)
node scripts/correcao_contabil/09_limpar_anomalias.mjs

# 3. Executar limpeza (apos verificar simulacao)
node scripts/correcao_contabil/09_limpar_anomalias.mjs --executar

# 4. Validar resultado
node scripts/correcao_contabil/04_validar_equacao_contabil.mjs
```

## Modos de Execucao

Todos os scripts de modificacao suportam dois modos:

- **SIMULACAO** (padrao): Mostra o que sera feito sem alterar dados
- **EXECUCAO**: Executa as alteracoes

Para executar, adicione `--executar`:

```bash
node scripts/correcao_contabil/09_limpar_anomalias.mjs --executar
```

## Criterios de Sucesso

Apos executar os scripts, verifique:

1. **Equacao contabil**: Debitos = Creditos (diferenca = R$ 0,00)
2. **Banco Sicredi**: Saldo positivo
3. **Conta sintetica 1.1.2.01**: Zero lancamentos diretos
4. **Sem linhas orfas**: Todas as linhas tem entry correspondente
5. **Sem entries desbalanceados**: Todo entry tem D = C
6. **Sem source_types suspeitos**: sicredi_boleto, boleto_sicredi = 0

## Prevencao de Duplicatas

As Edge Functions ja possuem verificacao de idempotencia:

- `processar-ofx`: Verifica `reference_id` + `reference_type` antes de criar
- `desmembrar-cobranca`: Verifica `cobranca_desmembramento` antes de processar
- `gerar-honorarios`: Verifica `hon_{clienteId}_{competencia}` antes de gerar

Nao devem mais ocorrer duplicatas se o fluxo correto for seguido.

---

*Versao 2.0 - Janeiro 2026*
