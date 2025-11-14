/**
 * OFX (Open Financial Exchange) Parser
 * Parses bank statement files in OFX format
 */

export interface OFXTransaction {
  bank_reference: string
  transaction_date: string
  amount: number
  description: string
  transaction_type: 'credit' | 'debit'
  matched: boolean
  imported_from: string
  category?: string
  memo?: string
}

export function parseOFX(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = []

  try {
    // Extract all STMTTRN (statement transaction) blocks
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g
    let match

    while ((match = stmtTrnRegex.exec(content)) !== null) {
      const trn = match[1]

      // Extract transaction fields
      const type = extractTag(trn, 'TRNTYPE')
      const date = extractTag(trn, 'DTPOSTED')
      const amount = parseFloat(extractTag(trn, 'TRNAMT'))
      const fitid = extractTag(trn, 'FITID')
      const name = extractTag(trn, 'NAME')
      const memo = extractTag(trn, 'MEMO')
      const checknum = extractTag(trn, 'CHECKNUM')

      // Determine description (use MEMO first, then NAME)
      const description = memo || name || checknum || 'Transação sem descrição'

      transactions.push({
        bank_reference: fitid || `OFX-${Date.now()}-${Math.random()}`,
        transaction_date: formatOFXDate(date),
        amount: Math.abs(amount),
        description: description.trim(),
        transaction_type: amount > 0 ? 'credit' : 'debit',
        matched: false,
        imported_from: 'ofx',
        category: type,
        memo: memo
      })
    }

    return transactions
  } catch (error) {
    console.error('Error parsing OFX:', error)
    throw new Error(`Failed to parse OFX: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function extractTag(content: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]+)`)
  const match = content.match(regex)
  return match ? match[1].trim() : ''
}

function formatOFXDate(ofxDate: string): string {
  if (!ofxDate) return new Date().toISOString().split('T')[0]

  // OFX dates are in format: YYYYMMDD or YYYYMMDDHHMMSS
  const year = ofxDate.substring(0, 4)
  const month = ofxDate.substring(4, 6)
  const day = ofxDate.substring(6, 8)

  return `${year}-${month}-${day}`
}

/**
 * Validate OFX file structure
 */
export function isValidOFX(content: string): boolean {
  return content.includes('<OFX>') && content.includes('</OFX>')
}
