/**
 * Formata um CNPJ no padrão 00.000.000/0000-00
 */
export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  
  const digits = cnpj.replace(/\D/g, '');
  
  if (digits.length !== 14) return cnpj;
  
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * Formata um CPF no padrão 000.000.000-00
 */
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  
  const digits = cpf.replace(/\D/g, '');
  
  if (digits.length !== 11) return cpf;
  
  return digits.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    '$1.$2.$3-$4'
  );
}

/**
 * Formata automaticamente CNPJ ou CPF baseado no tamanho
 */
export function formatDocument(document: string | null | undefined): string {
  if (!document) return '';
  
  const digits = document.replace(/\D/g, '');
  
  if (digits.length === 11) {
    return formatCPF(digits);
  } else if (digits.length === 14) {
    return formatCNPJ(digits);
  }
  
  return document;
}

/**
 * Remove toda formatação de um documento (mantém apenas dígitos)
 */
export function normalizeDocument(document: string | null | undefined): string {
  if (!document) return '';
  return document.replace(/\D/g, '');
}
