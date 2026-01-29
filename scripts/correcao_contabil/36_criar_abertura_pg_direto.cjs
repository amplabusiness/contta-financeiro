/**
 * SCRIPT: Criar Lançamentos de Abertura via PostgreSQL Direto
 * 
 * Este script conecta diretamente ao banco PostgreSQL usando pg
 * e executa o SQL com triggers desabilitados.
 */

require('dotenv/config');
const { Pool } = require('pg');

// Connection string do Supabase - conexão direta
const pool = new Pool({
  host: 'db.xdtlhzysrpoinqtsglmr.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'NayaraLeao2205#',
  ssl: { rejectUnauthorized: false }
});

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const DATA_ABERTURA = '2025-01-01';

async function executar() {
  console.log('='.repeat(80));
  console.log('CRIANDO LANÇAMENTOS DE ABERTURA VIA PG DIRETO');
  console.log('='.repeat(80));

  const client = await pool.connect();

  try {
    // Iniciar transação
    await client.query('BEGIN');

    // Desabilitar triggers
    await client.query('ALTER TABLE accounting_entries DISABLE TRIGGER USER');
    await client.query('ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER');

    // Buscar conta contrapartida
    const { rows: [contaContra] } = await client.query(`
      SELECT id, code, name FROM chart_of_accounts
      WHERE code = '5.2.1.01' AND tenant_id = $1
    `, [TENANT_ID]);

    if (!contaContra) {
      throw new Error('Conta 5.2.1.01 não encontrada!');
    }
    console.log(`Conta contrapartida: ${contaContra.code} - ${contaContra.name}`);

    // Buscar saldos pendentes
    const { rows: saldos } = await client.query(`
      SELECT cob.id, cob.client_id, cob.competence, cob.amount, c.name as client_name
      FROM client_opening_balance cob
      JOIN clients c ON c.id = cob.client_id
      WHERE cob.status = 'pending' AND cob.tenant_id = $1
    `, [TENANT_ID]);

    console.log(`Saldos pendentes: ${saldos.length}`);

    // Buscar contas de clientes
    const { rows: contas } = await client.query(`
      SELECT id, code, name FROM chart_of_accounts
      WHERE code LIKE '1.1.2.01.%' AND tenant_id = $1
    `, [TENANT_ID]);

    // Mapa nome -> conta
    const mapaContas = new Map();
    for (const c of contas) {
      mapaContas.set(c.name.toUpperCase().trim(), c);
    }

    let processados = 0;
    let semConta = 0;
    let totalValor = 0;

    for (const saldo of saldos) {
      const nomeCliente = saldo.client_name.toUpperCase().trim();
      const contaCliente = mapaContas.get(nomeCliente);

      if (!contaCliente) {
        console.log(`  AVISO: ${saldo.client_name} sem conta analítica`);
        semConta++;
        continue;
      }

      const valor = parseFloat(saldo.amount);
      const entryId = require('crypto').randomUUID();

      // Inserir accounting_entry
      await client.query(`
        INSERT INTO accounting_entries (
          id, tenant_id, entry_date, competence_date, entry_type,
          document_type, reference_type, description, total_debit, total_credit,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $3, 'SALDO_ABERTURA', 'ABERTURA', 'saldo_inicial',
          $4, $5, $5, NOW(), NOW())
      `, [entryId, TENANT_ID, DATA_ABERTURA, 
          `Saldo de abertura 01/01/2025 - ${saldo.client_name} (${saldo.competence})`,
          valor]);

      // Linha débito
      await client.query(`
        INSERT INTO accounting_entry_lines (
          id, tenant_id, entry_id, account_id, debit, credit, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, 0, $6, NOW())
      `, [require('crypto').randomUUID(), TENANT_ID, entryId, contaCliente.id, valor,
          `D - Saldo devedor abertura - ${saldo.client_name}`]);

      // Linha crédito
      await client.query(`
        INSERT INTO accounting_entry_lines (
          id, tenant_id, entry_id, account_id, debit, credit, description, created_at
        ) VALUES ($1, $2, $3, $4, 0, $5, $6, NOW())
      `, [require('crypto').randomUUID(), TENANT_ID, entryId, contaContra.id, valor,
          `C - Contrapartida abertura - ${saldo.client_name}`]);

      // Atualizar status
      await client.query(`
        UPDATE client_opening_balance SET status = 'processed', updated_at = NOW()
        WHERE id = $1
      `, [saldo.id]);

      processados++;
      totalValor += valor;

      if (processados % 10 === 0) {
        console.log(`  Processados: ${processados}...`);
      }
    }

    // Reabilitar triggers
    await client.query('ALTER TABLE accounting_entries ENABLE TRIGGER USER');
    await client.query('ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER');

    // Commit
    await client.query('COMMIT');

    console.log('\n' + '='.repeat(80));
    console.log('RESUMO:');
    console.log('='.repeat(80));
    console.log(`  Lançamentos criados: ${processados}`);
    console.log(`  Clientes sem conta: ${semConta}`);
    console.log(`  Total lançado: R$ ${totalValor.toFixed(2)}`);
    console.log('='.repeat(80));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERRO:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

executar().catch(console.error);
