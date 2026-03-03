#!/usr/bin/env python3
"""
Processador de TODAS as folhas de pagamento (Domínio Sistemas)
Extrai dados de todos os PDFs em folha_pgto/ e gera o data-lake consolidado.

Layout padrão Domínio:
  - Cada página = 1 holerite de 1 funcionário
  - Cabeçalho: empresa, CNPJ, CC, tipo folha, mês
  - Corpo: código, nome, CBO, cargo, admissão, rubricas
  - Rodapé: Total Vencimentos | Total Descontos | Líquido | FGTS | Sal.Contr.INSS

Saída: lib/datalake/folha_pagamento.json (data-lake completo)
"""

import pdfplumber
import json
import re
import os
import sys
from datetime import datetime
from pathlib import Path

# Diretório base
BASE_DIR = Path(__file__).resolve().parent.parent
FOLHA_DIR = BASE_DIR / "folha_pgto"
OUTPUT_FILE = BASE_DIR / "lib" / "datalake" / "folha_pagamento.json"

# Mapeamento de arquivos para competência
MESES = {
    "FOLHA AMPLA JAN.pdf":      {"competencia": "01/2025", "mes_ano": "012025", "entry_date": "2025-01-31", "label": "Janeiro/2025"},
    "FOLHA AMPLA FEV.pdf":      {"competencia": "02/2025", "mes_ano": "022025", "entry_date": "2025-02-28", "label": "Fevereiro/2025"},
    "FOLHA AMPLA MARCO.pdf":    {"competencia": "03/2025", "mes_ano": "032025", "entry_date": "2025-03-31", "label": "Março/2025"},
    "FOLHA AMPLA ABRIL.pdf":    {"competencia": "04/2025", "mes_ano": "042025", "entry_date": "2025-04-30", "label": "Abril/2025"},
    "FOLHA AMPLA MAIO.pdf":     {"competencia": "05/2025", "mes_ano": "052025", "entry_date": "2025-05-31", "label": "Maio/2025"},
    "FOLHA AMPLA JUNHO.pdf":    {"competencia": "06/2025", "mes_ano": "062025", "entry_date": "2025-06-30", "label": "Junho/2025"},
    "FOLHA AMPLA JULHO.pdf":    {"competencia": "07/2025", "mes_ano": "072025", "entry_date": "2025-07-31", "label": "Julho/2025"},
    "FOLHA AMPLA AGOSTO.pdf":   {"competencia": "08/2025", "mes_ano": "082025", "entry_date": "2025-08-31", "label": "Agosto/2025"},
    "FOLHA AMPLA SETEMBRO.pdf": {"competencia": "09/2025", "mes_ano": "092025", "entry_date": "2025-09-30", "label": "Setembro/2025"},
    "FOLHA AMPLA OUTUBRO.pdf":  {"competencia": "10/2025", "mes_ano": "102025", "entry_date": "2025-10-31", "label": "Outubro/2025"},
    "FOLHA AMPLA NOVEMBRO.pdf": {"competencia": "11/2025", "mes_ano": "112025", "entry_date": "2025-11-30", "label": "Novembro/2025"},
    "FOLHA AMPLA DEZEMBRO.pdf": {"competencia": "12/2025", "mes_ano": "122025", "entry_date": "2025-12-31", "label": "Dezembro/2025"},
    "FOLHA AMPLA JAN2026.pdf":  {"competencia": "01/2026", "mes_ano": "012026", "entry_date": "2026-01-31", "label": "Janeiro/2026"},
    "FOLHA AMPLA FEV2026.pdf":  {"competencia": "02/2026", "mes_ano": "022026", "entry_date": "2026-02-28", "label": "Fevereiro/2026"},
}

