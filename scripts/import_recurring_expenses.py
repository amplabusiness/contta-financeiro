#!/usr/bin/env python3
"""Ferramenta de linha de comando para cadastrar despesas recorrentes a partir
 da planilha Controle Despesas-1.xlsx.

O script replica a mesma lógica usada na tela React de importação, percorrendo
os cabeçalhos da planilha para identificar categorias/centros de custo e
registrando cada linha como um lançamento recorrente na tabela
`accounts_payable` do Supabase.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Iterable, List, Optional, Sequence, Tuple

import pandas as pd
import requests

CATEGORY_HEADERS = {
    "CONTAS FIXAS": ("Contas Fixas", "Ampla Contabilidade"),
    "IMPOSTOS": ("Impostos", "Ampla Contabilidade"),
    "CONTAS VARIÁVEIS": ("Contas Variáveis", "Ampla Contabilidade"),
    "SERVIÇO TERCEIROS": ("Serviço Terceiros", "Ampla Contabilidade"),
    "FOLHA PAGAMENTO": ("Folha Pagamento", "Ampla Contabilidade"),
    "MATERIAL DE CONSUMO": ("Material de Consumo", "Ampla Contabilidade"),
    "SERGIO CARNEIRO": ("Pessoal", "Sergio Carneiro"),
}

SKIP_KEYWORDS = ("TOTAL", "MOVIMENTO", "GASTOS", "RESULTADO", "R$")


@dataclass
class Expense:
    description: str
    amount: Decimal
    category: str
    cost_center: str


def parse_amount(value) -> Optional[Decimal]:  # type: ignore[override]
    """Converte diferentes formatos de números/currency em Decimal."""

    if value is None:
        return None

    if isinstance(value, str) and value.strip() == "":
        return None

    if pd.isna(value):
        return None

    if isinstance(value, (int, float)):
        return Decimal(str(value))

    if isinstance(value, str):
        cleaned = (
            value.strip()
            .replace("R$", "")
            .replace(".", "")
            .replace(" ", "")
            .replace(",", ".")
        )
        if cleaned in {"", "-"}:
            return None
        try:
            return Decimal(cleaned)
        except InvalidOperation:
            return None

    return None


def detect_header(text: str) -> Optional[Tuple[str, str]]:
    upper = text.upper()
    for key, value in CATEGORY_HEADERS.items():
        if key in upper:
            return value
    return None


def should_skip(text: str) -> bool:
    upper = text.upper()
    return any(keyword in upper for keyword in SKIP_KEYWORDS)


def extract_line_amount(row: Sequence) -> Optional[Decimal]:
    for value in reversed(row):
        amount = parse_amount(value)
        if amount is not None:
            return amount
    return None


def parse_expenses_from_sheet(path: str, sheet_name: Optional[str]) -> List[Expense]:
    sheet_ref = sheet_name if sheet_name is not None else 0
    dataframe = pd.read_excel(path, sheet_name=sheet_ref, header=None)
    expenses: List[Expense] = []
    current_category = "Outros"
    current_cost_center = "Geral"

    for _, row in dataframe.iterrows():
        values = row.tolist()
        if not values:
            continue

        first_cell = values[0]

        if first_cell is None or (isinstance(first_cell, str) and not first_cell.strip()):
            continue

        if not isinstance(first_cell, str) and pd.isna(first_cell):
            continue

        description = str(first_cell).strip()

        if not description:
            continue

        header = detect_header(description)
        if header:
            current_category, current_cost_center = header
            continue

        if should_skip(description):
            continue

        amount = extract_line_amount(values)
        if amount is None or amount <= 0:
            continue

        expenses.append(
            Expense(
                description=description,
                amount=amount,
                category=current_category,
                cost_center=current_cost_center,
            )
        )

    return expenses


def chunked(seq: Sequence, size: int) -> Iterable[Sequence]:
    for idx in range(0, len(seq), size):
        yield seq[idx : idx + size]


def build_payload(expense: Expense, args: argparse.Namespace) -> dict:
    payload = {
        "supplier_name": expense.description,
        "description": expense.description,
        "category": expense.category,
        "cost_center": expense.cost_center,
        "amount": float(expense.amount),
        "due_date": args.due_date,
        "status": "pending",
        "is_recurring": True,
        "recurrence_frequency": args.frequency,
        "recurrence_day": args.recurrence_day,
    }

    if args.created_by:
        payload["created_by"] = args.created_by

    return payload


def send_to_supabase(expenses: List[Expense], args: argparse.Namespace) -> None:
    supabase_url = args.supabase_url.rstrip("/")
    endpoint = f"{supabase_url}/rest/v1/accounts_payable"
    headers = {
        "apikey": args.supabase_key,
        "Authorization": f"Bearer {args.supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    created, errors = 0, 0
    for batch in chunked(expenses, args.batch_size):
        payload = [build_payload(expense, args) for expense in batch]
        response = requests.post(endpoint, headers=headers, data=json.dumps(payload))

        if response.status_code >= 400:
            errors += len(batch)
            print(
                f"Falha ao inserir lote (status {response.status_code}): {response.text}",
                file=sys.stderr,
            )
            continue

        created += len(batch)

    print(f"Resumo: {created} despesas inseridas, {errors} falhas.")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Importa despesas recorrentes da planilha Controle Despesas-1.xlsx",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--file",
        default="banco/Controle Despesas-1.xlsx",
        help="Caminho para a planilha de controle de despesas",
    )
    parser.add_argument(
        "--sheet",
        default=None,
        help="Nome da aba a ser lida (padrão: primeira aba)",
    )
    parser.add_argument(
        "--due-date",
        default=dt.date.today().isoformat(),
        help="Data de vencimento a aplicar aos lançamentos (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--recurrence-day",
        type=int,
        default=10,
        help="Dia padrão de recorrência",
    )
    parser.add_argument(
        "--frequency",
        choices=["monthly", "quarterly", "semiannual", "annual"],
        default="monthly",
        help="Frequência da despesa recorrente",
    )
    parser.add_argument(
        "--created-by",
        default=None,
        help="UUID do usuário que será atribuído como criador (opcional)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Apenas exibe os registros detectados sem enviar ao Supabase",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Quantidade de registros enviada por requisição",
    )
    parser.add_argument(
        "--supabase-url",
        default=os.environ.get("SUPABASE_URL")
        or os.environ.get("VITE_SUPABASE_URL", ""),
        help="URL do projeto Supabase (ex: https://xyz.supabase.co)",
    )
    parser.add_argument(
        "--supabase-key",
        default=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY", ""),
        help="Chave do Supabase com permissão de escrita",
    )
    return parser


def validate_args(args: argparse.Namespace) -> None:
    if not os.path.exists(args.file):
        raise FileNotFoundError(f"Planilha não encontrada: {args.file}")
    if not args.supabase_url and not args.dry_run:
        raise ValueError("Informe SUPABASE_URL via argumento ou variável de ambiente.")
    if not args.supabase_key and not args.dry_run:
        raise ValueError(
            "Informe SUPABASE_SERVICE_ROLE_KEY (ou use --dry-run para teste)."
        )
    try:
        dt.date.fromisoformat(args.due_date)
    except ValueError as exc:
        raise ValueError("--due-date deve estar no formato YYYY-MM-DD") from exc


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    try:
        validate_args(args)
    except Exception as exc:  # noqa: BLE001
        parser.error(str(exc))

    expenses = parse_expenses_from_sheet(args.file, args.sheet)
    if not expenses:
        print("Nenhuma despesa encontrada na planilha.")
        return

    print(f"Total identificado: {len(expenses)} despesas.")

    if args.dry_run:
        for expense in expenses:
            print(
                f"- {expense.description} | R$ {expense.amount:.2f} | "
                f"{expense.category} | CC: {expense.cost_center}"
            )
        return

    send_to_supabase(expenses, args)


if __name__ == "__main__":
    main()
