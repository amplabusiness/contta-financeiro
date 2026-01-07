import os
import re
import json
import base64
import gzip
import time
from io import BytesIO
from datetime import datetime

import pandas as pd  # precisa ser instalado via pip
import requests  # precisa ser instalado via pip
from requests_pkcs12 import Pkcs12Adapter  # precisa ser instalado via pip
import xml.etree.ElementTree as ET

BASE_URL = "https://adn.nfse.gov.br"
DFe_URL_TEMPLATE = BASE_URL + "/contribuintes/DFe/{nsu}"

EXCEL_PATH = "empresas.xlsx"  # <-- ajuste o caminho do seu Excel aqui
CERT_DIR = "certificados"
OUTPUT_BASE_DIR = "notasfiscais"

# Configurações para repetição automática
MAX_RODADAS_POR_EMPRESA = 100          # máximo de vezes que vamos "insistir" na empresa
INTERVALO_SEGUNDOS_ENTRE_RODADAS = 5  # tempo entre rodadas, em segundos


def only_digits(s: str) -> str:
    if not s:
        return ""
    return re.sub(r"\D", "", s)


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def decode_arquivo_xml(arquivo_xml_b64_gzip: str) -> str:
    """
    Decodifica campo ArquivoXml (gzip + base64) para string XML.
    """
    raw = base64.b64decode(arquivo_xml_b64_gzip)
    xml_bytes = gzip.decompress(raw)
    return xml_bytes.decode("utf-8", errors="ignore")


def extrair_cnpj_prestador(xml_str: str) -> str | None:
    """
    Extrai o CNPJ do emitente da NFSe.
    Considera apenas o padrão:
        <emit>
            <CNPJ>...</CNPJ>
        </emit>

    Se não existir <emit><CNPJ>, retorna None.
    """
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError:
        return None

    def local_name(tag):
        return tag.split("}")[-1].lower()

    # Busca somente: <emit><CNPJ>...</CNPJ></emit>
    for elem in root.iter():
        if local_name(elem.tag) == "emit":
            for child in elem:
                if local_name(child.tag) == "cnpj" and child.text:
                    return only_digits(child.text)

    return None


def format_mes_ano(data_str: str) -> str:
    """
    Recebe algo como '2023-09-27T08:28:28.377'
    e devolve '2023-09' para usar na pasta MesAno.
    """
    try:
        # Tenta parsear com microssegundos
        dt = datetime.fromisoformat(data_str)
    except ValueError:
        # fallback: pega só os 10 primeiros caracteres (YYYY-MM-DD)
        try:
            dt = datetime.strptime(data_str[:10], "%Y-%m-%d")
        except Exception:
            return "desconhecido"
    return f"{dt.month:02d}{dt.year:04d}"


def sanitize_folder_name(name: str) -> str:
    """
    Limpa nome de empresa para uso em path de pasta.
    """
    name = name.strip()
    # troca qualquer caractere estranho por underscore
    name = re.sub(r'[\\/:*?"<>|]+', "_", name)
    name = re.sub(r"\s+", " ", name)
    return name


def montar_sessao_pkcs12(cnpj: str, senha: str) -> requests.Session:
    """
    Cria sessão Requests com certificado PFX via Pkcs12Adapter.
    Espera arquivo em certificados/{cnpj}.pfx
    """
    cert_path = os.path.join(CERT_DIR, f"{cnpj}.pfx")

    if not os.path.exists(cert_path):
        raise FileNotFoundError(f"Certificado não encontrado: {cert_path}")

    s = requests.Session()
    s.mount(
        BASE_URL,
        Pkcs12Adapter(
            pkcs12_filename=cert_path,
            pkcs12_password=senha
        )
    )
    return s


