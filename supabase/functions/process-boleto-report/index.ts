import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import type {
  EdgeSupabaseClient,
  BoletoData,
  ChartOfAccount,
  ExtendedChartOfAccounts
} from '../_shared/types.ts'

interface ProcessedResult {
  total: number
  provisioned: number
  settled: number
  errors: string[]
  entriesCreated: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current user first
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Usuário não autenticado')

    // Check content type
    const contentType = req.headers.get('content-type') || ''
    let boletos: BoletoData[]
    let fileName = 'relatorio.xlsx'

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (file upload)
      const formData = await req.formData()
      const file = formData.get('file') as File
      
      if (!file) {
        throw new Error('Nenhum arquivo foi enviado')
      }

      fileName = file.name
      const fileContent = await file.arrayBuffer()
      const uint8Array = new Uint8Array(fileContent)

      // Import XLSX dynamically
      const { default: XLSX } = await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs')
      
      const workbook = XLSX.read(uint8Array, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]

      // Process Excel data to extract boletos
      boletos = []
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length < 5) continue

        try {
          boletos.push({
            boletoNumber: String(row[0] || ''),
            pagador: String(row[1] || ''),
            competence: String(row[2] || ''),
            dataVencimento: String(row[3] || ''),
            amount: Number(row[4]) || 0,
            status: String(row[5] || 'EMITIDO').toUpperCase(),
            dataPagamento: row[6] ? String(row[6]) : null,
            valorLiquidado: row[7] ? Number(row[7]) : null
          })
        } catch (error) {
          console.error(`Erro ao processar linha ${i}:`, error)
        }
      }
    } else {
      // Handle JSON (legacy support)
      const body = await req.json()
      boletos = body.boletos
      fileName = body.fileName || fileName
    }

    if (!boletos || !Array.isArray(boletos) || boletos.length === 0) {
      throw new Error('Dados de boletos inválidos ou vazios')
    }

    console.log(`Processando ${boletos.length} boletos do arquivo: ${fileName}`)

    // Criar registro do relatório
    const periodStart = new Date(Math.min(...boletos.map(b => new Date(b.dataVencimento).getTime())))
    const periodEnd = new Date(Math.max(...boletos.map(b => new Date(b.dataVencimento).getTime())))

    // Get user ID from auth header
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Usuário não autenticado')

    const { data: report, error: reportError } = await supabase
      .from('boleto_reports')
      .insert({
        file_name: fileName,
        file_type: fileName.endsWith('.xls') ? 'XLS' : fileName.endsWith('.xlsx') ? 'XLSX' : 'CSV',
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        total_boletos: boletos.length,
        status: 'PROCESSING',
        created_by: user.id
      })
      .select()
      .single()

    if (reportError) throw reportError

    const result: ProcessedResult = {
      total: boletos.length,
      provisioned: 0,
      settled: 0,
      errors: [],
      entriesCreated: 0
    }

    // Buscar contas contábeis necessárias
    const accounts = await getChartOfAccounts(supabase)

    // Processar cada boleto
    for (const boleto of boletos) {
      try {
        await processBoleto(supabase, boleto, report.id, accounts, result)
      } catch (error: unknown) {
        console.error(`Erro ao processar boleto ${boleto.boletoNumber}:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        result.errors.push(`Boleto ${boleto.boletoNumber}: ${errorMessage}`)
      }
    }

    // Atualizar relatório com resultado
    const totalEmitidos = boletos.filter(b => ['EMITIDO', 'VENCIDO'].includes(b.status))
      .reduce((sum, b) => sum + b.amount, 0)
    const totalPagos = boletos.filter(b => b.status === 'PAGO')
      .reduce((sum, b) => sum + b.amount, 0)
    const totalPendentes = totalEmitidos - totalPagos

    await supabase
      .from('boleto_reports')
      .update({
        status: result.errors.length > 0 ? 'COMPLETED' : 'COMPLETED',
        processed_at: new Date().toISOString(),
        total_emitidos: totalEmitidos,
        total_pagos: totalPagos,
        total_pendentes: totalPendentes,
        entries_created: result.entriesCreated,
        processing_log: {
          provisioned: result.provisioned,
          settled: result.settled,
          errors: result.errors
        }
      })
      .eq('id', report.id)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          reportId: report.id,
          ...result
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: unknown) {
    console.error('Erro ao processar relatório de boletos:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function getChartOfAccounts(supabase: EdgeSupabaseClient): Promise<ExtendedChartOfAccounts> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('is_analytical', true)

  if (error) throw error

  const accounts = data as ChartOfAccount[]

  return {
    honorariosAReceber: accounts.find((a) => a.code === '1.1.02.001')!,
    boletosAReceber: accounts.find((a) => a.code === '1.1.02.002')!,
    bancosContaMovimento: accounts.find((a) => a.code === '1.1.01.002')!,
    caixa: accounts.find((a) => a.code === '1.1.01.001')!,
    receitaHonorarios: accounts.find((a) => a.code === '3.1.01.001')!,
    issRecolher: accounts.find((a) => a.code === '2.1.02.005')!,
    pisRecolher: accounts.find((a) => a.code === '2.1.02.003')!,
    cofinsRecolher: accounts.find((a) => a.code === '2.1.02.004')!
  }
}

async function processBoleto(
  supabase: EdgeSupabaseClient,
  boleto: BoletoData,
  reportId: string,
  accounts: ExtendedChartOfAccounts,
  result: ProcessedResult
) {
  // 1. Buscar cliente
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .or(`name.ilike.%${boleto.clientName}%,cnpj.eq.${boleto.clientCnpj || ''}`)
    .limit(1)
    .single()

  // 2. Buscar ou criar invoice
  let invoice = null
  if (client) {
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('client_id', client.id)
      .eq('competence', boleto.competence)
      .limit(1)
      .single()

    if (existingInvoice) {
      invoice = existingInvoice
    } else {
      // Criar invoice se não existir
      const { data: newInvoice } = await supabase
        .from('invoices')
        .insert({
          client_id: client.id,
          competence: boleto.competence,
          amount: boleto.amount,
          due_date: boleto.dueDate,
          status: boleto.status === 'PAGO' ? 'paid' : 'pending',
          payment_date: boleto.paymentDate || null,
          external_invoice_number: boleto.boletoNumber
        })
        .select()
        .single()

      invoice = newInvoice
    }
  }

  // 3. Criar item do relatório
  const { data: reportItem } = await supabase
    .from('boleto_report_items')
    .insert({
      report_id: reportId,
      client_id: client?.id || null,
      client_name: boleto.clientName,
      invoice_id: invoice?.id || null,
      boleto_number: boleto.boletoNumber,
      emission_date: boleto.emissionDate,
      due_date: boleto.dueDate,
      payment_date: boleto.paymentDate || null,
      competence: boleto.competence,
      amount: boleto.amount,
      status: boleto.status,
      payment_method: boleto.paymentMethod || 'BOLETO'
    })
    .select()
    .single()

  // 4. PROVISÃO DA RECEITA (quando boleto é emitido)
  // Seguindo regime de competência - reconhecer receita na competência
  if (boleto.status !== 'CANCELADO') {
    const provisioned = await createProvisionEntry(
      supabase,
      boleto,
      reportItem.id,
      invoice?.id,
      client?.id,
      accounts
    )

    if (provisioned) {
      await supabase
        .from('boleto_report_items')
        .update({ is_provisioned: true, accounting_entry_id: provisioned.entryId })
        .eq('id', reportItem.id)

      result.provisioned++
      result.entriesCreated++
    }
  }

  // 5. BAIXA DA RECEITA (quando boleto é pago)
  if (boleto.status === 'PAGO' && boleto.paymentDate) {
    const settled = await createSettlementEntry(
      supabase,
      boleto,
      reportItem.id,
      invoice?.id,
      client?.id,
      accounts
    )

    if (settled) {
      await supabase
        .from('boleto_report_items')
        .update({ is_settled: true })
        .eq('id', reportItem.id)

      // Atualizar invoice como pago
      if (invoice) {
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            payment_date: boleto.paymentDate
          })
          .eq('id', invoice.id)
      }

      result.settled++
      result.entriesCreated++
    }
  }
}

async function createProvisionEntry(
  supabase: EdgeSupabaseClient,
  boleto: BoletoData,
  reportItemId: string,
  invoiceId: string | null,
  clientId: string | null,
  accounts: ExtendedChartOfAccounts
) {
  // Lançamento contábil de PROVISÃO DE RECEITA
  // D - Honorários a Receber (Ativo)
  // C - Receita de Honorários (Receita)

  const competenceDate = parseCompetence(boleto.competence)
  const emissionDate = new Date(boleto.emissionDate)

  // Criar entrada contábil
  const { data: entry, error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: emissionDate.toISOString().split('T')[0],
      competence_date: competenceDate,
      description: `Provisão de honorário - ${boleto.clientName} - Competência ${boleto.competence}`,
      history: `Boleto ${boleto.boletoNumber} emitido em ${boleto.emissionDate}`,
      entry_type: 'PROVISAO_RECEITA',
      document_type: 'BOLETO',
      document_number: boleto.boletoNumber,
      invoice_id: invoiceId,
      total_debit: boleto.amount,
      total_credit: boleto.amount,
      is_draft: false
    })
    .select()
    .single()

  if (entryError) throw entryError

  // Criar itens do lançamento (partidas dobradas)
  const items = [
    {
      entry_id: entry.id,
      account_id: accounts.honorariosAReceber.id,
      debit: boleto.amount,
      credit: 0,
      history: `Provisão honorário ref. ${boleto.competence}`,
      client_id: clientId
    },
    {
      entry_id: entry.id,
      account_id: accounts.receitaHonorarios.id,
      debit: 0,
      credit: boleto.amount,
      history: `Receita de honorário ref. ${boleto.competence}`,
      client_id: clientId
    }
  ]

  const { error: itemsError } = await supabase
    .from('accounting_entry_items')
    .insert(items)

  if (itemsError) throw itemsError

  return { entryId: entry.id }
}

async function createSettlementEntry(
  supabase: EdgeSupabaseClient,
  boleto: BoletoData,
  reportItemId: string,
  invoiceId: string | null,
  clientId: string | null,
  accounts: ExtendedChartOfAccounts
) {
  // Lançamento contábil de BAIXA DE RECEITA
  // D - Bancos/Caixa (Ativo)
  // C - Honorários a Receber (Ativo)

  const paymentDate = new Date(boleto.paymentDate!)

  // Determinar conta de destino (Banco ou Caixa)
  const destinationAccount = boleto.paymentMethod === 'DINHEIRO'
    ? accounts.caixa
    : accounts.bancosContaMovimento

  // Criar entrada contábil
  const { data: entry, error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: paymentDate.toISOString().split('T')[0],
      competence_date: paymentDate.toISOString().split('T')[0],
      description: `Recebimento de honorário - ${boleto.clientName} - Competência ${boleto.competence}`,
      history: `Boleto ${boleto.boletoNumber} pago em ${boleto.paymentDate} via ${boleto.paymentMethod}`,
      entry_type: 'BAIXA_RECEITA',
      document_type: boleto.paymentMethod || 'BOLETO',
      document_number: boleto.boletoNumber,
      invoice_id: invoiceId,
      total_debit: boleto.amount,
      total_credit: boleto.amount,
      is_draft: false
    })
    .select()
    .single()

  if (entryError) throw entryError

  // Criar itens do lançamento
  const items = [
    {
      entry_id: entry.id,
      account_id: destinationAccount.id,
      debit: boleto.amount,
      credit: 0,
      history: `Recebimento via ${boleto.paymentMethod} - ${boleto.competence}`,
      client_id: clientId
    },
    {
      entry_id: entry.id,
      account_id: accounts.honorariosAReceber.id,
      debit: 0,
      credit: boleto.amount,
      history: `Baixa de honorário ref. ${boleto.competence}`,
      client_id: clientId
    }
  ]

  const { error: itemsError } = await supabase
    .from('accounting_entry_items')
    .insert(items)

  if (itemsError) throw itemsError

  return { entryId: entry.id }
}

function parseCompetence(competence: string): string {
  // Converte "01/2025" para "2025-01-01"
  const [month, year] = competence.split('/')
  return `${year}-${month.padStart(2, '0')}-01`
}
