/**
 * NFe/NFSe XML Parser
 * Parses Brazilian electronic invoices
 */

export interface NFe {
  chave: string // Chave de acesso
  numero: string // Número da NF
  serie: string
  dataEmissao: string
  emitente: {
    cnpj: string
    razaoSocial: string
    nomeFantasia?: string
  }
  destinatario: {
    cnpj?: string
    cpf?: string
    razaoSocial: string
  }
  valorTotal: number
  valorProdutos: number
  valorServicos?: number
  icms?: number
  ipi?: number
  pis?: number
  cofins?: number
  itens: NFeItem[]
}

export interface NFeItem {
  codigo: string
  descricao: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  ncm?: string
  cfop?: string
}

export function parseNFeXML(xmlContent: string): NFe {
  try {
    // Remover namespaces para facilitar parsing
    const cleanXml = xmlContent.replace(/xmlns[^=]*="[^"]*"/g, '')

    const chave = extractXMLTag(cleanXml, 'chNFe') || extractAttribute(cleanXml, 'infNFe', 'Id')?.replace('NFe', '')
    const numero = extractXMLTag(cleanXml, 'nNF')
    const serie = extractXMLTag(cleanXml, 'serie')
    const dataEmissao = extractXMLTag(cleanXml, 'dhEmi') || extractXMLTag(cleanXml, 'dEmi')

    // Emitente
    const emitCNPJ = extractXMLTag(cleanXml, 'emit>CNPJ') || extractBetween(cleanXml, '<emit>', '<CNPJ>', '</CNPJ>')
    const emitRazao = extractXMLTag(cleanXml, 'emit>xNome') || extractBetween(cleanXml, '<emit>', '<xNome>', '</xNome>')
    const emitFantasia = extractXMLTag(cleanXml, 'emit>xFant') || extractBetween(cleanXml, '<emit>', '<xFant>', '</xFant>')

    // Destinatário
    const destCNPJ = extractXMLTag(cleanXml, 'dest>CNPJ') || extractBetween(cleanXml, '<dest>', '<CNPJ>', '</CNPJ>')
    const destCPF = extractXMLTag(cleanXml, 'dest>CPF') || extractBetween(cleanXml, '<dest>', '<CPF>', '</CPF>')
    const destRazao = extractXMLTag(cleanXml, 'dest>xNome') || extractBetween(cleanXml, '<dest>', '<xNome>', '</xNome>')

    // Valores
    const valorTotal = parseFloat(extractXMLTag(cleanXml, 'vNF') || '0')
    const valorProdutos = parseFloat(extractXMLTag(cleanXml, 'vProd') || '0')
    const valorServicos = parseFloat(extractXMLTag(cleanXml, 'vServ') || '0')
    const icms = parseFloat(extractXMLTag(cleanXml, 'vICMS') || '0')
    const ipi = parseFloat(extractXMLTag(cleanXml, 'vIPI') || '0')
    const pis = parseFloat(extractXMLTag(cleanXml, 'vPIS') || '0')
    const cofins = parseFloat(extractXMLTag(cleanXml, 'vCOFINS') || '0')

    // Itens
    const itens = parseNFeItems(cleanXml)

    return {
      chave: chave || '',
      numero: numero || '',
      serie: serie || '',
      dataEmissao: formatNFeDate(dataEmissao || ''),
      emitente: {
        cnpj: emitCNPJ || '',
        razaoSocial: emitRazao || '',
        nomeFantasia: emitFantasia
      },
      destinatario: {
        cnpj: destCNPJ,
        cpf: destCPF,
        razaoSocial: destRazao || ''
      },
      valorTotal,
      valorProdutos,
      valorServicos,
      icms,
      ipi,
      pis,
      cofins,
      itens
    }
  } catch (error) {
    console.error('Error parsing NFe XML:', error)
    throw new Error(`Failed to parse NFe XML: ${error.message}`)
  }
}

function parseNFeItems(xml: string): NFeItem[] {
  const items: NFeItem[] = []
  const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/g
  let match

  while ((match = detRegex.exec(xml)) !== null) {
    const detContent = match[1]

    items.push({
      codigo: extractXMLTag(detContent, 'cProd') || '',
      descricao: extractXMLTag(detContent, 'xProd') || '',
      quantidade: parseFloat(extractXMLTag(detContent, 'qCom') || '0'),
      valorUnitario: parseFloat(extractXMLTag(detContent, 'vUnCom') || '0'),
      valorTotal: parseFloat(extractXMLTag(detContent, 'vProd') || '0'),
      ncm: extractXMLTag(detContent, 'NCM'),
      cfop: extractXMLTag(detContent, 'CFOP')
    })
  }

  return items
}

function extractXMLTag(xml: string, tag: string): string | null {
  // Suporta tanto tag simples quanto caminho (ex: emit>CNPJ)
  const parts = tag.split('>')
  let content = xml

  for (const part of parts) {
    const regex = new RegExp(`<${part}[^>]*>([^<]*)</${part}>`)
    const match = content.match(regex)
    if (!match) return null
    content = match[1]
  }

  return content.trim()
}

function extractBetween(xml: string, section: string, startTag: string, endTag: string): string | null {
  const sectionRegex = new RegExp(`${section}([\\s\\S]*?)</${section.replaceAll('<', '').replaceAll('>', '')}`)
  const sectionMatch = xml.match(sectionRegex)
  if (!sectionMatch) return null

  const sectionContent = sectionMatch[1]
  const tagRegex = new RegExp(`${startTag}([^<]*)${endTag}`)
  const tagMatch = sectionContent.match(tagRegex)

  return tagMatch ? tagMatch[1].trim() : null
}

function extractAttribute(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`)
  const match = xml.match(regex)
  return match ? match[1] : null
}

function formatNFeDate(nfeDate: string): string {
  if (!nfeDate) return new Date().toISOString().split('T')[0]

  // NFe dates: 2025-01-14T10:30:00-03:00 or 2025-01-14
  const datePart = nfeDate.split('T')[0]
  return datePart
}

/**
 * Validate NFe XML signature (simplified)
 */
export function isValidNFeXML(xml: string): boolean {
  return xml.includes('<NFe') || xml.includes('<nfeProc')
}