# ── Mapeamento contábil por funcionário/cargo ──────────────────────────────────
# Regra geral:
#   CC "CUSTOS OPERACIONAIS" → 4.1.1.01 Salários (despesa operacional)
#   CC "DESPESAS ADMINISTRATIVAS" → depende do funcionário:
MAPEAMENTO_ESPECIAL = {
    # Babás → Adiantamento Nayara
    "FABIANA MARIA DA SILVA MENDONCA": {"cc_contabil": "ADIANTAMENTO_NAYARA",  "debit_code": "1.1.3.04.04", "obs": "Babá da Nayara → Adiantamento Nayara"},
    "CLAUDIA":                         {"cc_contabil": "ADIANTAMENTO_NAYARA",  "debit_code": "1.1.3.04.04", "obs": "Babá da Nayara → Adiantamento Nayara"},
    # Caseiro → Adiantamento Sérgio Carneiro
    "RAIMUNDO PEREIRA MOREIRA":        {"cc_contabil": "ADIANTAMENTO_SERGIO",  "debit_code": "1.1.3.04.01", "obs": "Caseiro propriedade pessoal Sérgio → Adiant. Sérgio Carneiro"},
    "KENIO MARTINS MARQUES":           {"cc_contabil": "ADIANTAMENTO_SERGIO",  "debit_code": "1.1.3.04.01", "obs": "Caseiro (substituto Raimundo) → Adiant. Sérgio Carneiro"},
    # Sérgio Augusto → Adiantamento (não trabalha na Ampla)
    "SERGIO AUGUSTO DE OLIVEIRA LEAO": {"cc_contabil": "ADIANTAMENTO_AUGUSTO", "debit_code": "1.1.3.04.05", "obs": "Filho (mesada) — não trabalha na Ampla → Adiant. Sérgio Augusto"},
    # Lilian → Serviços gerais do escritório (despesa operacional)
    "LILIAN":                          {"cc_contabil": "CUSTOS_OPERACIONAIS",  "debit_code": "4.1.1.01",    "obs": "Serviços gerais — despesa operacional"},
}

def parse_value(value_str):
    """Converte string monetária BR para float. Ex: '3.762,00' → 3762.00"""
    if not value_str or not value_str.strip():
        return 0.0
    try:
        clean = value_str.strip().replace('.', '').replace(',', '.')
        return float(clean)
    except:
        return 0.0

def classificar_funcionario(nome, cargo, cc_dominio):
    """Determina classificação contábil do funcionário."""
    nome_upper = nome.upper().strip()
    
    # 1. Verificar mapeamento especial por nome
    for key, info in MAPEAMENTO_ESPECIAL.items():
        if key in nome_upper:
            return info["cc_contabil"], info["debit_code"], info.get("obs", "")
    
    # 2. Verificar por cargo
    cargo_upper = (cargo or "").upper()
    if "BABA" in cargo_upper or "BABÁ" in cargo_upper:
        return "ADIANTAMENTO_NAYARA", "1.1.3.04.04", "Babá → Adiantamento Nayara"
    if "CASEIRO" in cargo_upper:
        return "ADIANTAMENTO_SERGIO", "1.1.3.04.01", "Caseiro → Adiant. Sérgio Carneiro"
    
    # 3. CC padrão
    cc_upper = (cc_dominio or "").upper()
    if "CUSTOS OPERACIONAIS" in cc_upper or "CUSTO" in cc_upper:
        return "CUSTOS_OPERACIONAIS", "4.1.1.01", ""
    if "DESPESAS ADMINISTRATIVAS" in cc_upper or "ADMIN" in cc_upper:
        # Funcionário administrativo genérico → despesa operacional
        return "CUSTOS_OPERACIONAIS", "4.1.1.01", "Desp. Administrativa → tratada como operacional"
    
    # 4. Default
    return "CUSTOS_OPERACIONAIS", "4.1.1.01", ""


