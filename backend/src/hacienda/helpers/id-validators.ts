/**
 * Validadores de identificación según especificación Hacienda 4.4
 * Soporta: Cédula Física, Cédula Jurídica, DIMEX, NITE
 */

/**
 * Valida un DIMEX (Documento de Identificación Migratorio para Extranjeros)
 * Estructura: 12 dígitos con checksum en última posición
 * Algoritmo: Pesos 1,2,3,4,5,6,7,8,9,1,2 (repetición) sobre 11 primeros dígitos
 */
export function validateDimex(dimex: string): boolean {
  // Remover guiones si existen
  const cleaned = dimex.replace(/-/g, '');

  // Debe ser exactamente 12 dígitos
  if (!/^\d{12}$/.test(cleaned)) {
    return false;
  }

  // Obtener los 11 primeros dígitos y el checksum
  const digits = cleaned.slice(0, 11);
  const providedChecksum = parseInt(cleaned[11], 10);

  // Pesos para calcular checksum (se repiten si es necesario)
  const weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2];

  // Sumar: cada dígito × su peso
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  // Calcular módulo 11 y restar de 11
  const remainder = sum % 11;
  let calculatedChecksum = 11 - remainder;

  // Si es 10 o 11, usar 0
  if (calculatedChecksum >= 10) {
    calculatedChecksum = 0;
  }

  return calculatedChecksum === providedChecksum;
}

/**
 * Valida formato básico de Cédula Física costarricense
 * Formato: 1-12 caracteres alfanuméricos (flexible per Hacienda 4.4)
 */
export function validateFisicalId(id: string): boolean {
  // Permitir 1-12 caracteres alfanuméricos (Hacienda es flexible aquí)
  return /^[a-zA-Z0-9]{1,12}$/.test(id.replace(/-/g, ''));
}

/**
 * Valida formato básico de Cédula Jurídica costarricense
 * Formato: 3-102-645890 (puede ser alfanumérica per Hacienda 4.4)
 */
export function validateJuridicalId(id: string): boolean {
  const cleaned = id.replace(/-/g, '');
  // Permitir 10 caracteres alfanuméricos
  return /^[a-zA-Z0-9]{10}$/.test(cleaned);
}

/**
 * Valida NITE (Número de Identificación Tributaria Especial)
 * Formato: 4 dígitos numéricos
 */
export function validateNite(nite: string): boolean {
  const cleaned = nite.replace(/-/g, '');
  return /^\d{4}$/.test(cleaned);
}

/**
 * Valida identificación genérica según tipo
 * Tipos: 01=Física, 02=Jurídica, 03=DIMEX, 04=NITE
 */
export function validateId(id: string, type: '01' | '02' | '03' | '04'): { valid: boolean; reason?: string } {
  if (!id || id.trim() === '') {
    return { valid: false, reason: 'Identificación vacía' };
  }

  switch (type) {
    case '01':
      if (!validateFisicalId(id)) {
        return { valid: false, reason: 'Cédula física debe tener 1-12 caracteres alfanuméricos' };
      }
      return { valid: true };

    case '02':
      if (!validateJuridicalId(id)) {
        return { valid: false, reason: 'Cédula jurídica debe tener 10 caracteres alfanuméricos' };
      }
      return { valid: true };

    case '03':
      if (!validateDimex(id)) {
        return { valid: false, reason: 'DIMEX inválido: debe ser 12 dígitos con checksum correcto' };
      }
      return { valid: true };

    case '04':
      if (!validateNite(id)) {
        return { valid: false, reason: 'NITE debe ser 4 dígitos numéricos' };
      }
      return { valid: true };

    default:
      return { valid: false, reason: 'Tipo de identificación desconocido' };
  }
}
