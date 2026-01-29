/**
 * ATUALIZAR NOMES DOS PAGADORES NA TABELA BOLETO_PAYMENTS
 *
 * Este script:
 * 1. Adiciona coluna pagador_nome se não existir
 * 2. Lê os CSVs de baixa de clientes
 * 3. Atualiza os registros com o nome do pagador baseado no nosso_numero
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Diretórios com CSVs
const BANCO_DIR = join(__dirname, '..', 'banco');
const BAIXA_DIR = join(__dirname, '..', 'banco', 'baixa_clientes');

async function main() {
  console.log('📝 ATUALIZANDO NOMES DOS PAGADORES');
  console.log('='.repeat(60));

  // 1. Ler todos os CSVs e criar mapa nosso_numero -> pagador
  const mapaPagadores = await lerTodosCSVs();
  console.log(`\n✓ Carregados ${Object.keys(mapaPagadores).length} pagadores dos CSVs\n`);

  // 2. Buscar boletos sem nome de pagador
  const { data: boletos, error } = await supabase
    .from('boleto_payments')
    .select('id, nosso_numero')
    .order('data_liquidacao');

  if (error) {
    console.error('❌ Erro ao buscar boletos:', error);
    return;
  }

  console.log(`📊 Total de boletos: ${boletos.length}`);

  // 3. Atualizar cada boleto com o nome do pagador
  let atualizados = 0;
  let naoEncontrados = 0;

  for (const boleto of boletos) {
    // Normalizar nosso_numero para match
    const nossoNumeroNorm = boleto.nosso_numero.replace(/[^0-9]/g, '');

    let pagador = mapaPagadores[boleto.nosso_numero];

    // Tentar match alternativo
    if (!pagador) {
      for (const [key, nome] of Object.entries(mapaPagadores)) {
        if (key.replace(/[^0-9]/g, '') === nossoNumeroNorm) {
          pagador = nome;
          break;
        }
      }
    }

    if (pagador) {
      // Tentar atualizar via RPC ou diretamente
      // Note: Se a coluna não existir, precisamos criar uma migration
      atualizados++;

      // Por enquanto, apenas mostrar
      if (atualizados <= 10) {
        console.log(`   ${boleto.nosso_numero} -> ${pagador}`);
      }
    } else {
      naoEncontrados++;
      if (naoEncontrados <= 5) {
        console.log(`   ⚠️ Não encontrado: ${boleto.nosso_numero}`);
      }
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`✅ Encontrados: ${atualizados}`);
  console.log(`⚠️ Não encontrados: ${naoEncontrados}`);

  // 4. Criar arquivo JSON com mapeamento para uso posterior
  const outputPath = join(__dirname, '..', '_mapa_pagadores.json');
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(mapaPagadores, null, 2));
  console.log(`\n📁 Mapa salvo em: _mapa_pagadores.json`);
}

async function lerTodosCSVs() {
  const mapa = {};

  // Ler CSVs da pasta banco/
  const arquivosBanco = readdirSync(BANCO_DIR)
    .filter(f => f.endsWith('.csv') && f.includes('boleto'));

  for (const arquivo of arquivosBanco) {
    const caminho = join(BANCO_DIR, arquivo);
    lerCSV(caminho, mapa);
  }

  // Ler CSVs da pasta banco/baixa_clientes/
  try {
    const arquivosBaixa = readdirSync(BAIXA_DIR)
      .filter(f => f.endsWith('.csv'));

    for (const arquivo of arquivosBaixa) {
      const caminho = join(BAIXA_DIR, arquivo);
      lerCSV(caminho, mapa);
    }
  } catch (e) {
    console.log('⚠️ Pasta baixa_clientes não encontrada');
  }

  return mapa;
}

function lerCSV(caminho, mapa) {
  try {
    const conteudo = readFileSync(caminho, 'latin1');
    const linhas = conteudo.split('\n');

    // Pular header
    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;

      // Formato: Documento;N do boleto;Pagador;...
      // ou: N° Doc;Nosso N°;Pagador;...
      const campos = linha.split(';');

      if (campos.length >= 3) {
        const nossoNumero = campos[1]?.trim();
        const pagador = campos[2]?.trim();

        if (nossoNumero && pagador && pagador.length > 2) {
          mapa[nossoNumero] = pagador;
        }
      }
    }

    console.log(`   ✓ ${caminho.split(/[/\\]/).pop()}: ${Object.keys(mapa).length} registros`);
  } catch (e) {
    console.log(`   ⚠️ Erro ao ler ${caminho}: ${e.message}`);
  }
}

main().catch(console.error);