def extrair_holerite(page_text, page_num):
    """Extrai dados de um holerite (1 página = 1 funcionário)."""
    text = page_text or ""
    if not text.strip():
        return None
    
    # Verificar se é página de holerite (tem "Total de Vencimentos" ou similar)
    if "Total de Vencimentos" not in text and "Valor Líquido" not in text and "Valor L" not in text:
        return None
    
    result = {}
    
    # ── Centro de Custo ──
    cc_match = re.search(r'CC:\s*([^\n]+?)(?:\s+Folha|\s*$)', text)
    result["cc_dominio"] = cc_match.group(1).strip() if cc_match else "DESCONHECIDO"
    
    # ── Código e Nome ──
    # Padrões possíveis no layout Domínio:
    # "127 DEUZA RESENDE DE JESUS 413105 1 1"
    code_match = re.search(
        r'(?:Código Nome do Funcionário|Filial\s*\n)\s*(\d+)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)\s+(\d{4,6})\s+\d+\s+\d+',
        text
    )
    if code_match:
        result["cod"] = int(code_match.group(1))
        result["nome"] = code_match.group(2).strip()
    else:
        # Fallback: tentar outro padrão
        code_match2 = re.search(r'^\s*(\d{1,4})\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,40}?)\s+\d{4,6}', text, re.MULTILINE)
        if code_match2:
            result["cod"] = int(code_match2.group(1))
            result["nome"] = code_match2.group(2).strip()
        else:
            return None  # Não conseguiu extrair — pular página

    # ── Cargo ──
    cargo_match = re.search(
        rf'{re.escape(result["nome"])}.*?\n\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ /]+?)\s+Admissão',
        text, re.DOTALL
    )
    result["cargo"] = cargo_match.group(1).strip() if cargo_match else "SEM CARGO"
    
    # ── Data de Admissão ──
    adm_match = re.search(r'Admissão:\s*(\d{2}/\d{2}/\d{4})', text)
    if adm_match:
        d, m, y = adm_match.group(1).split('/')
        result["admissao"] = f"{y}-{m}-{d}"
    else:
        result["admissao"] = ""
    
    # ── Horas Extras ──
    he_match = re.search(r'Horas\s+Extras?\s+\d+[%,]?\d*\s*([\d.,]+)', text)
    result["horas_extras"] = parse_value(he_match.group(1)) if he_match else 0.0
    
    # ── Total de Descontos ──
    # No layout Domínio, "Total de Vencimentos Total de Descontos" está na mesma linha.
    # O valor que aparece logo ABAIXO é o total de descontos (o de vencimentos não é extraído).
    td_match = re.search(r'Total de Descontos\s*\n\s*([\d.,]+)', text)
    if not td_match:
        td_match = re.search(r'Total de Descontos\s+([\d.,]+)', text)
    result["total_descontos"] = parse_value(td_match.group(1)) if td_match else 0.0
    
    # ── Valor Líquido ──
    vl_match = re.search(r'Valor L[íi]quido\s*([\d.,]+)', text)
    result["valor_liquido"] = parse_value(vl_match.group(1)) if vl_match else 0.0
    
    # ── Líquido Rescisão (campo especial para rescisões) ──
    # Quando é rescisão, "Valor Líquido" pode estar mascarado (*********) mas "LIQUIDO RESCISAO" tem o valor.
    if result["valor_liquido"] == 0:
        resc_match = re.search(r'LIQUIDO\s+RESCIS[ÃA]O\s+[\d.,]+\s+([\d.,]+)', text)
        if resc_match:
            result["valor_liquido_rescisao"] = parse_value(resc_match.group(1))
    
    # ── Total de Vencimentos ──
    # Não é extraído diretamente pelo pdfplumber (fica mascarado ou em coluna não capturada).
    # Regra contábil: Total Vencimentos = Valor Líquido + Total Descontos (sempre!)
    result["total_vencimentos"] = round(result["valor_liquido"] + result["total_descontos"], 2)
    
    # ── Rodapé estatístico: Salário Base | Sal.Contr.INSS | Base Cálc.FGTS | FGTS do Mês | Base Cálc.IRRF | Faixa IRRF ──
    # O cabeçalho fica em uma linha e os 6 valores ficam na PRÓXIMA linha, separados por espaços.
    # Exemplo:
    #   'Salário Base Sal. Contr. INSS Base Cálc. FGTS F.G.T.S do Mês Base Cálc. IRRF Faixa IRRF'
    #   '3.762,00 3.762,00 3.762,00 300,96 3.197,20 15,00'
    stats_match = re.search(
        r'Sal[áa]rio\s+Base\s+Sal.*?(?:IRRF|Faixa)\s*\n\s*([\d.,]+(?:\s+[\d.,]+){3,5})',
        text
    )
    if stats_match:
        stats_values = re.findall(r'[\d.,]+', stats_match.group(1))
        if len(stats_values) >= 4:
            result["salario_base"]  = parse_value(stats_values[0])
            result["sal_contr_inss"] = parse_value(stats_values[1])
            # stats_values[2] = Base Cálc. FGTS (não usado)
            result["fgts_mes"]      = parse_value(stats_values[3])
        elif len(stats_values) >= 1:
            result["salario_base"]  = parse_value(stats_values[0])
            result["sal_contr_inss"] = 0.0
            result["fgts_mes"]      = 0.0
    else:
        # Fallback: tentar extrair salário base do corpo das rubricas
        sal_rubrica = re.search(r'SALARIO\s+NORMAL\s+[\d.,]+\s+([\d.,]+)', text)
        result["salario_base"]  = parse_value(sal_rubrica.group(1)) if sal_rubrica else 0.0
        result["sal_contr_inss"] = 0.0
        result["fgts_mes"]      = 0.0
    
    # ── Descontos individuais ──
    inss_match = re.search(r'I\.?N\.?S\.?S\.?\s+[\d.,]*\s+([\d.,]+)', text)
    result["inss"] = parse_value(inss_match.group(1)) if inss_match else 0.0
    
    irrf_match = re.search(r'(?:IMPOSTO DE RENDA|I\.?R\.?R\.?F\.?)\s+[\d.,]*\s+([\d.,]+)', text)
    result["irrf"] = parse_value(irrf_match.group(1)) if irrf_match else 0.0
    
    adiant_match = re.search(r'DESC\.?\s*ADIANT\.?\s+SALARIAL\s+[\d.,]*\s+([\d.,]+)', text)
    if not adiant_match:
        adiant_match = re.search(r'ADIANTAMENTO\s+[\d.,]*\s+([\d.,]+)', text)
    result["adiantamento"] = parse_value(adiant_match.group(1)) if adiant_match else 0.0
    
    vt_match = re.search(r'VALE TRANSPORTE\s+[\d.,]*\s+([\d.,]+)', text)
    result["vale_transporte"] = parse_value(vt_match.group(1)) if vt_match else 0.0
    
    # ── Classificação contábil ──
    cc_contabil, debit_code, obs = classificar_funcionario(
        result["nome"], result["cargo"], result["cc_dominio"]
    )
    result["cc_contabil"] = cc_contabil
    result["debit_code"] = debit_code
    result["obs"] = obs
    
    # ── Situação ──
    # Rescisão: líquido = 0 e vencimentos altos (compensados por descontos)
    if result["valor_liquido"] == 0 and result["total_vencimentos"] > 0:
        result["situacao"] = "RESCISAO"
        result["obs"] = (result["obs"] + " | " if result["obs"] else "") + "Rescisão — líquido zero"
    else:
        result["situacao"] = "ATIVO"
    
    return result


