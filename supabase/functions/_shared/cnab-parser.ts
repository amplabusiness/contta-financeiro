/**
 * CNAB Parser - Brazilian standard for bank files
 * Supports CNAB 240 and CNAB 400
 */

export interface CNABTransaction {
  bank_reference: string
  transaction_date: string
  amount: number
  description: string
  transaction_type: 'credit' | 'debit'
  document_number?: string // Nosso número
  payer_name?: string
  payer_document?: string
  payment_date?: string
  status?: 'paid' | 'pending' | 'rejected'
}

export interface CNABReturnData {
  transactions: CNABTransaction[]
  bank_code: string
  company_name: string
  processing_date: string
}

/**
 * Parse CNAB 240 Return File (Retorno de Boletos)
 */
export function parseCNAB240Return(content: string): CNABReturnData {
  const lines = content.split('\n').filter(line => line.trim())
  const transactions: CNABTransaction[] = []

  let bankCode = ''
  let companyName = ''
  let processingDate = ''

  for (const line of lines) {
    const recordType = line.substring(7, 8) // Tipo de registro

    // Header do arquivo (tipo 0)
    if (recordType === '0') {
      bankCode = line.substring(0, 3)
      companyName = line.substring(72, 102).trim()
    }

    // Segmento T (dados do título) - tipo 3
    if (recordType === '3' && line.substring(13, 14) === 'T') {
      const documentNumber = line.substring(37, 57).trim() // Nosso número
      const dueDate = line.substring(73, 81) // Data de vencimento
      const amount = parseInt(line.substring(81, 96)) / 100 // Valor em centavos
      const paymentDate = line.substring(145, 153) // Data de pagamento
      const amountPaid = parseInt(line.substring(253, 268)) / 100

      transactions.push({
        bank_reference: documentNumber,
        transaction_date: formatCNABDate(paymentDate),
        amount: amountPaid || amount,
        description: `Pagamento de boleto - ${documentNumber}`,
        transaction_type: 'credit',
        document_number: documentNumber,
        payment_date: formatCNABDate(paymentDate),
        status: paymentDate && paymentDate !== '00000000' ? 'paid' : 'pending'
      })
    }

    // Segmento U (dados complementares)
    if (recordType === '3' && line.substring(13, 14) === 'U') {
      // Pegar dados do pagador se necessário
    }
  }

  return {
    transactions,
    bank_code: bankCode,
    company_name: companyName,
    processing_date: processingDate
  }
}

/**
 * Parse CNAB 400 Return File
 */
export function parseCNAB400Return(content: string): CNABReturnData {
  const lines = content.split('\n').filter(line => line.trim())
  const transactions: CNABTransaction[] = []

  let bankCode = ''
  let companyName = ''

  for (const line of lines) {
    const recordType = line.substring(0, 1)

    // Header (tipo 0)
    if (recordType === '0') {
      bankCode = line.substring(76, 79)
      companyName = line.substring(46, 76).trim()
    }

    // Detalhe (tipo 1)
    if (recordType === '1') {
      const documentNumber = line.substring(62, 70).trim()
      const occurrenceCode = line.substring(108, 110)
      const dueDate = line.substring(110, 116)
      const amount = parseInt(line.substring(126, 139)) / 100
      const paymentDate = line.substring(110, 116)

      // Código de ocorrência 06 = Liquidação
      const isPaid = occurrenceCode === '06'

      transactions.push({
        bank_reference: documentNumber,
        transaction_date: formatCNABDate(paymentDate),
        amount: amount,
        description: `Boleto ${documentNumber} - Ocorrência ${occurrenceCode}`,
        transaction_type: 'credit',
        document_number: documentNumber,
        payment_date: isPaid ? formatCNABDate(paymentDate) : undefined,
        status: isPaid ? 'paid' : 'pending'
      })
    }
  }

  return {
    transactions,
    bank_code: bankCode,
    company_name: companyName,
    processing_date: new Date().toISOString().split('T')[0]
  }
}

function formatCNABDate(cnabDate: string): string {
  if (!cnabDate || cnabDate === '00000000' || cnabDate === '000000') {
    return new Date().toISOString().split('T')[0]
  }

  let day, month, year

  if (cnabDate.length === 8) {
    // DDMMYYYY
    day = cnabDate.substring(0, 2)
    month = cnabDate.substring(2, 4)
    year = cnabDate.substring(4, 8)
  } else if (cnabDate.length === 6) {
    // DDMMYY
    day = cnabDate.substring(0, 2)
    month = cnabDate.substring(2, 4)
    year = '20' + cnabDate.substring(4, 6)
  } else {
    return new Date().toISOString().split('T')[0]
  }

  return `${year}-${month}-${day}`
}

/**
 * Detect CNAB format (240 or 400)
 */
export function detectCNABFormat(content: string): '240' | '400' | null {
  const firstLine = content.split('\n')[0]

  if (!firstLine) return null

  // CNAB 240 has 240 characters per line
  if (firstLine.length >= 240) return '240'

  // CNAB 400 has 400 characters per line
  if (firstLine.length >= 400) return '400'

  return null
}
