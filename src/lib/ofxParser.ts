// OFX Parser - Biblioteca para processar arquivos OFX do Sicredi e outros bancos
// Baseado no formato OFX (Open Financial Exchange)

export interface OFXTransaction {
  type: 'DEBIT' | 'CREDIT';
  date: Date;
  amount: number;
  fitid: string; // Financial Institution Transaction ID
  checkNumber?: string;
  description: string;
  memo?: string;
}

export interface OFXStatement {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  startDate: Date;
  endDate: Date;
  currency: string;
  balanceAmount: number;
  balanceDate: Date;
  transactions: OFXTransaction[];
}

export interface OFXParseResult {
  success: boolean;
  data?: OFXStatement;
  error?: string;
}

/**
 * Parse OFX file content
 * Suporta formato OFX 1.x (SGML) e 2.x (XML)
 */
export async function parseOFX(fileContent: string): Promise<OFXParseResult> {
  try {
    // Remove BOM if present
    const content = fileContent.replace(/^\uFEFF/, '');

    // Detect OFX version
    const isXML = content.includes('<?xml');

    if (isXML) {
      // OFX 2.x (XML format) - not common in Brazil, but supported
      return parseOFXXML(content);
    } else {
      // OFX 1.x (SGML format) - most common in Brazil
      return parseOFXSGML(content);
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Erro ao processar arquivo OFX: ${error.message}`
    };
  }
}

/**
 * Parse OFX 1.x (SGML format)
 */
function parseOFXSGML(content: string): OFXParseResult {
  try {
    // Helper to extract tag value
    const getTagValue = (tagName: string, text: string): string | null => {
      const regex = new RegExp(`<${tagName}>([^<]*?)(?:<|$)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };

    // Helper to extract date
    const parseOFXDate = (dateStr: string): Date => {
      // Format: YYYYMMDDHHMMSS or YYYYMMDD
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    };

    // Extract bank information
    const bankCode = getTagValue('BANKID', content) || '';
    const accountNumber = getTagValue('ACCTID', content) || '';
    const accountType = getTagValue('ACCTTYPE', content) || 'CHECKING';

    // Extract statement dates
    const startDateStr = getTagValue('DTSTART', content);
    const endDateStr = getTagValue('DTEND', content);
    const startDate = startDateStr ? parseOFXDate(startDateStr) : new Date();
    const endDate = endDateStr ? parseOFXDate(endDateStr) : new Date();

    // Extract balance
    const balanceAmountStr = getTagValue('BALAMT', content);
    const balanceDateStr = getTagValue('DTASOF', content);
    const balanceAmount = balanceAmountStr ? parseFloat(balanceAmountStr) : 0;
    const balanceDate = balanceDateStr ? parseOFXDate(balanceDateStr) : new Date();

    // Extract currency
    const currency = getTagValue('CURDEF', content) || 'BRL';

    // Parse transactions
    const transactions: OFXTransaction[] = [];
    const transactionRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = transactionRegex.exec(content)) !== null) {
      const txnContent = match[1];

      const typeStr = getTagValue('TRNTYPE', txnContent);
      const dateStr = getTagValue('DTPOSTED', txnContent);
      const amountStr = getTagValue('TRNAMT', txnContent);
      const fitid = getTagValue('FITID', txnContent);
      const checkNumber = getTagValue('CHECKNUM', txnContent);
      const name = getTagValue('NAME', txnContent);
      const memo = getTagValue('MEMO', txnContent);

      if (!dateStr || !amountStr || !fitid) {
        continue; // Skip invalid transactions
      }

      const amount = Math.abs(parseFloat(amountStr));
      const isDebit = parseFloat(amountStr) < 0 || typeStr === 'DEBIT';

      // Build description
      let description = name || memo || 'Transação bancária';
      if (memo && name && memo !== name) {
        description = `${name} - ${memo}`;
      }

      transactions.push({
        type: isDebit ? 'DEBIT' : 'CREDIT',
        date: parseOFXDate(dateStr),
        amount,
        fitid,
        checkNumber: checkNumber || undefined,
        description,
        memo: memo || undefined
      });
    }

    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Determine bank name from bank code
    const bankNames: Record<string, string> = {
      '748': 'Sicredi',
      '001': 'Banco do Brasil',
      '237': 'Bradesco',
      '341': 'Itaú',
      '104': 'Caixa Econômica Federal',
      '033': 'Santander',
      '077': 'Banco Inter',
      '260': 'Nu Pagamentos'
    };

    const bankName = bankNames[bankCode] || `Banco ${bankCode}`;

    return {
      success: true,
      data: {
        bankCode,
        bankName,
        accountNumber,
        accountType,
        startDate,
        endDate,
        currency,
        balanceAmount,
        balanceDate,
        transactions
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Erro ao processar OFX SGML: ${error.message}`
    };
  }
}

/**
 * Parse OFX 2.x (XML format)
 */
function parseOFXXML(content: string): OFXParseResult {
  try {
    // Check if DOMParser is available (not available in Node.js/Workers)
    if (typeof DOMParser === 'undefined') {
      return {
        success: false,
        error: 'XML parsing not available in this environment. DOMParser is only available in browser contexts.'
      };
    }

    // Simple XML parser for OFX 2.x
    // For production, consider using DOMParser or a proper XML library
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');

    const getElementValue = (tagName: string): string | null => {
      const element = xmlDoc.getElementsByTagName(tagName)[0];
      return element ? element.textContent : null;
    };

    const parseOFXDate = (dateStr: string): Date => {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    };

    const bankCode = getElementValue('BANKID') || '';
    const accountNumber = getElementValue('ACCTID') || '';
    const accountType = getElementValue('ACCTTYPE') || 'CHECKING';

    const startDateStr = getElementValue('DTSTART');
    const endDateStr = getElementValue('DTEND');
    const startDate = startDateStr ? parseOFXDate(startDateStr) : new Date();
    const endDate = endDateStr ? parseOFXDate(endDateStr) : new Date();

    const balanceAmountStr = getElementValue('BALAMT');
    const balanceDateStr = getElementValue('DTASOF');
    const balanceAmount = balanceAmountStr ? parseFloat(balanceAmountStr) : 0;
    const balanceDate = balanceDateStr ? parseOFXDate(balanceDateStr) : new Date();

    const currency = getElementValue('CURDEF') || 'BRL';

    const transactions: OFXTransaction[] = [];
    const stmtTrnElements = xmlDoc.getElementsByTagName('STMTTRN');

    for (let i = 0; i < stmtTrnElements.length; i++) {
      const txnElement = stmtTrnElements[i];

      const getChildValue = (tagName: string): string | null => {
        const child = txnElement.getElementsByTagName(tagName)[0];
        return child ? child.textContent : null;
      };

      const typeStr = getChildValue('TRNTYPE');
      const dateStr = getChildValue('DTPOSTED');
      const amountStr = getChildValue('TRNAMT');
      const fitid = getChildValue('FITID');
      const checkNumber = getChildValue('CHECKNUM');
      const name = getChildValue('NAME');
      const memo = getChildValue('MEMO');

      if (!dateStr || !amountStr || !fitid) continue;

      const amount = Math.abs(parseFloat(amountStr));
      const isDebit = parseFloat(amountStr) < 0 || typeStr === 'DEBIT';

      let description = name || memo || 'Transação bancária';
      if (memo && name && memo !== name) {
        description = `${name} - ${memo}`;
      }

      transactions.push({
        type: isDebit ? 'DEBIT' : 'CREDIT',
        date: parseOFXDate(dateStr),
        amount,
        fitid,
        checkNumber: checkNumber || undefined,
        description,
        memo: memo || undefined
      });
    }

    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    const bankNames: Record<string, string> = {
      '748': 'Sicredi',
      '001': 'Banco do Brasil',
      '237': 'Bradesco',
      '341': 'Itaú',
      '104': 'Caixa Econômica Federal',
      '033': 'Santander',
      '077': 'Banco Inter',
      '260': 'Nu Pagamentos'
    };

    const bankName = bankNames[bankCode] || `Banco ${bankCode}`;

    return {
      success: true,
      data: {
        bankCode,
        bankName,
        accountNumber,
        accountType,
        startDate,
        endDate,
        currency,
        balanceAmount,
        balanceDate,
        transactions
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Erro ao processar OFX XML: ${error.message}`
    };
  }
}

/**
 * Read OFX file from File object
 */
export async function readOFXFile(file: File): Promise<OFXParseResult> {
  try {
    const content = await file.text();
    return await parseOFX(content);
  } catch (error: any) {
    return {
      success: false,
      error: `Erro ao ler arquivo: ${error.message}`
    };
  }
}