def processar_pdf(filepath):
    """Processa um PDF completo de folha de pagamento."""
    funcionarios = []
    
    try:
        with pdfplumber.open(filepath) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                emp = extrair_holerite(text, i)
                if emp:
                    funcionarios.append(emp)
    except Exception as e:
        print(f"  ❌ Erro ao processar {filepath.name}: {e}")
        return []
    
    # ── Deduplicação ──
    # O PDF Domínio pode ter páginas duplicadas (2 cópias por holerite) ou
    # páginas de rescisão que geram 2 extrações para o mesmo funcionário.
    # Mantém a entrada com MAIOR total_vencimentos (mais completa).
    dedup = {}
    for emp in funcionarios:
        key = emp["cod"]
        if key in dedup:
            existing = dedup[key]
            # Manter a entrada com mais dados (maior total_vencimentos ou valor_liquido)
            new_score = emp["total_vencimentos"] + emp["valor_liquido"]
            old_score = existing["total_vencimentos"] + existing["valor_liquido"]
            if new_score > old_score:
                dedup[key] = emp
        else:
            dedup[key] = emp
    
    return list(dedup.values())


def main():
    print("=" * 70)
    print("  PROCESSADOR DE FOLHAS DE PAGAMENTO — AMPLA CONTABILIDADE")
    print(f"  Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 70)
    
    if not FOLHA_DIR.exists():
        print(f"\n❌ Pasta {FOLHA_DIR} não encontrada!")
        sys.exit(1)
    
    # Listar PDFs disponíveis
    pdfs_disponiveis = sorted([f.name for f in FOLHA_DIR.glob("*.pdf")])
    print(f"\n📁 PDFs encontrados em folha_pgto/: {len(pdfs_disponiveis)}")
    for pdf_name in pdfs_disponiveis:
        status = "✅ mapeado" if pdf_name in MESES else "⚠️ NÃO mapeado"
        print(f"   {status} — {pdf_name}")
    
    # Processar cada PDF
    folhas = []
    total_geral_funcionarios = 0
    total_geral_liquido = 0
    total_geral_fgts = 0
    
    for pdf_name in sorted(MESES.keys()):
        filepath = FOLHA_DIR / pdf_name
        if not filepath.exists():
            print(f"\n⚠️  {pdf_name} — arquivo não encontrado, pulando")
            continue
        
        meta = MESES[pdf_name]
        print(f"\n{'─' * 60}")
        print(f"📄 {meta['label']} ({pdf_name})")
        
        funcionarios = processar_pdf(filepath)
        
        if not funcionarios:
            print(f"  ⚠️  Nenhum funcionário extraído!")
            continue
        
        # Calcular totais
        total_liquido = sum(f["valor_liquido"] for f in funcionarios)
        total_fgts = sum(f["fgts_mes"] for f in funcionarios)
        total_vencimentos = sum(f["total_vencimentos"] for f in funcionarios)
        total_descontos = sum(f["total_descontos"] for f in funcionarios)
        ativos = [f for f in funcionarios if f["situacao"] == "ATIVO"]
        
        print(f"  👥 Funcionários: {len(funcionarios)} (ativos: {len(ativos)})")
        print(f"  💰 Total líquido banco: R$ {total_liquido:,.2f}")
        print(f"  💼 Total FGTS:          R$ {total_fgts:,.2f}")
        print(f"  📊 Total vencimentos:   R$ {total_vencimentos:,.2f}")
        
        # Listar cada funcionário
        for f in funcionarios:
            sit_icon = "🔴" if f["situacao"] == "RESCISAO" else "🟢"
            print(f"     {sit_icon} {f['nome'][:30]:<30} Líq: R$ {f['valor_liquido']:>10,.2f}  →  {f['debit_code']}")
        
        folha = {
            "competencia": meta["competencia"],
            "mes_ano": meta["mes_ano"],
            "entry_date": meta["entry_date"],
            "importado_em": datetime.now().strftime("%Y-%m-%d"),
            "status": "extraido",
            "arquivo_fonte": f"folha_pgto/{pdf_name}",
            "total_funcionarios": len(funcionarios),
            "total_funcionarios_ativos": len(ativos),
            "total_liquido_banco": round(total_liquido, 2),
            "total_fgts": round(total_fgts, 2),
            "total_vencimentos": round(total_vencimentos, 2),
            "total_descontos": round(total_descontos, 2),
            "funcionarios": funcionarios,
        }
        
        folhas.append(folha)
        total_geral_funcionarios += len(funcionarios)
        total_geral_liquido += total_liquido
        total_geral_fgts += total_fgts
    
    # Montar data-lake completo (ordenar por data)
    folhas.sort(key=lambda x: x["entry_date"])
    
    datalake = {
        "schema_version": "2.0",
        "descricao": "Data-lake COMPLETO de folha de pagamento — Ampla Contabilidade LTDA",
        "ultima_atualizacao": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "fonte": "Domínio Sistemas (holerites PDF)",
        "total_meses": len(folhas),
        "total_registros": total_geral_funcionarios,
        "total_liquido_geral": round(total_geral_liquido, 2),
        "total_fgts_geral": round(total_geral_fgts, 2),
        
        "folhas": folhas,
        
        "mapeamento_cc": {
            "CUSTOS OPERACIONAIS": {
                "cc_contabil": "CUSTOS_OPERACIONAIS",
                "debit_code": "4.1.1.01",
                "descricao": "Salários e Ordenados — despesa operacional da empresa"
            },
            "DESPESAS ADMINISTRATIVAS": {
                "regra": "Depende do funcionário — verificar mapeamento_especial",
                "casos": {
                    "BABA/BABÁ": {"cc_contabil": "ADIANTAMENTO_NAYARA", "debit_code": "1.1.3.04.04"},
                    "CASEIRO": {"cc_contabil": "ADIANTAMENTO_SERGIO", "debit_code": "1.1.3.04.01"},
                    "SERGIO AUGUSTO": {"cc_contabil": "ADIANTAMENTO_AUGUSTO", "debit_code": "1.1.3.04.05"},
                    "LILIAN (Serviços Gerais)": {"cc_contabil": "CUSTOS_OPERACIONAIS", "debit_code": "4.1.1.01"},
                }
            }
        },
        
        "contas_contabeis_utilizadas": {
            "4.1.1.01": "Salários e Ordenados (Despesa — saída operacional)",
            "4.1.1.04": "FGTS Patronal (Despesa — encargo)",
            "2.1.2.02": "FGTS a Recolher (Passivo — provisão)",
            "1.1.1.05": "Banco Sicredi (Ativo — saída pelo banco)",
            "1.1.3.04.01": "Adiantamento Sérgio Carneiro Leão",
            "1.1.3.04.04": "Adiantamento Nayara (Babá, etc.)",
            "1.1.3.04.05": "Adiantamento Sérgio Augusto (mesada)",
        },
        
        "notas": [
            "Layout padrão: Domínio Sistemas — cada página PDF = 1 holerite.",
            "Funcionários com CC 'DESPESAS ADMINISTRATIVAS' são reclassificados conforme mapeamento_especial.",
            "Rescisões (líquido = R$ 0,00) são registradas mas não geram saída bancária.",
            "FGTS patronal é consolidado em um único lançamento por mês.",
            "Lançamento contábil: D: [conta do funcionário] / C: 1.1.1.05 Banco Sicredi (valor líquido).",
            "Lançamento FGTS: D: 4.1.1.04 FGTS Patronal / C: 2.1.2.02 FGTS a Recolher.",
        ]
    }
    
    # Salvar
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(datalake, f, indent=2, ensure_ascii=False)
    
    # Resumo final
    print(f"\n{'=' * 70}")
    print(f"  RESUMO FINAL")
    print(f"{'=' * 70}")
    print(f"  📅 Meses processados:    {len(folhas)}")
    print(f"  👥 Total registros:      {total_geral_funcionarios}")
    print(f"  💰 Total líquido geral:  R$ {total_geral_liquido:,.2f}")
    print(f"  💼 Total FGTS geral:     R$ {total_geral_fgts:,.2f}")
    print(f"  📁 Salvo em:             {OUTPUT_FILE}")
    print(f"{'=' * 70}")
    
    # Tabela resumo por mês
    print(f"\n{'Competência':<15} {'Funcs':>6} {'Total Líquido':>15} {'Total FGTS':>12}")
    print("─" * 50)
    for folha in folhas:
        print(f"{folha['competencia']:<15} {folha['total_funcionarios']:>6} {folha['total_liquido_banco']:>15,.2f} {folha['total_fgts']:>12,.2f}")
    print("─" * 50)
    print(f"{'TOTAL':<15} {total_geral_funcionarios:>6} {total_geral_liquido:>15,.2f} {total_geral_fgts:>12,.2f}")


if __name__ == "__main__":
    main()