def processar_empresa(row, nsu_inicial: int = 0) -> int:
    """
    Processa uma empresa (linha do DataFrame) a partir de um NSU inicial.

    Fluxo de NSU (dentro de UMA rodada):

    - Se nsu_inicial == 0 -> primeira vez:
        chama /DFe/0 -> API retorna TODOS os documentos (NSU 1,2,3,...)
        (limitado pela política da API, ex: ~50 documentos liberados)
        grava todos e guarda o MAIOR NSU.
    - Próximas consultas dentro da mesma rodada:
        usa o NSU anterior retornado (ex.: 57).
        chama /DFe/57 -> API retorna só os documentos com NSU > 57.
        grava e atualiza o último NSU.
    - Ao não haver mais documentos (Status != DOCUMENTOS_LOCALIZADOS),
      encerra e devolve o último NSU desta rodada.

    OBS: o controle de várias "rodadas" para lidar com limite de 50 documentos
    é feito no main(), chamando esta função repetidamente enquanto o NSU evoluir.
    """
    nome_empresa = str(row["Nome empresa"])
    cnpj_excel = only_digits(str(row["cnpj"]))
    senha = str(row["senha"])

    try:
        nsu_atual = int(nsu_inicial)
    except (TypeError, ValueError):
        nsu_atual = 0

    print(f"\n=== Empresa: {nome_empresa} | CNPJ: {cnpj_excel} | NSU inicial desta rodada: {nsu_atual} ===")

    sess = montar_sessao_pkcs12(cnpj_excel, senha)
    ultimo_nsu = nsu_atual
    empresa_folder_name = sanitize_folder_name(nome_empresa)

    while True:
        url = DFe_URL_TEMPLATE.format(nsu=nsu_atual)
        print(f"Consultando NSU={nsu_atual} -> {url}")

        resp = sess.get(url, timeout=60)
        if resp.status_code != 200:
            print(f"  [ERRO] HTTP {resp.status_code} para NSU={nsu_atual}. Encerrando para esta empresa (rodada).")
            break

        try:
            data = resp.json()
        except json.JSONDecodeError:
            print(f"  [ERRO] Resposta não é JSON para NSU={nsu_atual}. Encerrando para esta empresa (rodada).")
            break

        status = data.get("StatusProcessamento", "")
        lote = data.get("LoteDFe") or []

        if status != "DOCUMENTOS_LOCALIZADOS" or not lote:
            print(f"  StatusProcessamento='{status}'. Nenhum documento localizado nesta chamada. Fim desta rodada.")
            break

        print(f"  {len(lote)} documento(s) localizado(s) para NSU={nsu_atual}.")

        for doc in lote:
            # Cada documento tem seu próprio NSU
            try:
                doc_nsu = int(doc.get("NSU", 0))
            except (TypeError, ValueError):
                doc_nsu = 0

            # mantemos sempre o MAIOR NSU retornado
            if doc_nsu > ultimo_nsu:
                ultimo_nsu = doc_nsu

            chave_acesso = doc.get("ChaveAcesso", "").strip()
            tipo_documento = doc.get("TipoDocumento", "").upper()
            arquivo_xml_b64_gzip = doc.get("ArquivoXml", "")
            data_hora_geracao = doc.get("DataHoraGeracao", "")

            if not chave_acesso or not arquivo_xml_b64_gzip:
                continue

            try:
                xml_str = decode_arquivo_xml(arquivo_xml_b64_gzip)
            except Exception as e:
                print(f"    [ERRO] Falha ao decodificar ArquivoXml (NSU={doc_nsu}, Chave={chave_acesso}): {e}")
                continue

            cnpj_prestador = extrair_cnpj_prestador(xml_str)
            cnpj_prestador_digits = only_digits(cnpj_prestador) if cnpj_prestador else ""

            # Se CNPJ do prestador == CNPJ da empresa → prestado; senão → tomado
            if cnpj_prestador_digits == cnpj_excel:
                tipo_pasta = "prestados"
            else:
                tipo_pasta = "tomados"

            mes_ano = format_mes_ano(data_hora_geracao)
            empresa_dir = os.path.join(
                OUTPUT_BASE_DIR,
                empresa_folder_name,
                mes_ano,
                tipo_pasta
            )
            ensure_dir(empresa_dir)

            file_path = os.path.join(empresa_dir, f"{chave_acesso}.xml")

            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(xml_str)
                print(f"    [OK] Salvo: {file_path} ({tipo_pasta}, NSU={doc_nsu})")
            except Exception as e:
                print(f"    [ERRO] Falha ao salvar XML em {file_path}: {e}")

        # Se nenhum NSU novo apareceu, não faz sentido continuar nesta rodada
        if ultimo_nsu == nsu_atual:
            print("  Nenhum NSU novo encontrado nesta rodada. Encerrando rodada da empresa.")
            break

        # Próxima consulta: usar o MAIOR NSU retornado
        nsu_atual = ultimo_nsu

    print(f"=== Fim da rodada da empresa {nome_empresa}. Último NSU desta rodada: {ultimo_nsu} ===")
    return ultimo_nsu


def main():
    if not os.path.exists(EXCEL_PATH):
        print(f"Arquivo Excel não encontrado: {EXCEL_PATH}")
        return

    df = pd.read_excel(EXCEL_PATH, dtype={"cnpj": str})

    # Garante que as colunas necessárias existem
    required_cols = {"Nome empresa", "cnpj", "senha", "nsu"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"Colunas ausentes no Excel: {missing}")

    # Processa cada empresa
    for idx, row in df.iterrows():
        print("\n" + "#" * 80)
        print(f"Processando linha {idx} - empresa: {row['Nome empresa']}")
        print("#" * 80)

        # NSU atual salvo no Excel (última vez que paramos)
        nsu_excel = row.get("nsu", 0)
        try:
            nsu_excel = int(nsu_excel) if str(nsu_excel) != "nan" else 0
        except ValueError:
            nsu_excel = 0

        nsu_atual = nsu_excel

        try:
            for rodada in range(1, MAX_RODADAS_POR_EMPRESA + 1):
                print(f"\n### Rodada {rodada} para empresa da linha {idx} (NSU atual={nsu_atual}) ###")

                novo_nsu = processar_empresa(row, nsu_inicial=nsu_atual)

                # Atualiza no DataFrame
                df.at[idx, "nsu"] = novo_nsu

                if novo_nsu == nsu_atual:
                    print(
                        f"NSU não evoluiu (permaneceu em {nsu_atual}). "
                        "Provavelmente não há mais notas a serem liberadas agora. Encerrando esta empresa."
                    )
                    break

                print(
                    f"NSU evoluiu de {nsu_atual} para {novo_nsu}. "
                    "Pode haver mais documentos, continuando para a próxima rodada..."
                )
                nsu_atual = novo_nsu

                # Pequena pausa para não 'martelar' a API
                time.sleep(INTERVALO_SEGUNDOS_ENTRE_RODADAS)

        except Exception as e:
            print(f"\n[ERRO] Falha ao processar empresa na linha {idx}: {e}\n")

    # Salva o Excel com os NSUs atualizados
    backup_path = EXCEL_PATH.replace(".xlsx", "_backup.xlsx")
    os.replace(EXCEL_PATH, backup_path)  # faz backup do original
    print(f"\nBackup do Excel original salvo em: {backup_path}")

    df.to_excel(EXCEL_PATH, index=False)
    print(f"Excel atualizado salvo em: {EXCEL_PATH}")


if __name__ == "__main__":
    main()
